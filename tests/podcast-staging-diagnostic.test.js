const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SUBJECTS,
  runPodcastStorageDiagnostic
} = require('../tools/podcast-sync/staging-storage-diagnostic-core');

const EXPECTED_CHAPTER_GROUPS = Object.freeze({
  VWL: 1,
  BWL: 3,
  Rechnungswesen: 5,
  Recht: 7,
  Steuern: 3,
  Unternehmensführung: 3,
  'Betriebliches Management': 4,
  'Investition und Finanzierung': 3,
  'Betriebliches Rechnungswesen und Controlling': 2,
  Logistik: 5,
  Marketing: 2,
  Vertrieb: 3,
  'Führung und Zusammenarbeit': 7
});

function manifestFor(subject, version) {
  const groupCount = EXPECTED_CHAPTER_GROUPS[subject];
  const chapters = [];
  const chapterGroups = [];
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const chapterNumber = String(groupIndex + 1);
    const chapterKey = `${subject}-chapter-${chapterNumber}`;
    const entries = subject === 'Recht' && groupIndex === 0 ? 2 : 1;
    const startIndex = chapters.length;
    for (let entryIndex = 0; entryIndex < entries; entryIndex += 1) {
      const index = chapters.length;
      const firstRecht = subject === 'Recht' && groupIndex === 0 && entryIndex === 0;
      chapters.push({
        index,
        lerntextId: firstRecht ? 'LZ-RE-51' : `${subject}-${index + 1}`,
        titel: firstRecht ? 'Anspruchsprüfung und Gutachtenstil' : `${subject} Lerntext ${index + 1}`,
        hauptkapitelNr: chapterNumber,
        unterkapitelNr: firstRecht ? '1.4' :
          (subject === 'VWL' && groupIndex === 0 ? '1.0' : `historisch-${index + 1}`),
        hauptkapitel: firstRecht ? 'BGB Allgemeiner Teil' : `${subject} Kapitel ${chapterNumber}`,
        chapterKey,
        start: index * 10,
        end: (index + 1) * 10
      });
    }
    const endIndex = chapters.length - 1;
    chapterGroups.push({
      chapterKey,
      chapterNumber,
      chapterTitle: chapters[startIndex].hauptkapitel,
      startIndex,
      endIndex,
      lerntextIds: chapters.slice(startIndex, endIndex + 1).map(chapter => chapter.lerntextId)
    });
  }
  return {
    schemaVersion: 2,
    fach: subject,
    bundleVersion: version,
    mp3Path: '',
    chapters,
    chapterGroups
  };
}

function orderManifestFor(subjects, version) {
  return {
    revision: version,
    subjects: subjects.map(subject => {
      const sidecar = manifestFor(subject, version);
      return {
        fach: subject,
        chapters: sidecar.chapterGroups.map(group => ({
          chapterKey: group.chapterKey,
          chapterNumber: group.chapterNumber,
          entries: sidecar.chapters.slice(group.startIndex, group.endIndex + 1).map((chapter, index) => ({
            id: chapter.lerntextId,
            ordinalInChapter: index + 1
          }))
        }))
      };
    })
  };
}

function canonicalNumberEntries(entries) {
  const positions = new Map();
  return entries.map(entry => {
    const key = `${entry.fach}\u0000${entry.chapterKey || `${entry.hauptkapitelNr}\u0000${entry.hauptkapitel}`}`;
    const position = (positions.get(key) || 0) + 1;
    positions.set(key, position);
    return { ...entry, sichtbareLerntextNr: `${entry.hauptkapitelNr}.${position}` };
  });
}

function resolvePlaybackRange(manifest, selection) {
  let startIndex = 0;
  let endIndex = manifest.chapters.length - 1;
  if (selection.mode === 'chapter') {
    const group = manifest.chapterGroups.find(item => item.chapterKey === selection.chapterKey);
    if (!group) return null;
    startIndex = group.startIndex;
    endIndex = group.endIndex;
  } else if (selection.mode === 'entry') {
    startIndex = manifest.chapters.findIndex(item => item.lerntextId === selection.lerntextId);
    if (startIndex < 0) return null;
    const group = manifest.chapterGroups.find(item => item.startIndex <= startIndex && item.endIndex >= startIndex);
    if (!group) return null;
    endIndex = group.endIndex;
  }
  return {
    mode: selection.mode,
    startIndex,
    endIndex,
    startId: manifest.chapters[startIndex].lerntextId,
    endId: manifest.chapters[endIndex].lerntextId,
    start: manifest.chapters[startIndex].start,
    end: manifest.chapters[endIndex].end
  };
}

test('browser diagnostic waits for Firebase auth persistence before reading currentUser', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'podcast-sync', 'staging-storage-diagnostic.mjs'), 'utf8');
  assert.match(source, /await auth\.authStateReady\(\)/);
  assert.ok(source.indexOf('await auth.authStateReady()') < source.indexOf('currentUser: auth.currentUser'));
});

