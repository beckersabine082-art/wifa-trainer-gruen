const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSetBusy() {
  const source = fs.readFileSync(path.join(__dirname, '../js/login.js'), 'utf8');
  const authControls = [
    { id: 'authTabLogin', classList: { contains: () => false }, disabled: false, style: {} },
    { id: 'loginSubmit', classList: { contains: () => false }, disabled: false, style: {} },
    { id: 'signOutBtn', classList: { contains: () => false }, disabled: false, style: {} }
  ];
  const hamburger = {
    id: '',
    disabled: false,
    style: {},
    classList: { contains: name => name === 'nav-hamburger' }
  };
  const navControls = [
    hamburger,
    { id: 'navStart', disabled: false, style: {}, classList: { contains: () => false } },
    { id: 'navAuth', disabled: false, style: {}, classList: { contains: () => false } }
  ];
  const context = {
    console,
    document: {
      querySelectorAll: selector => selector === '#authView button, #authView input'
        ? [...authControls, ...navControls]
        : authControls
    },
    window: {},
    String, Boolean, Array, Object, Number, Error
  };
  vm.createContext(context);
  const start = source.indexOf('function setBusy(flag)');
  const end = source.indexOf('function showStatus', start);
  vm.runInContext(source.slice(start, end).replace(/export\s+/g, '') + '\nthis.__setBusy = setBusy;', context);
  return { context, authControls, hamburger, navControls };
}

test('setBusy(true) deaktiviert echte Auth-Controls', () => {
  const fixture = loadSetBusy();
  fixture.context.__setBusy(true);
  assert.ok(fixture.authControls.every(control => control.disabled));
});

test('setBusy(true) deaktiviert keine globalen Navigationscontrols', () => {
  const fixture = loadSetBusy();
  fixture.context.__setBusy(true);
  assert.ok(fixture.navControls.every(control => control.disabled === false));
});

test('Login-Sequenz lässt Hamburger und Menü für startView aktiviert', () => {
  const fixture = loadSetBusy();
  fixture.context.__setBusy(true);
  fixture.context.__setBusy(false);
  assert.ok(fixture.navControls.every(control => control.disabled === false));
});

test('Logout-Sequenz lässt Hamburger und Anmelden für startView aktiviert', () => {
  const fixture = loadSetBusy();
  fixture.context.__setBusy(true);
  fixture.context.__setBusy(false);
  assert.equal(fixture.hamburger.disabled, false);
  assert.equal(fixture.authControls.find(control => control.id === 'authTabLogin').disabled, false);
});

test('setBusy(false) aktiviert Auth-Controls wieder', () => {
  const fixture = loadSetBusy();
  fixture.context.__setBusy(true);
  fixture.context.__setBusy(false);
  assert.ok(fixture.authControls.every(control => control.disabled === false));
});
