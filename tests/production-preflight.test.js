const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { classifyExpectedWrite, buildDryRunSummary } = require('../tools/release/production-dry-run');
const { runAtomicPreflight } = require('../tools/release/production-preflight');

const ROOT = path.resolve(__dirname, '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

test('dry-run derives the exact patch scope only from versioned packages', () => {
  const summary = buildDryRunSummary({
    manifest: read('PRODUCTION_MIGRATION_MANIFEST.json'),
    trainerPackage: read('release/WIFA-GESAMT-PROD-20261007-RC1/packages/trainer/Inhaltsaenderungen_neun-IDs.json'),
    quizPackage: read('release/WIFA-GESAMT-PROD-20261007-RC1/packages/quiz/Quiz_Inhaltsergaenzungen_final.json'),
    flashcardPackage: read('release/WIFA-GESAMT-PROD-20261007-RC1/packages/karteikarten/Karteikarten_Inhaltsergaenzungen_final.json'),
    learningTextPackage: read('release/WIFA-GESAMT-PROD-20261007-RC1/packages/lerntexte/Lerntexte_Gesamtumsetzung_final.json'),
    podcastPromotion: read('release/WIFA-GESAMT-PROD-20261007-RC1/podcast/PRODUCTION_PODCAST_PROMOTION_MANIFEST_V2.json'),
    liveEvidence: { unknownConflicts: 0, trainerMetadataMatches: true }
  });
  assert.deepEqual(summary.counts, {
    trainerContentIds: 9,
    trainerContentCells: 32,
    trainerMetadataWrites: 0,
    quizCreateRows: 53,
    quizCreateCells: 742,
    quizUpdateRows: 14,
    quizUpdateCells: 84,
    flashcardOverlayRows: 38,
    learningTextRows: 260,
    learningTextCells: 454,
    podcastObjects: 26,
    unknownConflicts: 0,
    userDataWrites: 0
  });
  assert.equal(summary.mode, 'READ_ONLY_PATCH_PLAN');
  assert.equal(summary.trainerMetadata.mode, 'SKIP_IDENTICAL');
  assert.deepEqual(summary.protectedSheets, ['NutzerFortschritt', 'PodcastFortschritt', 'Nutzerkonten', 'Analytics']);
});

test('expected-value classifier is idempotent and conflicts fail closed', () => {
  assert.equal(classifyExpectedWrite({ actual: 'old', expectedOld: 'old', finalValue: 'new' }), 'PATCH');
  assert.equal(classifyExpectedWrite({ actual: 'new', expectedOld: 'old', finalValue: 'new' }), 'SKIP_FINAL');
  assert.equal(classifyExpectedWrite({ actual: 'foreign', expectedOld: 'old', finalValue: 'new' }), 'CONFLICT');
});

test('atomic preflight creates backup only after first conflict check and rechecks immediately afterwards', async () => {
  const calls = [];
  const snapshots = [{ fingerprint: 'same', conflicts: [] }, { fingerprint: 'same', conflicts: [] }];
  const result = await runAtomicPreflight({
    getCurrentMainCommit: async () => { calls.push('commit'); return 'abc123'; },
    compareProductionExpectedOld: async () => { calls.push('compare'); return snapshots.shift(); },
    createFullProductionSheetBackup: async () => { calls.push('backup'); return { id: 'backup-1', sha256: 'a'.repeat(64) }; },
    createProductionGitRef: async commit => { calls.push('tag'); return { ref: 'refs/tags/prod-before', commit }; },
    getProductionAppsScriptState: async () => { calls.push('apps-script'); return { version: 114, deploymentId: 'AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA' }; },
    snapshotProductionPodcast: async () => { calls.push('podcast'); return { version: 'legacy', objects: 1042, aggregateSha256: 'b'.repeat(64) }; },
    writeReleaseRunReport: async report => { calls.push('report'); return { id: 'run-1', report }; }
  });
  assert.deepEqual(calls, ['commit', 'compare', 'backup', 'tag', 'apps-script', 'podcast', 'report', 'compare']);
  assert.equal(result.readyForFirstWrite, true);
  assert.equal(result.backup.id, 'backup-1');
  assert.equal(result.appsScript.version, 114);
});

test('atomic preflight aborts before backup on initial conflict and after backup on a race', async () => {
  let backupCalls = 0;
  const base = {
    getCurrentMainCommit: async () => 'abc123',
    createFullProductionSheetBackup: async () => { backupCalls += 1; return { id: 'backup' }; },
    createProductionGitRef: async commit => ({ ref: 'tag', commit }),
    getProductionAppsScriptState: async () => ({ version: 114, deploymentId: 'AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA' }),
    snapshotProductionPodcast: async () => ({ version: 'legacy', objects: 1, aggregateSha256: 'a'.repeat(64) }),
    writeReleaseRunReport: async () => ({ id: 'report' })
  };
  await assert.rejects(
    runAtomicPreflight({ ...base, compareProductionExpectedOld: async () => ({ fingerprint: 'x', conflicts: ['cell'] }) }),
    /Konflikt vor Backup/
  );
  assert.equal(backupCalls, 0);

  const snapshots = [{ fingerprint: 'before', conflicts: [] }, { fingerprint: 'after', conflicts: [] }];
  await assert.rejects(
    runAtomicPreflight({ ...base, compareProductionExpectedOld: async () => snapshots.shift() }),
    /nach Backup verändert/
  );
  assert.equal(backupCalls, 1);
});
