const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runtime = require('../js/runtime-config');
const {
  PRODUCTION_PODCAST_PREFIX,
  PRODUCTION_PODCAST_VERSION,
  PRODUCTION_PODCAST_PREFIX_V2,
  PRODUCTION_PODCAST_VERSION_V2,
  buildPromotionManifest,
  buildV2RuntimePromotionManifest,
  deriveProductionSidecar,
  validateV2RuntimePromotionManifest,
  validatePromotionManifest
} = require('../tools/release/podcast-promotion');

const ROOT = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs/podcast-staging-migration-2026-10-04/storage-paths.json'), 'utf8'));
const migration = JSON.parse(fs.readFileSync(path.join(ROOT, 'outputs/podcast-staging-migration-2026-10-04/migration-result.json'), 'utf8'));
const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'release/WIFA-GESAMT-PROD-20261007-RC1/podcast/PRODUCTION_PODCAST_PROMOTION_MANIFEST.json'), 'utf8'));
const savedV2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'release/WIFA-GESAMT-PROD-20261007-RC1/podcast/PRODUCTION_PODCAST_PROMOTION_MANIFEST_V2.json'), 'utf8'));

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
    podcastVersion: PRODUCTION_PODCAST_VERSION_V2,
    podcastPrefix: PRODUCTION_PODCAST_PREFIX_V2
  });
  assert.throws(() => runtime.resolveRuntimeConfig(''), /Umgebung/);
  assert.throws(() => runtime.resolveRuntimeConfig('preview'), /Umgebung/);
});

