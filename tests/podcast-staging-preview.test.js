const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { injectStagingRuntime, rewriteApiUrl } = require('../tools/podcast-sync/staging-preview');

test('staging preview injects only the approved podcast prefix before application scripts', () => {
  const html = '<html><body><script src="js/api.js"></script></body></html>';
  const output = injectStagingRuntime(html);
  assert.match(output, /window\.WIFA_PODCAST_STORAGE_PREFIX="podcast\/staging\/lerntext-rev2\/"/);
  assert.ok(output.indexOf('WIFA_PODCAST_STORAGE_PREFIX') < output.indexOf('js/api.js'));
});

test('staging preview opens the podcast through the real authentication gate', () => {
  const html = '<html><body><script src="js/api.js"></script></body></html>';
  const output = injectStagingRuntime(html);
  const scripts = Array.from(output.matchAll(/<script>([\s\S]*?)<\/script>/g), match => match[1]);
  const calls = [];
  const context = {
    window: {
      addEventListener(type, listener) {
        if (type === 'load') listener();
      },
      requireAuth(target) { calls.push(['requireAuth', target]); }
    },
    setTimeout(callback) { callback(); },
    zeigeBereich(target) { calls.push(['zeigeBereich', target]); }
  };
  context.window.window = context.window;
  scripts.forEach(script => vm.runInNewContext(script, context));
  assert.deepEqual(calls, [['requireAuth', 'lerntextePodcastView']]);
});

test('staging preview rewrites a local response without changing the checked-in API source', () => {
  const source = 'const API_BASE_URL = "https://example.invalid/prod";';
  const staging = 'https://script.google.com/macros/s/staging/exec';
  assert.equal(rewriteApiUrl(source, staging), `const API_BASE_URL = "${staging}";`);
  assert.throws(() => rewriteApiUrl('const other = 1;', staging), /API_BASE_URL/);
});
