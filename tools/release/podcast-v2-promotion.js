'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const {
  PRODUCTION_PODCAST_PREFIX,
  PRODUCTION_PODCAST_PREFIX_V2,
  PRODUCTION_PODCAST_VERSION_V2,
  buildV2RuntimePromotionManifest,
  validateV2RuntimePromotionManifest
} = require('./podcast-promotion');

const LEGACY_RUNTIME_PREFIX = 'podcast/continuous/';
const EXPECTED = Object.freeze({ subjects: 13, ids: 521, chapters: 48 });

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function publicManifest(plan) {
  const copy = JSON.parse(JSON.stringify(plan));
  for (const item of copy.sidecars || []) delete item.runtimeSidecarText;
  return copy;
}

function stableSnapshot(files) {
  const rows = files.map(file => ({
    path: file.name,
    generation: String(file.metadata.generation),
    size: Number(file.metadata.size),
    contentType: file.metadata.contentType || '',
    md5Hash: file.metadata.md5Hash || '',
    crc32c: file.metadata.crc32c || ''
  })).sort((a, b) => a.path.localeCompare(b.path));
  return { count: rows.length, aggregateSha256: sha256(JSON.stringify(rows)), rows };
}

async function listSnapshot(bucket, prefix) {
  const [files] = await bucket.getFiles({ prefix, autoPaginate: true });
  return stableSnapshot(files);
}

function assertSnapshotUnchanged(before, after, label) {
  if (before.count !== after.count || before.aggregateSha256 !== after.aggregateSha256) {
    throw new Error(`${label} wurde während der v2-Promotion verändert.`);
  }
}

async function readSourceObject(bucket, contract, download = false) {
  const file = bucket.file(contract.sourcePath, { generation: contract.sourceGeneration });
  const [metadata] = await file.getMetadata();
  const identity = sha256(JSON.stringify([
    contract.sourcePath,
    String(metadata.generation),
    Number(metadata.size),
    metadata.contentType
  ]));
  if (String(metadata.generation) !== String(contract.sourceGeneration) ||
      Number(metadata.size) !== Number(contract.size) || metadata.contentType !== contract.contentType ||
      identity !== contract.sourceIdentitySha256) {
    throw new Error(`Quellobjekt weicht vom freigegebenen Vertrag ab: ${contract.sourcePath}`);
  }
  if (!download) return { file, metadata };
  const [bytes] = await file.download();
  if (sha256(bytes) !== contract.contentSha256) {
    throw new Error(`Quellinhalt weicht vom freigegebenen Hash ab: ${contract.sourcePath}`);
  }
  return { file, metadata, bytes };
}

async function ensureTargetsAbsent(bucket, targetPaths) {
  const conflicts = [];
  for (const targetPath of targetPaths) {
    const [exists] = await bucket.file(targetPath).exists();
    if (exists) conflicts.push(targetPath);
  }
  if (conflicts.length) throw new Error(`v2-Zielnamespace ist nicht leer (${conflicts.length} Konflikte).`);
}

async function loadLivePlan(bucket, v1Manifest) {
  const runtimeSidecars = v1Manifest.objects.filter(item => item.runtimeClientObject && item.contentType === 'application/json');
  const sourceSidecars = {};
  for (const contract of runtimeSidecars) {
    const result = await readSourceObject(bucket, contract, true);
    sourceSidecars[contract.sourcePath] = result.bytes;
  }
  return buildV2RuntimePromotionManifest({ v1Manifest, sourceSidecars, expected: EXPECTED });
}

function assertPlanMatchesSaved(livePlan, saved) {
  const current = publicManifest(livePlan);
  const expected = { ...saved };
  delete expected.storageReadback;
  delete expected.publishedAt;
  expected.storageWritesPerformed = false;
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error('Live neu abgeleiteter v2-Plan weicht vom gespeicherten Promotion-Manifest ab.');
  }
}

