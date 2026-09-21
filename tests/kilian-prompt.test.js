const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadBackend() {
  const calls = [];
  const context = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-key' }) },
    UrlFetchApp: {
      fetch: (url, options) => {
        calls.push({ url, options });
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] })
        };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('backend/apps-script/Code.gs', 'utf8'), context);
  return { context, calls };
}

test('Trainerkontext erzwingt eine konkrete Analyse im Kilian-Systemprompt', () => {
  const { context, calls } = loadBackend();
  context.frageKilianFrontend('Warum habe ich hier null Punkte erhalten?', {
    fach: 'Recht',
    thema: 'Betriebliche Übung',
    frageId: 'r-1',
    frage: 'Wie kann ein Arbeitgeber die Entstehung einer betrieblichen Übung verhindern?',
    antwort: 'indem er keine regelmäßige gleiche Objektive zuwendungen herausgibt',
    musterloesung: 'Durch einen Freiwilligkeitsvorbehalt.',
    punkte: 0,
    maxPunkte: 5,
    ergebnis: 'Falsch',
    bewertungskriterien: 'Freiwilligkeitsvorbehalt'
  });

  const prompt = JSON.parse(calls[0].options.payload).messages[0].content;
  assert.match(prompt, /hier|meine Antwort|diese Frage/i);
  assert.match(prompt, /konkret.*Fragetext|Fragetext.*konkret/i);
  assert.match(prompt, /Nutzerantwort.*Musterlösung|Musterlösung.*Nutzerantwort/i);
  assert.match(prompt, /richtig.*fehlt|fehlt.*richtig/i);
  assert.match(prompt, /Bewertung.*nicht blind|zu streng|fachlich fragwürdig/i);
  assert.match(prompt, /nicht erneut nach Frage, Thema oder Antwort/i);
});
