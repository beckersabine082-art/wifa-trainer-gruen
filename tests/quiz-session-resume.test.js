const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadQuiz(progressTimeoutMs = 15) {
  const source = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');
  const storage = new Map();
  const context = {
    console,
    window: {},
    document: { getElementById() { return null; } },
    auth: { currentUser: { uid: 'u1', emailVerified: true } },
    currentVerifiedUser: () => ({ uid: 'u1', emailVerified: true }),
    QUIZ_PROGRESS_TIMEOUT_MS: progressTimeoutMs,
    Array, String, Math, Date, Object, Boolean, Number, RegExp, Map, Set, Error,
    setTimeout, clearTimeout
  };
  context.window = context;
  context.localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  context.window.localStorage = context.localStorage;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function setState(context, patch) {
  context.__patch = patch;
  vm.runInContext(`
    if ('katalog' in __patch) katalog = __patch.katalog;
    if ('quizFach' in __patch) quizFach = __patch.quizFach;
    if ('quizSchwierigkeitsgrad' in __patch) quizSchwierigkeitsgrad = __patch.quizSchwierigkeitsgrad;
    if ('quizShuffleAktiv' in __patch) quizShuffleAktiv = __patch.quizShuffleAktiv;
    if ('rundenReihenfolge' in __patch) rundenReihenfolge = __patch.rundenReihenfolge;
    if ('fragenIndex' in __patch) fragenIndex = __patch.fragenIndex;
    if ('rundenNummer' in __patch) rundenNummer = __patch.rundenNummer;
  `, context);
  delete context.__patch;
}

function state(context) {
  return vm.runInContext('({ rundenReihenfolge, fragenIndex, rundenNummer, quizFach, quizShuffleAktiv })', context);
}

const marketing = [
  { quizKey: 'm-1', fach: 'Marketing', frageId: 'm-1' },
  { quizKey: 'm-2', fach: 'Marketing', frageId: 'm-2' },
  { quizKey: 'm-3', fach: 'Marketing', frageId: 'm-3' }
];

test('setzt eine gespeicherte Fachsitzung mit derselben Reihenfolge fort', async () => {
  const context = loadQuiz();
  setState(context, {
    katalog: marketing,
    quizFach: 'Marketing',
    rundenReihenfolge: [marketing[2], marketing[0], marketing[1]],
    fragenIndex: 1,
    rundenNummer: 3
  });

  await vm.runInContext('speichereQuizSitzung()', context);
  setState(context, { rundenReihenfolge: [], fragenIndex: 0, rundenNummer: 1 });
  const restoredIndex = await vm.runInContext('ladeQuizSitzung()', context);

  assert.equal(restoredIndex, 1);
  assert.equal(JSON.stringify(state(context).rundenReihenfolge.map(item => item.quizKey)), JSON.stringify(['m-3', 'm-1', 'm-2']));
  assert.equal(state(context).rundenNummer, 3);
});

test('speichert Sitzungsstände zweier Fächer unabhängig', async () => {
  const context = loadQuiz();
  const recht = [{ quizKey: 'r-1', fach: 'Recht', frageId: 'r-1' }, { quizKey: 'r-2', fach: 'Recht', frageId: 'r-2' }];

  setState(context, { katalog: [...marketing, ...recht], quizFach: 'Marketing', rundenReihenfolge: marketing, fragenIndex: 2, rundenNummer: 1 });
  await vm.runInContext('speichereQuizSitzung()', context);
  setState(context, { quizFach: 'Recht', rundenReihenfolge: [recht[1], recht[0]], fragenIndex: 0, rundenNummer: 2 });
  await vm.runInContext('speichereQuizSitzung()', context);
  setState(context, { quizFach: 'Marketing', rundenReihenfolge: [], fragenIndex: 0 });
  assert.equal(await vm.runInContext('ladeQuizSitzung()', context), 2);
  setState(context, { quizFach: 'Recht', rundenReihenfolge: [], fragenIndex: 0 });
  assert.equal(await vm.runInContext('ladeQuizSitzung()', context), 0);
  assert.equal(JSON.stringify(state(context).rundenReihenfolge.map(item => item.quizKey)), JSON.stringify(['r-2', 'r-1']));
});

test('trennt Sitzungen desselben Fachs nach Schwierigkeitsgrad', async () => {
  const context = loadQuiz();
  const entries = ['Einsteiger', 'Fortgeschritten', 'Profi'].map((schwierigkeitsgrad, index) => ({
    quizKey: `m-${index + 1}`, fach: 'Marketing', frageId: `m-${index + 1}`, schwierigkeitsgrad
  }));
  setState(context, { katalog: entries, quizFach: 'Marketing', quizSchwierigkeitsgrad: 'Einsteiger', rundenReihenfolge: [entries[0]], fragenIndex: 0, rundenNummer: 1 });
  await vm.runInContext('speichereQuizSitzung()', context);
  setState(context, { quizSchwierigkeitsgrad: 'Profi', rundenReihenfolge: [entries[2]], fragenIndex: 0, rundenNummer: 2 });
  await vm.runInContext('speichereQuizSitzung()', context);
  setState(context, { quizSchwierigkeitsgrad: 'Einsteiger', rundenReihenfolge: [], fragenIndex: 0 });
  assert.equal(await vm.runInContext('ladeQuizSitzung()', context), 0);
  assert.equal(state(context).rundenReihenfolge[0].quizKey, 'm-1');
  setState(context, { quizSchwierigkeitsgrad: 'Profi', rundenReihenfolge: [], fragenIndex: 0 });
  assert.equal(await vm.runInContext('ladeQuizSitzung()', context), 0);
  assert.equal(state(context).rundenReihenfolge[0].quizKey, 'm-3');
  setState(context, { quizSchwierigkeitsgrad: 'Einsteiger' });
  const einsteigerProgress = await vm.runInContext('quizProgressContext()', context);
  setState(context, { quizSchwierigkeitsgrad: 'Profi' });
  const profiProgress = await vm.runInContext('quizProgressContext()', context);
  assert.notEqual(einsteigerProgress.auswahl, profiProgress.auswahl);
});

test('der Fragenpool enthält nur die ausgewählte Schwierigkeit und keinen Fallback', () => {
  const context = loadQuiz();
  const entries = ['Einsteiger', 'Profi'].map((schwierigkeitsgrad, index) => ({
    quizKey: `m-${index + 1}`, fach: 'Marketing', frageId: `m-${index + 1}`, schwierigkeitsgrad
  }));
  setState(context, { katalog: entries, quizFach: 'Marketing', quizSchwierigkeitsgrad: 'Fortgeschritten' });
  assert.equal(vm.runInContext('neuerFragenpool().length', context), 0);
});

test('Shuffle/Mix verändert den gespeicherten Fachstand nicht', async () => {
  const context = loadQuiz();
  setState(context, { katalog: marketing, quizFach: 'Marketing', rundenReihenfolge: [marketing[1], marketing[0], marketing[2]], fragenIndex: 1, rundenNummer: 1 });
  await vm.runInContext('speichereQuizSitzung()', context);
  setState(context, { quizShuffleAktiv: true, rundenReihenfolge: [marketing[2], marketing[1]], fragenIndex: 0 });
  await vm.runInContext('speichereQuizSitzung()', context);
  setState(context, { quizShuffleAktiv: false, rundenReihenfolge: [], fragenIndex: 0 });
  assert.equal(await vm.runInContext('ladeQuizSitzung()', context), 1);
  assert.equal(JSON.stringify(state(context).rundenReihenfolge.map(item => item.quizKey)), JSON.stringify(['m-2', 'm-1', 'm-3']));
});

test('startet bei Frage 1, wenn keine Fachsitzung gespeichert ist', async () => {
  const context = loadQuiz();
  setState(context, { katalog: marketing, quizFach: 'Marketing', rundenReihenfolge: [], fragenIndex: 0 });

  assert.equal(await vm.runInContext('ladeQuizSitzung()', context), null);
  assert.deepEqual(state(context).rundenReihenfolge, []);
});

function setupTransition(context, entries, currentEntry) {
  const card = { hidden: false };
  const status = {
    textContent: '',
    replaceChildren() { this.children = []; },
    appendChild(child) { (this.children ||= []).push(child); }
  };
  const pruefen = { disabled: false, dataset: {} };
  const antwort = { disabled: false, value: 'A', name: 'quizOption' };
  const naechste = { hidden: false };
  context.document.getElementById = id => ({ quizKarte: card, quizStatus: status, quizPruefenBtn: pruefen, quizNaechsteBtn: naechste }[id] || null);
  context.document.querySelector = () => antwort;
  context.document.querySelectorAll = selector => selector === 'input[name="quizOption"]' ? [antwort] : [];
  context.document.createElement = () => ({ textContent: '', appendChild() {}, className: '' });
  setState(context, {
    katalog: entries, quizFach: currentEntry.fach, quizSchwierigkeitsgrad: currentEntry.schwierigkeitsgrad,
    rundenReihenfolge: [currentEntry], fragenIndex: 0
  });
  context.__oldQuestion = { quizKey: currentEntry.quizKey, frageId: currentEntry.frageId, richtigeOption: 'A' };
  vm.runInContext('aktuellerKatalogEintrag = katalog[0]; aktuelleFrage = __oldQuestion; antwortGespeichert = false;', context);
  return { card, status, pruefen, antwort };
}

function questionFor(entry) {
  return {
    success: true,
    data: {
      quizKey: entry.quizKey, frageId: entry.frageId, fach: entry.fach,
      frage: `Frage ${entry.schwierigkeitsgrad}`, richtigeOption: 'C',
      antworten: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }, { id: 'C', text: 'C' }, { id: 'D', text: 'D' }]
    }
  };
}