async function streamSha256(file) {
  const hash = crypto.createHash('sha256');
  return new Promise((resolve, reject) => {
    file.createReadStream().on('data', chunk => hash.update(chunk)).on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function sidecarSemanticProjection(sidecar) {
  const clone = JSON.parse(JSON.stringify(sidecar));
  delete clone.bundleVersion;
  delete clone.mp3Path;
  return clone;
}

async function auditPublished(bucket, livePlan, preSnapshots) {
  const targetFiles = await listSnapshot(bucket, PRODUCTION_PODCAST_PREFIX_V2);
  if (targetFiles.count !== 26) throw new Error(`v2-Zielnamespace enthält ${targetFiles.count} statt 26 Objekte.`);
  const sourceSidecars = new Map();
  for (const item of livePlan.objects.filter(value => value.kind === 'sidecar')) {
    const source = await readSourceObject(bucket, {
      ...item,
      size: item.sourceSize,
      contentSha256: item.sourceContentSha256,
      contentType: 'application/json'
    }, true);
    sourceSidecars.set(item.fach, JSON.parse(source.bytes.toString('utf8')));
  }

  const readback = [];
  const allIds = [];
  let chapterCount = 0;
  let stagingReferences = 0;
  for (const sidecarContract of livePlan.sidecars) {
    const sidecarFile = bucket.file(sidecarContract.targetPath);
    const [sidecarBytes] = await sidecarFile.download();
    const [sidecarMetadata] = await sidecarFile.getMetadata();
    const sidecarHash = sha256(sidecarBytes);
    if (sidecarHash !== sidecarContract.manifestHash || sidecarMetadata.contentType !== 'application/json' ||
        !sidecarMetadata.metadata?.firebaseStorageDownloadTokens) {
      throw new Error(`v2-Sidecar-Readback fehlgeschlagen: ${sidecarContract.fach}`);
    }
    const text = sidecarBytes.toString('utf8');
    const sidecar = JSON.parse(text);
    stagingReferences += (text.match(/staging/gi) || []).length;
    if (sidecar.bundleVersion !== PRODUCTION_PODCAST_VERSION_V2 ||
        sidecar.mp3Path !== sidecarContract.mp3Path || !sidecar.mp3Path.startsWith(PRODUCTION_PODCAST_PREFIX_V2)) {
      throw new Error(`v2-Runtimefelder weichen ab: ${sidecarContract.fach}`);
    }
    const sourceSidecar = sourceSidecars.get(sidecarContract.fach);
    if (JSON.stringify(sidecarSemanticProjection(sidecar)) !== JSON.stringify(sidecarSemanticProjection(sourceSidecar))) {
      throw new Error(`Fachliche/zeitliche Sidecardaten wurden verändert: ${sidecarContract.fach}`);
    }
    const ids = sidecar.chapters.map(item => item.lerntextId);
    if (new Set(ids).size !== ids.length) throw new Error(`Doppelte Lerntext-ID in ${sidecarContract.fach}.`);
    allIds.push(...ids);
    chapterCount += sidecar.chapterGroups.length;

    const bundleContract = livePlan.objects.find(item => item.kind === 'bundle' && item.fach === sidecarContract.fach);
    const bundleFile = bucket.file(sidecar.mp3Path);
    const [bundleMetadata] = await bundleFile.getMetadata();
    if (bundleMetadata.contentType !== 'audio/mpeg' || Number(bundleMetadata.size) !== Number(bundleContract.size) ||
        bundleMetadata.metadata?.bundleHash !== bundleContract.bundleHash ||
        bundleMetadata.metadata?.manifestHash !== sidecarContract.manifestHash ||
        !bundleMetadata.metadata?.firebaseStorageDownloadTokens) {
      throw new Error(`v2-MP3-Metadatenbindung weicht ab: ${sidecarContract.fach}`);
    }
    const actualBundleHash = await streamSha256(bundleFile);
    if (actualBundleHash !== bundleContract.bundleHash || actualBundleHash !== bundleContract.sourceContentSha256) {
      throw new Error(`v2-MP3-Hash weicht ab: ${sidecarContract.fach}`);
    }
    readback.push({
      fach: sidecarContract.fach,
      sidecarPath: sidecarContract.targetPath,
      sidecarHash,
      sidecarGeneration: String(sidecarMetadata.generation),
      mp3Path: sidecar.mp3Path,
      mp3Hash: actualBundleHash,
      mp3Generation: String(bundleMetadata.generation),
      ids: ids.length,
      chapters: sidecar.chapterGroups.length,
      duration: sidecar.duration,
      result: 'PASS'
    });
  }
  if (allIds.length !== EXPECTED.ids || new Set(allIds).size !== EXPECTED.ids || chapterCount !== EXPECTED.chapters) {
    throw new Error(`Globale v2-Bilanz weicht ab: ${allIds.length} IDs/${new Set(allIds).size} eindeutig, ${chapterCount} Kapitel.`);
  }
  const postV1 = await listSnapshot(bucket, PRODUCTION_PODCAST_PREFIX);
  const postLegacy = await listSnapshot(bucket, LEGACY_RUNTIME_PREFIX);
  assertSnapshotUnchanged(preSnapshots.v1, postV1, 'v1-Produktionsnamespace');
  assertSnapshotUnchanged(preSnapshots.legacy, postLegacy, 'Bisheriger produktiver Runtimebestand');
  if (stagingReferences !== 0) throw new Error(`v2-Runtimebestand enthält ${stagingReferences} Staging-Referenzen.`);
  return {
    status: 'PASS',
    targetInventory: targetFiles,
    sidecars: readback.sort((a, b) => a.fach.localeCompare(b.fach)),
    totals: { objects: 26, sidecars: 13, bundles: 13, ids: allIds.length,
      uniqueIds: new Set(allIds).size, chapters: chapterCount, stagingReferences },
    unchanged: {
      v1: { count: postV1.count, aggregateSha256: postV1.aggregateSha256 },
      legacy: { count: postLegacy.count, aggregateSha256: postLegacy.aggregateSha256 }
    }
  };
}

async function prepare(bucket, v1ManifestPath, outputPath) {
  const v1Manifest = JSON.parse(fs.readFileSync(v1ManifestPath, 'utf8'));
  const livePlan = await loadLivePlan(bucket, v1Manifest);
  validateV2RuntimePromotionManifest(livePlan, EXPECTED);
  await ensureTargetsAbsent(bucket, livePlan.objects.map(item => item.targetPath));
  const result = publicManifest(livePlan);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  return { status: 'PREPARED', manifest: outputPath, version: result.version,
    prefix: result.targetPrefix, objects: result.objects.length, sidecars: result.sidecars.length };
}

async function publish(bucket, v1ManifestPath, manifestPath, reportPath) {
  const v1Manifest = JSON.parse(fs.readFileSync(v1ManifestPath, 'utf8'));
  const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateV2RuntimePromotionManifest(saved, EXPECTED);
  const livePlan = await loadLivePlan(bucket, v1Manifest);
  assertPlanMatchesSaved(livePlan, saved);
  const preSnapshots = {
    v1: await listSnapshot(bucket, PRODUCTION_PODCAST_PREFIX),
    legacy: await listSnapshot(bucket, LEGACY_RUNTIME_PREFIX)
  };
  if (preSnapshots.v1.count !== 110 || preSnapshots.legacy.count !== 26) {
    throw new Error(`Unveränderlicher Ausgangsbestand weicht ab (v1=${preSnapshots.v1.count}, legacy=${preSnapshots.legacy.count}).`);
  }

  // Verpflichtender zweiter Konfliktcheck unmittelbar vor dem ersten Write.
  const immediatePlan = await loadLivePlan(bucket, v1Manifest);
  assertPlanMatchesSaved(immediatePlan, saved);
  await ensureTargetsAbsent(bucket, immediatePlan.objects.map(item => item.targetPath));

  for (const item of immediatePlan.objects.filter(value => value.kind === 'bundle')) {
    const source = bucket.file(item.sourcePath, { generation: item.sourceGeneration });
    const destination = bucket.file(item.targetPath);
    await source.copy(destination, {
      contentType: 'audio/mpeg',
      metadata: {
        bundleHash: item.bundleHash,
        manifestHash: item.manifestHash,
        firebaseStorageDownloadTokens: crypto.randomUUID()
      },
      preconditionOpts: { ifGenerationMatch: 0 }
    });
  }
  for (const item of immediatePlan.objects.filter(value => value.kind === 'sidecar')) {
    const sidecar = immediatePlan.sidecars.find(value => value.fach === item.fach);
    const bytes = Buffer.from(sidecar.runtimeSidecarText, 'utf8');
    if (sha256(bytes) !== item.contentSha256) throw new Error(`Sidecarpayload weicht vor Write ab: ${item.fach}`);
    await bucket.file(item.targetPath).save(bytes, {
      resumable: false,
      metadata: {
        contentType: 'application/json',
        metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() }
      },
      preconditionOpts: { ifGenerationMatch: 0 }
    });
  }

  const storageReadback = await auditPublished(bucket, immediatePlan, preSnapshots);
  const finalManifest = publicManifest(immediatePlan);
  finalManifest.storageWritesPerformed = true;
  finalManifest.publishedAt = new Date().toISOString();
  finalManifest.storageReadback = storageReadback;
  fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2) + '\n');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    schemaVersion: 1,
    version: PRODUCTION_PODCAST_VERSION_V2,
    prefix: PRODUCTION_PODCAST_PREFIX_V2,
    result: 'GO_FOR_ROLLOUT_CONTINUATION',
    clientSwitched: false,
    sheetWritesPerformed: false,
    readback: storageReadback
  }, null, 2) + '\n');
  return { status: 'PUBLISHED_AND_VERIFIED', version: PRODUCTION_PODCAST_VERSION_V2,
    prefix: PRODUCTION_PODCAST_PREFIX_V2, report: reportPath, totals: storageReadback.totals };
}

async function main() {
  const mode = process.argv[2];
  const v1ManifestPath = path.resolve(process.argv[3] || 'release/WIFA-GESAMT-PROD-20261007-RC1/podcast/PRODUCTION_PODCAST_PROMOTION_MANIFEST.json');
  const manifestPath = path.resolve(process.argv[4] || 'release/WIFA-GESAMT-PROD-20261007-RC1/podcast/PRODUCTION_PODCAST_PROMOTION_MANIFEST_V2.json');
  const reportPath = path.resolve(process.argv[5] || 'release/WIFA-GESAMT-PROD-20261007-RC1/runs/podcast-v2-readback.json');
  if (!['prepare', 'publish'].includes(mode)) throw new Error('Modus muss prepare oder publish sein.');
  if (!getApps().length) initializeApp({ storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
  const bucket = getStorage().bucket();
  const result = mode === 'prepare'
    ? await prepare(bucket, v1ManifestPath, manifestPath)
    : await publish(bucket, v1ManifestPath, manifestPath, reportPath);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`STOP: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { EXPECTED, auditPublished, prepare, publicManifest, publish };
