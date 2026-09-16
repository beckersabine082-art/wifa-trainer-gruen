const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadKeyboardHandler({ buttonDisabled = false } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../js/wissensdatenbank.js'), 'utf8');
  const calls = [];
  const button = { disabled: buttonDisabled };
  const input = {
    value: '  Frage an Kilian  ',
    closest: selector => selector === '.card' ? {
      querySelector: query => query === 'button[onclick="frageKilian()"]' ? button : null
    } : null
  };
  const context = {
    console,
    frageKilian: () => { if (input.value.trim()) calls.push('frageKilian'); },
    String, Boolean, Object
  };
  vm.createContext(context);
  const start = source.indexOf('function behandleKilianEingabe');
  const end = source.indexOf('async function frageKilian', start);
  vm.runInContext(`${source.slice(start, end)}\nthis.__handler = behandleKilianEingabe;`, context);
  return { context, input, button, calls };
}

test('Enter mit Text verwendet genau den bestehenden Kilian-Sendeablauf', () => {
  const fixture = loadKeyboardHandler();
  let prevented = false;
  fixture.context.__handler({ key: 'Enter', shiftKey: false, target: fixture.input, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(fixture.calls, ['frageKilian']);
});

test('Shift+Enter sendet nicht und lässt einen Zeilenumbruch zu', () => {
  const fixture = loadKeyboardHandler();
  fixture.input.value += '\n';
  let prevented = false;
  fixture.context.__handler({ key: 'Enter', shiftKey: true, target: fixture.input, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(fixture.calls.length, 0);
  assert.match(fixture.input.value, /\n/);
});

test('Enter bei leerem Feld sendet nichts', () => {
  const fixture = loadKeyboardHandler();
  fixture.input.value = '   ';
  fixture.context.__handler({ key: 'Enter', shiftKey: false, target: fixture.input, preventDefault() {} });
  assert.equal(fixture.calls.length, 0);
});

test('Enter bei deaktiviertem Senden-Button startet keine zweite Anfrage', () => {
  const fixture = loadKeyboardHandler({ buttonDisabled: true });
  let prevented = false;
  fixture.context.__handler({ key: 'Enter', shiftKey: false, target: fixture.input, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(fixture.calls.length, 0);
});
