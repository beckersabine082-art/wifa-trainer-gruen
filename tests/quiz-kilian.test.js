const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadKilian() {
  const source = fs.readFileSync(path.join(__dirname, '../js/wissensdatenbank.js'), 'utf8');
  const calls = [];
  const elements = new Map();
  const makeElement = () => ({ value: '', textContent: '', innerHTML: '', style: { display: 'none' } });
  const context = {
    console,
    window: {},
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, makeElement());
        return elements.get(id);
      }
    },
    apiPost: async (action, payload) => {
      calls.push({ action, payload });
      return { success: true, data: { antwort: 'ok' } };
    },
    formatKilianAntwort: text => text,
    setTimeout, clearTimeout, console,
    String, Number, Boolean, Array, Object, Math, Date, RegExp, Error
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, calls, elements };
}

function setQuizContext(context, value) {
  context.quizKilianKontext = value;
}

function setTrainerContext(context, value) {
  context.trainerKilianKontext = value;
}

test('verwendet die aktuelle offene Quizfrage als Kilian-Kontext', async () => {
  const kilian = loadKilian();
  setQuizContext(kilian.context, {
    fach: 'Marketing', thema: 'Marketingmix', frageId: 'm-1', frage: 'Erkläre den Marketingmix.'
  });
  kilian.context.document.getElementById('kilianInput').value = 'Was ist damit gemeint?';

  await kilian.context.frageKilian();

  assert.match(kilian.calls[0].payload.frage, /Marketingmix/);
  assert.match(kilian.calls[0].payload.frage, /Erkläre den Marketingmix/);
  assert.match(kilian.calls[0].payload.frage, /Was ist damit gemeint/);
});

test('neue Quizfrage leert den Chat und setzt den neuen Kontext', () => {
  const kilian = loadKilian();
  const mainInput = kilian.context.document.getElementById('kilianInput');
  const bubbleInput = kilian.context.document.getElementById('kilianBubbleInput');
  mainInput.value = 'alte Frage';
  bubbleInput.value = 'alter Bubble-Text';
  kilian.context.quizKilianKontext = { frage: 'Alte Quizfrage' };

  kilian.context.kilianQuizKontextSetzen({ fach: 'Marketing', frageId: 'm-2', frage: 'Neue Quizfrage' });

  assert.equal(mainInput.value, '');
  assert.equal(bubbleInput.value, '');
  assert.equal(kilian.context.quizKilianKontext.frage, 'Neue Quizfrage');
});

test('alter Quiz-Fragenkontext wird nicht in die nächste Anfrage übernommen', async () => {
  const kilian = loadKilian();
  setQuizContext(kilian.context, { fach: 'Marketing', frageId: 'm-1', frage: 'Alte Frage' });
  kilian.context.kilianQuizKontextSetzen({ fach: 'Marketing', frageId: 'm-2', frage: 'Neue Frage' });
  kilian.context.document.getElementById('kilianInput').value = 'Erklär das.';

  await kilian.context.frageKilian();

  assert.match(kilian.calls[0].payload.frage, /Neue Frage/);
  assert.doesNotMatch(kilian.calls[0].payload.frage, /Alte Frage/);
});

test('Fachwechsel und Shuffle setzen den Quiz-Kilian-Kontext zurück', () => {
  const kilian = loadKilian();
  setQuizContext(kilian.context, { fach: 'Marketing', frageId: 'm-1', frage: 'Marketingfrage' });
  kilian.context.kilianQuizKontextLeeren();
  assert.equal(kilian.context.quizKilianKontext, null);

  kilian.context.kilianQuizKontextSetzen({ fach: 'Recht', frageId: 'r-1', frage: 'Rechtsfrage' });
  assert.equal(kilian.context.quizKilianKontext.fach, 'Recht');
  kilian.context.kilianQuizKontextLeeren();
  assert.equal(kilian.context.quizKilianKontext, null);
});

test('übermittelt den aktuell sichtbaren Trainerkontext einschließlich Bewertung intern', async () => {
  const kilian = loadKilian();
  setTrainerContext(kilian.context, {
    bereich: 'WQ', fach: 'Recht', thema: 'Betriebliche Übung', frageId: 'r-1',
    frage: 'Wie kann ein Arbeitgeber die Entstehung einer betrieblichen Übung verhindern?',
    antwort: 'indem er keine regelmäßige gleiche Objektive zuwendungen herausgibt',
    musterloesung: 'Durch einen Freiwilligkeitsvorbehalt.', punkte: 0, maxPunkte: 5,
    ergebnis: 'Falsch', bewertungskriterien: 'Freiwilligkeitsvorbehalt'
  });
  kilian.context.document.getElementById('kilianInput').value = 'Warum habe ich hier 0 Punkte bekommen?';

  await kilian.context.frageKilian();

  assert.deepEqual(JSON.parse(JSON.stringify(kilian.calls[0].payload.trainerKontext)), {
    bereich: 'WQ', fach: 'Recht', thema: 'Betriebliche Übung', frageId: 'r-1',
    frage: 'Wie kann ein Arbeitgeber die Entstehung einer betrieblichen Übung verhindern?',
    antwort: 'indem er keine regelmäßige gleiche Objektive zuwendungen herausgibt',
    musterloesung: 'Durch einen Freiwilligkeitsvorbehalt.', punkte: 0, maxPunkte: 5,
    ergebnis: 'Falsch', bewertungskriterien: 'Freiwilligkeitsvorbehalt'
  });
  assert.equal(kilian.calls[0].payload.frage, 'Warum habe ich hier 0 Punkte bekommen?');
});
