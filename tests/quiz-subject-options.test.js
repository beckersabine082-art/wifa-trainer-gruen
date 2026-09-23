const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function initialQuizOptions() {
  const select = indexHtml.match(/<select id="quizModus">([\s\S]*?)<\/select>/);
  assert.ok(select, 'Quiz-Fachauswahl ist in index.html vorhanden');
  return Array.from(select[1].matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g), match => ({
    value: match[1],
    text: match[2].replace(/<[^>]*>/g, '').trim()
  }));
}

function createSelect(options) {
  let value = '';
  return {
    children: options.map(option => ({ ...option })),
    get options() { return this.children; },
    addEventListener() {},
    replaceChildren(...children) {
      this.children = children;
      if (!children.some(option => option.value === value)) value = children[0]?.value || '';
    },
    get value() { return value; },
    set value(nextValue) {
      value = this.children.some(option => option.value === String(nextValue))
        ? String(nextValue)
        : (this.children[0]?.value || '');
    }
  };
}

function loadQuiz() {
  const source = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');
  const elements = new Map();
  const modus = createSelect(initialQuizOptions());
  const difficulty = { value: 'Einsteiger', checked: false, addEventListener() {} };
  const makeElement = id => ({
    id, hidden: false, textContent: '', disabled: false, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener() {},
    set innerHTML(value) { this.children = []; }
  });
  const document = {
    getElementById(id) {
      if (id === 'quizModus') return modus;
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="quizSchwierigkeitsgrad"]') return [difficulty];
      return [];
    },
    createElement(tagName) { return makeElement(tagName); }
  };
  let resolveCatalog;
  const catalogRequest = new Promise(resolve => { resolveCatalog = resolve; });
  const calls = [];
  const context = {
    console: { info() {}, warn() {}, error() {} },
    window: {}, document, Option: function Option(text, value) { this.text = text; this.textContent = text; this.value = value; },
    auth: { currentUser: { uid: 'user-1', emailVerified: true } },
    Array, String, Math, Date, Object, Boolean, Number, RegExp, Map, Set, Error,
    setTimeout, clearTimeout,
    apiPlaceholder: null
  };
  context.window = context;
  context.window.QUIZ_REQUEST_TIMEOUT_MS = 1000;
  context.window.QUIZ_PROGRESS_TIMEOUT_MS = 1000;
  context.window.apiGet = (action, params) => {
    calls.push({ action, params });
    if (action === 'quizCatalog') return catalogRequest;
    if (action === 'getProgress') return Promise.resolve({ success: false, data: null });
    if (action === 'quizQuestion') return Promise.resolve({
      success: true,
      data: { frageId: 'q-1', quizKey: 'Marketing::q-1', fach: 'Marketing', frage: 'Frage', antworten: [] }
    });
    return Promise.resolve({ success: false });
  };
  context.window.apiPost = async () => ({ success: true });
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, modus, difficulty, calls, resolveCatalog };
}

test('Quiz-Dropdown zeigt die festen Fächer schon im HTML-Startzustand alphabetisch', () => {
  assert.deepEqual(initialQuizOptions(), [
    { value: '', text: '🎲 Alle Fächer – Zufallsmix' },
    { value: 'Betriebliches Management', text: 'Betriebliches Management' },
    { value: 'Betriebliches Rechnungswesen und Controlling', text: 'Betriebliches Rechnungswesen und Controlling' },
    { value: 'BWL', text: 'BWL' },
    { value: 'Führung und Zusammenarbeit', text: 'Führung und Zusammenarbeit' },
    { value: 'Investition und Finanzierung', text: 'Investition und Finanzierung' },
    { value: 'Logistik', text: 'Logistik' },
    { value: 'Marketing', text: 'Marketing' },
    { value: 'Rechnungswesen', text: 'Rechnungswesen' },
    { value: 'Recht', text: 'Recht' },
    { value: 'Steuern', text: 'Steuern' },
    { value: 'Unternehmensführung', text: 'Unternehmensführung' },
    { value: 'Vertrieb', text: 'Vertrieb' },
    { value: 'VWL', text: 'VWL' }
  ]);
});

test('Katalogabgleich ergänzt neue Fächer ohne Duplikate und erhält die Auswahl', () => {
  const { context, modus } = loadQuiz();
  modus.value = 'Marketing';
  vm.runInContext(`katalog = [
    { quizKey: 'q-1', frageId: 'q-1', fach: 'Marketing' },
    { quizKey: 'q-2', frageId: 'q-2', fach: 'BWL' },
    { quizKey: 'q-3', frageId: 'q-3', fach: 'Zusatzfach' },
    { quizKey: 'q-4', frageId: 'q-4', fach: 'Zusatzfach' }
  ]; befuelleQuizModus();`, context);

  const values = modus.children.map(option => option.value);
  assert.deepEqual(values, [
    '', 'Betriebliches Management', 'Betriebliches Rechnungswesen und Controlling', 'BWL',
    'Führung und Zusammenarbeit', 'Investition und Finanzierung', 'Logistik', 'Marketing',
    'Rechnungswesen', 'Recht', 'Steuern', 'Unternehmensführung', 'Vertrieb', 'VWL', 'Zusatzfach'
  ]);
  assert.equal(new Set(values).size, values.length);
  assert.equal(modus.value, 'Marketing');
});

test('Fach- und Schwierigkeitsauswahl während des Katalogladens wird danach normal verarbeitet', async () => {
  const { context, modus, difficulty, calls, resolveCatalog } = loadQuiz();
  const loading = context.initialisiereQuiz();

  modus.value = 'Marketing';
  context.wechsleQuizmodus({ target: modus });
  difficulty.checked = true;
  context.wechsleQuizSchwierigkeitsgrad({ target: difficulty });

  assert.equal(calls.some(call => call.action === 'quizQuestion'), false);
  assert.doesNotMatch(context.document.getElementById('quizStatus').textContent, /keine aktiven Fragen/i);

  resolveCatalog({
    success: true,
    data: [{ quizKey: 'Marketing::q-1', frageId: 'q-1', fach: 'Marketing', schwierigkeitsgrad: 'Einsteiger' }]
  });
  await loading;

  const questionCall = calls.find(call => call.action === 'quizQuestion');
  assert.ok(questionCall, 'Frage wird nach dem Katalogladen angefordert');
  assert.equal(questionCall.params.fach, 'Marketing');
  assert.equal(questionCall.params.schwierigkeitsgrad, 'Einsteiger');
  assert.equal(modus.value, 'Marketing');
});
