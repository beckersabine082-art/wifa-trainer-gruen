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

function loadKilianScript() {
  const source = fs.readFileSync(path.join(__dirname, '../js/wissensdatenbank.js'), 'utf8');
  const elements = new Map();
  const documentListeners = new Map();
  const apiCalls = [];
  const makeElement = (id) => ({
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: { display: 'none' },
    classList: { contains: () => false, add() {}, remove() {} },
    querySelectorAll: () => []
  });
  const context = {
    console,
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, makeElement(id));
        return elements.get(id);
      },
      querySelectorAll: () => [],
      addEventListener(type, listener) {
        const listeners = documentListeners.get(type) || [];
        listeners.push(listener);
        documentListeners.set(type, listeners);
      }
    },
    window: { speechSynthesis: { cancel() {}, speak() {} } },
    apiPost: async (...args) => {
      apiCalls.push(args);
      return { success: true, data: { antwort: 'ok' } };
    },
    formatKilianAntwort: value => value,
    aktuellerTeilbereich: 'WQ',
    aktuellesFach: 'Recht',
    aktuellesThema: 'Vertrag',
    aktuelleFrage: 'Was ist ein Vertrag?',
    aktuelleFrageId: 'Q-001',
    aktuelleKilianBewertung: null,
    Array,
    String,
    Object
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, elements, documentListeners, apiCalls };
}

test('Kilian bubble sends with Enter and keeps Shift+Enter as a line break', async () => {
  const { context, documentListeners, apiCalls } = loadKilianScript();
  const input = context.document.getElementById('kilianBubbleInput');
  const keydown = event => documentListeners.get('keydown').forEach(listener => listener(event));
  input.value = 'Wie funktioniert das?';
  let enterPrevented = false;

  keydown({
    target: input,
    key: 'Enter',
    shiftKey: false,
    preventDefault() { enterPrevented = true; }
  });
  await Promise.resolve();

  assert.equal(enterPrevented, true);
  assert.equal(apiCalls.length, 1);

  let shiftEnterPrevented = false;
  keydown({
    target: input,
    key: 'Enter',
    shiftKey: true,
    preventDefault() { shiftEnterPrevented = true; }
  });

  assert.equal(shiftEnterPrevented, false);
  assert.equal(apiCalls.length, 1);
});

test('Kilian bubble ignores Enter when the input is empty', () => {
  const { context, documentListeners, apiCalls } = loadKilianScript();
  const input = context.document.getElementById('kilianBubbleInput');
  input.value = '   ';
  let prevented = false;

  documentListeners.get('keydown').forEach(listener => listener({
    target: input,
    key: 'Enter',
    shiftKey: false,
    preventDefault() { prevented = true; }
  }));

  assert.equal(prevented, false);
  assert.equal(apiCalls.length, 0);
});

test('Kilian bubble keeps same-question chat and clears it for another question', () => {
  const { context, elements } = loadKilianScript();
  context.kilianBubbleFrageWechseln('Q-001');
  elements.get('kilianBubbleAntwort').textContent = 'Antwort aus Frage A';
  elements.get('kilianBubbleInput').value = 'Rückfrage';

  context.kilianBubbleFrageWechseln('Q-001');
  assert.equal(elements.get('kilianBubbleAntwort').textContent, 'Antwort aus Frage A');
  assert.equal(elements.get('kilianBubbleInput').value, 'Rückfrage');

  context.kilianBubbleFrageWechseln('Q-002');
  assert.equal(elements.get('kilianBubbleAntwort').textContent, 'Hier erscheint Kilians Antwort.');
  assert.equal(elements.get('kilianBubbleInput').value, '');
});

test('Kilian context includes the current question but omits evaluation before grading', () => {
  const { context } = loadKilianScript();
  const before = context.trainerKilianKontext();
  assert.equal(before.frageId, 'Q-001');
  assert.equal(before.fach, 'Recht');
  assert.equal(before.thema, 'Vertrag');
  assert.equal(before.fragetext, 'Was ist ein Vertrag?');
  assert.equal(before.antwort, '');

  context.aktuelleKilianBewertung = {
    musterloesung: 'Eine Einigung.',
    punkte: 1,
    maxPunkte: 2,
    erkannte: ['Einigung'],
    fehlende: ['Willenserklärungen']
  };
  const after = context.trainerKilianKontext();
  assert.equal(after.bewertung.musterloesung, 'Eine Einigung.');
  assert.equal(after.bewertung.punkte, 1);
});

