'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  APPROVED_SUBJECTS,
  PRODUCTION_PREFIX,
  buildApprovedTargets,
  assertOnlyApprovedSnapshotChanges,
  assertRecoverableSnapshot,
  assertFreshPreparation,
  assertProductionCatalogMatchesBundles,
  executeWrites,
  validateCompletedManifest,
  copyBundles,
  switchSidecars,
  verify
} = require('../tools/release/podcast-legal-production-rollout');

const approvalPath = path.resolve(
  'outputs/pruefungsrechtsstand-2026-10-12/podcast-staging-publish-result.json'
);

test('Rechtsstands-Rollout bildet ausschließlich vier freigegebene Staging-Bundles auf Produktion ab', () => {
  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
  const plan = buildApprovedTargets(approval);

  assert.deepEqual(plan.map(item => item.fach), APPROVED_SUBJECTS);
  assert.equal(plan.length, 4);
  assert.equal(new Set(plan.flatMap(item => [item.targetMp3Path, item.targetSidecarPath])).size, 8);
  for (const item of plan) {
    assert.ok(item.sourceMp3Path.startsWith('podcast/staging/lerntext-rev2/continuous/'));
    assert.ok(item.sourceSidecarPath.startsWith('podcast/staging/lerntext-rev2/continuous/'));
    assert.ok(item.targetMp3Path.startsWith(PRODUCTION_PREFIX));
    assert.ok(item.targetSidecarPath.startsWith(PRODUCTION_PREFIX));
    assert.equal(item.targetMp3Path.endsWith('/' + item.bundleHash + '.mp3'), true);
    assert.equal(item.sampleCount, item.decodedSamples);
  }

  const extra = structuredClone(approval);
  extra.bundles.push({ ...extra.bundles[0], fach: 'Marketing' });
  assert.throws(() => buildApprovedTargets(extra), /vier|Fächer|freigegeben/i);
});

test('Snapshot-Audit erlaubt nur vier neue Hash-MP3s und vier per CAS geänderte Sidecars', () => {
  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
  const plan = buildApprovedTargets(approval);
  const beforeRows = plan.map((item, index) => ({
    path: item.targetSidecarPath,
    generation: String(100 + index),
    size: 1000 + index,
    contentType: 'application/json',
    md5Hash: 'old-' + index,
    crc32c: 'old-' + index,
    metageneration: '1',
    customMetadataSha256: 'meta-' + index
  }));
  beforeRows.push({
    path: PRODUCTION_PREFIX + 'continuous/marketing.json',
    generation: '999', size: 777, contentType: 'application/json', md5Hash: 'stable', crc32c: 'stable',
    metageneration: '1', customMetadataSha256: 'stable-meta'
  });
  const afterRows = beforeRows.map(row => {
    const item = plan.find(value => value.targetSidecarPath === row.path);
    return item ? { ...row, generation: String(Number(row.generation) + 1000), md5Hash: 'new-' + item.fach } : { ...row };
  });
  for (const item of plan) {
    afterRows.push({
      path: item.targetMp3Path,
      generation: '2000', size: item.bytes, contentType: 'audio/mpeg', md5Hash: item.bundleHash, crc32c: item.bundleHash,
      metageneration: '1', customMetadataSha256: 'bundle-meta-' + item.fach
    });
  }

  assert.deepEqual(assertOnlyApprovedSnapshotChanges({ rows: beforeRows }, { rows: afterRows }, plan), {
    addedBundles: 4,
    changedSidecars: 4,
    unchangedObjects: 1
  });

  const corrupted = structuredClone(afterRows);
  corrupted.find(row => row.path.endsWith('marketing.json')).metageneration = '2';
  assert.throws(
    () => assertOnlyApprovedSnapshotChanges({ rows: beforeRows }, { rows: corrupted }, plan),
    /außerhalb|unerwartet|Marketing/i
  );
});

