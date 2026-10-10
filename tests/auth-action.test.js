const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/auth-action.js', 'utf8');

function loadActionModule(overrides = {}) {
  const exported = {};
  const context = Object.assign({
    URLSearchParams,
    encodeURIComponent,
    console: { warn() {}, error() {} },
    FirebaseError: class FirebaseError extends Error {}
  }, overrides);
  vm.createContext(context);
  vm.runInContext(`${source.replaceAll(/^export /gm, '')}\nObject.assign(globalThis, {parseActionParams, getActionErrorMessage, initAuthAction});`, context);
  Object.assign(exported, context);
  return exported;
}

function createElement(overrides = {}) {
  const listeners = new Map();
  return Object.assign({
    hidden: true,
    disabled: false,
    textContent: '',
    className: '',
    value: '',
    addEventListener(type, handler) { listeners.set(type, handler); },
    async dispatch(type) {
      const handler = listeners.get(type);
      if (!handler) throw new Error(`No ${type} listener registered`);
      await handler({ preventDefault() {} });
    }
  }, overrides);
}

function createResetFixture({ verifyError = null, confirmError = null } = {}) {
  const button = createElement();
  const status = createElement({ hidden: false, textContent: 'Die Aktion wird geprüft …', className: 'status info' });
  const title = createElement();
  const resetForm = createElement({ querySelector: selector => selector === 'button' ? button : null });
  const homeLink = createElement();
  const loginLink = createElement();
  const newPassword = createElement();
  const confirmPassword = createElement();
  const elements = {
    '#actionStatus': status,
    '#actionTitle': title,
    '#resetPasswordForm': resetForm,
    '#homeLink': homeLink,
    '#loginLink': loginLink,
    '#newPassword': newPassword,
    '#confirmPassword': confirmPassword
  };
  const warnings = [];
  let confirmCalls = 0;
  const module = loadActionModule({
    window: { location: { search: '?mode=resetPassword&oobCode=test-code' } },
    document: { querySelector: selector => elements[selector] || null },
    console: { warn(...args) { warnings.push(args); }, error(...args) { warnings.push(args); } }
  });
  module.initAuthAction({
    auth: {},
    async applyActionCode() {},
    async verifyPasswordResetCode() {
      if (verifyError) throw verifyError;
      return 'person@example.test';
    },
    async confirmPasswordReset() {
      confirmCalls += 1;
      if (confirmError) throw confirmError;
    }
  });
  return {
    elements,
    status,
    title,
    resetForm,
    homeLink,
    loginLink,
    newPassword,
    confirmPassword,
    button,
    warnings,
    getConfirmCalls: () => confirmCalls
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
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

test('verified reset link asks for a new password without offering login prematurely', async () => {
  const fixture = createResetFixture();

  await flushPromises();

  assert.equal(fixture.resetForm.hidden, false);
  assert.match(fixture.status.textContent, /neues Passwort/i);
  assert.equal(fixture.status.className, 'status info');
  assert.equal(fixture.loginLink.hidden, true);
  assert.equal(fixture.homeLink.hidden, false);
});

test('reset enforces the same twelve-character minimum as registration', async () => {
  const fixture = createResetFixture();
  await flushPromises();
  fixture.newPassword.value = '12345678';
  fixture.confirmPassword.value = '12345678';

  await fixture.resetForm.dispatch('submit');

  assert.equal(fixture.getConfirmCalls(), 0);
  assert.match(fixture.status.textContent, /mindestens 12 Zeichen/i);
  assert.equal(fixture.loginLink.hidden, true);
});

test('successful Firebase confirmation is the only state that offers the login link', async () => {
  const fixture = createResetFixture();
  await flushPromises();
  fixture.newPassword.value = 'NewPassword123!';
  fixture.confirmPassword.value = 'NewPassword123!';

  await fixture.resetForm.dispatch('submit');

  assert.equal(fixture.getConfirmCalls(), 1);
  assert.equal(fixture.resetForm.hidden, true);
  assert.equal(fixture.status.textContent, 'Dein Passwort wurde erfolgreich geändert.');
  assert.equal(fixture.status.className, 'status success');
  assert.equal(fixture.loginLink.hidden, false);
  assert.equal(fixture.homeLink.hidden, true);
});

test('failed Firebase confirmation stays in the form and logs only stage and error code', async () => {
  const fixture = createResetFixture({
    confirmError: { code: 'auth/network-request-failed', message: 'contains person@example.test and a private value' }
  });
  await flushPromises();
  fixture.newPassword.value = 'NewPassword123!';
  fixture.confirmPassword.value = 'NewPassword123!';

  await fixture.resetForm.dispatch('submit');

  assert.equal(fixture.resetForm.hidden, false);
  assert.equal(fixture.loginLink.hidden, true);
  assert.equal(fixture.button.disabled, false);
  assert.match(fixture.status.textContent, /Verbindung/i);
  const diagnostics = JSON.stringify(fixture.warnings);
  assert.match(diagnostics, /password-reset-confirmation/);
  assert.match(diagnostics, /auth\/network-request-failed/);
  assert.doesNotMatch(diagnostics, /person@example\.test|private value/);
});
