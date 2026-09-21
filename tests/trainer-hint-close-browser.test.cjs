const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('trainer hint close button is visible and closes only the current hint bubble', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  const trainer = fs.readFileSync(path.join(root, 'js/wissensdatenbank.js'), 'utf8');

  assert.match(html, /id="trainerHintBubble"[\s\S]*class="trainer-hint-close"[\s\S]*schliesseTrainerHint\(\)/);
  assert.doesNotMatch(css, /\.trainer-hint-header\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css, /\.trainer-hint-close\s*\{[\s\S]*position:\s*absolute;/);
  assert.match(trainer, /function schliesseTrainerHint\(\)[\s\S]*hintBubble\.hidden\s*=\s*true/);
  assert.doesNotMatch(trainer, /function schliesseTrainerHint\(\)[\s\S]*kilianBubbleFenster/);
});
