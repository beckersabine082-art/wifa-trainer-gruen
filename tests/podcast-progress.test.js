const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../backend/apps-script/Code.gs'),
  'utf8'
);
const apiSource = fs.readFileSync(
  path.join(__dirname, '../js/api.js'),
  'utf8'
);

function createApi() {
  const calls = [];
  const responses = [];
  const context = {
    URL,
    URLSearchParams,
    JSON,
    Object,
    Error,
    Promise,
    window: {},
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      const response = responses.shift();
      if (response instanceof Error) {
        throw response;
      }
      return response;
    }
  };

  vm.createContext(context);
  vm.runInContext(apiSource, context);

  return { context, calls, responses };
}

function createSheet(name, rows = []) {
  return {
    name,
    rows,
    appendRowCalls: 0,
    setValuesCalls: 0,
    getName() {
      return this.name;
    },
    appendRow(row) {
      this.appendRowCalls += 1;
      this.rows.push(row.slice());
    },
    getDataRange() {
      return { getValues: () => this.rows.map((row) => row.slice()) };
    },
    getRange(rowIndex, column, rowCount, columnCount) {
      const thisSheet = this;
      return {
        setValues(values) {
          thisSheet.setValuesCalls += 1;
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
    ['nutzer', 123], ['fach', {}], ['einheit', []], ['firebasePfad', 123], ['lerntextHash', false],
    ['sekundenPosition', '12.5'], ['sekundenPosition', NaN], ['sekundenPosition', Infinity],
    ['sekundenPosition', -1], ['wortIndex', '4'], ['wortIndex', NaN], ['wortIndex', Infinity],
    ['wortIndex', 1.5], ['wortIndex', -1], ['completed', 'true'], ['completed', 1]
  ];
  for (const [field, value] of invalid) {
    const before = sheet.rows.length;
    const appendRowCallsBefore = sheet.appendRowCalls;
    const setValuesCallsBefore = sheet.setValuesCalls;
    assert.throws(() => context.savePodcastProgress(validState({ [field]: value })), /erforderlich|ungültig|muss|number|boolean/i, field);
    assert.equal(sheet.rows.length, before, `invalid ${field} wrote a row`);
    assert.equal(sheet.appendRowCalls, appendRowCallsBefore, `invalid ${field} called appendRow`);
    assert.equal(sheet.setValuesCalls, setValuesCallsBefore, `invalid ${field} called setValues`);
  }

  const clientTimestamp = '1900-01-01T00:00:00.000Z';
  context.savePodcastProgress(validState({ aktualisiert: clientTimestamp }));
  assert.notEqual(sheet.rows[1][8], clientTimestamp);
  assert.ok(sheet.rows[1][8] instanceof Date);
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

test('Frontend load wrapper passes explicit user and subject through unchanged', async () => {
  const api = createApi();
  const response = { success: true, data: [{ fach: 'Recht' }] };
  api.responses.push({ ok: true, json: async () => response });

  assert.equal(typeof api.context.lerntextePodcastFortschrittLaden, 'function');
  assert.equal(typeof api.context.window.lerntextePodcastFortschrittLaden, 'function');
  assert.strictEqual(
    api.context.window.lerntextePodcastFortschrittLaden,
    api.context.lerntextePodcastFortschrittLaden
  );
  assert.strictEqual(
    await api.context.window.lerntextePodcastFortschrittLaden('uid-123', 'Recht'),
    response
  );

  assert.equal(api.calls.length, 1);
  const requestUrl = new URL(api.calls[0].url);
  assert.equal(requestUrl.searchParams.get('action'), 'getPodcastProgress');
  assert.deepEqual(
    {
      nutzer: requestUrl.searchParams.get('nutzer'),
      fach: requestUrl.searchParams.get('fach')
    },
    { nutzer: 'uid-123', fach: 'Recht' }
  );
});

test('Frontend load wrapper validates input and propagates API errors', async () => {
  const invalidNutzer = [undefined, null, '', '   ', 123];
  const invalidFach = [undefined, null, '', '   ', 123];

  for (const nutzer of invalidNutzer) {
    const api = createApi();
    await assert.rejects(
      api.context.window.lerntextePodcastFortschrittLaden(nutzer, 'Recht'),
      /erforderlich|ungültig|leer/i
    );
    assert.equal(api.calls.length, 0, `invalid nutzer ${String(nutzer)} made a request`);
  }

  for (const fach of invalidFach) {
    const api = createApi();
    await assert.rejects(
      api.context.window.lerntextePodcastFortschrittLaden('uid-123', fach),
      /erforderlich|ungültig|leer/i
    );
    assert.equal(api.calls.length, 0, `invalid fach ${String(fach)} made a request`);
  }

  const api = createApi();
  const failure = new Error('load failed');
  api.responses.push(failure);
  await assert.rejects(
    api.context.window.lerntextePodcastFortschrittLaden('uid-123', 'Recht'),
    failure
  );
});

test('Frontend save wrapper passes state unchanged and returns the API response', async () => {
  const api = createApi();
  const state = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte und Rechtsobjekte',
    firebasePfad: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 19.04,
    wortIndex: 36,
    completed: false
  };
  const originalState = JSON.parse(JSON.stringify(state));
  const response = { success: true, data: { ...state } };
  api.responses.push({ ok: true, json: async () => response });

  assert.equal(typeof api.context.lerntextePodcastFortschrittSpeichern, 'function');
  assert.equal(typeof api.context.window.lerntextePodcastFortschrittSpeichern, 'function');
  assert.strictEqual(
    api.context.window.lerntextePodcastFortschrittSpeichern,
    api.context.lerntextePodcastFortschrittSpeichern
  );
  assert.strictEqual(
    await api.context.window.lerntextePodcastFortschrittSpeichern(state),
    response
  );

  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(api.calls[0].options.body), {
    action: 'savePodcastProgress',
    ...originalState
  });
  assert.deepEqual(state, originalState);
  assert.equal(JSON.parse(api.calls[0].options.body).aktualisiert, undefined);
});

test('Frontend save wrapper validates state and propagates API errors', async () => {
  const invalidStates = [
    null,
    undefined,
    {},
    { nutzer: '' },
    { nutzer: '   ' },
    validState({ nutzer: 123 })
  ];

  for (const state of invalidStates) {
    const api = createApi();
    await assert.rejects(
      api.context.window.lerntextePodcastFortschrittSpeichern(state),
      /erforderlich|ungültig|Objekt|leer/i
    );
    assert.equal(api.calls.length, 0, 'invalid state made a request');
  }

  const api = createApi();
  const failure = new Error('save failed');
  api.responses.push(failure);
  await assert.rejects(
    api.context.window.lerntextePodcastFortschrittSpeichern({ nutzer: 'uid-123' }),
    failure
  );
});
