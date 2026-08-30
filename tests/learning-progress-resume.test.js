const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createDomStub() {
  const elements = new Map();
  const buttonState = {};

  function makeElement(id = '') {
    return {
      id,
      hidden: false,
      value: '',
      textContent: '',
      classList: { toggle() {}, add() {}, remove() {} },
      style: {},
      dataset: {},
      disabled: false,
      appendChild() {},
      replaceChildren() {},
      setAttribute() {},
      addEventListener() {},
      querySelectorAll() { return []; },
      querySelector() { return null; },
      getContext() { return { fillRect() {} }; },
      innerHTML: '',
      checked: false,
      focus() {}
    };
  }

  return {
    elements,
    buttonState,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelector(selector) {
      if (selector === 'label[for="antwortInput"]') return null;
      if (selector === 'input[name="quizOption"]') return null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#quizOptionen .quiz-option') return [];
      if (selector === 'input[name="quizOption"]') return [];
      return [];
    },
    createElement() { return makeElement(); },
    addEventListener() {}
  };
}

function loadTrainerScript() {
  const trainerSource = fs.readFileSync(path.join(__dirname, '../js/trainer.js'), 'utf8');
  const context = {
    console,
    window: {},
    document: createDomStub(),
    auth: { currentUser: { uid: 'uid-1' } },
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
    apiGet: async () => ({ success: true, data: null }),
    apiPost: async () => ({ success: true }),
    alert: () => {},
    localStorage: {},
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
  vm.runInContext(trainerSource, context);
  return context;
}

function loadQuizScript() {
  const quizSource = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');

  const context = {
    console,
    window: {},
    document: createDomStub(),
    auth: { currentUser: { uid: 'uid-1', emailVerified: true } },
    currentVerifiedUser: () => ({ uid: 'uid-1', emailVerified: true }),
    quizFach: 'Recht',
    quizShuffleAktiv: false,
    katalog: [
      { quizKey: 'q-1', fach: 'Recht', frageId: 'q-1', thema: 'Vertrag', part: 'WQ' },
      { quizKey: 'q-2', fach: 'Recht', frageId: 'q-2', thema: 'Vertrag', part: 'WQ' },
      { quizKey: 'q-3', fach: 'Recht', frageId: 'q-3', thema: 'Vertrag', part: 'WQ' }
    ],
    rundenReihenfolge: [],
    rundenNummer: 0,
    fragenIndex: 0,
    letzteFrageAlterRunde: null,
    aktuellerKatalogEintrag: null,
    aktuelleFrage: null,
    antwortGespeichert: false,
    letzteAuswahl: null,
    ladeToken: 0,
    quizInteraktionenGebunden: false,
    OPTION_IDS: ['A', 'B', 'C', 'D'],
    MODULE_ID: 'quiz',
    sitzungsStatistik: { richtig: 0, falsch: 0 },
    setQuizButtonsDisabled() {},
    setNaechsteSichtbar() {},
    hideErgebnis() {},
    showErgebnis() {},
    renderFrage() {},
    markiereOptionen() {},
    aktualisiereSitzungsStatistik() {},
    apiGet: async () => ({ success: true, data: null }),
    apiPost: async () => ({ success: true }),
    alert: () => {},
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
  vm.runInContext(quizSource, context);
  return context;
}

const backendSource = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');
const backendContext = {
  console,
  Utilities: { formatDate: () => '' },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '' }) },
  SpreadsheetApp: { getUi: () => ({ alert: () => {} }) },
  ContentService: { createTextOutput: () => ({ setMimeType: () => ({}) }), MimeType: { JSON: 'application/json' } },
  Session: { getScriptTimeZone: () => 'UTC' },
  HtmlService: { createHtmlOutputFromFile: () => ({ setTitle: () => ({}) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-key' }) },
  OPENAI_API_KEY: 'test-key',
  getSpreadsheet_: () => ({ getSheets: () => [], getSheetByName: () => null, insertSheet: () => ({ appendRow: () => {}, getDataRange: () => ({ getValues: () => [] }), getRange: () => ({ getValues: () => [], setValue: () => ({ setBackground: () => ({}) }), clearContent: () => ({ setBackground: () => ({}) }), setBackground: () => ({}) }) }) }),
  getSheetByNameSafe_: () => ({ getLastRow: () => 0, getRange: () => ({ getValues: () => [] }) }),
  getSheet_: () => ({ getActiveCell: () => ({ getRow: () => 3, getColumn: () => 0 }), getRange: () => ({ getValue: () => '', setValue: () => ({ setBackground: () => ({}) }), clearContent: () => ({ setBackground: () => ({}) }), setBackground: () => ({}) }) }),
  JSON,
  Date,
  Math,
  RegExp,
  Array,
  String,
  Object,
  Number,
  Boolean,
  Set,
  Map,
  Error
};
vm.createContext(backendContext);
vm.runInContext(backendSource, backendContext);

test('progress upsert updates existing row and normalizes empty Auswahl to __ALL__', () => {
  const fakeSheet = {
    data: [[ 'Nutzer', 'Bereich', 'Fach', 'Auswahl', 'Letzte Frage-ID', 'Aktualisiert' ], [ 'uid-1', 'trainer', 'Recht', '__ALL__', 'Q-001', new Date('2024-01-01T00:00:00Z') ]],
    getDataRange() {
      return { getValues: () => this.data };
    },
    appendRow(row) {
      this.data.push(row);
    },
    getRange(rowIndex, startCol, numRows, numCols) {
      return {
        setValues(values) {
          const targetRow = rowIndex - 1;
          if (targetRow >= 0 && targetRow < fakeSheet.data.length) {
            fakeSheet.data[targetRow] = values[0];
          }
        }
      };
    }
  };

  backendContext.getSpreadsheet_ = () => ({
    getSheetByName: () => fakeSheet,
    insertSheet: () => fakeSheet
  });

  assert.equal(backendContext.normalizeProgressSelection_('   '), '__ALL__');
  const updated = backendContext.upsertProgressForKey_('uid-1', 'trainer', 'Recht', '', 'Q-999');
  assert.equal(updated.auswahl, '__ALL__');
  assert.equal(updated.letzteFrageId, 'Q-999');
  assert.equal(fakeSheet.data[1][4], 'Q-999');
});

test('missing frageId is rejected in saveProgress', () => {
  assert.throws(() => {
    backendContext.upsertProgressForKey_('uid-1', 'trainer', 'Recht', '__ALL__', '');
  }, /erforderlich|frageId/i);
});

test('stale trainer progress response is ignored when the selected topic changed mid-request', async () => {
  const trainerContext = loadTrainerScript();
  trainerContext.aktuellesFach = 'Recht';
  trainerContext.aktuellesThema = 'Vertrag';

  const deferred = {};
  deferred.promise = new Promise((resolve) => {
    deferred.resolve = resolve;
  });

  const originalLadeFrageAusFach = trainerContext.ladeFrageAusFach;
  const frageLadeAufrufe = [];
  trainerContext.ladeFrageAusFach = (...args) => {
    frageLadeAufrufe.push(args);
    return originalLadeFrageAusFach.apply(trainerContext, args);
  };

  trainerContext.document.getElementById = (id) => {
    if (id === 'themaSelect') {
      return { value: 'Vertrag' };
    }
    if (id === 'frageText') {
      return {
        textContent: '',
        innerHTML: '',
        style: {},
        classList: { add() {}, remove() {} }
      };
    }
    if (id === 'anzeigeThema') {
      return { textContent: '' };
    }
    if (id === 'resultBox') {
      return { style: { display: 'none' } };
    }
    if (id === 'solutionBox') {
      return { style: { display: 'none' } };
    }
    if (id === 'antwortInput') {
      return { value: '', style: { display: 'block' } };
    }
    if (id === 'trainerTippHinweis') {
      return { hidden: true, classList: { add() {}, remove() {}, contains() { return false; } } };
    }
    if (id === 'kilianView') {
      return { classList: { contains() { return false; } } };
    }
    return {
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      classList: { add() {}, remove() {}, contains() { return false; } }
    };
  };

  trainerContext.window.apiGet = async (action, params) => {
    if (action === 'getProgress') {
      assert.equal(params.fach, 'Recht');
      assert.equal(params.auswahl, 'Vertrag');
      return deferred.promise;
    }
    if (action === 'questionById') {
      throw new Error('stale questionById should not run: ' + JSON.stringify(params));
    }
    return { success: true, data: null };
  };

  const startPromise = trainerContext.starteThema();
  await Promise.resolve();

  trainerContext.aktuellesFach = 'Steuern';
  trainerContext.aktuellesThema = 'EStG';

  deferred.resolve({ success: true, data: { letzteFrageId: 'q-stale-a' } });
  await startPromise;

  assert.equal(trainerContext.aktuellesFach, 'Steuern');
  assert.equal(trainerContext.aktuellesThema, 'EStG');
  assert.ok(frageLadeAufrufe.every(([fach, thema]) => !(fach === 'Recht' && thema === 'Vertrag')));
  assert.ok(frageLadeAufrufe.every(([fach, thema, currentId]) => !(fach === 'Recht' && thema === 'Vertrag' && currentId === 'q-stale-a')));
  assert.ok(frageLadeAufrufe.length >= 1);
  assert.equal(frageLadeAufrufe[frageLadeAufrufe.length - 1][0], 'Steuern');
  assert.equal(frageLadeAufrufe[frageLadeAufrufe.length - 1][1], 'EStG');
});

test('Quiz Von vorne restores the first normal question and exits shuffle', async () => {
  const quizContext = loadQuizScript();
  quizContext.katalog = [
    { quizKey: 'q-1', fach: 'Recht', frageId: 'q-1', thema: 'Vertrag', part: 'WQ' },
    { quizKey: 'q-2', fach: 'Recht', frageId: 'q-2', thema: 'Vertrag', part: 'WQ' },
    { quizKey: 'q-3', fach: 'Recht', frageId: 'q-3', thema: 'Vertrag', part: 'WQ' }
  ];
  quizContext.quizFach = 'Recht';
  quizContext.quizShuffleAktiv = true;
  quizContext.rundenReihenfolge = [...quizContext.katalog];
  quizContext.fragenIndex = 2;
  quizContext.aktuellerKatalogEintrag = quizContext.katalog[2];
  quizContext.aktuelleFrage = { frageId: 'q-3', frage: 'Dritte Frage' };
  quizContext.sitzungsStatistik = { richtig: 2, falsch: 1 };

  quizContext.window.apiPost = async (action, payload) => {
    assert.equal(action, 'saveProgress');
    assert.equal(payload.frageId, 'q-1');
    return { success: true };
  };

  await quizContext.quizVonVorne();

  assert.equal(quizContext.quizShuffleAktiv, false);
  assert.equal(quizContext.fragenIndex, 0);
  assert.equal(quizContext.aktuellerKatalogEintrag.quizKey, 'q-1');
  assert.deepEqual(quizContext.sitzungsStatistik, { richtig: 2, falsch: 1 });
});

test('shuffle navigation still does not persist progress while the shuffle flag is active', async () => {
  const quizContext = loadQuizScript();
  quizContext.quizFach = 'Recht';
  quizContext.quizShuffleAktiv = true;
  quizContext.katalog = [
    { quizKey: 'q-1', fach: 'Recht', frageId: 'q-1', thema: 'Vertrag', part: 'WQ' },
    { quizKey: 'q-2', fach: 'Recht', frageId: 'q-2', thema: 'Vertrag', part: 'WQ' }
  ];

  let posted = false;
  quizContext.window.apiPost = async () => {
    posted = true;
    return { success: true };
  };

  const result = await quizContext.speichereQuizFortschritt('q-1');
  assert.equal(result, false);
  assert.equal(posted, false);
});
