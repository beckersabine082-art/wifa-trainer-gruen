const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildAppsScriptSource } = require('../tools/release/build-apps-script');

const source = buildAppsScriptSource(fs.readFileSync('backend/apps-script/Code.gs', 'utf8'), 'STAGING');
const STAGING_ID = '1cJ8Wa92r-_LRmMOf3h3kTqfHV8Qz3ZjERuCP1Un25r8';
const header = ['ID','Fach','Hauptkapitel_Nr','Hauptkapitel','Unterkapitel_Nr','Titel','Lerntext','Podcast_Text','Kurzfassung','Prüfungsfokus','Reihenfolge_Fach','Reihenfolge_Kapitel','Aktiv','Quelle_Buchseiten','Hinweis'];

function workbook(id, textId) {
  const rows = [header, [textId,'Testfach','1','Testkapitel','1.1','Titel','Text','Podcast','Kurz','Fokus',1,1,'ja','','']];
  const sheet = {
    getLastRow: () => 3,
    getLastColumn: () => 15,
    getRange: (row) => ({ getValues: () => row === 2 ? [rows[0]] : [rows[1]] })
  };
  return { getId: () => id, getSheetByName: name => name === 'Lerntexte' ? sheet : null };
}

test('Staging-Code liest Lerntexte ausschließlich aus der dedizierten Staging-Spreadsheet-ID', () => {
  const production = workbook('production', 'LZ-PROD-01');
  const staging = workbook(STAGING_ID, 'LZ-STAGING-01');
  const opened = [];
  const context = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => production,
      openById: id => { opened.push(id); return id === STAGING_ID ? staging : null; }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const texts = context.getLerntexte('Testfach');
  assert.equal(context.getSpreadsheet_().getId(), STAGING_ID);
  assert.deepEqual(texts.map(item => item.id), ['LZ-STAGING-01']);
  assert.ok(opened.length >= 2);
  assert.ok(opened.every(id => id === STAGING_ID));
});
