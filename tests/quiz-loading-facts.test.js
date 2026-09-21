const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadQuizLoadingView() {
  const source = fs.readFileSync(path.join(__dirname, '../js/quiz.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/export\s+/g, '');
  const status = {
    children: [], textContent: '',
    replaceChildren(...children) { this.children = children; },
    appendChild(child) { this.children.push(child); }
  };
  const document = {
    getElementById: id => id === 'quizStatus' ? status : null,
    createElement: tagName => ({ tagName, className: '', textContent: '' })
  };
  const context = {
    console, window: {}, document,
    Math: { floor: Math.floor, random: () => 0 },
    Array, String, Number, Boolean, Object, Date, RegExp, Map, Set, Error,
    setTimeout, clearTimeout
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, status };
}

function rendered(status) {
  return status.children.map(child => child.textContent);
}

test('initialer Katalog-Load zeigt kurzen Hinweis und allgemeinen Fact', () => {
  const fixture = loadQuizLoadingView();
  vm.runInContext("setzeQuizLadehinweis('', 'katalog')", fixture.context);
  assert.deepEqual(rendered(fixture.status), [
    'Quiz lädt …', 'Wusstest du schon?',
    'Lernen gelingt oft besser in kurzen, konzentrierten Einheiten.'
  ]);
});

test('Fragen-Load mit bekanntem Fach zeigt kurzen Hinweis und Fach-Fact', () => {
  const fixture = loadQuizLoadingView();
  vm.runInContext("setzeQuizLadehinweis('Marketing')", fixture.context);
  assert.equal(rendered(fixture.status)[0], 'Frage lädt …');
  assert.match(rendered(fixture.status)[2], /AIDA|USP|Marktsegmentierung/);
});

test('Fact wird getrennt vom Ladehinweis dargestellt', () => {
  const fixture = loadQuizLoadingView();
  vm.runInContext("setzeQuizLadehinweis('Recht')", fixture.context);
  assert.equal(fixture.status.children.length, 3);
  assert.equal(fixture.status.children[0].className, 'quiz-loading-hinweis');
  assert.equal(fixture.status.children[2].className, 'quiz-loading-fact');
});

test('Fact-Bereich verwendet die vorgesehene Hervorhebung', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  assert.match(css, /\.quiz-loading-fact\s*\{[\s\S]*color:\s*#4a3970;[\s\S]*font-size:[\s\S]*font-weight:\s*700/);
  assert.match(css, /\.quiz-loading-fact-label\s*\{[\s\S]*color:\s*#5a4a80;/);
});

test('Shuffle/Mix nutzt bei bekanntem Fach den Fach-Fact, sonst den allgemeinen Fact', () => {
  const fixture = loadQuizLoadingView();
  vm.runInContext("setzeQuizLadehinweis('Logistik')", fixture.context);
  assert.match(rendered(fixture.status)[2], /Lieferzeit|Lagerbestände|Warenfluss/);
  vm.runInContext("setzeQuizLadehinweis('')", fixture.context);
  assert.match(rendered(fixture.status)[2], /Lernen|Wiederholen|Überblick/);
});

test('jeder vorhandene Fach-Pool enthält deutlich mehr als drei Facts', () => {
  const fixture = loadQuizLoadingView();
  const expectedSubjects = [
    'allgemein', 'Marketing', 'Recht', 'Rechnungswesen', 'Logistik', 'BWL', 'VWL', 'Steuern',
    'Unternehmensführung', 'Führung und Zusammenarbeit', 'Betriebliches Management', 'Vertrieb',
    'Investition und Finanzierung', 'Betriebliches Rechnungswesen und Controlling'
  ];
  for (const subject of expectedSubjects) {
    const pool = vm.runInContext(`QUIZ_LADEFACTS[${JSON.stringify(subject)}]`, fixture.context);
    assert.ok(Array.isArray(pool), subject);
    assert.ok(pool.length >= 10, subject);
    assert.equal(new Set(pool).size, pool.length, subject);
  }
});

test('unmittelbare Fact-Wiederholung desselben Fachs wird vermieden', () => {
  const fixture = loadQuizLoadingView();
  vm.runInContext("setzeQuizLadehinweis('Marketing')", fixture.context);
  const first = rendered(fixture.status)[2];
  vm.runInContext("setzeQuizLadehinweis('Marketing')", fixture.context);
  assert.notEqual(rendered(fixture.status)[2], first);
});

test('unbekanntes Fach verwendet weiterhin den allgemeinen Pool', () => {
  const fixture = loadQuizLoadingView();
  vm.runInContext("setzeQuizLadehinweis('Unbekannt')", fixture.context);
  const generalPool = vm.runInContext('QUIZ_LADEFACTS.allgemein', fixture.context);
  assert.ok(generalPool.includes(rendered(fixture.status)[2]));
});
