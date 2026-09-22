const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadMain() {
  const document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  const context = {
    console,
    document,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    localStorage: { getItem: () => null, setItem() {} },
    window: null
  };
  context.window = context;
  context.addEventListener = () => {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8'), context);
  return context;
}

test('trainer entry only needs the guided selection when the productive choice is incomplete', () => {
  const context = loadMain();

  assert.equal(context.trainerAuswahlIstVollstaendig('WQ', 'Recht', 'Vertrag'), true);
  assert.equal(context.trainerAuswahlIstVollstaendig('HQ', 'Logistik', 'Lager'), true);
  assert.equal(context.trainerAuswahlIstVollstaendig('WQ', 'Recht', ''), false);
  assert.equal(context.trainerAuswahlIstVollstaendig('WQ', 'Logistik', 'Lager'), false);
  assert.equal(context.trainerAuswahlIstVollstaendig('', '', ''), false);
});

test('trainer entry markup contains one shared dialog and a fallback trigger', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  assert.match(html, /id="trainerEinstiegsDialog"/);
  assert.match(html, /id="trainerEinstiegsTeilbereich"/);
  assert.match(html, /id="trainerEinstiegsFach"/);
  assert.match(html, /id="trainerEinstiegsThema"/);
  assert.match(html, /id="trainerAuswahlStartBtn"/);
  assert.match(html, /Lernbereich auswählen/);
});
