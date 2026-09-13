const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBackendNavigation() {
  const source = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');
  const context = {
    console,
    String,
    Array,
    Math,
    Object,
    PropertiesService: {
      getScriptProperties() {
        return { getProperty() { return ''; } };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const questions = Array.from({ length: 83 }, (_, index) => ({
    id: `Q${index + 1}`,
    thema: 'Vertrag',
    frage: `Frage ${index + 1}`,
    musterloesung: '',
    stichpunkte: '',
    fragetyp: 'TEXT',
    aufgabenHtml: '',
    loesungsschluessel: '',
    bilddatei: ''
  }));
  context.getActiveQuestions = () => questions;
  context.filterQuestionsByThema_ = (items, thema) => items.filter(question => question.thema === thema);
  return context;
}

function loadTrainerWithQuestions() {
  const source = fs.readFileSync(path.join(__dirname, '../js/trainer.js'), 'utf8');
  const elements = new Map();
  const questions = Array.from({ length: 83 }, (_, index) => ({
    id: `Q${index + 1}`,
    frage: `Frage ${index + 1}`,
    thema: 'Vertrag',
    musterloesung: '',
    stichpunkte: '',
    fragetyp: 'TEXT',
    fragePosition: index + 1,
    frageGesamt: 83
  }));
  const apiCalls = [];

  function makeElement(id) {
    return {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      dataset: {},
      disabled: false,
      hidden: false,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      appendChild() {},
      querySelectorAll() { return []; },
      setAttribute() {},
      addEventListener() {},
      getContext() { return { clearRect() {} }; }
    };
  }

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeElement('created'); },
    addEventListener() {}
  };

  const apiGet = async (action, params) => {
    apiCalls.push({ action, params });
    if (action === 'firstQuestion') return { success: true, data: questions[0] };
    if (action === 'nextQuestion') {
      const currentIndex = questions.findIndex(question => question.id === params.currentId);
      return { success: true, data: questions[currentIndex + 1 < questions.length ? currentIndex + 1 : 0] };
    }
    if (action === 'questionById') {
      return { success: true, data: questions.find(question => question.id === params.frageId) };
    }
    if (action === 'previousQuestion') {
      const currentIndex = questions.findIndex(question => question.id === params.currentId);
      const previousIndex = currentIndex <= 0 ? questions.length - 1 : currentIndex - 1;
      return { success: true, data: questions[previousIndex] };
    }
    return { success: true, data: null };
  };

  const context = {
    console,
    window: {},
    document,
    auth: { currentUser: null },
    appIstBeschaeftigt: false,
    aktuellerTeilbereich: 'WQ',
    aktuellesFach: 'Recht',
    aktuellesThema: 'Vertrag',
    aktuelleFrageId: '',
    aktuelleFrage: null,
    aktuelleMusterloesung: '',
    aktuelleStichpunkte: [],
    faecherNachTeilbereich: { WQ: ['Recht'], HQ: [] },
    ladeToken: 0,
    setzeStatus() {},
    setzeAppBeschaeftigt() {},
    resetFrageAnzeige() {},
    updateStatAnzeige() {},
    apiGet,
    apiPost: async () => ({ success: true }),
    alert() {},
    localStorage: {},
    escapeHtml(value) { return String(value || ''); },
    loescheSkizze() {},
    kilianBubbleFrageWechseln() {},
    setTimeout,
    clearTimeout,
    Array,
    String,
    Math,
    Date,
    Object,
    Boolean,
    Number,
    RegExp,
    Error
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);

  return { context, elements, questions, apiCalls };
}

function trainerState(context) {
  return vm.runInContext(`({
    frageId: aktuelleFrageId,
    index: trainerVerlaufIndex,
    verlauf: trainerFragenVerlauf.slice()
  })`, context);
}

test('backend previousQuestion follows the filtered order and wraps from first to last', () => {
  const context = loadBackendNavigation();
  assert.equal(context.getNextQuestion('Recht', 'Vertrag', 'Q82').id, 'Q83');
  assert.equal(context.getNextQuestion('Recht', 'Vertrag', 'Q83').id, 'Q1');
  assert.equal(context.getNextQuestion('Recht', 'Vertrag', 'Q1').id, 'Q2');
  assert.equal(context.getPreviousQuestion('Recht', 'Vertrag', 'Q34').id, 'Q33');
  assert.equal(context.getPreviousQuestion('Recht', 'Vertrag', 'Q33').id, 'Q32');
  assert.equal(context.getPreviousQuestion('Recht', 'Vertrag', 'Q2').id, 'Q1');
  assert.equal(context.getPreviousQuestion('Recht', 'Vertrag', 'Q1').id, 'Q83');
  assert.equal(context.getPreviousQuestion('Recht', 'Vertrag', 'missing').navigationFehler, true);
});

test('normal trainer navigates 34 to 33 to 32 and forward again without answers', async () => {
  const { context, elements, questions, apiCalls } = loadTrainerWithQuestions();

  context.zeigeGeladeneFrage(questions[33], 'Vertrag');
  await new Promise(resolve => setTimeout(resolve, 0));

  let state = trainerState(context);
  assert.equal(state.frageId, 'Q34');
  assert.equal(elements.get('btnVorherigeFrage').disabled, false);

  context.vorherigeFrage();
  await new Promise(resolve => setTimeout(resolve, 0));
  state = trainerState(context);
  assert.equal(state.frageId, 'Q33');
  assert.equal(elements.get('antwortInput').value, '');

  context.vorherigeFrage();
  await new Promise(resolve => setTimeout(resolve, 0));
  state = trainerState(context);
  assert.equal(state.frageId, 'Q32');

  context.naechsteFrage();
  await new Promise(resolve => setTimeout(resolve, 0));
  state = trainerState(context);
  assert.equal(state.frageId, 'Q33');

  context.naechsteFrage();
  await new Promise(resolve => setTimeout(resolve, 0));
  state = trainerState(context);
  assert.equal(state.frageId, 'Q34');
  assert.equal(apiCalls.some(call => call.action === 'bewerteAntwort'), false);

  context.zeigeGeladeneFrage(questions[0], 'Vertrag');
  await new Promise(resolve => setTimeout(resolve, 0));
  context.vorherigeFrage();
  await new Promise(resolve => setTimeout(resolve, 0));
  state = trainerState(context);
  assert.equal(state.frageId, 'Q83');

  context.naechsteFrage();
  await new Promise(resolve => setTimeout(resolve, 0));
  state = trainerState(context);
  assert.equal(state.frageId, 'Q1');
});

test('shuffle keeps seenIds separate from history and rejects stale forward branches after backtracking', () => {
  const { context } = loadTrainerWithQuestions();
  context.trainerShuffleAktiv = true;
  context.trainerShuffleSeenIds = new Set(['Q1', 'Q2', 'Q3', 'Q4']);
  context.trainerShuffleHistory = ['Q1', 'Q2', 'Q3', 'Q4'];
  context.trainerShuffleHistoryIndex = 3;
  context.trainerFragenVerlauf = ['Q1', 'Q2', 'Q3', 'Q4'];
  context.trainerVerlaufIndex = 3;
  context.trainerShufflePool = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
  context.trainerFragenCache = new Map([
    ['Q1', { id: 'Q1', frage: 'Q1', thema: 'Vertrag' }],
    ['Q2', { id: 'Q2', frage: 'Q2', thema: 'Vertrag' }],
    ['Q3', { id: 'Q3', frage: 'Q3', thema: 'Vertrag' }],
    ['Q4', { id: 'Q4', frage: 'Q4', thema: 'Vertrag' }],
    ['Q5', { id: 'Q5', frage: 'Q5', thema: 'Vertrag' }],
    ['Q6', { id: 'Q6', frage: 'Q6', thema: 'Vertrag' }]
  ]);
  context.aktuelleFrageId = 'Q4';
  context.aktuellesThema = 'Vertrag';

  context.trainerShuffleSeenIds = new Set(['Q1', 'Q2', 'Q3']);
  context.trainerShuffleHistory = ['Q1', 'Q2', 'Q3'];
  context.trainerShuffleHistoryIndex = 2;
  context.trainerFragenVerlauf = ['Q1', 'Q2', 'Q3'];
  context.trainerVerlaufIndex = 2;
  context.aktuelleFrageId = 'Q3';

  const afterBack = context.trainerShuffleNaechsteFrage();
  assert.ok(afterBack);
  assert.notEqual(afterBack.id, 'Q4');
  assert.ok(context.trainerShuffleSeenIds.has(afterBack.id));
  assert.ok(context.trainerShuffleHistory.includes(afterBack.id));
  assert.equal(context.trainerShuffleHistory.length, 4);
  assert.deepEqual(context.trainerShuffleHistory.slice(0, 3), ['Q1', 'Q2', 'Q3']);
  assert.equal(context.trainerShuffleHistory[3], afterBack.id);
});

test('shuffle activation loads one topic pool and starts with a single unseen question', async () => {
  const { context, questions } = loadTrainerWithQuestions();
  const calls = [];

  context.aktuellesFach = 'Recht';
  context.aktuellesThema = 'Vertrag';
  context.trainerShuffleAktiv = false;
  context.apiGet = async (action, params) => {
    calls.push({ action, params });
    if (action === 'questionsForTopic') {
      return { success: true, data: questions.map(question => ({ ...question, thema: 'Vertrag' })) };
    }
    return { success: true, data: null };
  };

  await context.trainerShuffleMix();

  assert.equal(calls.filter(call => call.action === 'questionsForTopic').length, 1);
  assert.equal(context.trainerShufflePool.length, 83);
  assert.equal(new Set(context.trainerShufflePool).size, 83);
  assert.equal(context.trainerShuffleSeenIds.size, 1);
  assert.equal(context.trainerShuffleHistory.length, 1);
  assert.equal(context.trainerShuffleAktiv, true);
});
