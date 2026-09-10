const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareLocalInput, validateLocalResult } = require('../tools/podcast-sync/local-audio.js');

test('Originalwörter einschließlich Vergleichsformeln und Apostroph bleiben erhalten', () => {
  const input = prepareLocalInput('Bei Ist < Plan gilt A. Bei Ist > Plan gilt B. Manager’s Kosten-Nutzen.');
  assert.deepEqual(input.words.map(w => w.wort), ['Bei','Ist','Plan','gilt','A','Bei','Ist','Plan','gilt','B','Manager’s','Kosten-Nutzen']);
  assert.ok(input.text.includes('< Plan gilt A. Bei Ist >'));
});

test('Zeitmarken müssen vollständig, positiv, monoton und innerhalb der Audiodauer sein', () => {
  const input = prepareLocalInput('Ein Test.');
  const result = { duration: 1, peak: 0.5, rms: 0.1, wortZeitmarken: [
    { wortIndex: 0, wort: 'Ein', start: 0.05, end: 0.4 },
    { wortIndex: 1, wort: 'Test', start: 0.4, end: 0.9 }
  ] };
  assert.doesNotThrow(() => validateLocalResult(input, result));
  for (const bad of [
    {...result, wortZeitmarken: result.wortZeitmarken.slice(1)},
    {...result, peak: 0}, {...result, duration: 0},
    {...result, wortZeitmarken: [{...result.wortZeitmarken[0], start: -1},result.wortZeitmarken[1]]},
    {...result, wortZeitmarken: [result.wortZeitmarken[0],{...result.wortZeitmarken[1],end: 2}]},
    {...result, wortZeitmarken: [result.wortZeitmarken[0],{...result.wortZeitmarken[1],wort: 'falsch'}]}
  ]) assert.throws(() => validateLocalResult(input, bad));
});
