const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/wissensdatenbank.js', 'utf8');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('Karteikarten-Themen werden über den kartenspezifischen Katalog geladen', async () => {
  const calls = [];
  const elements = {
    kartenFachSelect: { value: 'Recht' },
    kartenThemaSelect: { innerHTML: '', options: [], appendChild(option) { this.options.push(option); } },
    karteikartenBox: { style: {} },
    kartenStatus: { textContent: '' }
  };
  const context = {
    console,
    window: {},
    karteikartenDaten: [],
    aktuelleKartenIndex: 0,
    karteikartenAudioStoppen() {},
    apiGet: async (action, params) => {
      calls.push({ action, params });
      return { success: true, data: [{ thema: 'BGB Allgemeiner Teil', anzahl: 86 }] };
    },
    document: {
      getElementById: id => elements[id],
      createElement: () => ({ value: '', textContent: '' })
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  await context.kartenFachWaehlen();

  assert.deepEqual(plain(calls), [{ action: 'cardTopics', params: { fach: 'Recht' } }]);
  assert.equal(elements.kartenThemaSelect.options[0].textContent, 'BGB Allgemeiner Teil (86 Fragen)');
});

