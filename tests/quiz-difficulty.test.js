const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function backendContext() {
  const rows = ['Einsteiger', 'Fortgeschritten', 'Profi', 'Einsteiger'].map((level, index) => [
    `Marketing::m-${index + 1}`, 'Marketing', `m-${index + 1}`, 'A1', 'B1', 'C1', 'D1', 'C',
    index === 3 ? '' : 'Ja', 'date', `Frage ${index + 1}`, 'Ja', '', level
  ]);
  const context = {
    console,
    getQuizSheet_: () => ({
      getLastRow: () => rows.length + 1,
      getRange: () => ({ getValues: () => rows })
    }),
    getQuizKey_: (fach, id) => `${fach}::${id}`,
    getSubjectMetadataMap_: () => ({}),
    Array, String, Number, Object, Math
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../backend/apps-script/Quiz.gs'), 'utf8'), context);
  return context;
}

test('quizQuestion liefert bei jeder Stufe ausschließlich eine passend aktive Frage', () => {
  const context = backendContext();
  const levelRows = [['Einsteiger', 'm-1'], ['Fortgeschritten', 'm-2'], ['Profi', 'm-3']];
  for (const [level, id] of levelRows) {
    const result = context.getQuizQuestionFrontend('Marketing', id, level);
    assert.equal(result.frageId, id);
    for (const [otherLevel] of levelRows.filter(([otherLevel]) => otherLevel !== level)) {
      assert.throws(() => context.getQuizQuestionFrontend('Marketing', id, otherLevel), /Schwierigkeitsstufe/);
    }
  }
  assert.deepEqual(Array.from(context.getStaticQuizEntries_(), entry => entry.frageId), ['m-1', 'm-2', 'm-3']);
});

test('quizQuestion-Aufruf ohne Schwierigkeitsparameter behält den bisherigen Abruf bei', () => {
  const context = backendContext();
  assert.equal(context.getQuizQuestionFrontend('Marketing', 'm-1').frage, 'Frage 1');
});

test('Quiz-Frontend sendet die ausgewählte Schwierigkeit an quizQuestion', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');
  const context = {
    console, window: {}, document: { getElementById: () => null },
    auth: { currentUser: { uid: 'u1', emailVerified: true } },
    Array, String, Math, Date, Object, Boolean, Number, RegExp, Map, Set, Error,
    setTimeout, clearTimeout
  };
  context.window = context;
  context.window.apiGet = async (action, params) => ({ success: true, action, params });
  vm.createContext(context);
  vm.runInContext(source, context);
  const result = await context.quizQuestionMitDiagnose('Marketing', 'm-1', 'Fortgeschritten');
  assert.equal(result.action, 'quizQuestion');
  assert.equal(result.params.schwierigkeitsgrad, 'Fortgeschritten');
});

test('Antworten werden pro Render gemischt und behalten ihre Original-ID zur Auswertung', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');
  const elements = new Map();
  const makeElement = () => ({ dataset: {}, children: [], appendChild(child) { this.children.push(child); }, classList: { add() {}, remove() {}, toggle() {} } });
  const container = makeElement();
  const document = {
    getElementById(id) {
      if (id === 'quizOptionen') return container;
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    createElement: makeElement
  };
  const context = { console, window: {}, document, Array, String, Math: Object.create(Math), Date, Object, Boolean, Number, RegExp, Map, Set, Error, setTimeout, clearTimeout };
  context.Math.random = () => 0;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  vm.runInContext(`aktuelleFrage = {
    frageId: 'm-1', quizKey: 'Marketing::m-1', fach: 'Marketing', frage: 'Q', richtigeOption: 'C',
    antworten: [{id:'A',text:'Alpha'}, {id:'B',text:'Beta'}, {id:'C',text:'Gamma'}, {id:'D',text:'Delta'}]
  }`, context);

  context.renderFrage();
  const first = container.children.map(label => ({ id: label.dataset.optionId, text: label.children[2].textContent, position: label.children[1].textContent, value: label.children[0].value }));
  container.children = [];
  context.renderFrage();
  const second = container.children.map(label => ({ id: label.dataset.optionId, text: label.children[2].textContent, position: label.children[1].textContent, value: label.children[0].value }));

  assert.notDeepEqual(first.map(option => option.id), second.map(option => option.id));
  const correct = second.find(option => option.id === 'C');
  assert.equal(correct.text, 'Gamma');
  assert.equal(correct.value, 'C');
  assert.equal(second.find(option => option.position === 'A').id, second[0].id);
});
