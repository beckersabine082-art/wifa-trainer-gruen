const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCelebration() {
  const source = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
  const start = source.indexOf('  const erfolgsFortschritt = {};');
  const end = source.indexOf('  // Aktueller Nutzer', start);
  assert.ok(start >= 0 && end > start, 'success progress reporter exists in main.js');
  const storage = new Map();
  const children = [];
  const document = {
    getElementById(id) { return children.find(element => element.id === id) || null; },
    createElement(tagName) {
      return { tagName, setAttribute() {}, remove() { const index = children.indexOf(this); if (index >= 0) children.splice(index, 1); } };
    },
    body: { appendChild(element) { children.push(element); } }
  };
  const window = {
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }
    },
    setTimeout() {}
  };
  vm.runInNewContext(source.slice(start, end), { window, document });
  return { window, document, children, storage };
}

test('success celebration waits for three scores strictly above 80 and appears once', () => {
  const fixture = loadCelebration();
  const report = fixture.window.meldeErfolgsFortschritt;

  report('trainer', 100, 'user-1');
  report('quiz', 81, 'user-1');
  assert.equal(fixture.children.length, 0);
  report('pruefung', 80, 'user-1');
  assert.equal(fixture.children.length, 0);

  report('pruefung', 81, 'user-1');
  assert.equal(fixture.children.length, 1);
  assert.match(fixture.children[0].innerHTML, /Stark!/);
  assert.equal(fixture.children[0].className, 'erfolg-ueber80-overlay');
  assert.equal((fixture.children[0].innerHTML.match(/erfolg-konfetti-teil/g) || []).length, 72);
  assert.equal((fixture.children[0].innerHTML.match(/erfolg-konfetti-zweite-welle/g) || []).length, 36);
  assert.match(fixture.children[0].innerHTML, /80&nbsp;%/);
  report('quiz', 100, 'user-1');
  assert.equal(fixture.children.length, 1);
  assert.equal(fixture.storage.get('wifa.erfolg.ueber80.v1.user-1'), 'true');
});

test('scores from different user accounts cannot combine', () => {
  const fixture = loadCelebration();
  const report = fixture.window.meldeErfolgsFortschritt;
  report('trainer', 90, 'user-1');
  report('quiz', 90, 'user-2');
  report('pruefung', 90, 'user-2');
  assert.equal(fixture.children.length, 0);
});

test('navigation placeholder and quiz button hierarchy are present', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  assert.match(html, /<button[^>]*id="navPraesentation"[^>]*>[\s\S]*<img src="images\/presentation-icon\.png"[\s\S]*<span>Präsentation<\/span><\/button>/);
  assert.match(html, /id="praesentationView"[\s\S]*?Dieser Bereich wird vorbereitet/);
  const evaluateButton = html.match(/<button[^>]*quiz-auswerten-btn[^>]*>/)?.[0] || '';
  const restartButton = html.match(/<button[^>]*quiz-von-vorne-btn[^>]*>/)?.[0] || '';
  assert.match(evaluateButton, /id="quizPruefenBtn"/);
  assert.match(restartButton, /id="quizVonVorneBtn"/);
  assert.match(css, /\.quiz-actions \.quiz-auswerten-btn\s*\{[^}]*min-height:\s*48px/s);
  assert.match(css, /\.quiz-actions \.quiz-von-vorne-btn\s*\{[^}]*font-size:\s*0\.85rem/s);
  assert.match(css, /\.erfolg-ueber80-overlay\s*\{[^}]*z-index:\s*12000/s);
  assert.match(css, /\.erfolg-konfetti-zweite-welle\s*\{[^}]*1\.7s/s);
  assert.match(css, /\.erfolg-ueber80-quote\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.nav-btn-praesentation img\s*\{[^}]*width:\s*35px[^}]*height:\s*35px[^}]*object-fit:\s*contain/s);
});
