'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createAdminClient } = require('../podcast-sync/sync-all');
const { runFfmpeg } = require('../podcast-sync/continuous-bundle');
const {
  PRODUCTION_PODCAST_PREFIX_V2: PRODUCTION_PREFIX,
  PRODUCTION_PODCAST_VERSION_V2: PRODUCTION_VERSION,
  STAGING_PODCAST_PREFIX: STAGING_PREFIX,
  deriveProductionSidecar
} = require('./podcast-promotion');

const EXPECTED_PROJECT_ID = 'wifa-trainer-gruen';
const EXPECTED_BUCKET = 'wifa-trainer-gruen.firebasestorage.app';
const STAGING_VERSION = 'WIFA-PODCAST-STAGING-LZREV2-20261012-v2';
const ROLLOUT_ID = 'WIFA-PODCAST-PROD-20261013-RS2026';
const APPROVED_SUBJECTS = Object.freeze(['Steuern', 'Recht', 'Vertrieb', 'Logistik']);
const DEFAULT_APPROVAL = path.resolve(
  'outputs/pruefungsrechtsstand-2026-10-12/podcast-staging-publish-result.json'
);
const DEFAULT_MANIFEST = path.resolve(
  'release/WIFA-PODCAST-PROD-20261013-RS2026/podcast/PRODUCTION_PODCAST_LEGAL_REFRESH_MANIFEST.json'
);
const DEFAULT_REPORT = path.resolve(
  'release/WIFA-PODCAST-PROD-20261013-RS2026/runs/production-readback.json'
);

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const text = value => String(value ?? '').trim();

function readJson(filePath, label) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { throw new Error(label + ' konnte nicht gelesen werden: ' + error.message); }
}

function exactSubjectMap(items, label) {
  if (!Array.isArray(items) || items.length !== APPROVED_SUBJECTS.length) {
    throw new Error(label + ' muss exakt vier freigegebene Fächer enthalten');
  }
  const index = new Map();
  for (const item of items) {
    const fach = text(item?.fach);
    if (!APPROVED_SUBJECTS.includes(fach) || index.has(fach)) {
      throw new Error(label + ' enthält ein nicht freigegebenes oder doppeltes Fach');
    }
    index.set(fach, item);
  }
  if (APPROVED_SUBJECTS.some(fach => !index.has(fach))) throw new Error(label + ': freigegebenes Fach fehlt');
  return index;
}

function buildApprovedTargets(approval) {
  if (approval?.projectId !== EXPECTED_PROJECT_ID || approval?.bucket !== EXPECTED_BUCKET ||
      approval?.targetPrefix !== STAGING_PREFIX || approval?.bundleVersion !== STAGING_VERSION ||
      approval?.productionWrites !== 0 || approval?.segments?.requested !== 15 || approval?.segments?.verified !== 15) {
    throw new Error('Staging-Freigabenachweis ist nicht für diesen Produktionsrollout freigegeben');
  }
  const bundles = exactSubjectMap(approval.bundles, 'Staging-Bundles');
  const smoke = exactSubjectMap(approval.authenticatedPlaybackSmoke, 'Wiedergabe-Smoke-Test');
  return APPROVED_SUBJECTS.map(fach => {
    const bundle = bundles.get(fach);
    const verified = smoke.get(fach);
    if (bundle.bundleVersion !== STAGING_VERSION || verified.bundleVersion !== STAGING_VERSION ||
        bundle.bundleHash !== verified.bundleHash || bundle.mp3Path !== verified.mp3Path ||
        bundle.sidecarPath !== verified.sidecarPath || Number(bundle.bytes) !== Number(verified.bytes) ||
        Number(bundle.sampleCount) !== Number(verified.sampleCount) ||
        Number(verified.decodedSamples) !== Number(verified.sampleCount) ||
        !/^[a-f0-9]{64}$/.test(text(bundle.bundleHash)) ||
        !/^[a-f0-9]{64}$/.test(text(bundle.manifestHash))) {
      throw new Error(fach + ': Staging-Bundle und Freigabe-Smoke-Test weichen ab');
    }
    const sourceMp3Path = text(bundle.mp3Path);
    const sourceSidecarPath = text(bundle.sidecarPath);
    if (!sourceMp3Path.startsWith(STAGING_PREFIX + 'continuous/') ||
        !sourceSidecarPath.startsWith(STAGING_PREFIX + 'continuous/')) {
      throw new Error(fach + ': freigegebener Staging-Pfad ist ungültig');
    }
    return {
      fach,
      bundleHash: bundle.bundleHash,
      sourceManifestHash: bundle.manifestHash,
      sourceMp3Path,
      sourceSidecarPath,
      targetMp3Path: PRODUCTION_PREFIX + sourceMp3Path.slice(STAGING_PREFIX.length),
      targetSidecarPath: PRODUCTION_PREFIX + sourceSidecarPath.slice(STAGING_PREFIX.length),
      bytes: Number(bundle.bytes),
      sampleCount: Number(bundle.sampleCount),
      decodedSamples: Number(verified.decodedSamples),
      chapters: Number(bundle.chapters),
      chapterGroups: Number(bundle.chapterGroups),
      words: Number(bundle.words),
      duration: Number(bundle.duration),
      boundaries: Number(bundle.boundaries)
    };
  });
}

