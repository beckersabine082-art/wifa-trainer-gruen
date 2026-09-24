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

test('accepts a hash-bound 57-chapter Recht bundle matching current entries', () => {
  assert.deepEqual(helper.validateRechtBundle(fixture()), { valid: true, reason: null });
});

test('rejects wrong schema, subject, encoding, or chapter count', () => {
  invalidWith(input => { input.manifest.schemaVersion = 2; });
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
