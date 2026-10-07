'use strict';

const crypto = require('node:crypto');

const STAGING_PODCAST_PREFIX = 'podcast/staging/lerntext-rev2/';
const PRODUCTION_PODCAST_VERSION = 'WIFA-PODCAST-PROD-LZREV2-20261007-v1';
const PRODUCTION_PODCAST_PREFIX = `podcast/production/lerntext-rev2/${PRODUCTION_PODCAST_VERSION}/`;
const PRODUCTION_PODCAST_VERSION_V2 = 'WIFA-PODCAST-PROD-LZREV2-20261007-v2';
const PRODUCTION_PODCAST_PREFIX_V2 = `podcast/production/lerntext-rev2/${PRODUCTION_PODCAST_VERSION_V2}/`;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildRuntimeHashes(migration) {
  const hashes = new Map();
  for (const subject of migration.subjects || []) {
    const publication = subject.publication || {};
    hashes.set(publication.mp3Path, publication.bundleHash);
    hashes.set(publication.sidecarPath, publication.manifestHash);
  }
  return hashes;
}

function buildPromotionManifest({ inventory, migration }) {
  if (inventory?.prefix !== STAGING_PODCAST_PREFIX || migration?.targetPrefix !== STAGING_PODCAST_PREFIX) {
    throw new Error('Staging-Präfix stimmt nicht mit dem freigegebenen Inventar überein.');
  }
  if (!Array.isArray(inventory.objects) || inventory.objects.length !== 110) {
    throw new Error(`Podcastinventar muss exakt 110 Objekte enthalten; ist ${inventory?.objects?.length || 0}.`);
  }
  const runtimeHashes = buildRuntimeHashes(migration);
  const objects = inventory.objects.map(object => {
    if (!object.path.startsWith(STAGING_PODCAST_PREFIX)) throw new Error(`Fremder Quellpfad: ${object.path}`);
    const suffix = object.path.slice(STAGING_PODCAST_PREFIX.length);
    const runtimeClientObject = runtimeHashes.has(object.path);
    return {
      sourcePath: object.path,
      sourceGeneration: String(object.generation),
      sourceIdentitySha256: sha256(JSON.stringify([
        object.path, String(object.generation), Number(object.size), object.contentType
      ])),
      contentSha256: runtimeClientObject ? runtimeHashes.get(object.path) : null,
      size: Number(object.size),
      contentType: object.contentType,
      targetPath: PRODUCTION_PODCAST_PREFIX + suffix,
      runtimeClientObject
    };
  });
  const manifest = {
    schemaVersion: 1,
    releaseId: 'WIFA-GESAMT-PROD-20261007-RC1',
    version: PRODUCTION_PODCAST_VERSION,
    sourceVersion: migration.bundleVersion,
    sourcePrefix: STAGING_PODCAST_PREFIX,
    targetPrefix: PRODUCTION_PODCAST_PREFIX,
    storageWritesPerformed: false,
    hashContract: {
      sourceIdentitySha256: 'SHA-256(JSON([sourcePath,sourceGeneration,size,contentType]))',
      runtimeContentSha256: 'Bundle SHA-256 for MP3; manifest SHA-256 for sidecar JSON',
      copyPrecondition: 'sourceGeneration must match before server-side copy'
    },
    objects
  };
  validatePromotionManifest(manifest);
  return manifest;
}

function validatePromotionManifest(manifest) {
  if (manifest?.version !== PRODUCTION_PODCAST_VERSION || manifest?.targetPrefix !== PRODUCTION_PODCAST_PREFIX) {
    throw new Error('Produktionspräfix oder Podcastversion ist ungültig.');
  }
  if (!Array.isArray(manifest.objects) || manifest.objects.length !== 110) {
    throw new Error(`Produktionsmapping muss exakt 110 Objekte enthalten; ist ${manifest?.objects?.length || 0}.`);
  }
  const sources = new Set();
  const targets = new Set();
  let runtimeObjects = 0;
  let totalBytes = 0;
  for (const item of manifest.objects) {
    if (sources.has(item.sourcePath) || targets.has(item.targetPath)) throw new Error('Quell- oder Zielpfad ist doppelt.');
    sources.add(item.sourcePath);
    targets.add(item.targetPath);
    if (!item.sourcePath.startsWith(STAGING_PODCAST_PREFIX) || !item.targetPath.startsWith(PRODUCTION_PODCAST_PREFIX)) {
      throw new Error('Objekt liegt außerhalb des freigegebenen Staging-/Produktionspräfixes.');
    }
    if (!/^[a-f0-9]{64}$/.test(item.sourceIdentitySha256) || !/^\d+$/.test(item.sourceGeneration) ||
        !Number.isSafeInteger(item.size) || item.size <= 0 || !['application/json', 'audio/mpeg'].includes(item.contentType)) {
      throw new Error(`Ungültiger Objektvertrag: ${item.sourcePath}`);
    }
    if (item.runtimeClientObject) {
      runtimeObjects += 1;
      if (!/^[a-f0-9]{64}$/.test(item.contentSha256)) throw new Error(`Runtimehash fehlt: ${item.sourcePath}`);
    }
    totalBytes += item.size;
  }
  if (runtimeObjects !== 26) throw new Error(`Runtimemapping muss exakt 26 Objekte enthalten; ist ${runtimeObjects}.`);
  return { objects: manifest.objects.length, runtimeObjects, totalBytes };
}