test('authenticated diagnostic checks all 13 sidecars, bundles and loadedmetadata without leaking tokens', async () => {
  const calls = [];
  let numberCalls = 0;
  let orderManifestCalls = 0;
  const version = 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1';
  const report = await runPodcastStorageDiagnostic({
    currentUser: { uid: 'user-1', emailVerified: true },
    getIdToken: async () => 'secret-id-token',
    subjects: SUBJECTS,
    prefix: 'podcast/staging/lerntext-rev2/',
    version,
    expectedChapterGroups: 48,
    resolvePlaybackRange,
    loadOrderManifest: async () => {
      orderManifestCalls += 1;
      return orderManifestFor(SUBJECTS, version);
    },
    numberEntries: entries => { numberCalls += 1; return canonicalNumberEntries(entries); },
    pathsForSubject: subject => ({
      sidecarPath: `podcast/staging/lerntext-rev2/continuous/${subject}.json`,
      mp3Prefix: `podcast/staging/lerntext-rev2/continuous/${subject}/`
    }),
    loadSidecar: async path => {
      calls.push(['sidecar', path]);
      const subject = path.split('/').pop().replace('.json', '');
      const manifest = manifestFor(subject, version);
      manifest.mp3Path = `podcast/staging/lerntext-rev2/continuous/${subject}/${'a'.repeat(64)}.mp3`;
      return manifest;
    },
    loadBundleMetadata: async path => { calls.push(['bundle', path]); return { contentType: 'audio/mpeg', size: 100 }; },
    loadAudioMetadata: async path => { calls.push(['audio', path]); return { duration: 123.5, readyState: 1 }; }
  });
  assert.equal(report.pass, true);
  assert.equal(report.currentUser, true);
  assert.equal(report.idToken, true);
  assert.equal(report.sidecars, 13);
  assert.equal(report.bundles, 13);
  assert.equal(report.loadedmetadata, 13);
  assert.equal(report.durations, 13);
  assert.equal(report.chapterGroups, 48);
  assert.equal(report.summary, '13/13 Sidecars | 13/13 Bundles | 13/13 loadedmetadata | 13/13 duration > 0 | PASS');
  assert.equal(report.results.length, 13);
  assert.deepEqual(report.results[0], {
    subject: 'VWL', sidecar: 'PASS', bundle: 'PASS', loadedmetadata: 'PASS',
    duration: 123.5, version, result: 'PASS'
  });
  assert.deepEqual(report.recht, {
    chapterNavigation: true,
    allChapters: true,
    chapterOne: true,
    singleEntry: true,
    numbering: true,
    firstVisibleTitle: '1.1 Anspruchsprüfung und Gutachtenstil'
  });
  assert.equal(numberCalls, 13, 'jedes Fach verwendet die injizierte kanonische Playerfunktion');
  assert.equal(orderManifestCalls, 1, 'das finale Reihenfolgemanifest wird genau einmal geladen');
  assert.equal(report.structureEvidence.Recht.firstMismatch, null);
  assert.deepEqual(report.structureEvidence.Recht.sidecarIds.slice(0, 2), ['LZ-RE-51', 'Recht-2']);
  assert.deepEqual(report.structureEvidence.Recht.manifestIds.slice(0, 2), ['LZ-RE-51', 'Recht-2']);
  assert.deepEqual(report.structureEvidence.Recht.calculatedVisibleNumbers.slice(0, 2), ['1.1', '1.2']);
  assert.deepEqual(report.structureEvidence.Recht.expectedVisibleNumbers.slice(0, 2), ['1.1', '1.2']);
  assert.equal(report.structureEvidence.Recht.comparisonFunction, 'window.lerntexteSichtbareNummerierung');
  assert.equal(report.structureEvidence.Recht.manifestSource, 'Lerntexte_Reihenfolge_Manifest.json');
  assert.equal(report.structureEvidence.VWL.firstMismatch, null);
  assert.equal(report.structureEvidence.VWL.calculatedVisibleNumbers[0], '1.1');
  assert.equal(report.structureEvidence.VWL.expectedVisibleNumbers[0], '1.1');
  assert.equal(calls.length, 39);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /secret-id-token|token=|firebasestorage|podcast\/staging/);
});

test('diagnostic fails closed before storage access when auth or runtime version is missing', async () => {
  const base = {
    subjects: SUBJECTS,
    prefix: 'podcast/staging/lerntext-rev2/',
    version: 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1',
    pathsForSubject: () => { throw new Error('must not access storage'); },
    loadSidecar: async () => { throw new Error('must not access storage'); },
    loadBundleMetadata: async () => { throw new Error('must not access storage'); },
    loadAudioMetadata: async () => { throw new Error('must not access storage'); }
  };
  const signedOut = await runPodcastStorageDiagnostic({ ...base, currentUser: null, getIdToken: async () => '' });
  assert.equal(signedOut.pass, false);
  assert.equal(signedOut.summary, 'AUTH FAIL');
  assert.match(signedOut.errors[0], /currentUser/);
  const noVersion = await runPodcastStorageDiagnostic({ ...base, currentUser: { uid: 'u' }, getIdToken: async () => 'token', version: '' });
  assert.equal(noVersion.pass, false);
  assert.match(noVersion.errors[0], /Version/);
});

