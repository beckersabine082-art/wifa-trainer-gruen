const test = require('node:test');
const assert = require('node:assert/strict');

const { injectStagingRuntime, rewriteApiUrl } = require('../tools/podcast-sync/staging-preview');

test('staging preview injects only the approved podcast prefix before application scripts', () => {
  const html = '<html><body><script src="js/api.js"></script></body></html>';
  const output = injectStagingRuntime(html);
  assert.match(output, /window\.WIFA_PODCAST_STORAGE_PREFIX="podcast\/staging\/lerntext-rev2\/"/);
  assert.ok(output.indexOf('WIFA_PODCAST_STORAGE_PREFIX') < output.indexOf('js/api.js'));
  assert.match(output, /zeigeBereich\('lerntextePodcastView'\)/);
});

test('staging preview rewrites a local response without changing the checked-in API source', () => {
  const source = 'const API_BASE_URL = "https://example.invalid/prod";';
  const staging = 'https://script.google.com/macros/s/staging/exec';
  assert.equal(rewriteApiUrl(source, staging), `const API_BASE_URL = "${staging}";`);
  assert.throws(() => rewriteApiUrl('const other = 1;', staging), /API_BASE_URL/);
});
