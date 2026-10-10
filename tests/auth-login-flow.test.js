const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/login.js'), 'utf8');

function createClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    toggle(value, force) {
      if (force === true) values.add(value);
      else if (force === false) values.delete(value);
      else if (values.has(value)) values.delete(value);
      else values.add(value);
    },
    contains(value) { return values.has(value); }
  };
}

function createElement(overrides = {}) {
  const listeners = new Map();
  return Object.assign({
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
    textContent: '',
    dataset: {},
    style: {},
    classList: createClassList(),
    addEventListener(type, handler) { listeners.set(type, handler); },
    async dispatch(type, event = {}) {
      const handler = listeners.get(type);
      if (!handler) throw new Error(`No ${type} listener registered`);
      await handler(Object.assign({ preventDefault() {} }, event));
    },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children = [...(this.children || []), ...children]; },
    setAttribute(name, value) { this.attributes = { ...(this.attributes || {}), [name]: value }; },
    getAttribute(name) { return this.attributes && this.attributes[name]; },
    focus() {}
  }, overrides);
}

function createFixture(options = {}) {
  const requiredIds = [
    'authTabLogin', 'authTabRegister', 'authLoginForm', 'authRegisterForm', 'authProfile', 'authStatus',
    'loginEmail', 'loginPassword', 'loginRemember', 'regDisplayName', 'regEmail', 'regTermsAccepted',
    'regPrivacyAcknowledged', 'regPassword', 'regPasswordConfirm', 'forgotPasswordBtn',
    'resendVerificationBtn', 'checkVerificationBtn', 'signOutBtn', 'accountPasswordResetBtn',
    'startUserGreeting', 'navAuth', 'navAuthLabel', 'authViewTitle', 'profileGreeting',
    'profileDisplayName', 'profileDisplayNameInput', 'profileEmail', 'profileEmailVerified',
    'displayNameEditArea', 'editDisplayNameBtn', 'saveDisplayNameBtn', 'cancelDisplayNameBtn',
    'authView', 'startView', 'trainerView'
  ];
  const elements = Object.fromEntries(requiredIds.map(id => [id, createElement({ id })]));
  const tabs = createElement();
  const domEvents = new Map();
  const warnings = [];
  const navigation = [];
  const state = {
    persistenceError: null,
    signInError: null,
    resetError: null,
    signInCalls: 0,
    resetCalls: 0
  };
  const defaultUser = {
    uid: 'user-123',
    email: 'person@example.test',
    emailVerified: true,
    displayName: 'Testperson',
    async getIdToken() { return 'test-token'; },
    async reload() {}
  };
  const auth = { currentUser: options.currentUser || null };
  let authStateCallback;
  const document = {
    getElementById(id) { return elements[id] || null; },
    querySelector(selector) {
      if (selector === '#authView .auth-tabs') return tabs;
      if (selector === '.view.active') return null;
      return null;
    },
    querySelectorAll() { return Object.values(elements); },
    createElement() { return createElement(); },
    addEventListener(type, handler) { domEvents.set(type, handler); }
  };
  const window = {
    location: { hash: options.hash || '', pathname: '/', hostname: 'wifa-trainer.de' },
    desiredView: null,
    aktuellerNutzer: null,
    trainerEinstiegNachAuth: undefined
  };
  if (options.restoreError) {
    window.stelleLaufendePruefungWiederHer = async () => { throw options.restoreError; };
  }
  const context = {
    auth,
    db: {},
    window,
    document,
    console: {
      warn(...args) { warnings.push(args); },
      error(...args) { warnings.push(args); }
    },
    onAuthStateChanged(_auth, callback) { authStateCallback = callback; },
    async setPersistence() {
      if (state.persistenceError) throw state.persistenceError;
    },
    browserLocalPersistence: { name: 'local' },
    browserSessionPersistence: { name: 'session' },
    async createUserWithEmailAndPassword() { throw new Error('not configured'); },
    async signInWithEmailAndPassword() {
      state.signInCalls += 1;
      if (state.signInError) throw state.signInError;
      const user = options.user || defaultUser;
      auth.currentUser = user;
      return { user };
    },
    async sendEmailVerification() {},
    async signOut() { auth.currentUser = null; },
    async sendPasswordResetEmail() {
      state.resetCalls += 1;
      if (state.resetError) throw state.resetError;
    },
    async updateProfile() {},
    doc() { return {}; },
    async getDoc() { return { exists: () => true, data: () => ({ displayName: 'Testperson' }) }; },
    async setDoc() {},
    serverTimestamp() { return 'timestamp'; },
    async updateDoc() {},
    getReturnUrl() { return 'https://wifa-trainer.de/'; },
    zeigeBereich(view) {
      navigation.push(view);
      if (options.navigationError && view !== 'authView') throw options.navigationError;
    },
    closeMainMenu() {},
    location: window.location,
    URLSearchParams,
    String,
    Boolean,
    Array,
    Object,
    Number,
    Error,
    Promise,
    setTimeout,
    clearTimeout
  };
  window.document = document;
  vm.createContext(context);
  const executable = source
    .replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/firebase-config\.js['"];\s*/m, '')
    .replace(/^export\s+/gm, '');
  vm.runInContext(`${executable}\nObject.assign(globalThis, { __translateError: translateError, __bindAuthUI: bindAuthUI });`, context);
  context.__bindAuthUI();
  return {
    context,
    elements,
    tabs,
    window,
    auth,
    state,
    warnings,
    navigation,
    domEvents,
    getAuthStateCallback: () => authStateCallback,
    defaultUser
  };
}

function diagnosticText(fixture) {
  return JSON.stringify(fixture.warnings);
}

test('invalid credentials get a safe specific message and a sanitized Firebase diagnostic', async () => {
  const fixture = createFixture();
  fixture.elements.loginEmail.value = 'person@example.test';
  fixture.elements.loginPassword.value = 'ExamplePassword123!';
  fixture.elements.loginRemember.checked = true;
  fixture.state.signInError = { code: 'auth/invalid-credential', message: 'contains person@example.test' };

  await fixture.elements.authLoginForm.dispatch('submit');

  assert.equal(fixture.elements.authStatus.textContent, 'E-Mail-Adresse oder Passwort stimmen nicht.');
  assert.equal(fixture.elements.authStatus.style.color, '#a12d2d');
  assert.match(diagnosticText(fixture), /sign-in/);
  assert.match(diagnosticText(fixture), /auth\/invalid-credential/);
  assert.doesNotMatch(diagnosticText(fixture), /person@example\.test|ExamplePassword123!/);
});

test('unsupported browser persistence is distinguished before sign-in', async () => {
  const fixture = createFixture();
  fixture.elements.loginEmail.value = 'person@example.test';
  fixture.elements.loginPassword.value = 'ExamplePassword123!';
  fixture.state.persistenceError = { code: 'auth/web-storage-unsupported' };

  await fixture.elements.authLoginForm.dispatch('submit');

  assert.equal(fixture.state.signInCalls, 0);
  assert.match(fixture.elements.authStatus.textContent, /Browserspeicher/);
  assert.match(diagnosticText(fixture), /persistence/);
  assert.match(diagnosticText(fixture), /auth\/web-storage-unsupported/);
});

test('a navigation exception cannot turn successful Firebase authentication into a login failure', async () => {
  const fixture = createFixture({ navigationError: new TypeError('broken view') });
  fixture.elements.loginEmail.value = 'person@example.test';
  fixture.elements.loginPassword.value = 'ExamplePassword123!';

  await fixture.elements.authLoginForm.dispatch('submit');

  assert.equal(fixture.state.signInCalls, 1);
  assert.equal(fixture.auth.currentUser, fixture.defaultUser);
  assert.equal(fixture.window.aktuellerNutzer, fixture.defaultUser.uid);
  assert.match(fixture.elements.authStatus.textContent, /Anmeldung war erfolgreich/);
  assert.match(fixture.elements.authStatus.textContent, /Bereich konnte nicht geöffnet werden/);
  assert.match(diagnosticText(fixture), /post-auth-navigation/);
  assert.doesNotMatch(fixture.elements.authStatus.textContent, /^Ein Fehler ist aufgetreten/);
});

test('a working verified login keeps its existing successful route', async () => {
  const fixture = createFixture();
  fixture.elements.loginEmail.value = 'person@example.test';
  fixture.elements.loginPassword.value = 'ExamplePassword123!';

  await fixture.elements.authLoginForm.dispatch('submit');

  assert.equal(fixture.elements.authStatus.textContent, 'Erfolgreich angemeldet.');
  assert.deepEqual(fixture.navigation, ['startView']);
  assert.equal(fixture.window.aktuellerNutzer, fixture.defaultUser.uid);
});

test('trainer-entry failures after direct login cannot be misreported as authentication failures', async () => {
  const failures = [
    () => { throw new Error('synchronous private trainer state'); },
    async () => { throw new Error('asynchronous private trainer state'); }
  ];

  for (const trainerEntry of failures) {
    const fixture = createFixture();
    fixture.elements.loginEmail.value = 'person@example.test';
    fixture.elements.loginPassword.value = 'ExamplePassword123!';
    fixture.window.desiredView = 'trainerView';
    fixture.window.trainerEinstiegNachAuth = trainerEntry;

    await fixture.elements.authLoginForm.dispatch('submit');
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(fixture.auth.currentUser, fixture.defaultUser);
    assert.equal(fixture.elements.authStatus.textContent, 'Erfolgreich angemeldet.');
    assert.match(diagnosticText(fixture), /trainer-entry/);
    assert.doesNotMatch(diagnosticText(fixture), /private trainer state/);
  }
});

test('password reset request reports a network failure instead of claiming an email was sent', async () => {
  const fixture = createFixture();
  fixture.elements.loginEmail.value = 'person@example.test';
  fixture.state.resetError = { code: 'auth/network-request-failed', message: 'contains person@example.test' };

  await fixture.elements.forgotPasswordBtn.dispatch('click');

  assert.equal(fixture.state.resetCalls, 1);
  assert.match(fixture.elements.authStatus.textContent, /Netzwerk/);
  assert.equal(fixture.elements.authStatus.style.color, '#a12d2d');
  assert.match(diagnosticText(fixture), /password-reset-request/);
  assert.match(diagnosticText(fixture), /auth\/network-request-failed/);
  assert.doesNotMatch(diagnosticText(fixture), /person@example\.test/);
});

test('unknown reset account stays enumeration-safe while preserving the diagnostic code', async () => {
  const fixture = createFixture();
  fixture.elements.loginEmail.value = 'unknown@example.test';
  fixture.state.resetError = { code: 'auth/user-not-found' };

  await fixture.elements.forgotPasswordBtn.dispatch('click');

  assert.equal(fixture.elements.authStatus.textContent, 'Wenn die Adresse existiert, wurde eine E-Mail zum Zurücksetzen versendet.');
  assert.notEqual(fixture.elements.authStatus.style.color, '#a12d2d');
  assert.match(diagnosticText(fixture), /auth\/user-not-found/);
  assert.doesNotMatch(diagnosticText(fixture), /unknown@example\.test/);
});

test('authenticated password-reset request reports continue-URL configuration errors as reset failures', async () => {
  const fixture = createFixture();
  fixture.auth.currentUser = fixture.defaultUser;
  fixture.state.resetError = { code: 'auth/unauthorized-continue-uri' };

  await fixture.elements.accountPasswordResetBtn.dispatch('click');

  assert.match(fixture.elements.authStatus.textContent, /Passwort-Reset ist derzeit nicht verfügbar/);
  assert.doesNotMatch(fixture.elements.authStatus.textContent, /Anmeldung konnte nicht abgeschlossen/);
  assert.equal(fixture.elements.authStatus.style.color, '#a12d2d');
  assert.match(diagnosticText(fixture), /account-password-reset-request/);
  assert.match(diagnosticText(fixture), /auth\/unauthorized-continue-uri/);
});

test('the reset return hash opens the login area after page initialization', async () => {
  const fixture = createFixture({ hash: '#auth' });

  await fixture.domEvents.get('DOMContentLoaded')();

  assert.ok(fixture.navigation.includes('authView'));
});

test('a stale verified-user observer cannot restore account state after logout', async () => {
  let releaseToken;
  const tokenGate = new Promise(resolve => { releaseToken = resolve; });
  const oldUser = {
    uid: 'old-user',
    email: 'old@example.test',
    emailVerified: true,
    displayName: 'Alt',
    getIdToken() { return tokenGate; }
  };
  const fixture = createFixture({ currentUser: oldUser });
  const observe = fixture.getAuthStateCallback();

  const staleRun = observe(oldUser);
  await Promise.resolve();
  fixture.auth.currentUser = null;
  await observe(null);
  releaseToken('test-token');
  await staleRun;

  assert.equal(fixture.auth.currentUser, null);
  assert.equal(fixture.window.aktuellerNutzer, null);
  assert.equal(fixture.elements.navAuthLabel.textContent, 'Anmelden');
});

test('an old observer generation cannot overwrite a new session for the same uid', async () => {
  let releaseOldToken;
  const oldTokenGate = new Promise(resolve => { releaseOldToken = resolve; });
  const oldUser = {
    uid: 'same-user',
    email: 'old@example.test',
    emailVerified: true,
    displayName: 'Alter Name',
    getIdToken() { return oldTokenGate; }
  };
  const newUser = {
    uid: 'same-user',
    email: 'new@example.test',
    emailVerified: true,
    displayName: 'Neuer Name',
    async getIdToken() { return 'new-token'; }
  };
  const fixture = createFixture({ currentUser: oldUser });
  const observe = fixture.getAuthStateCallback();

  const staleRun = observe(oldUser);
  await Promise.resolve();
  fixture.auth.currentUser = null;
  await observe(null);
  fixture.auth.currentUser = newUser;
  await observe(newUser);
  releaseOldToken('old-token');
  await staleRun;

  assert.equal(fixture.auth.currentUser, newUser);
  assert.equal(fixture.window.aktuellerNutzer, newUser.uid);
  assert.equal(fixture.elements.profileDisplayName.textContent, 'Neuer Name');
  assert.equal(fixture.elements.profileEmail.textContent, 'E-Mail: new@example.test');
});

test('observer navigation failures preserve authenticated initialization and safe diagnostics', async () => {
  const fixture = createFixture({
    currentUser: null,
    navigationError: new TypeError('contains private navigation state')
  });
  fixture.auth.currentUser = fixture.defaultUser;
  fixture.window.desiredView = 'trainerView';
  const observe = fixture.getAuthStateCallback();

  await assert.doesNotReject(() => observe(fixture.defaultUser));

  assert.equal(fixture.window.aktuellerNutzer, fixture.defaultUser.uid);
  assert.equal(fixture.window.authInitialized, true);
  assert.equal(fixture.window.requireAuthReal, fixture.context.requireAuth);
  assert.match(fixture.elements.authStatus.textContent, /Anmeldung war erfolgreich/);
  assert.match(diagnosticText(fixture), /auth-state-navigation/);
  assert.doesNotMatch(diagnosticText(fixture), /private navigation state/);
  assert.equal(fixture.window.desiredView, null);
});

test('observer trainer-entry failures stay isolated and expose only safe diagnostics', async () => {
  const failures = [
    () => { throw new Error('synchronous private trainer state'); },
    async () => { throw new Error('asynchronous private trainer state'); }
  ];

  for (const trainerEntry of failures) {
    const fixture = createFixture({ currentUser: null });
    fixture.auth.currentUser = fixture.defaultUser;
    fixture.window.desiredView = 'trainerView';
    fixture.window.trainerEinstiegNachAuth = trainerEntry;
    const observe = fixture.getAuthStateCallback();

    await assert.doesNotReject(() => observe(fixture.defaultUser));
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(fixture.window.authInitialized, true);
    assert.match(diagnosticText(fixture), /trainer-entry/);
    assert.doesNotMatch(diagnosticText(fixture), /private trainer state/);
  }
});

test('a failed post-auth session restore cannot invalidate the authenticated state', async () => {
  const fixture = createFixture({
    currentUser: null,
    restoreError: { code: 'session/restore-failed', message: 'contains private state' }
  });
  fixture.auth.currentUser = fixture.defaultUser;
  const observe = fixture.getAuthStateCallback();

  await assert.doesNotReject(() => observe(fixture.defaultUser));

  assert.equal(fixture.window.aktuellerNutzer, fixture.defaultUser.uid);
  assert.equal(fixture.window.authInitialized, true);
  const diagnostics = diagnosticText(fixture);
  assert.match(diagnostics, /post-auth-session-restore/);
  assert.match(diagnostics, /session\/restore-failed/);
  assert.doesNotMatch(diagnostics, /private state/);
});