function stableCustomMetadataHash(metadata) {
  const entries = Object.entries(metadata || {}).sort(([left], [right]) => left.localeCompare(right));
  return sha256(JSON.stringify(entries));
}

function snapshotRowsMatch(before, after) {
  const keys = ['generation', 'size', 'contentType', 'md5Hash', 'crc32c'];
  if (before.metageneration !== undefined) keys.push('metageneration');
  if (before.customMetadataSha256 !== undefined) keys.push('customMetadataSha256');
  return keys.every(key => String(before[key] ?? '') === String(after[key] ?? ''));
}

function assertOnlyApprovedSnapshotChanges(before, after, plan) {
  const beforeRows = Array.isArray(before?.rows) ? before.rows : [];
  const afterRows = Array.isArray(after?.rows) ? after.rows : [];
  const beforeIndex = new Map(beforeRows.map(row => [row.path, row]));
  const afterIndex = new Map(afterRows.map(row => [row.path, row]));
  if (beforeIndex.size !== beforeRows.length || afterIndex.size !== afterRows.length) {
    throw new Error('Produktionssnapshot enthält doppelte Pfade');
  }
  const approvedSidecars = new Set(plan.map(item => item.targetSidecarPath));
  const approvedBundles = new Set(plan.map(item => item.targetMp3Path));
  let addedBundles = 0;
  let changedSidecars = 0;
  let unchangedObjects = 0;
  for (const [storagePath, row] of beforeIndex) {
    const current = afterIndex.get(storagePath);
    if (!current) throw new Error('Produktionsobjekt wurde unerwartet entfernt: ' + storagePath);
    if (snapshotRowsMatch(row, current)) {
      unchangedObjects += 1;
    } else if (approvedSidecars.has(storagePath)) {
      changedSidecars += 1;
    } else {
      throw new Error('Produktionsobjekt außerhalb der Freigabe wurde unerwartet geändert: ' + storagePath);
    }
  }
  for (const [storagePath] of afterIndex) {
    if (beforeIndex.has(storagePath)) continue;
    if (!approvedBundles.has(storagePath)) {
      throw new Error('Unerwartetes Produktionsobjekt wurde hinzugefügt: ' + storagePath);
    }
    addedBundles += 1;
  }
  if (changedSidecars !== APPROVED_SUBJECTS.length || addedBundles !== APPROVED_SUBJECTS.length) {
    throw new Error(`Produktionsänderungsbilanz unerwartet: ${changedSidecars} Sidecars, ${addedBundles} Bundles`);
  }
  return { addedBundles, changedSidecars, unchangedObjects };
}

function assertRecoverableSnapshot(before, current, plan) {
  const beforeRows = Array.isArray(before?.rows) ? before.rows : [];
  const currentRows = Array.isArray(current?.rows) ? current.rows : [];
  const beforeIndex = new Map(beforeRows.map(row => [row.path, row]));
  const currentIndex = new Map(currentRows.map(row => [row.path, row]));
  if (beforeIndex.size !== beforeRows.length || currentIndex.size !== currentRows.length) {
    throw new Error('Produktionssnapshot enthält doppelte Pfade');
  }
  const sidecars = new Map(plan.map(item => [item.targetSidecarPath, item]));
  const bundles = new Map(plan.map(item => [item.targetMp3Path, item]));
  for (const [storagePath, row] of beforeIndex) {
    const liveRow = currentIndex.get(storagePath);
    if (!liveRow) throw new Error('Produktionsobjekt wurde unerwartet entfernt: ' + storagePath);
    if (snapshotRowsMatch(row, liveRow)) continue;
    const item = sidecars.get(storagePath);
    if (!item || item.targetSidecarState !== 'CURRENT' ||
        String(liveRow.generation) !== String(item.targetSidecarGeneration)) {
      throw new Error('Fremdänderung außerhalb des freigegebenen Wiederanlaufs: ' + storagePath);
    }
  }
  for (const [storagePath, row] of currentIndex) {
    if (beforeIndex.has(storagePath)) continue;
    const item = bundles.get(storagePath);
    if (!item || item.targetBundleState !== 'VERIFIED_EXISTING' ||
        String(row.generation) !== String(item.targetBundleGeneration)) {
      throw new Error('Unerwartetes Produktionsobjekt außerhalb des freigegebenen Wiederanlaufs: ' + storagePath);
    }
  }
  for (const item of plan) {
    const bundlePresent = currentIndex.has(item.targetMp3Path);
    if ((item.targetBundleState === 'VERIFIED_EXISTING') !== bundlePresent) {
      throw new Error(item.fach + ': Produktions-MP3-Zustand widerspricht dem Snapshot');
    }
    const sidecarRow = currentIndex.get(item.targetSidecarPath);
    if (!sidecarRow || String(sidecarRow.generation) !== String(item.targetSidecarGeneration)) {
      throw new Error(item.fach + ': Produktions-Sidecar-Zustand widerspricht dem Snapshot');
    }
  }
}

