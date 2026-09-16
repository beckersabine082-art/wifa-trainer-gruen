const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadQuiz() {
  const source = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');
  const elements = new Map();
  const makeElement = id => ({
    id, hidden: false, textContent: '', disabled: false, dataset: {}, innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} }, appendChild() {},
    replaceChildren() {}, addEventListener() {}
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement() { return makeElement(''); }
  };
  const context = {
    console,
    window: {},
    document,
    auth: { currentUser: { uid: 'u1', emailVerified: true } },
    Array, String, Math, Date, Object, Boolean, Number, RegExp, Error, Map, Set,
    setTimeout, clearTimeout
  };
  context.window = context;
  context.window.QUIZ_REQUEST_TIMEOUT_MS = 20;
  vm.createContext(context);
  vm.runInContext(source, context);
  vm.runInContext(`
    katalog = [{ quizKey: 'q-1', fach: 'Marketing', frageId: 'q-1', thema: 'T' }];
    rundenReihenfolge = katalog;
    fragenIndex = 0;
  `, context);
  return context;
}

function call(context, expression) {
  return vm.runInContext(expression, context);
}

test('zeigt die nächste Frage, ohne auf saveProgress zu warten', async () => {
  const context = loadQuiz();
  let resolveSave;
  context.window.apiGet = async () => ({
    success: true,
    data: { frageId: 'q-1', fach: 'Marketing', frage: 'Neue Frage', antworten: [] }
  });
  context.window.apiPost = () => new Promise(resolve => { resolveSave = resolve; });

  const loading = call(context, 'zeigeAktuelleFrage()');
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(context.document.getElementById('quizKarte').hidden, false);
  assert.equal(context.document.getElementById('quizStatus').textContent, '');
  resolveSave({ success: true });
  await loading;
});

test('beendet den Ladezustand mit Fehlermeldung bei hängendem quizQuestion', async () => {
  const context = loadQuiz();
  context.window.apiGet = () => new Promise(() => {});

  await call(context, 'zeigeAktuelleFrage()');

  assert.equal(context.document.getElementById('quizKarte').hidden, true);
  assert.match(context.document.getElementById('quizStatus').textContent, /nicht geladen|Zeitüberschreitung/i);
});

test('ein hängendes saveProgress hält die bereits angezeigte Frage nicht zurück', async () => {
  const context = loadQuiz();
  context.window.apiGet = async () => ({
    success: true,
    data: { frageId: 'q-1', fach: 'Marketing', frage: 'Neue Frage', antworten: [] }
  });
  context.window.apiPost = () => new Promise(() => {});

  await call(context, 'zeigeAktuelleFrage()');

  assert.equal(context.document.getElementById('quizKarte').hidden, false);
  assert.equal(context.document.getElementById('quizStatus').textContent, '');
});
