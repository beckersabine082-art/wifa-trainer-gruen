const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SUBJECTS,
  runPodcastStorageDiagnostic
} = require('../tools/podcast-sync/staging-storage-diagnostic-core');

test('browser diagnostic waits for Firebase auth persistence before reading currentUser', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'podcast-sync', 'staging-storage-diagnostic.mjs'), 'utf8');
  assert.match(source, /await auth\.authStateReady\(\)/);
  assert.ok(source.indexOf('await auth.authStateReady()') < source.indexOf('currentUser: auth.currentUser'));
});

test('authenticated diagnostic checks all 13 sidecars, bundles and loadedmetadata without leaking tokens', async () => {
  const calls = [];
  const report = await runPodcastStorageDiagnostic({
    currentUser: { uid: 'user-1', emailVerified: true },
    getIdToken: async () => 'secret-id-token',
    subjects: SUBJECTS,
    prefix: 'podcast/staging/lerntext-rev2/',
    version: 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1',
    pathsForSubject: subject => ({
      sidecarPath: `podcast/staging/lerntext-rev2/continuous/${subject}.json`,
      mp3Prefix: `podcast/staging/lerntext-rev2/continuous/${subject}/`
    }),
    loadSidecar: async path => {
      calls.push(['sidecar', path]);
      const subject = path.split('/').pop().replace('.json', '');
      return {
        bundleVersion: 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1',
        mp3Path: `podcast/staging/lerntext-rev2/continuous/${subject}/${'a'.repeat(64)}.mp3`
      };
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
  assert.equal(report.summary, '13/13 Sidecars | 13/13 Bundles | 13/13 loadedmetadata | PASS');
  assert.equal(calls.length, 39);
  assert.doesNotMatch(JSON.stringify(report), /secret-id-token/);
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
  assert.match(signedOut.errors[0], /currentUser/);
  const noVersion = await runPodcastStorageDiagnostic({ ...base, currentUser: { uid: 'u' }, getIdToken: async () => 'token', version: '' });
  assert.equal(noVersion.pass, false);
  assert.match(noVersion.errors[0], /Version/);
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
  assert.equal(report.sidecars, 0);
  assert.match(report.errors.join(' '), /Version|Legacy|Präfix/);
});
