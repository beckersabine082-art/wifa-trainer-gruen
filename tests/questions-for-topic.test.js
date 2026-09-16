const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('backend/apps-script/Code.gs', 'utf8');

function backend() {
  const rows = [
    ['q-1', 'Vertrag', 'Aktive Frage', '', 'Antwort', '', '', '', 'ja'],
    ['q-2', 'Kündigung', 'Inaktive Frage', '', 'Antwort', '', '', '', 'nein'],
    ['q-3', 'Vertrag', 'Zweite aktive Frage', '', 'Antwort', '', '', '', 'ja'],
    ['q-4', 'Kündigung', 'Aktive Kündigungsfrage', '', 'Antwort', '', '', '', 'ja']
  ];
  const context = {
    console,
    PropertiesService: {getScriptProperties: () => ({getProperty: () => ''})},
    ContentService: {
      MimeType: {JSON: 'application/json'},
      createTextOutput: text => ({setMimeType: () => JSON.parse(text)})
    },
    SpreadsheetApp: {getActiveSpreadsheet: () => ({})}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.getFrontendSheetNames = () => ['Recht'];
  context.getSpreadsheet_ = () => ({getSheets: () => []});
  context.getSheetByNameSafe_ = fach => {
      assert.equal(fach, 'Recht');
      return {getLastRow: () => rows.length + 2, getLastColumn: () => 9,
        getRange: (startRow, startColumn, numRows) => ({getValues: () => rows.slice(startRow - 3, startRow - 3 + numRows)})};
  };
  return context;
}

test('questionsForTopic returns active Recht questions and supports the optional topic filter', () => {
  const context = backend();
  const all = context.doGet({parameter: {action: 'questionsForTopic', fach: 'Recht'}});

  assert.equal(all.success, true, JSON.stringify(all));
  assert.ok(Array.isArray(all.data));
  assert.deepEqual(JSON.parse(JSON.stringify(all.data.map(({id, thema}) => ({id, thema})))), [
    {id: 'q-1', thema: 'Vertrag'},
    {id: 'q-3', thema: 'Vertrag'},
    {id: 'q-4', thema: 'Kündigung'}
  ]);

  const filtered = context.doGet({parameter: {action: 'questionsForTopic', fach: 'Recht', thema: 'Kündigung'}});
  assert.equal(filtered.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(filtered.data.map(({id, thema}) => ({id, thema})))), [
    {id: 'q-4', thema: 'Kündigung'}
  ]);
});