test('Wiederanlauf erlaubt nur verifizierten Teilfortschritt an den acht freigegebenen Zielen', () => {
  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
  const plan = buildApprovedTargets(approval).map(item => ({
    ...item,
    targetSidecarState: 'PENDING',
    targetBundleState: 'ABSENT',
    targetSidecarGeneration: '100',
    targetBundleGeneration: null
  }));
  const unrelated = {
    path: PRODUCTION_PREFIX + 'continuous/marketing.json', generation: '90', metageneration: '3',
    size: 800, contentType: 'application/json', md5Hash: 'stable', crc32c: 'stable',
    customMetadataSha256: 'stable-meta'
  };
  const beforeRows = [unrelated, ...plan.map(item => ({
    path: item.targetSidecarPath, generation: '100', metageneration: '1', size: 500,
    contentType: 'application/json', md5Hash: 'old', crc32c: 'old', customMetadataSha256: 'old-meta'
  }))];
  const currentRows = structuredClone(beforeRows);
  const completed = plan[0];
  completed.targetSidecarState = 'CURRENT';
  completed.targetBundleState = 'VERIFIED_EXISTING';
  completed.targetSidecarGeneration = '101';
  completed.targetBundleGeneration = '201';
  Object.assign(currentRows.find(row => row.path === completed.targetSidecarPath), {
    generation: '101', md5Hash: 'new', crc32c: 'new', customMetadataSha256: 'new-meta'
  });
  currentRows.push({
    path: completed.targetMp3Path, generation: '201', metageneration: '1', size: completed.bytes,
    contentType: 'audio/mpeg', md5Hash: 'new-bundle', crc32c: 'new-bundle',
    customMetadataSha256: 'bundle-meta'
  });

  assert.doesNotThrow(() => assertRecoverableSnapshot({ rows: beforeRows }, { rows: currentRows }, plan));
  const corrupted = structuredClone(currentRows);
  corrupted.find(row => row.path === unrelated.path).customMetadataSha256 = 'foreign-change';
  assert.throws(
    () => assertRecoverableSnapshot({ rows: beforeRows }, { rows: corrupted }, plan),
    /außerhalb|unerwartet|Fremdänderung/i
  );
  const pendingSidecarDrift = structuredClone(currentRows);
  const pending = plan[1];
  pending.targetSidecarGeneration = '102';
  pendingSidecarDrift.find(row => row.path === pending.targetSidecarPath).generation = '102';
  assert.throws(
    () => assertRecoverableSnapshot({ rows: beforeRows }, { rows: pendingSidecarDrift }, plan),
    /Fremdänderung|unerwartet/i
  );
});

test('Produktions-Sidecars werden erst nach Kopie und Verifikation aller MP3s umgeschaltet', async () => {
  const order = [];
  await executeWrites({
    bucket: {},
    subjects: [{ fach: 'Steuern' }],
    copy: async () => order.push('copy-all'),
    verify: async () => order.push('verify-all'),
    productionPreflight: async () => order.push('production-api-preflight'),
    switchRuntime: async () => order.push('switch-sidecars')
  });
  assert.deepEqual(order, ['copy-all', 'verify-all', 'production-api-preflight', 'switch-sidecars']);

  order.length = 0;
  await assert.rejects(() => executeWrites({
    bucket: {},
    subjects: [{ fach: 'Steuern' }],
    copy: async () => order.push('copy-all'),
    verify: async () => { order.push('verify-all'); throw new Error('MP3-Readback fehlgeschlagen'); },
    productionPreflight: async () => order.push('production-api-preflight'),
    switchRuntime: async () => order.push('switch-sidecars')
  }), /Readback/);
  assert.deepEqual(order, ['copy-all', 'verify-all']);

  order.length = 0;
  await assert.rejects(() => executeWrites({
    bucket: {},
    subjects: [{ fach: 'Steuern' }],
    copy: async () => order.push('copy-all'),
    verify: async () => order.push('verify-all'),
    productionPreflight: async () => {
      order.push('production-api-preflight');
      throw new Error('LZ-ST-08: Produktionshash weicht ab');
    },
    switchRuntime: async () => order.push('switch-sidecars')
  }), /LZ-ST-08/);
  assert.deepEqual(order, ['copy-all', 'verify-all', 'production-api-preflight']);
});

