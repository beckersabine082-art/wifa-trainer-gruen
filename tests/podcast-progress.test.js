const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../backend/apps-script/Code.gs'),
  'utf8'
);

function createSheet(name, rows = []) {
  return {
    name,
    rows,
    getName() {
      return this.name;
    },
    appendRow(row) {
      this.rows.push(row.slice());
    },
    getDataRange() {
      return { getValues: () => this.rows.map((row) => row.slice()) };
    },
    getRange(rowIndex, column, rowCount, columnCount) {
      const thisSheet = this;
      return {
        setValues(values) {
          for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
            thisSheet.rows[rowIndex - 1 + rowOffset] = values[rowOffset].slice(0, columnCount);
          }
        }
      };
    }
  };
}

function createBackend() {
  const sheets = new Map();
  let responseValue;
  const spreadsheet = {
    getSheetByName(name) {
      return sheets.get(name) || null;
    },
    getSheets() {
      return [...sheets.values()];
    },
    insertSheet(name) {
      const sheet = createSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };

  const context = {
    console,
    Date,
    JSON,
    Math,
    RegExp,
    Array,
    String,
    Object,
    Boolean,
    Number,
    Set,
    Map,
    Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, getUi: () => ({ alert() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(value) {
        responseValue = value;
        return { setMimeType() { return this; } };
      }
    },
    HtmlService: { createHtmlOutputFromFile: () => ({ setTitle: () => ({}) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-key' }) },
    Session: { getScriptTimeZone: () => 'UTC' },
    Utilities: { formatDate: () => '' },
    UrlFetchApp: { fetch: () => ({}) }
  };

  vm.createContext(context);
  vm.runInContext(source, context);

  return {
    context,
    sheets,
    spreadsheet,
    response(action, params = {}) {
      const result = action === 'get'
        ? context.doGet({ parameter: params })
        : context.doPost({ postData: { contents: JSON.stringify(params) } });
      assert.ok(result);
      return JSON.parse(responseValue);
    }
  };
}

function validState(overrides = {}) {
  return {
    nutzer: 'uid-1',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3',
    lerntextHash: 'hash-v1',
    sekundenPosition: 12.5,
    wortIndex: 4,
    completed: false,
    ...overrides
  };
}

test('PodcastFortschritt sheet, header, filtering, upsert and validation', () => {
  const backend = createBackend();
  const { context, sheets } = backend;
  const header = [
    'Nutzer', 'Fach', 'Einheit', 'FirebasePfad', 'LerntextHash',
    'SekundenPosition', 'WortIndex', 'Completed', 'Aktualisiert'
  ];

  const sheet = context.ensurePodcastFortschrittSheet_();
  assert.equal(sheet.getName(), 'PodcastFortschritt');
  assert.equal(JSON.stringify(sheet.rows[0]), JSON.stringify(header));
  assert.strictEqual(context.ensurePodcastFortschrittSheet_(), sheet);
  assert.equal(sheets.size, 1);

  assert.equal(JSON.stringify(context.getPodcastProgress('uid-1', 'Recht')), '[]');
  assert.throws(() => context.getPodcastProgress('', 'Recht'), /Nutzer.*erforderlich/i);
  assert.throws(() => context.getPodcastProgress('uid-1', ''), /Fach.*erforderlich/i);

  const first = context.savePodcastProgress(validState());
  assert.equal(first.nutzer, 'uid-1');
  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.rows[1][4], 'hash-v1');
  assert.equal(sheet.rows[1][5], 12.5);
  assert.equal(sheet.rows[1][6], 4);
  assert.strictEqual(sheet.rows[1][7], false);
  assert.ok(sheet.rows[1][8] instanceof Date);

  context.savePodcastProgress(validState({ lerntextHash: 'hash-v2', sekundenPosition: 99.25, wortIndex: 8, completed: true }));
  assert.equal(sheet.rows.length, 2);
  assert.equal(JSON.stringify(context.getPodcastProgress('uid-1', 'Recht')), JSON.stringify([{
    nutzer: 'uid-1', fach: 'Recht', einheit: 'Rechtssubjekte',
    firebasePfad: validState().firebasePfad, lerntextHash: 'hash-v2',
    sekundenPosition: 99.25, wortIndex: 8, completed: true,
    aktualisiert: sheet.rows[1][8]
  }]));

  context.savePodcastProgress(validState({ firebasePfad: 'podcast/other.mp3' }));
  context.savePodcastProgress(validState({ nutzer: 'uid-2' }));
  context.savePodcastProgress(validState({ fach: 'Steuern', firebasePfad: 'podcast/taxes.mp3' }));
  assert.equal(sheet.rows.length, 5);
  assert.equal(context.getPodcastProgress('uid-1', 'Recht').length, 2);
  assert.equal(context.getPodcastProgress('uid-2', 'Recht').length, 1);
  assert.equal(context.getPodcastProgress('uid-1', 'Steuern').length, 1);

  const invalid = [
    ['nutzer', ''], ['fach', ''], ['einheit', ''], ['firebasePfad', ''], ['lerntextHash', ''],
    ['sekundenPosition', '12.5'], ['sekundenPosition', NaN], ['sekundenPosition', Infinity],
    ['sekundenPosition', -1], ['wortIndex', '4'], ['wortIndex', 1.5], ['wortIndex', -1],
    ['completed', 'true']
  ];
  for (const [field, value] of invalid) {
    const before = sheet.rows.length;
    assert.throws(() => context.savePodcastProgress(validState({ [field]: value })), /erforderlich|ungültig|muss|number|boolean/i, field);
    assert.equal(sheet.rows.length, before, `invalid ${field} wrote a row`);
  }
});

test('Podcast GET and POST routes expose PodcastFortschritt actions', () => {
  const backend = createBackend();
  const state = validState();
  const getResult = backend.response('get', { action: 'getPodcastProgress', nutzer: 'uid-1', fach: 'Recht' });
  assert.equal(getResult.success, true);
  assert.deepEqual(getResult.data, []);

  const postResult = backend.response('post', { action: 'savePodcastProgress', ...state });
  assert.equal(postResult.success, true);
  assert.equal(postResult.data.firebasePfad, state.firebasePfad);

  const loaded = backend.response('get', { action: 'getPodcastProgress', nutzer: 'uid-1', fach: 'Recht' });
  assert.equal(loaded.data.length, 1);
  assert.equal(loaded.data[0].lerntextHash, state.lerntextHash);
});