test('Kilian request embeds hidden current-question context for older backends', () => {
  const { context } = loadKilianScript();
  const request = context.trainerKilianAnfrage('Was bedeutet das?');
  assert.match(request, /Was bedeutet das\?/);
  assert.match(request, /Fragen-ID: Q-001/);
  assert.match(request, /Vollständiger Fragetext: Was ist ein Vertrag\?/);
  assert.doesNotMatch(request, /Musterlösung|Bewertung nach Auswertung/);

  context.aktuelleKilianBewertung = { musterloesung: 'Eine Einigung.', punkte: 1 };
  assert.match(context.trainerKilianAnfrage('Warum kein Punkt?'), /Bewertung nach Auswertung/);
  assert.match(context.trainerKilianAnfrage('Warum kein Punkt?'), /Eine Einigung\./);
});

function loadCodeFunctions() {
  const script = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');
  const context = {
    console,
    Object,
    String,
    Array,
    Math,
    RegExp,
    JSON,
    Set,
    Map,
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheets() {
            return [
              { getName() { return 'Recht'; } },
              { getName() { return 'Buchhaltung'; } },
              { getName() { return 'Lerntexte'; } },
              { getName() { return 'Glossar'; } },
              { getName() { return 'NutzerFortschritt'; } }
            ];
          }
        };
      }
    },
    getSheetByNameSafe_() {
      return null;
    },
    PropertiesService: {
      getScriptProperties() {
        return { getProperty() { return 'test-key'; } };
      }
    },
    UrlFetchApp: {
      fetch() {
        return {
          getResponseCode() { return 200; },
          getContentText() {
            return JSON.stringify({ choices: [{ message: { content: 'ok' } }] });
          }
        };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return context;
}

test('Kilian prompt and trainer context reflect the real source constraints', () => {
  const codeSource = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');
  const { context } = loadKilianScript();

  assert.match(codeSource, /keinen Zugriff auf externe Live-Quellen|Websuche|Retrieval-Tools/i);
  assert.match(codeSource, /keine Live-Verifikation|Live-Verifikation/i);
  assert.match(codeSource, /interne WiFa-Trainer-Datenbasis/i);
  assert.match(codeSource, /Prokurist.*§\s*49\s*Abs\.?\s*2\s*HGB|§\s*49\s*Abs\.?\s*2\s*HGB.*Prokurist/i);
  assert.match(codeSource, /Die EZB strebt.*2 %|2 %.*symmetrisch|symmetrisch/i);

  const request = context.trainerKilianAnfrage('Was bedeutet das?');
  assert.match(request, /Fragen-ID: Q-001/);
  assert.match(request, /Fach: Recht/);
  assert.match(request, /Thema: Vertrag/);
  assert.match(request, /Vollständiger Fragetext: Was ist ein Vertrag\?/);
  assert.match(request, /Aktuelle Nutzerantwort: Keine Antwort eingegeben\./);
});

test('internal knowledge ranking prioritizes Prokura, property sales and HGB over unrelated content', () => {
  const context = loadCodeFunctions();
  const candidates = [
    { source: 'Glossar', fach: 'Recht', thema: 'Vertrag', titel: 'Vertrag', text: 'Ein Vertrag ist eine Vereinbarung zwischen zwei Personen.' },
    { source: 'Frage/Musterlösung', fach: 'Recht', thema: 'Prokura', titel: 'Prokura', text: 'Ein Prokurist darf Grundstücke kaufen. Für den Verkauf oder die Belastung eines Grundstücks braucht es besondere Ermächtigung nach § 49 Abs. 2 HGB.' },
    { source: 'Lerntext', fach: 'Buchhaltung', thema: 'Bilanz', titel: 'Bilanz', text: 'Die Bilanz zeigt die Vermögenslage eines Unternehmens.' }
  ];

  const ranked = context.rankInternalKnowledgeMatches_('Darf ein Prokurist Grundstücke verkaufen?', candidates, 'Rechnungswesen', 'Buchführung');

  assert.ok(ranked.length >= 1);
  assert.equal(ranked[0].source, 'Frage/Musterlösung');
  assert.match(ranked[0].text, /Grundstück|§ 49 Abs\. 2 HGB|verkaufen/i);
  assert.equal(ranked.length, 1);
});

test('internal knowledge ranking prioritizes EZB inflation target hits', () => {
  const context = loadCodeFunctions();
  const candidates = [
    { source: 'Lerntext', fach: 'Wirtschaft', thema: 'Geldpolitik', titel: 'Inflation', text: 'Die EZB strebt für den Euroraum eine Inflationsrate von 2 % an. Das Ziel ist symmetrisch.' },
    { source: 'Glossar', fach: 'Wirtschaft', thema: 'Volkswirtschaft', titel: 'Preisniveau', text: 'Preisniveau beschreibt das allgemeine Niveau der Preise.' },
    { source: 'Frage/Musterlösung', fach: 'Recht', thema: 'Vertrag', titel: 'Vertrag', text: 'Ein Vertrag ist eine Willenserklärung.' }
  ];

  const ranked = context.rankInternalKnowledgeMatches_('Wie hoch ist das Inflationsziel der EZB?', candidates, 'Wirtschaft', 'Geldpolitik');

  assert.equal(ranked[0].source, 'Lerntext');
  assert.match(ranked[0].text, /EZB|2 %|symmetrisch/i);
});

test('internal knowledge ranking finds BCG matrix content even if current screen context is unrelated', () => {
  const context = loadCodeFunctions();
  const candidates = [
    { source: 'Frage/Musterlösung', fach: 'Unternehmensführung', thema: 'Portfolio', titel: 'BCG-Matrix', text: 'Die BCG-Matrix bewertet Produkte nach Marktwachstum und relativer Marktanteil.' },
    { source: 'Glossar', fach: 'Recht', thema: 'Gesellschaftsrecht', titel: 'Gesellschaft', text: 'Eine Gesellschaft ist eine rechtliche Personenvereinigung.' }
  ];

  const ranked = context.rankInternalKnowledgeMatches_('Was ist die BCG-Matrix?', candidates, 'Rechnungswesen', 'Buchführung');

  assert.equal(ranked[0].source, 'Frage/Musterlösung');
  assert.match(ranked[0].text, /BCG|Marktwachstum|Marktanteil/i);
});

test('internal knowledge search ignores unrelated current-fach bias when the question is clearly different', () => {
  const context = loadCodeFunctions();
  const candidates = [
    { source: 'Frage/Musterlösung', fach: 'Rechnungswesen', thema: 'Bilanz', titel: 'Bilanz', text: 'Die Bilanz zeigt Vermögen und Schulden.' },
    { source: 'Frage/Musterlösung', fach: 'Recht', thema: 'Prokura', titel: 'Prokura', text: 'Ein Prokurist darf im Namen des Unternehmens Grundstücke kaufen; der Verkauf bedarf besonderer Ermächtigung nach § 49 Abs. 2 HGB.' }
  ];

  const ranked = context.rankInternalKnowledgeMatches_('Darf ein Prokurist Grundstücke verkaufen?', candidates, 'Rechnungswesen', 'Bilanz');

  assert.equal(ranked[0].fach, 'Recht');
  assert.match(ranked[0].text, /Prokurist|§ 49 Abs\. 2 HGB/i);
});

test('internal knowledge search returns empty context when nothing matches', () => {
  const context = loadCodeFunctions();
  const candidates = [
    { source: 'Glossar', fach: 'Recht', thema: 'Vertrag', titel: 'Vertrag', text: 'Ein Vertrag ist eine Vereinbarung.' },
    { source: 'Lerntext', fach: 'Buchhaltung', thema: 'Bilanz', titel: 'Bilanz', text: 'Die Bilanz zeigt Vermögen und Schulden.' }
  ];

  const ranked = context.rankInternalKnowledgeMatches_('Wie funktioniert ein Warp-Antrieb bei einem Raumschiff?', candidates, 'Recht', 'Vertrag');

  assert.equal(ranked.length, 0);
});

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

function setQuizState(context, patch) {
  context.__quizStatePatch = patch;

  vm.runInContext(`
    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'katalog')) {
      katalog = __quizStatePatch.katalog;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'rundenReihenfolge')) {
      rundenReihenfolge = __quizStatePatch.rundenReihenfolge;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'rundenNummer')) {
      rundenNummer = __quizStatePatch.rundenNummer;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'fragenIndex')) {
      fragenIndex = __quizStatePatch.fragenIndex;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'letzteFrageAlterRunde')) {
      letzteFrageAlterRunde = __quizStatePatch.letzteFrageAlterRunde;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'aktuellerKatalogEintrag')) {
      aktuellerKatalogEintrag = __quizStatePatch.aktuellerKatalogEintrag;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'aktuelleFrage')) {
      aktuelleFrage = __quizStatePatch.aktuelleFrage;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'antwortGespeichert')) {
      antwortGespeichert = __quizStatePatch.antwortGespeichert;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'letzteAuswahl')) {
      letzteAuswahl = __quizStatePatch.letzteAuswahl;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'ladeToken')) {
      ladeToken = __quizStatePatch.ladeToken;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'quizFach')) {
      quizFach = __quizStatePatch.quizFach;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'quizShuffleAktiv')) {
      quizShuffleAktiv = __quizStatePatch.quizShuffleAktiv;
    }

    if (Object.prototype.hasOwnProperty.call(__quizStatePatch, 'sitzungsStatistik')) {
      sitzungsStatistik.richtig = __quizStatePatch.sitzungsStatistik.richtig;
      sitzungsStatistik.falsch = __quizStatePatch.sitzungsStatistik.falsch;
    }
  `, context);

  delete context.__quizStatePatch;
}

function getQuizState(context) {
  return vm.runInContext(`
    ({
      katalog,
      rundenReihenfolge,
      rundenNummer,
      fragenIndex,
      letzteFrageAlterRunde,
      aktuellerKatalogEintrag,
      aktuelleFrage,
      antwortGespeichert,
      letzteAuswahl,
      ladeToken,
      quizFach,
      quizShuffleAktiv,
      sitzungsStatistik: {
        richtig: sitzungsStatistik.richtig,
        falsch: sitzungsStatistik.falsch
      }
    })
  `, context);
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
  const katalog = [
    { quizKey: 'q-1', fach: 'Recht', frageId: 'q-1', thema: 'Vertrag', part: 'WQ' },
    { quizKey: 'q-2', fach: 'Recht', frageId: 'q-2', thema: 'Vertrag', part: 'WQ' },
    { quizKey: 'q-3', fach: 'Recht', frageId: 'q-3', thema: 'Vertrag', part: 'WQ' }
  ];
  setQuizState(quizContext, {
    katalog,
    quizFach: 'Recht',
    quizShuffleAktiv: true,
    rundenReihenfolge: [...katalog],
    fragenIndex: 2,
    aktuellerKatalogEintrag: katalog[2],
    aktuelleFrage: { frageId: 'q-3', frage: 'Dritte Frage' },
    sitzungsStatistik: { richtig: 2, falsch: 1 }
  });

  quizContext.window.apiPost = async (action, payload) => {
    assert.equal(action, 'saveProgress');
    assert.equal(payload.frageId, 'q-1');
    return { success: true };
  };

  await quizContext.quizVonVorne();

  const state = getQuizState(quizContext);
  assert.equal(state.quizShuffleAktiv, false);
  assert.equal(state.fragenIndex, 0);
  assert.equal(state.aktuellerKatalogEintrag.quizKey, 'q-1');
  assert.equal(state.sitzungsStatistik.richtig, 2);
  assert.equal(state.sitzungsStatistik.falsch, 1);
});

test('shuffle navigation still does not persist progress while the shuffle flag is active', async () => {
  const quizContext = loadQuizScript();
  const katalog = [
    { quizKey: 'q-1', fach: 'Recht', frageId: 'q-1', thema: 'Vertrag', part: 'WQ' },
    { quizKey: 'q-2', fach: 'Recht', frageId: 'q-2', thema: 'Vertrag', part: 'WQ' }
  ];
  setQuizState(quizContext, {
    quizFach: 'Recht',
    quizShuffleAktiv: true,
    katalog
  });

  let posted = false;
  quizContext.window.apiPost = async () => {
    posted = true;
    return { success: true };
  };

  const result = await quizContext.speichereQuizFortschritt('q-1');
  assert.equal(result, false);
  assert.equal(posted, false);
});