test('Produktions-Preflight blockiert Bundle-Aktivierung und dokumentiert jede abweichende ID', () => {
  const productionCatalog = [{
    id: 'LZ-RE-13',
    fach: 'Recht',
    titel: 'Sachmangel',
    hauptkapitel: 'Vertragsrecht',
    hauptkapitelNr: '1',
    unterkapitelNr: '1.5',
    lerntext: 'Produktiver Text'
  }];
  const bundleChapters = [{
    index: 0,
    lerntextId: 'LZ-RE-13',
    titel: 'Sachmangel',
    hauptkapitel: 'Vertragsrecht',
    hauptkapitelNr: '1',
    unterkapitelNr: '1.5',
    lerntextHash: require('node:crypto').createHash('sha256').update('Bundle-Text').digest('hex'),
    legacyMp3Path: 'podcast/recht-sachmangel.mp3',
    legacyJsonPath: 'podcast/recht-sachmangel.json'
  }];

  assert.throws(() => assertProductionCatalogMatchesBundles({
    subjects: [{ fach: 'Recht', targetSidecarJson: { fach: 'Recht', chapters: bundleChapters } }],
    catalogBySubject: new Map([['Recht', productionCatalog]])
  }), error => {
    assert.match(error.message, /Preflight.*blockiert|blockiert.*Preflight/i);
    assert.match(error.message, /Recht\/LZ-RE-13/);
    assert.match(error.message, /lerntextHash/);
    assert.equal(error.details.mismatches[0].productionHash,
      require('node:crypto').createHash('sha256').update('Produktiver Text').digest('hex'));
    assert.equal(error.details.mismatches[0].bundleHash, bundleChapters[0].lerntextHash);
    return true;
  });
});