test('Schwierigkeitswechsel blendet Altfrage aus und startet nach getProgress-Timeout mit der neuen Stufe', async () => {
  const context = loadQuiz(15);
  const starter = { quizKey: 'r-e1', fach: 'Recht', frageId: 'r-e1', schwierigkeitsgrad: 'Einsteiger' };
  const advanced = { quizKey: 'r-f1', fach: 'Recht', frageId: 'r-f1', schwierigkeitsgrad: 'Fortgeschritten' };
  const ui = setupTransition(context, [starter, advanced], starter);
  const calls = [];
  context.window.apiGet = (action, params) => {
    calls.push({ action, params });
    if (action === 'getProgress') return new Promise(() => {});
    if (action === 'quizQuestion') return Promise.resolve(questionFor(advanced));
    throw new Error(`Unexpected action ${action}`);
  };
  context.window.apiPost = async () => ({ success: true });

  context.wechsleQuizSchwierigkeitsgrad({ target: { value: 'Fortgeschritten' } });
  assert.equal(ui.card.hidden, true, 'die alte Frage wird vor dem Progress-Abruf ausgeblendet');
  assert.equal(ui.pruefen.disabled, true);
  assert.equal(ui.antwort.disabled, true);
  assert.equal(vm.runInContext('aktuelleFrage', context), null);

  await new Promise(resolve => setTimeout(resolve, 40));
  const questionRequest = calls.find(call => call.action === 'quizQuestion');
  assert.deepEqual(calls.map(call => call.action), ['getProgress', 'quizQuestion']);
  assert.equal(questionRequest.params.fach, 'Recht');
  assert.equal(questionRequest.params.schwierigkeitsgrad, 'Fortgeschritten');
  assert.equal(vm.runInContext('fragenIndex', context), 0);
  assert.equal(vm.runInContext('aktuelleFrage.frageId', context), 'r-f1');
  assert.equal(ui.card.hidden, false);
});