test('production runtime uses the validated immutable v2 runtime manifest', () => {
  assert.deepEqual(validateV2RuntimePromotionManifest(savedV2), {
    objects: 26,
    runtimeObjects: 26,
    sidecars: 13,
    bundles: 13,
    ids: 521,
    chapters: 48
  });
  assert.equal(savedV2.version, runtime.resolveRuntimeConfig('PRODUCTION').podcastVersion);
  assert.equal(savedV2.targetPrefix, runtime.resolveRuntimeConfig('PRODUCTION').podcastPrefix);
  assert.equal(savedV2.sidecars.some(item => /podcast\/staging\//i.test(item.runtimeSidecarText)), false);
  assert.equal(savedV2.sidecars.some(item => !item.targetPath.startsWith(PRODUCTION_PODCAST_PREFIX_V2)), false);
  assert.equal(savedV2.sidecars.some(item => !item.mp3Path.startsWith(PRODUCTION_PODCAST_PREFIX_V2)), false);
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

test('v2 sidecar derivation changes only runtime version and active MP3 path', () => {
  const source = {
    schemaVersion: 2,
    bundleVersion: 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1',
    chapterGroups: [{ chapterKey: 'recht-bgb-at', startIndex: 0, endIndex: 1 }],
    fach: 'Recht',
    bundleHash: 'a'.repeat(64),
    mp3Path: 'podcast/staging/lerntext-rev2/continuous/recht/' + 'a'.repeat(64) + '.mp3',
    duration: 12.5,
    chapters: [
      { lerntextId: 'LZ-RE-01', chapterKey: 'recht-bgb-at', startOffset: 0, endOffset: 5,
        legacyMp3Path: 'podcast/recht-eins.mp3', legacyJsonPath: 'podcast/recht-eins.json' },
      { lerntextId: 'LZ-RE-02', chapterKey: 'recht-bgb-at', startOffset: 5, endOffset: 12.5,
        legacyMp3Path: 'podcast/recht-zwei.mp3', legacyJsonPath: 'podcast/recht-zwei.json' }
    ]
  };
  const result = deriveProductionSidecar({ sourceSidecar: source });
  assert.equal(result.sidecar.bundleVersion, PRODUCTION_PODCAST_VERSION_V2);
  assert.equal(result.sidecar.mp3Path,
    PRODUCTION_PODCAST_PREFIX_V2 + 'continuous/recht/' + 'a'.repeat(64) + '.mp3');
  assert.equal(result.sidecar.chapters[0].legacyMp3Path, source.chapters[0].legacyMp3Path);
  assert.equal(result.sidecar.chapters[0].legacyJsonPath, source.chapters[0].legacyJsonPath);
  assert.equal(JSON.stringify(result.sidecar).includes('podcast/staging/'), false);
  const restored = structuredClone(result.sidecar);
  restored.bundleVersion = source.bundleVersion;
  restored.mp3Path = source.mp3Path;
  assert.deepEqual(restored, source);
  assert.match(result.manifestHash, /^[a-f0-9]{64}$/);
});

test('v2 runtime promotion is self-contained, preserves MP3 hashes and rejects hidden staging paths', () => {
  const hash = 'b'.repeat(64);
  const sourceSidecarPath = 'podcast/staging/lerntext-rev2/continuous/recht.json';
  const sourceMp3Path = `podcast/staging/lerntext-rev2/continuous/recht/${hash}.mp3`;
  const sourceSidecar = {
    schemaVersion: 2,
    bundleVersion: 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1',
    chapterGroups: [{ chapterKey: 'recht-bgb-at', startIndex: 0, endIndex: 0 }],
    fach: 'Recht', bundleHash: hash, mp3Path: sourceMp3Path, duration: 7,
    chapters: [{ lerntextId: 'LZ-RE-01', chapterKey: 'recht-bgb-at', startOffset: 0, endOffset: 7 }]
  };
  const sourceBytes = Buffer.from(JSON.stringify(sourceSidecar));
  const sourceManifestHash = require('node:crypto').createHash('sha256').update(sourceBytes).digest('hex');
  const v1 = {
    sourceVersion: sourceSidecar.bundleVersion,
    sourcePrefix: 'podcast/staging/lerntext-rev2/',
    objects: [
      { sourcePath: sourceSidecarPath, sourceGeneration: '11', sourceIdentitySha256: 'c'.repeat(64),
        contentSha256: sourceManifestHash, size: sourceBytes.length, contentType: 'application/json', runtimeClientObject: true },
      { sourcePath: sourceMp3Path, sourceGeneration: '12', sourceIdentitySha256: 'd'.repeat(64),
        contentSha256: hash, size: 1234, contentType: 'audio/mpeg', runtimeClientObject: true }
    ]
  };
  const built = buildV2RuntimePromotionManifest({
    v1Manifest: v1,
    sourceSidecars: { [sourceSidecarPath]: sourceBytes },
    expected: { subjects: 1, ids: 1, chapters: 1 }
  });
  assert.equal(built.version, PRODUCTION_PODCAST_VERSION_V2);
  assert.equal(built.targetPrefix, PRODUCTION_PODCAST_PREFIX_V2);
  assert.equal(built.objects.length, 2);
  assert.equal(built.objects.filter(item => item.kind === 'sidecar').length, 1);
  assert.equal(built.objects.filter(item => item.kind === 'bundle').length, 1);
  assert.equal(built.objects.find(item => item.kind === 'bundle').contentSha256, hash);
  assert.notEqual(built.objects.find(item => item.kind === 'sidecar').contentSha256, sourceManifestHash);
  assert.equal(built.sidecars[0].runtimeSidecarText.includes('staging'), false);
  assert.deepEqual(validateV2RuntimePromotionManifest(built, { subjects: 1, ids: 1, chapters: 1 }), {
    objects: 2, runtimeObjects: 2, sidecars: 1, bundles: 1, ids: 1, chapters: 1
  });

  const corrupted = structuredClone(sourceSidecar);
  corrupted.chapters[0].unexpectedRuntimePath = 'podcast/staging/hidden.mp3';
  assert.throws(() => deriveProductionSidecar({ sourceSidecar: corrupted }), /staging/i);
});