test('Produktions-Preflight akzeptiert nur die vollständig identische API-Kapitelidentität', () => {
  const lerntext = 'Identischer Text';
  const hash = require('node:crypto').createHash('sha256').update(lerntext).digest('hex');
  const catalog = [{
    id: 'LZ-RE-13',
    fach: 'Recht',
    titel: 'Sachmangel',
    hauptkapitel: 'Vertragsrecht',
    hauptkapitelNr: '1',
    unterkapitelNr: '1.5',
    lerntext
  }];
  const subjects = [{
    fach: 'Recht',
    targetSidecarJson: {
      fach: 'Recht',
      chapters: [{
        index: 0,
        lerntextId: 'LZ-RE-13',
        titel: 'Sachmangel',
        hauptkapitel: 'Vertragsrecht',
        hauptkapitelNr: '1',
        unterkapitelNr: '1.5',
        lerntextHash: hash,
        legacyMp3Path: 'podcast/recht-sachmangel.mp3',
        legacyJsonPath: 'podcast/recht-sachmangel.json'
      }]
    }
  }];

  assert.deepEqual(assertProductionCatalogMatchesBundles({
    subjects,
    catalogBySubject: new Map([['Recht', catalog]])
  }), {
    status: 'PASS',
    subjects: 1,
    entries: 1,
    mismatches: []
  });

  const wrongSubjectCatalog = structuredClone(catalog);
  wrongSubjectCatalog[0].fach = 'Steuern';
  assert.throws(() => assertProductionCatalogMatchesBundles({
    subjects,
    catalogBySubject: new Map([['Recht', wrongSubjectCatalog]])
  }), /Recht\/LZ-RE-13 \[fach,/);
});

test('Neue Vorbereitung verlangt vier abwesende Ziel-MP3s und vier noch offene Sidecars', () => {
  const subjects = APPROVED_SUBJECTS.map(fach => ({
    fach, targetBundleState: 'ABSENT', targetSidecarState: 'PENDING'
  }));
  assert.doesNotThrow(() => assertFreshPreparation(subjects));
  const existingBundle = structuredClone(subjects);
  existingBundle[0].targetBundleState = 'VERIFIED_EXISTING';
  assert.throws(() => assertFreshPreparation(existingBundle), /Ausgangszustand|vorhanden|MP3/i);
  const switchedSidecar = structuredClone(subjects);
  switchedSidecar[0].targetSidecarState = 'CURRENT';
  assert.throws(() => assertFreshPreparation(switchedSidecar), /Ausgangszustand|Sidecar/i);
});

test('Wiederaufnahme überspringt nur bereits exakt verifizierte Ziele und behält CAS für offene Sidecars', async () => {
  const events = [];
  const bucket = {
    file(storagePath, options) {
      return {
        async copy(destination, copyOptions) {
          events.push({ kind: 'copy', storagePath, options, destination: destination.name, copyOptions });
        },
        async save(_bytes, saveOptions) {
          events.push({ kind: 'save', storagePath, saveOptions });
        },
        name: storagePath
      };
    }
  };
  const subjects = [
    { fach: 'Steuern', sourceMp3Path: 'source-steuern', sourceMp3Generation: '11', targetMp3Path: 'target-steuern',
      targetBundleState: 'ABSENT', targetSidecarPath: 'sidecar-steuern', targetSidecarState: 'PENDING',
      targetSidecarGeneration: '21', targetSidecarBytes: Buffer.from('{}'), targetManifestHash: require('node:crypto').createHash('sha256').update('{}').digest('hex'), bundleHash: 'a'.repeat(64) },
    { fach: 'Recht', sourceMp3Path: 'source-recht', sourceMp3Generation: '12', targetMp3Path: 'target-recht',
      targetBundleState: 'VERIFIED_EXISTING', targetSidecarPath: 'sidecar-recht', targetSidecarState: 'CURRENT',
      targetSidecarGeneration: '22', targetSidecarBytes: Buffer.from('{}'), targetManifestHash: require('node:crypto').createHash('sha256').update('{}').digest('hex'), bundleHash: 'b'.repeat(64) }
  ];
  await copyBundles(bucket, subjects);
  await switchSidecars(bucket, subjects);

  assert.equal(events.filter(event => event.kind === 'copy').length, 1);
  assert.equal(events.find(event => event.kind === 'copy').copyOptions.preconditionOpts.ifGenerationMatch, 0);
  assert.equal(events.filter(event => event.kind === 'save').length, 1);
  assert.equal(events.find(event => event.kind === 'save').saveOptions.preconditionOpts.ifGenerationMatch, '21');
});

test('Read-only Wiederholungsprüfung akzeptiert nur den vollständig abgeschlossenen Vier-Fächer-Rollout', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(
    'release/WIFA-PODCAST-PROD-20261013-RS2026/podcast/PRODUCTION_PODCAST_LEGAL_REFRESH_MANIFEST.json'
  ), 'utf8'));
  assert.deepEqual(validateCompletedManifest(manifest), {
    subjects: 4,
    productionWrites: 8,
    targetPrefix: PRODUCTION_PREFIX
  });
  const altered = structuredClone(manifest);
  altered.subjects.push({ ...altered.subjects[0], fach: 'Marketing' });
  assert.throws(() => validateCompletedManifest(altered), /vier|Fächer|freigegeben/i);

  const missingReadback = structuredClone(manifest);
  missingReadback.storageReadback.subjects.pop();
  assert.throws(() => validateCompletedManifest(missingReadback), /Readback|vier|Fächer|freigegeben/i);

  const invalidGeneration = structuredClone(manifest);
  invalidGeneration.storageReadback.subjects[0].mp3Generation = '';
  assert.throws(() => validateCompletedManifest(invalidGeneration), /Generation|Readback/i);
});

test('Read-only Wiederholungsprüfung pinnt die veröffentlichten Produktionsgenerationen', async () => {
  const manifestPath = path.resolve(
    'release/WIFA-PODCAST-PROD-20261013-RS2026/podcast/PRODUCTION_PODCAST_LEGAL_REFRESH_MANIFEST.json'
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let captured;
  await verify({
    manifestPath,
    bucketProvider: async () => ({ name: 'bucket-double' }),
    verifyFn: async (_bucket, _subjects, _beforeSnapshot, _ffmpeg, expectedGenerations) => {
      captured = expectedGenerations;
      return {
        subjects: manifest.storageReadback.subjects,
        totals: manifest.storageReadback.totals,
        changeAudit: manifest.storageReadback.changeAudit
      };
    }
  });
  assert.deepEqual(captured, Object.fromEntries(manifest.storageReadback.subjects.map(item => [item.fach, {
    sidecarGeneration: item.sidecarGeneration,
    mp3Generation: item.mp3Generation
  }])));
});
