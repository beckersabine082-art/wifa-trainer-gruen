const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBubble({ apiPost } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../js/wissensdatenbank.js'), 'utf8');
  const elements = new Map([
    ['kilianBubbleInput', { value: 'Frage' }],
    ['kilianBubbleStatus', { textContent: '' }],
    ['kilianBubbleAntwort', { innerHTML: '', textContent: '' }]
  ]);
  const button = { disabled: false, onclick: 'frageKilianBubble()' };
  const context = {
    console,
    window: { WifaUsage: { captureTicket: () => 'ticket', isCurrent: () => true } },
    document: {
      getElementById: id => elements.get(id),
      querySelector: selector => selector === '#kilianBubbleFenster button[onclick="frageKilianBubble()"]' ? button : null
    },
    apiPost: apiPost || (async () => ({ success: true, data: { antwort: 'ok' } })),
    formatKilianAntwort: text => text,
    alert() {},
    quizKilianFrageMitKontext: text => text,
    String, Boolean, Object, Error, Promise
  };
  vm.createContext(context);
  const start = source.indexOf('let kilianBubbleAnfrageLaeuft');
  const end = source.indexOf('function kilianBubbleVorlesen', start);
  vm.runInContext(`${source.slice(start, end)}\nthis.__bubbleHandler = behandleKilianBubbleEingabe; this.__sendBubble = frageKilianBubble;`, context);
  return { context, input: elements.get('kilianBubbleInput'), button, calls: [] };
}

async function pressEnter(fixture, { shiftKey = false } = {}) {
  let prevented = false;
  const result = fixture.context.__bubbleHandler({
    key: 'Enter', shiftKey, target: fixture.input,
    preventDefault: () => { prevented = true; }
  });
  await result;
  return prevented;
}

test('Enter in #kilianBubbleInput uses exactly one frageKilianBubble request', async () => {
  let calls = 0;
  const fixture = loadBubble({ apiPost: async () => { calls += 1; return { success: true, data: { antwort: 'ok' } }; } });
  assert.equal(await pressEnter(fixture), true);
  assert.equal(calls, 1);
});

test('Shift+Enter does not send and preserves the line break', async () => {
  let calls = 0;
  const fixture = loadBubble({ apiPost: async () => { calls += 1; return { success: true }; } });
  fixture.input.value += '\n';
  assert.equal(await pressEnter(fixture, { shiftKey: true }), false);
  assert.equal(calls, 0);
  assert.match(fixture.input.value, /\n/);
});

test('empty or whitespace-only Bubble input does not send', async () => {
  let calls = 0;
  const fixture = loadBubble({ apiPost: async () => { calls += 1; return { success: true }; } });
  fixture.input.value = '   ';
  await pressEnter(fixture);
  assert.equal(calls, 0);
});

test('a running Bubble request prevents a second Enter request', async () => {
  let resolveRequest;
  let calls = 0;
  const fixture = loadBubble({ apiPost: () => { calls += 1; return new Promise(resolve => { resolveRequest = resolve; }); } });
  const first = pressEnter(fixture);
  await new Promise(resolve => setImmediate(resolve));
  await pressEnter(fixture);
  assert.equal(calls, 1);
  resolveRequest({ success: true, data: { antwort: 'ok' } });
  await first;
});

test('a running Bubble request prevents a second button click', async () => {
  let resolveRequest;
  let calls = 0;
  const fixture = loadBubble({ apiPost: () => { calls += 1; return new Promise(resolve => { resolveRequest = resolve; }); } });
  const first = fixture.context.__sendBubble();
  await new Promise(resolve => setImmediate(resolve));
  await fixture.context.__sendBubble();
  assert.equal(calls, 1);
  resolveRequest({ success: true, data: { antwort: 'ok' } });
  await first;
});

test('Bubble send button is re-enabled after success', async () => {
  const fixture = loadBubble();
  await fixture.context.__sendBubble();
  assert.equal(fixture.button.disabled, false);
});

test('Bubble send button is re-enabled after failure', async () => {
  const fixture = loadBubble({ apiPost: async () => { throw new Error('failed'); } });
  await fixture.context.__sendBubble();
  assert.equal(fixture.button.disabled, false);
});

test('normal Bubble button path remains frageKilianBubble()', async () => {
  const fixture = loadBubble();
  await fixture.context.__sendBubble();
  assert.equal(fixture.button.onclick, 'frageKilianBubble()');
});

test('normal #kilianInput Enter handler remains unchanged', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/wissensdatenbank.js'), 'utf8');
  const calls = [];
  const context = { frageKilian: () => calls.push('frageKilian'), String, Boolean, Object };
  vm.createContext(context);
  const start = source.indexOf('function behandleKilianEingabe');
  const end = source.indexOf('async function frageKilian', start);
  vm.runInContext(`${source.slice(start, end)}\nthis.__handler = behandleKilianEingabe;`, context);
  const input = { closest: () => ({ querySelector: () => ({ disabled: false }) }) };
  let prevented = false;
  context.__handler({ key: 'Enter', shiftKey: false, target: input, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(calls, ['frageKilian']);
});
