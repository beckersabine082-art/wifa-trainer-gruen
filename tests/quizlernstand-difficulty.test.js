import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadQuizLernstand() {
  const source = fs.readFileSync(path.join(import.meta.dirname, '../js/quizlernstand.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');
  const context = {
    console,
    document: { getElementById: () => null },
    auth: { currentUser: { uid: 'u1', emailVerified: true } },
    Array, String, Number, Boolean, Date, Intl, Map, Set, Object, Math
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

const catalog = [
  { quizKey: 'Recht::r1', fach: 'Recht', schwierigkeitsgrad: 'Einsteiger' },
  { quizKey: 'Recht::r2', fach: 'Recht', schwierigkeitsgrad: 'Fortgeschritten' },
  { quizKey: 'Marketing::m1', fach: 'Marketing', schwierigkeitsgrad: 'Einsteiger' },
  { quizKey: 'Marketing::m2', fach: 'Marketing', schwierigkeitsgrad: 'Profi' }
];
const attempts = [
  { quizKey: 'Recht::r1', fach: 'Recht', richtig: true },
  { quizKey: 'Recht::r1', fach: 'Recht', richtig: false }, // älterer Attempt derselben Frage
  { quizKey: 'Recht::r2', fach: 'Recht', richtig: false },
  { quizKey: 'Marketing::m1', fach: 'Marketing', richtig: false },
  { quizKey: 'Marketing::m2', fach: 'Marketing', richtig: true }
];

test('Schwierigkeitswerte zählen je neuestem Quiz-Key über alle Fächer', () => {
  const context = loadQuizLernstand();
  const stats = context.summarizeByDifficulty(attempts, catalog);

  assert.deepEqual(JSON.parse(JSON.stringify(stats)), [
    { schwierigkeitsgrad: 'Einsteiger', richtig: 1, falsch: 1, bearbeitet: 2, prozent: 50 },
    { schwierigkeitsgrad: 'Fortgeschritten', richtig: 0, falsch: 1, bearbeitet: 1, prozent: 0 },
    { schwierigkeitsgrad: 'Profi', richtig: 1, falsch: 0, bearbeitet: 1, prozent: 100 }
  ]);
});

test('Fachfilter trennt Schwierigkeitswerte und leere Stufen ergeben 0%', () => {
  const context = loadQuizLernstand();
  const recht = context.summarizeByDifficulty(attempts, catalog, 'Recht');
  const marketing = context.summarizeByDifficulty(attempts, catalog, 'Marketing');

  assert.deepEqual(JSON.parse(JSON.stringify(recht)), [
    { schwierigkeitsgrad: 'Einsteiger', richtig: 1, falsch: 0, bearbeitet: 1, prozent: 100 },
    { schwierigkeitsgrad: 'Fortgeschritten', richtig: 0, falsch: 1, bearbeitet: 1, prozent: 0 },
    { schwierigkeitsgrad: 'Profi', richtig: 0, falsch: 0, bearbeitet: 0, prozent: 0 }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(marketing)), [
    { schwierigkeitsgrad: 'Einsteiger', richtig: 0, falsch: 1, bearbeitet: 1, prozent: 0 },
    { schwierigkeitsgrad: 'Fortgeschritten', richtig: 0, falsch: 0, bearbeitet: 0, prozent: 0 },
    { schwierigkeitsgrad: 'Profi', richtig: 1, falsch: 0, bearbeitet: 1, prozent: 100 }
  ]);
});
