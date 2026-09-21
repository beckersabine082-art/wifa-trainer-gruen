const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/auth-action.js', 'utf8');

function loadActionModule() {
  const exported = {};
  const context = {
    URLSearchParams,
    encodeURIComponent,
    console: { error() {} },
    FirebaseError: class FirebaseError extends Error {}
  };
  vm.createContext(context);
  vm.runInContext(`${source.replaceAll(/^export /gm, '')}\nObject.assign(globalThis, {parseActionParams, getActionErrorMessage});`, context);
  Object.assign(exported, context);
  return exported;
}

test('parses only supported action parameters without exposing raw values', () => {
  const { parseActionParams } = loadActionModule();
  assert.deepEqual(JSON.parse(JSON.stringify(parseActionParams('?mode=verifyEmail&oobCode=abc123&apiKey=secret'))), {
    mode: 'verifyEmail',
    oobCode: 'abc123'
  });
});

test('rejects missing mode or action code', () => {
  const { parseActionParams } = loadActionModule();
  assert.deepEqual(JSON.parse(JSON.stringify(parseActionParams('?mode=unknown&oobCode=abc'))), { mode: 'unknown', oobCode: 'abc' });
  assert.deepEqual(JSON.parse(JSON.stringify(parseActionParams('?mode=verifyEmail'))), { mode: 'verifyEmail', oobCode: '' });
});

test('maps Firebase action errors to safe German messages', () => {
  const { getActionErrorMessage } = loadActionModule();
  assert.match(getActionErrorMessage({ code: 'auth/invalid-action-code' }), /ungültig oder abgelaufen/i);
  assert.match(getActionErrorMessage({ code: 'auth/weak-password' }), /zu kurz oder zu unsicher/i);
  assert.match(getActionErrorMessage({ code: 'auth/network-request-failed' }), /Verbindung/i);
});
