const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadQuiz() {
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
