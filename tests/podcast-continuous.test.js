const assert = require('node:assert/strict');
const { test } = require('node:test');

let helper = {};
try {
  helper = require('../js/podcast-continuous.js');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

const HASH = 'a'.repeat(64);
const MANIFEST_HASH = 'b'.repeat(64);
const MP3_PATH = `podcast/continuous/recht/${HASH}.mp3`;
const SAMPLE_RATE = 22050;

function fixture() {
  const currentEntries = Array.from({ length: 57 }, (_, index) => ({
    index,
    titel: `Titel ${index + 1}`,
    hauptkapitel: `Hauptkapitel ${Math.floor(index / 3) + 1}`,
    hauptkapitelNr: String(Math.floor(index / 3) + 1),
    unterkapitelNr: `${Math.floor(index / 3) + 1}.${index % 3 + 1}`,
    lerntextHash: index.toString(16).padStart(64, '0'),
    legacyMp3Path: `podcast/recht-kapitel-${index + 1}.mp3`,
    legacyJsonPath: `podcast/recht-kapitel-${index + 1}.json`
  }));
  const chapters = currentEntries.map(entry => ({
    ...entry,
    startSample: entry.index * SAMPLE_RATE,
    endSample: (entry.index + 1) * SAMPLE_RATE,
    start: entry.index,
    end: entry.index + 1,
    wortZeitmarken: [{ wortIndex: 0, wort: 'Wort', start: 0, end: 0.75 }]
  }));
  return {
    manifest: {
      schemaVersion: 1,
      fach: 'Recht',
      bundleHash: HASH,
      mp3Path: MP3_PATH,
      duration: 57,
      sampleCount: 57 * SAMPLE_RATE,
      encoding: { container: 'mp3', codec: 'mp3', bitrateKbps: 96, sampleRateHz: SAMPLE_RATE, channels: 1, pcmFormat: 's16le' },
      chapters
    },
    manifestHash: MANIFEST_HASH,
    mp3Metadata: { customMetadata: { bundleHash: HASH, manifestHash: MANIFEST_HASH } },
    currentEntries
  };
}

function invalidWith(change) {
  const input = fixture();
  change(input);
  assert.equal(helper.validateRechtBundle(input).valid, false);
}

function genericFixture(fach = 'Steuern', count = 3) {
  const input = fixture();
  const slug = 'steuern';
  input.expectedFach = fach;
  input.expectedMp3Prefix = `podcast/continuous/${slug}/`;
  input.manifest.fach = fach;
  input.manifest.mp3Path = `${input.expectedMp3Prefix}${HASH}.mp3`;
  input.currentEntries = input.currentEntries.slice(0, count).map(entry => ({
    ...entry,
    fach,
    legacyMp3Path: entry.legacyMp3Path.replace('recht-', `${slug}-`),
    legacyJsonPath: entry.legacyJsonPath.replace('recht-', `${slug}-`)
  }));
  input.manifest.chapters = input.currentEntries.map((entry, index) => ({
    ...entry,
    startSample: index * SAMPLE_RATE,
    endSample: (index + 1) * SAMPLE_RATE,
    start: index,
    end: index + 1,
    wortZeitmarken: [{ wortIndex: 0, wort: 'Wort', start: 0, end: 0.75 }]
  }));
  input.manifest.duration = count;
  input.manifest.sampleCount = count * SAMPLE_RATE;
  return input;
}

test('accepts a non-Recht bundle with an exact, nonempty current chapter count', () => {
  assert.deepEqual(helper.validateContinuousBundle(genericFixture()), { valid: true, reason: null });
  assert.deepEqual(helper.validateContinuousBundle(genericFixture('Steuern', 4)), { valid: true, reason: null });
  const empty = genericFixture('Steuern', 0);
  assert.equal(helper.validateContinuousBundle(empty).valid, false);
  const fewerCurrent = genericFixture();
  fewerCurrent.currentEntries.pop();
  assert.equal(helper.validateContinuousBundle(fewerCurrent).valid, false);
  const fewerChapters = genericFixture();
  fewerChapters.manifest.chapters.pop();
  assert.equal(helper.validateContinuousBundle(fewerChapters).valid, false);
});

test('rejects wrong subject, slug, path prefix, and mixed current subjects', () => {
  const cases = [
    input => { input.manifest.fach = 'Recht'; },
    input => { input.expectedFach = 'Recht'; },
    input => { input.expectedMp3Prefix = 'podcast/continuous/recht/'; },
    input => { input.manifest.mp3Path = `podcast/continuous/recht/${HASH}.mp3`; },
    input => { input.currentEntries[1].fach = 'Recht'; },
    input => { delete input.currentEntries[1].fach; }
  ];
  for (const change of cases) {
    const input = genericFixture();
    change(input);
    assert.equal(helper.validateContinuousBundle(input).valid, false);
  }
});

test('generic validation retains hash, encoding, identity, sample, and word-mark gates', () => {
  const cases = [
    input => { input.manifest.schemaVersion = 3; },
    input => { input.manifest.bundleHash = 'invalid'; },
    input => { input.mp3Metadata.customMetadata.manifestHash = 'c'.repeat(64); },
    input => { input.manifest.encoding.channels = 2; },
    input => { input.manifest.chapters[1].lerntextHash = 'f'.repeat(64); },
    input => { input.manifest.chapters[1].legacyJsonPath = 'podcast/other.json'; },
    input => { input.manifest.chapters[1].startSample += 1; },
    input => { input.manifest.chapters[1].wortZeitmarken[0].end = 1.1; }
  ];
  for (const change of cases) {
    const input = genericFixture();
    change(input);
    assert.equal(helper.validateContinuousBundle(input).valid, false);
  }
});

test('accepts schema 2 only with exact stable IDs, version, origins, hashes and contiguous visible chapter groups', () => {
  const input = genericFixture();
  input.expectedStoragePrefix = 'podcast/staging/lerntext-rev2/';
  input.expectedMp3Prefix = 'podcast/staging/lerntext-rev2/continuous/steuern/';
  input.manifest.schemaVersion = 2;
  input.manifest.bundleVersion = 'TEST-BUNDLE-v2';
  input.manifest.mp3Path = input.expectedMp3Prefix + HASH + '.mp3';
  input.manifest.chapters.forEach((chapter, index) => {
    chapter.lerntextId = `LZ-ST-${index + 1}`;
    chapter.chapterKey = index < 2 ? 'ui-wq-1' : 'ui-wq-2';
    chapter.origin = index === 1 ? 'regenerated' : 'reused';
    chapter.segmentHash = String(index + 1).padStart(64, 'a').slice(-64);
    input.currentEntries[index].lerntextId = chapter.lerntextId;
  });
  input.manifest.chapterGroups = [
    { chapterKey: 'ui-wq-1', chapterNumber: input.manifest.chapters[0].hauptkapitelNr,
      chapterTitle: input.manifest.chapters[0].hauptkapitel, startIndex: 0, endIndex: 1,
      lerntextIds: ['LZ-ST-1', 'LZ-ST-2'] },
    { chapterKey: 'ui-wq-2', chapterNumber: input.manifest.chapters[2].hauptkapitelNr,
      chapterTitle: input.manifest.chapters[2].hauptkapitel, startIndex: 2, endIndex: 2,
      lerntextIds: ['LZ-ST-3'] }
  ];
  assert.deepEqual(helper.validateContinuousBundle(input), { valid: true, reason: null });

  for (const mutate of [
    value => { delete value.manifest.bundleVersion; },
    value => { value.manifest.chapters[1].lerntextId = 'LZ-ST-1'; },
    value => { value.manifest.chapters[1].origin = 'unknown'; },
    value => { value.manifest.chapters[1].segmentHash = 'bad'; },
    value => { value.manifest.chapterGroups[0].endIndex = 0; },
    value => { value.manifest.chapterGroups[1].lerntextIds = ['LZ-ST-2']; }
  ]) {
    const broken = structuredClone(input);
    mutate(broken);
    assert.equal(helper.validateContinuousBundle(broken).valid, false);
  }
});

test('generic timeline helpers work on variable-length bundles and retain Recht aliases', () => {
  const { manifest } = genericFixture();
  assert.equal(helper.chapterIndexAtTime(manifest, 1), 1);
  assert.equal(helper.chapterIndexAtTime(manifest, 3), 2);
  assert.equal(helper.chapterIndexAtTime(manifest, 3.01), -1);
  assert.equal(helper.chapterLocalTime(manifest, 1, 1.4), 0.3999999999999999);
  assert.equal(helper.chapterSeekTarget(manifest, 1, 0.25), 1.25);
  assert.equal(helper.rechtChapterIndexAtTime(manifest, 1), 1);
  assert.equal(helper.rechtChapterLocalTime(manifest, 1, 1.4), helper.chapterLocalTime(manifest, 1, 1.4));
  assert.equal(helper.rechtChapterSeekTarget(manifest, 1, 0.25), 1.25);
});

test('browser canonical paths reject invalid subjects', () => {
  assert.deepEqual(helper.continuousPodcastPaths('Steuern'), {
    slug: 'steuern', sidecarPath: 'podcast/continuous/steuern.json',
    mp3Prefix: 'podcast/continuous/steuern/'
  });
  for (const fach of ['', '   ', null, {}, '!!!']) {
    assert.throws(() => helper.continuousPodcastPaths(fach));
  }
});

test('accepts a hash-bound 57-chapter Recht bundle matching current entries', () => {
  assert.deepEqual(helper.validateRechtBundle(fixture()), { valid: true, reason: null });
});

test('rejects wrong schema, subject, encoding, or chapter count', () => {
  invalidWith(input => { input.manifest.schemaVersion = 3; });
  invalidWith(input => { input.manifest.fach = 'Steuern'; });
  invalidWith(input => { input.manifest.encoding.sampleRateHz = 44100; });
  invalidWith(input => { input.manifest.chapters.pop(); });
  invalidWith(input => { input.currentEntries.pop(); });
});

test('rejects a bundle path or hash that does not match the MP3 metadata', () => {
  invalidWith(input => { input.manifest.mp3Path = 'podcast/continuous/steuern/' + HASH + '.mp3'; });
  invalidWith(input => { input.manifest.bundleHash = 'not-a-hash'; });
  invalidWith(input => { input.mp3Metadata.customMetadata.bundleHash = 'c'.repeat(64); });
  invalidWith(input => { input.mp3Metadata.customMetadata.manifestHash = 'c'.repeat(64); });
  invalidWith(input => { input.manifestHash = 'not-a-hash'; });
});

test('rejects stale chapter identity, learning hash, and legacy paths', () => {
  invalidWith(input => { input.manifest.chapters[17].titel = 'alter Titel'; });
  invalidWith(input => { input.manifest.chapters[17].hauptkapitelNr = 99; });
  invalidWith(input => { input.manifest.chapters[17].index = 18; });
  invalidWith(input => { input.manifest.chapters[17].lerntextHash = 'f'.repeat(64); });
  invalidWith(input => { input.manifest.chapters[17].legacyMp3Path = 'podcast/falsch.mp3'; });
  invalidWith(input => { input.manifest.chapters[17].legacyJsonPath = 'podcast/falsch.json'; });
  invalidWith(input => { input.manifest.chapters[17].hauptkapitelNr = ''; input.currentEntries[17].hauptkapitelNr = ''; });
  invalidWith(input => { input.manifest.chapters[17].unterkapitelNr = ''; input.currentEntries[17].unterkapitelNr = ''; });
});

test('rejects gaps, overlaps, noninteger samples, and inconsistent seconds', () => {
  invalidWith(input => { input.manifest.chapters[1].startSample += 1; });
  invalidWith(input => { input.manifest.chapters[1].startSample -= 1; });
  invalidWith(input => { input.manifest.chapters[1].endSample = 2.5 * SAMPLE_RATE; });
  invalidWith(input => { input.manifest.chapters[0].start = 0.1; });
  invalidWith(input => { input.manifest.chapters[0].end = 1.1; });
  invalidWith(input => { input.manifest.sampleCount -= 1; });
  invalidWith(input => { input.manifest.duration = 56; });
});

test('rejects word marks outside local chapter time or out of order', () => {
  invalidWith(input => { input.manifest.chapters[4].wortZeitmarken[0].end = 1.1; });
  invalidWith(input => { input.manifest.chapters[4].wortZeitmarken[0].start = -0.1; });
  invalidWith(input => { input.manifest.chapters[4].wortZeitmarken.push({ wortIndex: 2, wort: 'spät', start: 0.7, end: 0.8 }); });
});

test('accepts the builder’s 1 ms word-end rounding allowance', () => {
  const input = fixture();
  input.manifest.chapters[4].wortZeitmarken[0].end = 1.0008;
  assert.deepEqual(helper.validateRechtBundle(input), { valid: true, reason: null });
  input.manifest.chapters[4].wortZeitmarken[0].end = 1.0011;
  assert.equal(helper.validateRechtBundle(input).valid, false);
});

test('resolves exact starts to the new chapter and clamps only the final endpoint', () => {
  const { manifest } = fixture();
  assert.equal(helper.rechtChapterIndexAtTime(manifest, -0.01), -1);
  assert.equal(helper.rechtChapterIndexAtTime(manifest, 0), 0);
  assert.equal(helper.rechtChapterIndexAtTime(manifest, 0.999), 0);
  assert.equal(helper.rechtChapterIndexAtTime(manifest, 1), 1);
  assert.equal(helper.rechtChapterIndexAtTime(manifest, 56.999), 56);
  assert.equal(helper.rechtChapterIndexAtTime(manifest, 57), 56);
  assert.equal(helper.rechtChapterIndexAtTime(manifest, 57.001), -1);
  assert.equal(helper.rechtChapterIndexAtTime(manifest, NaN), -1);
});

test('computes local time without leaking absolute bundle seconds', () => {
  const { manifest } = fixture();
  assert.equal(helper.rechtChapterLocalTime(manifest, 31, 31.4), 0.3999999999999986);
  assert.equal(helper.rechtChapterLocalTime(manifest, 31, 32), 1);
  assert.equal(helper.rechtChapterLocalTime(manifest, 31, 999), 1);
  assert.equal(helper.rechtChapterLocalTime(manifest, 31, 30), 0);
  assert.equal(helper.rechtChapterLocalTime(manifest, 31, Infinity), null);
});

test('seeks within the selected chapter and rejects invalid targets', () => {
  const { manifest } = fixture();
  assert.equal(helper.rechtChapterSeekTarget(manifest, 7), 7);
  assert.equal(helper.rechtChapterSeekTarget(manifest, 7, 0.25), 7.25);
  assert.equal(helper.rechtChapterSeekTarget(manifest, 7, -2), 7);
  assert.equal(helper.rechtChapterSeekTarget(manifest, 7, 2), 8);
  assert.equal(helper.rechtChapterSeekTarget(manifest, 56, 999), 57);
  assert.equal(helper.rechtChapterSeekTarget(manifest, 57, 0), null);
  assert.equal(helper.rechtChapterSeekTarget(manifest, 7, NaN), null);
});
