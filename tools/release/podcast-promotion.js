'use strict';

const crypto = require('node:crypto');

const STAGING_PODCAST_PREFIX = 'podcast/staging/lerntext-rev2/';
const PRODUCTION_PODCAST_VERSION = 'WIFA-PODCAST-PROD-LZREV2-20261007-v1';
const PRODUCTION_PODCAST_PREFIX = `podcast/production/lerntext-rev2/${PRODUCTION_PODCAST_VERSION}/`;

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

module.exports = {
  PRODUCTION_PODCAST_PREFIX,
  PRODUCTION_PODCAST_VERSION,
  STAGING_PODCAST_PREFIX,
  buildPromotionManifest,
  validatePromotionManifest
};