function assertAuthorizedContext({ projectId, bucketName } = {}) {
  if (text(projectId) !== EXPECTED_PROJECT_ID) throw new Error('Firebase-Projekt ist nicht freigegeben');
  if (text(bucketName) !== EXPECTED_BUCKET) throw new Error('Firebase-Bucket ist nicht freigegeben');
  return { projectId: EXPECTED_PROJECT_ID, bucket: EXPECTED_BUCKET };
}

function metadataRow(file) {
  const metadata = file.metadata || {};
  return {
    path: file.name,
    generation: String(metadata.generation),
    metageneration: String(metadata.metageneration || ''),
    size: Number(metadata.size),
    contentType: metadata.contentType || '',
    md5Hash: metadata.md5Hash || '',
    crc32c: metadata.crc32c || '',
    customMetadataSha256: stableCustomMetadataHash(metadata.metadata)
  };
}

async function listSnapshot(bucket) {
  const [files] = await bucket.getFiles({ prefix: PRODUCTION_PREFIX, autoPaginate: true });
  const rows = files.map(metadataRow).sort((a, b) => a.path.localeCompare(b.path));
  return { count: rows.length, aggregateSha256: sha256(JSON.stringify(rows)), rows };
}

async function streamSha256(file) {
  const hash = crypto.createHash('sha256');
  return new Promise((resolve, reject) => {
    file.createReadStream().on('data', chunk => hash.update(chunk)).on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

async function readPinnedObject(bucket, storagePath, expectedType, expectedGeneration) {
  const base = bucket.file(storagePath);
  const [metadata] = await base.getMetadata();
  if (!/^[1-9]\d*$/.test(String(metadata.generation)) ||
      (expectedGeneration !== undefined && String(metadata.generation) !== String(expectedGeneration)) ||
      metadata.contentType !== expectedType || !Number.isSafeInteger(Number(metadata.size)) || Number(metadata.size) <= 0) {
    throw new Error('Objektmetadaten weichen ab: ' + storagePath);
  }
  const file = bucket.file(storagePath, { generation: metadata.generation });
  return { file, metadata };
}

async function readPinnedBytes(bucket, storagePath, expectedType, expectedGeneration) {
  const object = await readPinnedObject(bucket, storagePath, expectedType, expectedGeneration);
  const [bytes] = await object.file.download();
  if (!Buffer.isBuffer(bytes) || bytes.length !== Number(object.metadata.size)) {
    throw new Error('Objektbytes sind unvollständig: ' + storagePath);
  }
  return { ...object, bytes, contentSha256: sha256(bytes) };
}

function sidecarSemanticProjection(sidecar) {
  const clone = JSON.parse(JSON.stringify(sidecar));
  delete clone.bundleVersion;
  delete clone.mp3Path;
  return clone;
}

function auditPlaybackStructure(sidecar, expected) {
  if (!sidecar || sidecar.fach !== expected.fach || sidecar.bundleHash !== expected.bundleHash ||
      Number(sidecar.sampleCount) !== expected.sampleCount || !Array.isArray(sidecar.chapters) ||
      sidecar.chapters.length !== expected.chapters || !Array.isArray(sidecar.chapterGroups) ||
      sidecar.chapterGroups.length !== expected.chapterGroups) {
    throw new Error(expected.fach + ': Produktions-Sidecar-Struktur weicht vom freigegebenen Stand ab');
  }
  let words = 0;
  let previousEndSample = 0;
  for (let index = 0; index < sidecar.chapters.length; index += 1) {
    const chapter = sidecar.chapters[index];
    if (Number(chapter.index) !== index || !Number.isSafeInteger(chapter.startSample) ||
        !Number.isSafeInteger(chapter.endSample) || chapter.startSample !== previousEndSample ||
        chapter.endSample <= chapter.startSample || !Array.isArray(chapter.wortZeitmarken)) {
      throw new Error(expected.fach + ': Kapitelwechsel oder Samplegrenze ist ungültig');
    }
    const duration = (chapter.endSample - chapter.startSample) / 22050;
    let previousStart = 0;
    let previousEnd = 0;
    for (let wordIndex = 0; wordIndex < chapter.wortZeitmarken.length; wordIndex += 1) {
      const mark = chapter.wortZeitmarken[wordIndex];
      if (Number(mark.wortIndex) !== wordIndex || typeof mark.wort !== 'string' || !mark.wort ||
          !Number.isFinite(mark.start) || !Number.isFinite(mark.end) || mark.start < previousStart ||
          mark.end < previousEnd || mark.end < mark.start || mark.end > duration + 0.001) {
        throw new Error(expected.fach + ': Wortmarkensynchronisation ist ungültig');
      }
      previousStart = mark.start;
      previousEnd = mark.end;
    }
    words += chapter.wortZeitmarken.length;
    previousEndSample = chapter.endSample;
  }
  if (previousEndSample !== expected.sampleCount || words !== expected.words) {
    throw new Error(expected.fach + ': Sample- oder Wortmarkenbilanz weicht ab');
  }
  let nextGroupIndex = 0;
  for (const group of sidecar.chapterGroups) {
    if (!Number.isInteger(group.startIndex) || !Number.isInteger(group.endIndex) ||
        group.startIndex !== nextGroupIndex || group.endIndex < group.startIndex ||
        group.endIndex >= sidecar.chapters.length) {
      throw new Error(expected.fach + ': sichtbarer Kapitelwechsel ist ungültig');
    }
    nextGroupIndex = group.endIndex + 1;
  }
  if (nextGroupIndex !== sidecar.chapters.length) throw new Error(expected.fach + ': Kapitelgruppen sind unvollständig');
  return { start: 'PASS', continuousBoundaries: sidecar.chapters.length - 1, chapterGroups: sidecar.chapterGroups.length,
    wordMarks: words, finalSample: previousEndSample };
}

async function inspectSubject(bucket, approved) {
  const sourceSidecar = await readPinnedBytes(bucket, approved.sourceSidecarPath, 'application/json');
  if (sourceSidecar.contentSha256 !== approved.sourceManifestHash) {
    throw new Error(approved.fach + ': Staging-Sidecarhash weicht von der Freigabe ab');
  }
  let sourceSidecarJson;
  try { sourceSidecarJson = JSON.parse(sourceSidecar.bytes.toString('utf8')); }
  catch { throw new Error(approved.fach + ': Staging-Sidecar ist kein JSON'); }
  if (sourceSidecarJson.bundleVersion !== STAGING_VERSION || sourceSidecarJson.mp3Path !== approved.sourceMp3Path) {
    throw new Error(approved.fach + ': Staging-Runtimefelder weichen von der Freigabe ab');
  }
  auditPlaybackStructure(sourceSidecarJson, approved);

  const sourceMp3 = await readPinnedObject(bucket, approved.sourceMp3Path, 'audio/mpeg');
  if (Number(sourceMp3.metadata.size) !== approved.bytes || await streamSha256(sourceMp3.file) !== approved.bundleHash) {
    throw new Error(approved.fach + ': Staging-MP3 weicht von der Freigabe ab');
  }
  if (sourceMp3.metadata.metadata?.bundleHash !== approved.bundleHash ||
      sourceMp3.metadata.metadata?.manifestHash !== approved.sourceManifestHash) {
    throw new Error(approved.fach + ': Staging-MP3-Metadatenbindung weicht ab');
  }

  const derived = deriveProductionSidecar({ sourceSidecar: sourceSidecarJson });
  if (derived.sidecar.fach !== approved.fach || derived.sidecar.mp3Path !== approved.targetMp3Path ||
      derived.sidecar.bundleVersion !== PRODUCTION_VERSION ||
      JSON.stringify(sidecarSemanticProjection(derived.sidecar)) !== JSON.stringify(sidecarSemanticProjection(sourceSidecarJson))) {
    throw new Error(approved.fach + ': Produktions-Sidecar verändert fachliche oder zeitliche Daten');
  }

  const targetSidecar = await readPinnedBytes(bucket, approved.targetSidecarPath, 'application/json');
  let targetSidecarJson;
  try { targetSidecarJson = JSON.parse(targetSidecar.bytes.toString('utf8')); }
  catch { throw new Error(approved.fach + ': bisheriger Produktions-Sidecar ist kein JSON'); }
  if (targetSidecarJson.fach !== approved.fach || targetSidecarJson.bundleVersion !== PRODUCTION_VERSION ||
      !text(targetSidecarJson.mp3Path).startsWith(PRODUCTION_PREFIX)) {
    throw new Error(approved.fach + ': bisheriges Produktionsziel ist unerwartet');
  }
  const targetSidecarState = targetSidecar.contentSha256 === derived.manifestHash ? 'CURRENT' : 'PENDING';
  let targetBundleState = 'ABSENT';
  let targetBundleGeneration = null;
  const [targetBundleExists] = await bucket.file(approved.targetMp3Path).exists();
  if (targetBundleExists) {
    const targetBundle = await readPinnedObject(bucket, approved.targetMp3Path, 'audio/mpeg');
    if (Number(targetBundle.metadata.size) !== approved.bytes ||
        targetBundle.metadata.metadata?.bundleHash !== approved.bundleHash ||
        targetBundle.metadata.metadata?.manifestHash !== derived.manifestHash ||
        !text(targetBundle.metadata.metadata?.firebaseStorageDownloadTokens) ||
        await streamSha256(targetBundle.file) !== approved.bundleHash) {
      throw new Error(approved.fach + ': vorhandenes Hash-MP3-Ziel ist nicht exakt der freigegebene Stand');
    }
    targetBundleState = 'VERIFIED_EXISTING';
    targetBundleGeneration = String(targetBundle.metadata.generation);
  }

  return {
    ...approved,
    sourceMp3Generation: String(sourceMp3.metadata.generation),
    sourceSidecarGeneration: String(sourceSidecar.metadata.generation),
    targetSidecarGeneration: String(targetSidecar.metadata.generation),
    targetSidecarState,
    targetBundleState,
    targetBundleGeneration,
    previousProductionMp3Path: targetSidecarJson.mp3Path,
    targetManifestHash: derived.manifestHash,
    targetSidecarBytes: derived.bytes,
    targetSidecarJson: derived.sidecar
  };
}

function publicSubject(item) {
  const copy = { ...item };
  delete copy.targetSidecarBytes;
  delete copy.targetSidecarJson;
  return copy;
}

function publicPlan(plan) {
  return {
    schemaVersion: 1,
    rolloutId: ROLLOUT_ID,
    projectId: EXPECTED_PROJECT_ID,
    bucket: EXPECTED_BUCKET,
    sourcePrefix: STAGING_PREFIX,
    sourceVersion: STAGING_VERSION,
    targetPrefix: PRODUCTION_PREFIX,
    targetVersion: PRODUCTION_VERSION,
    storageWritesPerformed: false,
    plannedWrites: { immutableMp3Creates: 4, sidecarCasUpdates: 4, total: 8 },
    subjects: plan.subjects.map(publicSubject),
    beforeSnapshot: plan.beforeSnapshot
  };
}

async function createLivePlan(bucket, approval) {
  const approved = buildApprovedTargets(approval);
  const beforeSnapshot = await listSnapshot(bucket);
  const subjects = [];
  for (const item of approved) subjects.push(await inspectSubject(bucket, item));
  return { subjects, beforeSnapshot };
}

function assertFreshPreparation(subjects) {
  exactSubjectMap(subjects, 'Vorbereitungs-Fächer');
  for (const item of subjects) {
    if (item.targetBundleState !== 'ABSENT') {
      throw new Error(item.fach + ': Ziel-MP3 ist im frischen Ausgangszustand bereits vorhanden');
    }
    if (item.targetSidecarState !== 'PENDING') {
      throw new Error(item.fach + ': Produktions-Sidecar ist im frischen Ausgangszustand bereits umgeschaltet');
    }
  }
}

function invariantSubject(item) {
  return {
    fach: item.fach,
    bundleHash: item.bundleHash,
    sourceManifestHash: item.sourceManifestHash,
    sourceMp3Path: item.sourceMp3Path,
    sourceSidecarPath: item.sourceSidecarPath,
    targetMp3Path: item.targetMp3Path,
    targetSidecarPath: item.targetSidecarPath,
    bytes: item.bytes,
    sampleCount: item.sampleCount,
    decodedSamples: item.decodedSamples,
    chapters: item.chapters,
    chapterGroups: item.chapterGroups,
    words: item.words,
    duration: item.duration,
    boundaries: item.boundaries,
    sourceMp3Generation: item.sourceMp3Generation,
    sourceSidecarGeneration: item.sourceSidecarGeneration,
    targetManifestHash: item.targetManifestHash
  };
}

function assertPlanMatchesSaved(live, saved) {
  const livePlan = publicPlan(live);
  const fixedFields = ['rolloutId', 'projectId', 'bucket', 'sourcePrefix', 'sourceVersion',
    'targetPrefix', 'targetVersion'];
  const fixedFieldsMatch = fixedFields.every(key => livePlan[key] === saved?.[key]);
  const writesMatch = saved?.plannedWrites?.immutableMp3Creates === 4 &&
    saved?.plannedWrites?.sidecarCasUpdates === 4 && saved?.plannedWrites?.total === 8;
  const subjectsMatch = JSON.stringify(livePlan.subjects.map(invariantSubject)) ===
    JSON.stringify((saved?.subjects || []).map(invariantSubject));
  if (!fixedFieldsMatch || !writesMatch || !subjectsMatch) {
    throw new Error('Live-Preflight weicht vom gespeicherten Produktionsplan ab');
  }
  const savedSubjects = exactSubjectMap(saved.subjects, 'Gespeicherte Produktionsplan-Fächer');
  for (const item of live.subjects) {
    if (item.targetSidecarState === 'PENDING' &&
        String(item.targetSidecarGeneration) !== String(savedSubjects.get(item.fach).targetSidecarGeneration)) {
      throw new Error(item.fach + ': offener Produktions-Sidecar hat eine unerwartete Generation');
    }
  }
  assertRecoverableSnapshot(saved.beforeSnapshot, live.beforeSnapshot, live.subjects);
}

function validateCompletedManifest(manifest) {
  if (manifest?.rolloutId !== ROLLOUT_ID || manifest?.projectId !== EXPECTED_PROJECT_ID ||
      manifest?.bucket !== EXPECTED_BUCKET || manifest?.sourcePrefix !== STAGING_PREFIX ||
      manifest?.sourceVersion !== STAGING_VERSION || manifest?.targetPrefix !== PRODUCTION_PREFIX ||
      manifest?.targetVersion !== PRODUCTION_VERSION || manifest?.storageWritesPerformed !== true ||
      manifest?.plannedWrites?.total !== 8 || manifest?.storageReadback?.status !== 'PASS' ||
      manifest?.storageReadback?.totals?.transferredArtifacts !== 8 ||
      manifest?.storageReadback?.changeAudit?.addedBundles !== 4 ||
      manifest?.storageReadback?.changeAudit?.changedSidecars !== 4 ||
      !Array.isArray(manifest?.beforeSnapshot?.rows)) {
    throw new Error('Abgeschlossenes Produktionsmanifest ist nicht vollständig oder nicht freigegeben');
  }
  const subjects = exactSubjectMap(manifest.subjects, 'Produktionsmanifest-Fächer');
  const readbackSubjects = exactSubjectMap(manifest.storageReadback.subjects, 'Produktions-Readback-Fächer');
  for (const fach of APPROVED_SUBJECTS) {
    const item = subjects.get(fach);
    const readback = readbackSubjects.get(fach);
    if (!text(item.sourceMp3Path).startsWith(STAGING_PREFIX) ||
        !text(item.sourceSidecarPath).startsWith(STAGING_PREFIX) ||
        !text(item.targetMp3Path).startsWith(PRODUCTION_PREFIX) ||
        !text(item.targetSidecarPath).startsWith(PRODUCTION_PREFIX) ||
        !/^[a-f0-9]{64}$/.test(text(item.bundleHash)) ||
        !/^[a-f0-9]{64}$/.test(text(item.targetManifestHash))) {
      throw new Error(fach + ': abgeschlossenes Produktionsmanifest enthält unerwartete Pfade oder Hashes');
    }
    if (!/^[1-9]\d*$/.test(text(readback.mp3Generation)) ||
        !/^[1-9]\d*$/.test(text(readback.sidecarGeneration)) ||
        readback.mp3Path !== item.targetMp3Path || readback.sidecarPath !== item.targetSidecarPath ||
        readback.mp3Hash !== item.bundleHash || readback.sidecarHash !== item.targetManifestHash) {
      throw new Error(fach + ': Produktions-Readback enthält ungültige Generationen, Pfade oder Hashes');
    }
  }
  return { subjects: subjects.size, productionWrites: manifest.plannedWrites.total, targetPrefix: manifest.targetPrefix };
}

async function verifyPreparedSourcesAndTargets(bucket, subjects) {
  for (const item of subjects) {
    const sourceMp3 = await readPinnedObject(bucket, item.sourceMp3Path, 'audio/mpeg', item.sourceMp3Generation);
    const sourceSidecar = await readPinnedObject(bucket, item.sourceSidecarPath, 'application/json', item.sourceSidecarGeneration);
    const targetSidecar = await readPinnedObject(bucket, item.targetSidecarPath, 'application/json', item.targetSidecarGeneration);
    if (Number(sourceMp3.metadata.size) !== item.bytes || Number(sourceSidecar.metadata.size) <= 0 ||
        Number(targetSidecar.metadata.size) <= 0) throw new Error(item.fach + ': unmittelbare Schreibvorprüfung fehlgeschlagen');
    const targetBundle = await readPinnedObject(bucket, item.targetMp3Path, 'audio/mpeg');
    if (Number(targetBundle.metadata.size) !== item.bytes || targetBundle.metadata.metadata?.bundleHash !== item.bundleHash ||
        targetBundle.metadata.metadata?.manifestHash !== item.targetManifestHash ||
        await streamSha256(targetBundle.file) !== item.bundleHash) {
      throw new Error(item.fach + ': kopiertes Produktions-MP3 ist vor Sidecar-Umschaltung ungültig');
    }
  }
}

async function copyBundles(bucket, subjects) {
  for (const item of subjects) {
    if (item.targetBundleState === 'VERIFIED_EXISTING') continue;
    if (item.targetBundleState !== 'ABSENT') {
      throw new Error(item.fach + ': unbekannter Zielzustand für Produktions-MP3');
    }
    const source = bucket.file(item.sourceMp3Path, { generation: item.sourceMp3Generation });
    await source.copy(bucket.file(item.targetMp3Path), {
      contentType: 'audio/mpeg',
      metadata: {
        bundleHash: item.bundleHash,
        manifestHash: item.targetManifestHash,
        firebaseStorageDownloadTokens: crypto.randomUUID()
      },
      preconditionOpts: { ifGenerationMatch: 0 }
    });
  }
}

async function switchSidecars(bucket, subjects) {
  for (const item of subjects) {
    if (item.targetSidecarState === 'CURRENT') continue;
    if (item.targetSidecarState !== 'PENDING') {
      throw new Error(item.fach + ': unbekannter Zielzustand für Produktions-Sidecar');
    }
    if (sha256(item.targetSidecarBytes) !== item.targetManifestHash) {
      throw new Error(item.fach + ': Produktions-Sidecarbytes weichen vor Write ab');
    }
    await bucket.file(item.targetSidecarPath).save(item.targetSidecarBytes, {
      resumable: false,
      metadata: {
        contentType: 'application/json',
        metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() }
      },
      preconditionOpts: { ifGenerationMatch: item.targetSidecarGeneration }
    });
  }
}

async function executeWrites({ bucket, subjects, copy = copyBundles,
  verify = verifyPreparedSourcesAndTargets, switchRuntime = switchSidecars } = {}) {
  await copy(bucket, subjects);
  await verify(bucket, subjects);
  await switchRuntime(bucket, subjects);
}

async function verifyPublishedSubject(bucket, item, root, ffmpeg = runFfmpeg, expectedGeneration = {}) {
  const sourceSidecar = await readPinnedBytes(
    bucket, item.sourceSidecarPath, 'application/json', item.sourceSidecarGeneration
  );
  const targetSidecar = await readPinnedBytes(
    bucket, item.targetSidecarPath, 'application/json', expectedGeneration.sidecarGeneration
  );
  if (targetSidecar.contentSha256 !== item.targetManifestHash) {
    throw new Error(item.fach + ': Produktions-Sidecarhash weicht ab');
  }
  const sourceJson = JSON.parse(sourceSidecar.bytes.toString('utf8'));
  const targetJson = JSON.parse(targetSidecar.bytes.toString('utf8'));
  if (targetJson.bundleVersion !== PRODUCTION_VERSION || targetJson.mp3Path !== item.targetMp3Path ||
      JSON.stringify(sidecarSemanticProjection(targetJson)) !== JSON.stringify(sidecarSemanticProjection(sourceJson)) ||
      /podcast\/staging\//i.test(targetSidecar.bytes.toString('utf8'))) {
    throw new Error(item.fach + ': Produktions-Sidecar ist nicht semantisch identisch');
  }
  const playback = auditPlaybackStructure(targetJson, item);
  const targetMp3 = await readPinnedObject(
    bucket, item.targetMp3Path, 'audio/mpeg', expectedGeneration.mp3Generation
  );
  if (Number(targetMp3.metadata.size) !== item.bytes || targetMp3.metadata.metadata?.bundleHash !== item.bundleHash ||
      targetMp3.metadata.metadata?.manifestHash !== item.targetManifestHash ||
      !text(targetMp3.metadata.metadata?.firebaseStorageDownloadTokens)) {
    throw new Error(item.fach + ': Produktions-MP3-Metadatenbindung weicht ab');
  }
  const subjectDir = fs.mkdtempSync(path.join(root, 'verify-'));
  const localMp3 = path.join(subjectDir, 'bundle.mp3');
  const localPcm = path.join(subjectDir, 'bundle.pcm');
  try {
    await targetMp3.file.download({ destination: localMp3 });
    const bytes = fs.readFileSync(localMp3);
    if (bytes.length !== item.bytes || sha256(bytes) !== item.bundleHash) {
      throw new Error(item.fach + ': Produktions-MP3 ist nicht byteidentisch mit Staging');
    }
    await ffmpeg(['-nostdin', '-v', 'error', '-xerror', '-y', '-i', localMp3,
      '-f', 's16le', '-ac', '1', '-ar', '22050', localPcm]);
    const pcmBytes = fs.statSync(localPcm).size;
    if (pcmBytes <= 0 || pcmBytes % 2 || pcmBytes / 2 !== item.sampleCount) {
      throw new Error(item.fach + ': Produktions-MP3 Decode-Samples weichen ab');
    }
    const [latestSidecar] = await bucket.file(item.targetSidecarPath).getMetadata();
    const [latestMp3] = await bucket.file(item.targetMp3Path).getMetadata();
    if (latestSidecar.generation !== targetSidecar.metadata.generation ||
        latestMp3.generation !== targetMp3.metadata.generation) {
      throw new Error(item.fach + ': Produktionsobjekt änderte sich während des Smoke-Tests');
    }
    return {
      fach: item.fach,
      sidecarPath: item.targetSidecarPath,
      sidecarGeneration: String(targetSidecar.metadata.generation),
      sidecarHash: item.targetManifestHash,
      mp3Path: item.targetMp3Path,
      mp3Generation: String(targetMp3.metadata.generation),
      mp3Hash: item.bundleHash,
      bytes: bytes.length,
      stagingBytes: item.bytes,
      sampleCount: item.sampleCount,
      decodedSamples: pcmBytes / 2,
      chapters: item.chapters,
      chapterGroups: item.chapterGroups,
      wordMarks: item.words,
      playback,
      authenticatedDownload: 'PASS',
      downloadTokenPresent: true,
      result: 'PASS'
    };
  } finally {
    if (fs.existsSync(subjectDir)) fs.rmSync(subjectDir, { recursive: true, force: true });
  }
}

async function verifyProduction(bucket, subjects, beforeSnapshot, ffmpeg = runFfmpeg, expectedGenerations = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-prod-verify-'));
  try {
    const verified = [];
    for (const item of subjects) {
      verified.push(await verifyPublishedSubject(bucket, item, root, ffmpeg, expectedGenerations[item.fach]));
    }
    const afterSnapshot = await listSnapshot(bucket);
    const changeAudit = assertOnlyApprovedSnapshotChanges(beforeSnapshot, afterSnapshot, subjects);
    return {
      status: 'PASS',
      subjects: verified,
      totals: {
        subjects: verified.length,
        transferredArtifacts: 8,
        mp3Bytes: verified.reduce((sum, item) => sum + item.bytes, 0),
        sampleCount: verified.reduce((sum, item) => sum + item.sampleCount, 0),
        wordMarks: verified.reduce((sum, item) => sum + item.wordMarks, 0)
      },
      changeAudit,
      beforeSnapshot: { count: beforeSnapshot.count, aggregateSha256: beforeSnapshot.aggregateSha256 },
      afterSnapshot: { count: afterSnapshot.count, aggregateSha256: afterSnapshot.aggregateSha256 }
    };
  } finally {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  }
}

async function authorizedBucket() {
  const credentialPath = text(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!credentialPath || !fs.existsSync(credentialPath)) throw new Error('Vorhandene externe Firebase-Anmeldung fehlt');
  const credential = readJson(credentialPath, 'Firebase-Anmeldung');
  assertAuthorizedContext({ projectId: credential.project_id, bucketName: process.env.FIREBASE_STORAGE_BUCKET });
  const adminClient = await createAdminClient();
  const bucket = adminClient.storage().bucket();
  const [metadata] = await bucket.getMetadata();
  assertAuthorizedContext({ projectId: credential.project_id, bucketName: metadata.name });
  return bucket;
}

async function prepare({ approvalPath = DEFAULT_APPROVAL, manifestPath = DEFAULT_MANIFEST } = {}) {
  const approval = readJson(approvalPath, 'Staging-Freigabenachweis');
  const bucket = await authorizedBucket();
  const live = await createLivePlan(bucket, approval);
  assertFreshPreparation(live.subjects);
  const manifest = { ...publicPlan(live), generatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { status: 'PREPARED_NO_WRITES', manifest: manifestPath, subjects: manifest.subjects.length,
    writes: manifest.plannedWrites, prefix: manifest.targetPrefix };
}

async function publish({ approvalPath = DEFAULT_APPROVAL, manifestPath = DEFAULT_MANIFEST,
  reportPath = DEFAULT_REPORT, ffmpeg = runFfmpeg } = {}) {
  const approval = readJson(approvalPath, 'Staging-Freigabenachweis');
  const saved = readJson(manifestPath, 'Produktions-Rollout-Manifest');
  const bucket = await authorizedBucket();
  const live = await createLivePlan(bucket, approval);
  assertPlanMatchesSaved(live, saved);

  const immediate = await createLivePlan(bucket, approval);
  assertPlanMatchesSaved(immediate, saved);
  await executeWrites({ bucket, subjects: immediate.subjects });

  const storageReadback = await verifyProduction(bucket, immediate.subjects, saved.beforeSnapshot, ffmpeg);
  const finalManifest = { ...saved, storageWritesPerformed: true, publishedAt: new Date().toISOString(), storageReadback };
  fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2) + '\n', 'utf8');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    schemaVersion: 1,
    rolloutId: ROLLOUT_ID,
    result: 'PUBLISHED_AND_VERIFIED',
    projectId: EXPECTED_PROJECT_ID,
    bucket: EXPECTED_BUCKET,
    sourcePrefix: STAGING_PREFIX,
    targetPrefix: PRODUCTION_PREFIX,
    productionWrites: 8,
    deploymentPerformed: false,
    storageReadback
  }, null, 2) + '\n', 'utf8');
  return { status: 'PUBLISHED_AND_VERIFIED', manifest: manifestPath, report: reportPath,
    totals: storageReadback.totals, changes: storageReadback.changeAudit };
}

