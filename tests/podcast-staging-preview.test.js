const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const {
  DEFAULT_STAGING_API_URL,
  createServer,
  injectStagingRuntime,
  rewriteApiUrl
} = require('../tools/podcast-sync/staging-preview');

test('staging preview defaults to the dedicated staging deployment, never production', () => {
  assert.equal(
    DEFAULT_STAGING_API_URL,
    'https://script.google.com/macros/s/AKfycbwGFmFLFMfsRgOmLF-uwTH6xc8E_AaorV5AoiQLmXWzd4FZUdu92YT7SE8YVs2wLZ32_Q/exec'
  );
  assert.notEqual(
    DEFAULT_STAGING_API_URL,
    'https://script.google.com/macros/s/AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA/exec'
  );
});

test('staging preview serves js/api.js with the staging deployment URL', async (t) => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/js/api.js`);
  const source = await response.text();
  assert.equal(response.status, 200);
  assert.match(source, new RegExp(DEFAULT_STAGING_API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA/);
});

test('staging preview injects only the approved podcast prefix before application scripts', () => {
  const html = '<html><body><script>window.WIFA_RELEASE_ENVIRONMENT="PRODUCTION";</script><script src="js/runtime-config.js"></script><script src="js/api.js"></script></body></html>';
  const output = injectStagingRuntime(html);
  assert.match(output, /window\.WIFA_RELEASE_ENVIRONMENT="STAGING"/);
  assert.doesNotMatch(output, /window\.WIFA_RELEASE_ENVIRONMENT="PRODUCTION"/);
  assert.ok(output.indexOf('WIFA_RELEASE_ENVIRONMENT="STAGING"') < output.indexOf('js/runtime-config.js'));
});

test('staging preview opens the podcast through the real authentication gate', () => {
  const html = '<html><body><script>window.WIFA_RELEASE_ENVIRONMENT="PRODUCTION";</script><script src="js/runtime-config.js"></script><script src="js/api.js"></script></body></html>';
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

test('diagnostic scripts are injected only for the explicit local diagnostic mode', () => {
  const html = '<html><body><script>window.WIFA_RELEASE_ENVIRONMENT="PRODUCTION";</script><script src="js/runtime-config.js"></script><script src="js/api.js"></script></body></html>';
  assert.doesNotMatch(injectStagingRuntime(html), /staging-storage-diagnostic/);
  const diagnostic = injectStagingRuntime(html, { diagnostic: true });
  assert.match(diagnostic, /staging-storage-diagnostic-core\.js/);
  assert.match(diagnostic, /staging-storage-diagnostic\.mjs/);
});

test('staging preview rewrites a local response without changing the checked-in API source', () => {
  const source = 'const API_BASE_URL = "https://example.invalid/prod";';
  const staging = 'https://script.google.com/macros/s/staging/exec';
  assert.equal(rewriteApiUrl(source, staging), `const API_BASE_URL = "${staging}";`);
  assert.throws(() => rewriteApiUrl('const other = 1;', staging), /API_BASE_URL/);
});
