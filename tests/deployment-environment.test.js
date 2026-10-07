const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const { buildAppsScriptSource } = require('../tools/release/build-apps-script');

const source = fs.readFileSync('backend/apps-script/Code.gs', 'utf8');
const STAGING_ID = '1cJ8Wa92r-_LRmMOf3h3kTqfHV8Qz3ZjERuCP1Un25r8';
const PRODUCTION_ID = '1_PGsBBjPZcc48B1PvwS3XKNVrQgH6Rvarzg4zBbPa7Y';

function evaluate(builtSource) {
  const opened = [];
  const context = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    SpreadsheetApp: { openById(id) { opened.push(id); return { getId: () => id }; } }
  };
  vm.createContext(context);
  vm.runInContext(builtSource, context);
  return { context, opened };
}

test('staging build opens only the staging spreadsheet', () => {
  const built = buildAppsScriptSource(source, 'STAGING');
  const fixture = evaluate(built);
  assert.equal(fixture.context.getSpreadsheet_().getId(), STAGING_ID);
  assert.deepEqual(fixture.opened, [STAGING_ID]);
  assert.ok(!fixture.opened.includes(PRODUCTION_ID));
  assert.match(built, new RegExp(STAGING_ID));
  assert.doesNotMatch(built, new RegExp(PRODUCTION_ID));
});

test('production build opens only the production spreadsheet', () => {
  const built = buildAppsScriptSource(source, 'PRODUCTION');
  const fixture = evaluate(built);
  assert.equal(fixture.context.getSpreadsheet_().getId(), PRODUCTION_ID);
  assert.deepEqual(fixture.opened, [PRODUCTION_ID]);
  assert.ok(!fixture.opened.includes(STAGING_ID));
  assert.match(built, new RegExp(PRODUCTION_ID));
  assert.doesNotMatch(built, new RegExp(STAGING_ID));
});

test('unbuilt, missing and invalid environment configurations fail closed', () => {
  assert.throws(() => evaluate(source).context.getSpreadsheet_(), /Deployment-Umgebung/);
  assert.throws(() => buildAppsScriptSource(source, ''), /STAGING oder PRODUCTION/);
  assert.throws(() => buildAppsScriptSource(source, 'preview'), /STAGING oder PRODUCTION/);
});

test('environment routing does not depend on shared Apps Script properties', () => {
  const built = buildAppsScriptSource(source, 'PRODUCTION');
  const fixture = evaluate(built);
  fixture.context.getSpreadsheet_();
  assert.deepEqual(fixture.opened, [PRODUCTION_ID]);
  assert.doesNotMatch(
    source.slice(source.indexOf('function getSpreadsheet_'), source.indexOf('function getSheetByNameSafe_')),
    /PropertiesService/
  );
});