test('diagnostic reports the subject and exact failed stage without continuing that subject', async () => {
  const version = 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1';
  const report = await runPodcastStorageDiagnostic({
    currentUser: { uid: 'u' },
    getIdToken: async () => 'token',
    subjects: ['Recht'],
    prefix: 'podcast/staging/lerntext-rev2/',
    version,
    expectedChapterGroups: 7,
    resolvePlaybackRange,
    pathsForSubject: () => ({
      sidecarPath: 'podcast/staging/lerntext-rev2/continuous/recht.json',
      mp3Prefix: 'podcast/staging/lerntext-rev2/continuous/recht/'
    }),
    loadSidecar: async () => {
      const manifest = manifestFor('Recht', 'WRONG');
      manifest.mp3Path = `podcast/staging/lerntext-rev2/continuous/recht/${'a'.repeat(64)}.mp3`;
      return manifest;
    },
    loadBundleMetadata: async () => { throw new Error('must not load bundle'); },
    loadAudioMetadata: async () => { throw new Error('must not load audio'); }
  });
  assert.equal(report.pass, false);
  assert.equal(report.failure, 'FAIL – Recht – BUNDLE-VERSION');
  assert.equal(report.results[0].result, 'FAIL');
  assert.equal(report.results[0].version, 'WRONG');
});

test('a structure mismatch remains FAIL but does not hide bundle and loadedmetadata results', async () => {
  const version = 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1';
  const orderManifest = orderManifestFor(['Recht'], version);
  orderManifest.subjects[0].chapters[0].entries[0].id = 'LZ-RE-OTHER';
  const report = await runPodcastStorageDiagnostic({
    currentUser: { uid: 'u' },
    getIdToken: async () => 'token',
    subjects: ['Recht'],
    prefix: 'podcast/staging/lerntext-rev2/',
    version,
    expectedChapterGroups: 7,
    resolvePlaybackRange,
    orderManifest,
    numberEntries: canonicalNumberEntries,
    pathsForSubject: () => ({
      sidecarPath: 'podcast/staging/lerntext-rev2/continuous/recht.json',
      mp3Prefix: 'podcast/staging/lerntext-rev2/continuous/recht/'
    }),
    loadSidecar: async () => {
      const manifest = manifestFor('Recht', version);
      manifest.mp3Path = `podcast/staging/lerntext-rev2/continuous/recht/${'a'.repeat(64)}.mp3`;
      return manifest;
    },
    loadBundleMetadata: async () => ({ contentType: 'audio/mpeg', size: 100 }),
    loadAudioMetadata: async () => ({ duration: 42, readyState: 1 })
  });
  assert.equal(report.pass, false);
  assert.equal(report.failure, 'FAIL – Recht – STRUKTUR');
  assert.equal(report.sidecars, 1);
  assert.equal(report.bundles, 1);
  assert.equal(report.loadedmetadata, 1);
  assert.equal(report.durations, 1);
  assert.equal(report.results[0].bundle, 'PASS');
  assert.equal(report.results[0].loadedmetadata, 'PASS');
  assert.deepEqual(report.structureEvidence.Recht.firstMismatch, {
    position: 1,
    sidecarId: 'LZ-RE-51',
    manifestId: 'LZ-RE-OTHER',
    calculatedVisibleNumber: '1.1',
    expectedVisibleNumber: '1.1'
  });
});

test('diagnostic rejects legacy paths and mismatched bundle versions', async () => {
  const report = await runPodcastStorageDiagnostic({
    currentUser: { uid: 'u' }, getIdToken: async () => 'token', subjects: SUBJECTS.slice(0, 1),
    prefix: 'podcast/staging/lerntext-rev2/', version: 'EXPECTED',
    pathsForSubject: () => ({ sidecarPath: 'podcast/staging/lerntext-rev2/continuous/recht.json', mp3Prefix: 'podcast/staging/lerntext-rev2/continuous/recht/' }),
    loadSidecar: async () => ({ bundleVersion: 'WRONG', mp3Path: `podcast/continuous/recht/${'a'.repeat(64)}.mp3` }),
    loadBundleMetadata: async () => ({ contentType: 'audio/mpeg' }),
    loadAudioMetadata: async () => ({ duration: 1, readyState: 1 })
  });
  assert.equal(report.pass, false);
  assert.equal(report.sidecars, 1, 'der Sidecar war erreichbar; die separate Versionsprüfung schlug fehl');
  assert.match(report.errors.join(' '), /Version|Legacy|Präfix/);
});
