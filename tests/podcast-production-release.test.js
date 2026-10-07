const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runtime = require('../js/runtime-config');
const {
  PRODUCTION_PODCAST_PREFIX,
  PRODUCTION_PODCAST_VERSION,
  buildPromotionManifest,
  validatePromotionManifest
} = require('../tools/release/podcast-promotion');

const ROOT = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs/podcast-staging-migration-2026-10-04/storage-paths.json'), 'utf8'));
const migration = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs/podcast-staging-migration-2026-10-04/migration-result.json'), 'utf8'));
const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'release/WIFA-GESAMT-PROD-20261007-RC1/podcast/PRODUCTION_PODCAST_PROMOTION_MANIFEST.json'), 'utf8'));

test('runtime config separates staging and immutable production podcast namespaces', () => {
  const staging = runtime.resolveRuntimeConfig('STAGING');
  const production = runtime.resolveRuntimeConfig('PRODUCTION');
  assert.deepEqual(staging, {
    environment: 'STAGING',
    podcastVersion: 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1',
    podcastPrefix: 'podcast/staging/lerntext-rev2/'
  });
  assert.deepEqual(production, {
    environment: 'PRODUCTION',
    podcastVersion: PRODUCTION_PODCAST_VERSION,
    podcastPrefix: PRODUCTION_PODCAST_PREFIX
  });
  assert.throws(() => runtime.resolveRuntimeConfig(''), /Umgebung/);
  assert.throws(() => runtime.resolveRuntimeConfig('preview'), /Umgebung/);
});

test('production promotion manifest maps all 110 objects without overwriting legacy paths', () => {
  const built = buildPromotionManifest({ inventory, migration });
  assert.deepEqual(saved, built);
  const report = validatePromotionManifest(saved);
  assert.deepEqual(report, { objects: 110, runtimeObjects: 26, totalBytes: 860568743 });
  assert.equal(saved.version, PRODUCTION_PODCAST_VERSION);
  assert.equal(saved.sourcePrefix, 'podcast/staging/lerntext-rev2/');
  assert.equal(saved.targetPrefix, PRODUCTION_PODCAST_PREFIX);
  assert.equal(new Set(saved.objects.map(item => item.sourcePath)).size, 110);
  assert.equal(new Set(saved.objects.map(item => item.targetPath)).size, 110);
  assert.equal(saved.objects.filter(item => item.runtimeClientObject).length, 26);
  for (const item of saved.objects) {
    assert.match(item.sourceGeneration, /^\d+$/);
    assert.match(item.sourceIdentitySha256, /^[a-f0-9]{64}$/);
    assert.ok(item.size > 0);
    assert.ok(['application/json', 'audio/mpeg'].includes(item.contentType));
    assert.ok(item.targetPath.startsWith(PRODUCTION_PODCAST_PREFIX));
    assert.ok(!item.targetPath.startsWith('podcast/continuous/'));
    if (item.runtimeClientObject) assert.match(item.contentSha256, /^[a-f0-9]{64}$/);
  }
});

test('promotion manifest fails closed on missing, duplicate or unversioned runtime objects', () => {
  assert.throws(() => buildPromotionManifest({ inventory: { ...inventory, objects: inventory.objects.slice(1) }, migration }), /110/);
  assert.throws(() => validatePromotionManifest({ ...saved, objects: [...saved.objects, saved.objects[0]] }), /110|doppelt/);
  const corrupted = structuredClone(saved);
  corrupted.objects.find(item => item.runtimeClientObject).targetPath = 'podcast/continuous/recht.json';
  assert.throws(() => validatePromotionManifest(corrupted), /Produktionspräfix/);
});

test('browser entry point resolves an explicit production config before podcast runtime code', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const environment = html.indexOf('window.WIFA_RELEASE_ENVIRONMENT="PRODUCTION"');
  const config = html.indexOf('js/runtime-config.js');
  const continuous = html.indexOf('js/podcast-continuous.js');
  assert.ok(environment >= 0);
  assert.ok(config > environment);
  assert.ok(continuous > config);
});
