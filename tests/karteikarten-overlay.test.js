const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('backend/apps-script/Code.gs', 'utf8');

const HEADER = [
  'KartenID', 'Fach', 'Typ', 'Thema', 'Vorderseite', 'Rueckseite', 'Aktiv', 'Revision'
];
const REVISION = 'WIFA-KK-INHALTE-20260930-FINAL-1';

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function row(id, fach, typ, thema, front, back, aktiv = 'ja', revision = REVISION) {
  return [id, fach, typ, thema, front, back, aktiv, revision];
}

function backend(overlayRows = []) {
  const reads = new Map();
  const cache = new Map();
  const base = {
    Recht: [
      { id: 'R-0001', thema: 'BGB Allgemeiner Teil', frage: 'Basisfrage 1', musterloesung: 'Basisantwort 1' },
      { id: 'R-0002', thema: 'BGB Schuldrecht', frage: 'Basisfrage 2', musterloesung: 'Basisantwort 2' }
    ],
    Steuern: [
      { id: 'ST-0001', thema: 'Grundbegriffe des Steuerrechts', frage: 'Steuerfrage', musterloesung: 'Steuerantwort' }
    ]
  };
  const table = [HEADER, ...overlayRows];
  const overlaySheet = {
    getDataRange: () => ({
      getValues: () => {
        reads.set('Karteikarten_Ergaenzungen', (reads.get('Karteikarten_Ergaenzungen') || 0) + 1);
        return table.map(entry => [...entry]);
      }
    })
  };
  const spreadsheet = {
    getSheetByName: name => name === 'Karteikarten_Ergaenzungen' ? overlaySheet : null,
    getSheets: () => []
  };
  const context = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    CacheService: { getScriptCache: () => ({
      get: key => cache.has(key) ? cache.get(key) : null,
      put: (key, value) => cache.set(key, value),
      remove: key => cache.delete(key)
    }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: value => ({ setMimeType: () => JSON.parse(value) })
    },
    HtmlService: { createHtmlOutputFromFile: () => ({ setTitle: () => ({}) }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.getSpreadsheet_ = () => spreadsheet;
  context.getActiveQuestions = fach => (base[fach] || []).map(card => ({ ...card }));
  context.getFrontendSheetNames = () => Object.keys(base);
  context.__base = base;
  context.__reads = reads;
  context.__cache = cache;
  return context;
}

test('leere Ergänzungstabelle lässt Karten und Trainerthemen unverändert', () => {
  const context = backend();

  assert.deepEqual(plain(context.getKarteikartenTopicsFrontend('Recht')), [
    { thema: 'BGB Allgemeiner Teil', anzahl: 1 },
    { thema: 'BGB Schuldrecht', anzahl: 1 }
  ]);
  assert.deepEqual(plain(context.getKarteikartenFrontend('Recht', '')), [
    { id: 'R-0001', fach: 'Recht', thema: 'BGB Allgemeiner Teil', vorderseite: 'Basisfrage 1', rueckseite: 'Basisantwort 1' },
    { id: 'R-0002', fach: 'Recht', thema: 'BGB Schuldrecht', vorderseite: 'Basisfrage 2', rueckseite: 'Basisantwort 2' }
  ]);
  assert.deepEqual(plain(context.getTopicsForSheet('Recht')), [
    { thema: 'BGB Allgemeiner Teil', anzahl: 1 },
    { thema: 'BGB Schuldrecht', anzahl: 1 }
  ]);
});

test('OVERRIDE ersetzt nur die Karte und lässt die Trainerquelle unangetastet', () => {
  const context = backend([
    row('R-0001', 'Recht', 'OVERRIDE', 'BGB Allgemeiner Teil', 'Neue Vorderseite', 'Neue Rückseite')
  ]);

  const [card] = context.getKarteikartenFrontend('Recht', 'BGB Allgemeiner Teil');
  assert.equal(card.vorderseite, 'Neue Vorderseite');
  assert.equal(card.rueckseite, 'Neue Rückseite');
  assert.equal(context.getActiveQuestions('Recht')[0].frage, 'Basisfrage 1');
  assert.equal(context.getActiveQuestions('Recht')[0].musterloesung, 'Basisantwort 1');
});

test('OVERRIDE nur der Rückseite erbt die unveränderte Vorderseite', () => {
  const context = backend([
    row('R-0001', 'Recht', 'OVERRIDE', 'BGB Allgemeiner Teil', '', 'Nur neue Rückseite')
  ]);

  const [card] = context.getKarteikartenFrontend('Recht', 'BGB Allgemeiner Teil');
  assert.equal(card.vorderseite, 'Basisfrage 1');
  assert.equal(card.rueckseite, 'Nur neue Rückseite');
});

test('NEU erscheint nur im Kartenbestand und verändert keinen Trainerpool', () => {
  const context = backend([
    row('R-0689', 'Recht', 'NEU', 'BGB Allgemeiner Teil', 'Neue Karte', 'Neue Antwort')
  ]);

  const cards = context.getKarteikartenFrontend('Recht', 'BGB Allgemeiner Teil');
  assert.deepEqual(plain(cards.map(card => card.id)), ['R-0001', 'R-0689']);
  assert.deepEqual(plain(context.getActiveQuestions('Recht').map(question => question.id)), ['R-0001', 'R-0002']);
  assert.deepEqual(plain(context.getTopicsForSheet('Recht')), [
    { thema: 'BGB Allgemeiner Teil', anzahl: 1 },
    { thema: 'BGB Schuldrecht', anzahl: 1 }
  ]);
  assert.deepEqual(plain(context.getKarteikartenTopicsFrontend('Recht')), [
    { thema: 'BGB Allgemeiner Teil', anzahl: 2 },
    { thema: 'BGB Schuldrecht', anzahl: 1 }
  ]);
});

test('ungültiger Override und doppelte aktive Ergänzungs-ID enden fail-closed', () => {
  const missingBase = backend([
    row('R-0999', 'Recht', 'OVERRIDE', 'BGB Allgemeiner Teil', 'X', 'Y')
  ]);
  assert.throws(() => missingBase.getKarteikartenFrontend('Recht', ''), /ungültige Karteikarten-Ergänzung/i);

  const duplicate = backend([
    row('R-0001', 'Recht', 'OVERRIDE', 'BGB Allgemeiner Teil', 'X', 'Y'),
    row('R-0001', 'Recht', 'OVERRIDE', 'BGB Allgemeiner Teil', 'X2', 'Y2')
  ]);
  assert.throws(() => duplicate.getKarteikartenFrontend('Recht', ''), /doppelte aktive Karten-ID/i);
});

test('inaktiver Override wird ignoriert', () => {
  const context = backend([
    row('R-0001', 'Recht', 'OVERRIDE', 'BGB Allgemeiner Teil', 'Verwerfen', 'Verwerfen', 'nein')
  ]);

  const [card] = context.getKarteikartenFrontend('Recht', 'BGB Allgemeiner Teil');
  assert.equal(card.vorderseite, 'Basisfrage 1');
  assert.equal(card.rueckseite, 'Basisantwort 1');
});

test('Cache-Miss, Eviction, Korruption und Versionswechsel bleiben sicher', () => {
  const context = backend([
    row('R-0689', 'Recht', 'NEU', 'BGB Allgemeiner Teil', 'Neue Karte', 'Neue Antwort')
  ]);

  context.getKarteikartenFrontend('Recht', '');
  assert.equal(context.__reads.get('Karteikarten_Ergaenzungen'), 1);
  context.getKarteikartenFrontend('Recht', '');
  assert.equal(context.__reads.get('Karteikarten_Ergaenzungen'), 1);

  const key = context.getKarteikartenOverlayCacheKey_(REVISION);
  context.__cache.delete(key);
  context.getKarteikartenFrontend('Recht', '');
  assert.equal(context.__reads.get('Karteikarten_Ergaenzungen'), 2);

  context.__cache.set(key, '{kaputt');
  context.getKarteikartenFrontend('Recht', '');
  assert.equal(context.__reads.get('Karteikarten_Ergaenzungen'), 3);
  assert.notEqual(context.getKarteikartenOverlayCacheKey_(REVISION), context.getKarteikartenOverlayCacheKey_('WIFA-KK-INHALTE-NEU'));
});