function completedGenerations(manifest) {
  return Object.fromEntries(manifest.storageReadback.subjects.map(item => [item.fach, {
    sidecarGeneration: String(item.sidecarGeneration),
    mp3Generation: String(item.mp3Generation)
  }]));
}

async function verify({ manifestPath = DEFAULT_MANIFEST, ffmpeg = runFfmpeg,
  bucketProvider = authorizedBucket, verifyFn = verifyProduction } = {}) {
  const manifest = readJson(manifestPath, 'Produktions-Rollout-Manifest');
  validateCompletedManifest(manifest);
  const bucket = await bucketProvider();
  const storageReadback = await verifyFn(
    bucket, manifest.subjects, manifest.beforeSnapshot, ffmpeg, completedGenerations(manifest)
  );
  return { status: 'VERIFIED_NO_WRITES', subjects: storageReadback.subjects.length,
    totals: storageReadback.totals, changes: storageReadback.changeAudit };
}

async function main() {
  const mode = text(process.argv[2]);
  if (mode === 'prepare') return prepare();
  if (mode === 'publish') return publish();
  if (mode === 'verify') return verify();
  throw new Error('Modus muss prepare, publish oder verify sein');
}

if (require.main === module) {
  main().then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n')).catch(error => {
    process.stderr.write('STOP: ' + error.message + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  APPROVED_SUBJECTS,
  PRODUCTION_PREFIX,
  PRODUCTION_VERSION,
  STAGING_PREFIX,
  STAGING_VERSION,
  ROLLOUT_ID,
  buildApprovedTargets,
  assertFreshPreparation,
  assertOnlyApprovedSnapshotChanges,
  assertRecoverableSnapshot,
  assertAuthorizedContext,
  auditPlaybackStructure,
  createLivePlan,
  copyBundles,
  executeWrites,
  switchSidecars,
  validateCompletedManifest,
  prepare,
  publish,
  verify,
  verifyProduction
};