test('Fachwechsel blendet die Altfrage ebenfalls vor einem offenen getProgress aus', () => {
  const context = loadQuiz(15);
  const starter = { quizKey: 'r-e1', fach: 'Recht', frageId: 'r-e1', schwierigkeitsgrad: 'Einsteiger' };
  const marketing = { quizKey: 'm-e1', fach: 'Marketing', frageId: 'm-e1', schwierigkeitsgrad: 'Einsteiger' };
  const ui = setupTransition(context, [starter, marketing], starter);
  context.window.apiGet = (action) => action === 'getProgress'
    ? new Promise(() => {})
    : Promise.resolve(questionFor(marketing));
  context.window.apiPost = async () => ({ success: true });

  context.wechsleQuizmodus({ target: { value: 'Marketing' } });

  assert.equal(ui.card.hidden, true);
  assert.equal(ui.pruefen.disabled, true);
  assert.equal(ui.antwort.disabled, true);
  assert.equal(vm.runInContext('aktuelleFrage', context), null);
});

test('fehlgeschlagenes getProgress startet ohne unbehandelte Rejection die neue Session', async () => {
  const context = loadQuiz(100);
  const starter = { quizKey: 'r-e1', fach: 'Recht', frageId: 'r-e1', schwierigkeitsgrad: 'Einsteiger' };
  const advanced = { quizKey: 'r-f1', fach: 'Recht', frageId: 'r-f1', schwierigkeitsgrad: 'Fortgeschritten' };
  const ui = setupTransition(context, [starter, advanced], starter);
  const calls = [];
  context.window.apiGet = (action, params) => {
    calls.push({ action, params });
    if (action === 'getProgress') return Promise.reject(new Error('offline'));
    return Promise.resolve(questionFor(advanced));
  };
  context.window.apiPost = async () => ({ success: true });

  context.wechsleQuizSchwierigkeitsgrad({ target: { value: 'Fortgeschritten' } });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(calls.find(call => call.action === 'quizQuestion').params.schwierigkeitsgrad, 'Fortgeschritten');
  assert.equal(vm.runInContext('fragenIndex', context), 0);
  assert.equal(vm.runInContext('aktuelleFrage.frageId', context), 'r-f1');
  assert.equal(ui.card.hidden, false);
});
