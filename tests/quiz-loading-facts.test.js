const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('wählt beim Quiz-Ladehinweis einen passenden Fach-Fact', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');
  const status = { textContent: '' };
  const context = {
    console,
    window: {},
    document: { getElementById: id => id === 'quizStatus' ? status : null },
    Math: { floor: Math.floor, random: () => 0 },
    Array, String, Number, Boolean, Object, Date, RegExp, Map, Set, Error,
    setTimeout, clearTimeout
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);

  vm.runInContext("setzeQuizLadehinweis('Marketing')", context);
  assert.match(status.textContent, /Frage wird geladen/);
  assert.match(status.textContent, /Marketing|AIDA|Markt/);

  vm.runInContext("setzeQuizLadehinweis('Unbekannt')", context);
  assert.match(status.textContent, /Frage wird geladen/);
  assert.match(status.textContent, /WiFa|Prüfung|Lernen/);
});