function parseSidecarBytes(value, sourcePath) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''), 'utf8');
  let sidecar;
  try {
    sidecar = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Sidecar ist kein gültiges JSON (${sourcePath || 'unbekannt'}): ${error.message}`);
  }
  return { bytes, sidecar };
}

function deriveProductionSidecar({
  sourceSidecar,
  targetVersion = PRODUCTION_PODCAST_VERSION_V2,
  targetPrefix = PRODUCTION_PODCAST_PREFIX_V2
} = {}) {
  if (!sourceSidecar || typeof sourceSidecar !== 'object' || Array.isArray(sourceSidecar)) {
    throw new Error('Staging-Sidecar fehlt.');
  }
  if (typeof sourceSidecar.mp3Path !== 'string' || !sourceSidecar.mp3Path.startsWith(STAGING_PODCAST_PREFIX + 'continuous/')) {
    throw new Error('Aktiver Staging-MP3-Pfad ist ungültig.');
  }
  if (!/^[a-f0-9]{64}$/.test(String(sourceSidecar.bundleHash || '')) ||
      !sourceSidecar.mp3Path.endsWith(`/${sourceSidecar.bundleHash}.mp3`)) {
    throw new Error('Bundlehash und aktiver MP3-Pfad sind inkonsistent.');
  }
  if (!Array.isArray(sourceSidecar.chapters) || !sourceSidecar.chapters.length ||
      !Array.isArray(sourceSidecar.chapterGroups) || !sourceSidecar.chapterGroups.length) {
    throw new Error('Kapitel- oder Lerntextstruktur fehlt.');
  }
  const sidecar = JSON.parse(JSON.stringify(sourceSidecar));
  sidecar.bundleVersion = targetVersion;
  sidecar.mp3Path = targetPrefix + sourceSidecar.mp3Path.slice(STAGING_PODCAST_PREFIX.length);
  const runtimeSidecarText = JSON.stringify(sidecar);
  if (/podcast\/staging\//i.test(runtimeSidecarText) || /WIFA-PODCAST-STAGING/i.test(runtimeSidecarText)) {
    throw new Error('Abgeleiteter Produktions-Sidecar enthält weiterhin Staging-Referenzen.');
  }
  const restored = JSON.parse(runtimeSidecarText);
  restored.bundleVersion = sourceSidecar.bundleVersion;
  restored.mp3Path = sourceSidecar.mp3Path;
  if (JSON.stringify(restored) !== JSON.stringify(sourceSidecar)) {
    throw new Error('Die Sidecar-Ableitung verändert mehr als Bundleversion und aktiven MP3-Pfad.');
  }
  const bytes = Buffer.from(runtimeSidecarText, 'utf8');
  return { sidecar, bytes, runtimeSidecarText, manifestHash: sha256(bytes) };
}

function buildV2RuntimePromotionManifest({
  v1Manifest,
  sourceSidecars,
  expected = { subjects: 13, ids: 521, chapters: 48 }
} = {}) {
  if (v1Manifest?.sourcePrefix !== STAGING_PODCAST_PREFIX || !Array.isArray(v1Manifest?.objects)) {
    throw new Error('Freigegebenes v1-Quellmanifest ist ungültig.');
  }
  const runtimeObjects = v1Manifest.objects.filter(item => item.runtimeClientObject);
  const sourceByPath = new Map(runtimeObjects.map(item => [item.sourcePath, item]));
  const sourceValues = sourceSidecars instanceof Map ? sourceSidecars : new Map(Object.entries(sourceSidecars || {}));
  const sidecarSources = runtimeObjects.filter(item => item.contentType === 'application/json');
  const objects = [];
  const sidecars = [];
  for (const sourceObject of sidecarSources) {
    const supplied = sourceValues.get(sourceObject.sourcePath);
    if (supplied === undefined) throw new Error(`Sidecarbytes fehlen: ${sourceObject.sourcePath}`);
    const parsed = parseSidecarBytes(supplied, sourceObject.sourcePath);
    if (sha256(parsed.bytes) !== sourceObject.contentSha256) {
      throw new Error(`Quell-Sidecarhash weicht vom freigegebenen Manifest ab: ${sourceObject.sourcePath}`);
    }
    if (parsed.sidecar.bundleVersion !== v1Manifest.sourceVersion) {
      throw new Error(`Quell-Bundleversion weicht ab: ${sourceObject.sourcePath}`);
    }
    const derived = deriveProductionSidecar({ sourceSidecar: parsed.sidecar });
    const bundleSource = sourceByPath.get(parsed.sidecar.mp3Path);
    if (!bundleSource || bundleSource.contentType !== 'audio/mpeg' ||
        bundleSource.contentSha256 !== parsed.sidecar.bundleHash) {
      throw new Error(`Freigegebenes MP3-Bundle fehlt oder ist inkonsistent: ${parsed.sidecar.fach}`);
    }
    const sidecarSuffix = sourceObject.sourcePath.slice(STAGING_PODCAST_PREFIX.length);
    const targetSidecarPath = PRODUCTION_PODCAST_PREFIX_V2 + sidecarSuffix;
    const commonSidecar = {
      sourcePath: sourceObject.sourcePath,
      sourceGeneration: sourceObject.sourceGeneration,
      sourceIdentitySha256: sourceObject.sourceIdentitySha256,
      sourceContentSha256: sourceObject.contentSha256,
      sourceSize: sourceObject.size,
      contentSha256: derived.manifestHash,
      size: derived.bytes.length,
      contentType: 'application/json',
      targetPath: targetSidecarPath,
      runtimeClientObject: true,
      kind: 'sidecar',
      fach: parsed.sidecar.fach,
      bundleHash: parsed.sidecar.bundleHash
    };
    const commonBundle = {
      sourcePath: bundleSource.sourcePath,
      sourceGeneration: bundleSource.sourceGeneration,
      sourceIdentitySha256: bundleSource.sourceIdentitySha256,
      sourceContentSha256: bundleSource.contentSha256,
      sourceSize: bundleSource.size,
      contentSha256: bundleSource.contentSha256,
      size: bundleSource.size,
      contentType: 'audio/mpeg',
      targetPath: derived.sidecar.mp3Path,
      runtimeClientObject: true,
      kind: 'bundle',
      fach: parsed.sidecar.fach,
      bundleHash: parsed.sidecar.bundleHash,
      manifestHash: derived.manifestHash
    };
    objects.push(commonSidecar, commonBundle);
    sidecars.push({
      fach: parsed.sidecar.fach,
      sourcePath: sourceObject.sourcePath,
      targetPath: targetSidecarPath,
      sourceManifestHash: sourceObject.contentSha256,
      manifestHash: derived.manifestHash,
      bundleHash: parsed.sidecar.bundleHash,
      mp3Path: derived.sidecar.mp3Path,
      ids: parsed.sidecar.chapters.length,
      chapters: parsed.sidecar.chapterGroups.length,
      duration: parsed.sidecar.duration,
      runtimeSidecarText: derived.runtimeSidecarText
    });
  }
  objects.sort((a, b) => a.targetPath.localeCompare(b.targetPath));
  sidecars.sort((a, b) => a.targetPath.localeCompare(b.targetPath));
  const manifest = {
    schemaVersion: 2,
    releaseId: 'WIFA-GESAMT-PROD-20261007-RC1',
    version: PRODUCTION_PODCAST_VERSION_V2,
    sourceVersion: v1Manifest.sourceVersion,
    sourcePrefix: STAGING_PODCAST_PREFIX,
    targetPrefix: PRODUCTION_PODCAST_PREFIX_V2,
    storageWritesPerformed: false,
    immutableRuntimeOnly: true,
    hashContract: {
      sourceIdentitySha256: 'SHA-256(JSON([sourcePath,sourceGeneration,size,contentType]))',
      sidecarContentSha256: 'SHA-256 of derived production JSON bytes',
      bundleContentSha256: 'SHA-256 of unchanged MP3 bytes',
      bundleBinding: 'Target MP3 custom metadata manifestHash equals derived sidecar SHA-256',
      copyPrecondition: 'sourceGeneration pinned; target ifGenerationMatch=0'
    },
    expected,
    objects,
    sidecars
  };
  validateV2RuntimePromotionManifest(manifest, expected);
  return manifest;
}

function validateV2RuntimePromotionManifest(manifest, expected = { subjects: 13, ids: 521, chapters: 48 }) {
  if (manifest?.version !== PRODUCTION_PODCAST_VERSION_V2 || manifest?.targetPrefix !== PRODUCTION_PODCAST_PREFIX_V2) {
    throw new Error('v2-Produktionspräfix oder Podcastversion ist ungültig.');
  }
  const expectedObjects = Number(expected.subjects) * 2;
  if (!Array.isArray(manifest.objects) || manifest.objects.length !== expectedObjects ||
      !Array.isArray(manifest.sidecars) || manifest.sidecars.length !== Number(expected.subjects)) {
    throw new Error(`v2-Runtimemapping muss exakt ${expectedObjects} Objekte und ${expected.subjects} Sidecars enthalten.`);
  }
  const sources = new Set();
  const targets = new Set();
  let bundles = 0;
  let sidecarCount = 0;
  for (const item of manifest.objects) {
    if (sources.has(item.sourcePath) || targets.has(item.targetPath)) throw new Error('v2-Quell- oder Zielpfad ist doppelt.');
    sources.add(item.sourcePath);
    targets.add(item.targetPath);
    if (!item.sourcePath.startsWith(STAGING_PODCAST_PREFIX) || !item.targetPath.startsWith(PRODUCTION_PODCAST_PREFIX_V2) ||
        item.targetPath.includes('/WIFA-PODCAST-PROD-LZREV2-20261007-v1/')) {
      throw new Error('v2-Objekt liegt außerhalb des freigegebenen Quell-/Zielpräfixes.');
    }
    if (!/^[a-f0-9]{64}$/.test(String(item.contentSha256 || '')) ||
        !/^[a-f0-9]{64}$/.test(String(item.sourceContentSha256 || '')) ||
        !/^\d+$/.test(String(item.sourceGeneration || '')) || !Number.isSafeInteger(item.size) || item.size <= 0) {
      throw new Error(`Ungültiger v2-Objektvertrag: ${item.sourcePath}`);
    }
    if (item.kind === 'bundle') {
      bundles += 1;
      if (item.contentSha256 !== item.sourceContentSha256 || item.contentSha256 !== item.bundleHash ||
          item.contentType !== 'audio/mpeg' || !/^[a-f0-9]{64}$/.test(String(item.manifestHash || ''))) {
        throw new Error(`v2-Bundlebindung ist ungültig: ${item.sourcePath}`);
      }
    } else if (item.kind === 'sidecar') {
      sidecarCount += 1;
      if (item.contentType !== 'application/json' || item.contentSha256 === item.sourceContentSha256) {
        throw new Error(`v2-Sidecarhash ist ungültig: ${item.sourcePath}`);
      }
    } else {
      throw new Error(`Unbekannter v2-Objekttyp: ${item.kind}`);
    }
  }
  const ids = manifest.sidecars.reduce((sum, item) => sum + Number(item.ids || 0), 0);
  const chapters = manifest.sidecars.reduce((sum, item) => sum + Number(item.chapters || 0), 0);
  for (const item of manifest.sidecars) {
    if (item.runtimeSidecarText !== undefined && /staging/i.test(item.runtimeSidecarText)) {
      throw new Error(`v2-Runtime-Sidecar enthält Staging: ${item.fach}`);
    }
    if (!targets.has(item.targetPath) || !targets.has(item.mp3Path) ||
        !item.targetPath.startsWith(PRODUCTION_PODCAST_PREFIX_V2) || !item.mp3Path.startsWith(PRODUCTION_PODCAST_PREFIX_V2)) {
      throw new Error(`v2-Sidecar-/Bundlepfad fehlt: ${item.fach}`);
    }
  }
  if (bundles !== Number(expected.subjects) || sidecarCount !== Number(expected.subjects) ||
      ids !== Number(expected.ids) || chapters !== Number(expected.chapters)) {
    throw new Error(`v2-Sollzahlen weichen ab: Bundles ${bundles}, Sidecars ${sidecarCount}, IDs ${ids}, Kapitel ${chapters}.`);
  }
  return { objects: manifest.objects.length, runtimeObjects: manifest.objects.length,
    sidecars: sidecarCount, bundles, ids, chapters };
}

module.exports = {
  PRODUCTION_PODCAST_PREFIX,
  PRODUCTION_PODCAST_VERSION,
  PRODUCTION_PODCAST_PREFIX_V2,
  PRODUCTION_PODCAST_VERSION_V2,
  STAGING_PODCAST_PREFIX,
  buildPromotionManifest,
  buildV2RuntimePromotionManifest,
  deriveProductionSidecar,
  validateV2RuntimePromotionManifest,
  validatePromotionManifest
};
