const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { continuousPodcastPaths, podcastPaths, sha256Lerntext, assertStagingWriteTargets } = require('./hash-paths');
const { buildSubjectBundle, publishSubjectBundle, validateCatalog, orderedSubjectEntries, runFfmpeg } = require('./continuous-bundle');
const { validateContinuousBundle } = require('../../js/podcast-continuous');
const { tokenizeVisibleWords } = require('./normalize-lerntext');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function loadBundleCatalog({ apiUrl, fetchImpl = globalThis.fetch } = {}) {
  // Reuse API discovery (including its supplementary podcast subjects), but reject
  // empty/misrouted per-subject responses instead of silently omitting a subject.
  return require('./sync-all').loadLerntexteReadOnly({ apiUrl, fetchImpl: async (url, options) => {
    const response = await fetchImpl(url, options);
    return { ok: response.ok, status: response.status, async json() {
      const result = await response.json();
      const params = new URL(url).searchParams;
      if (params.get('action') === 'getLerntexte' && (!Array.isArray(result?.data) || !result.data.length ||
          result.data.some(entry => entry?.fach !== params.get('fach')))) throw new Error('API-Fachliste leer oder enthält fremdes Fach: ' + params.get('fach'));
      return result;
    } };
  } });
}

async function readBundleObject(bucket, storagePath, contentType) {
  const [metadata] = await bucket.file(storagePath).getMetadata();
  if (!/^[1-9]\d*$/.test(String(metadata.generation))) throw new Error(storagePath + ': Generation fehlt');
  const [bytes] = await bucket.file(storagePath, { generation: metadata.generation }).download();
  if (!Buffer.isBuffer(bytes) || !bytes.length || !/^\d+$/.test(String(metadata.size)) || Number(metadata.size) !== bytes.length) {
    throw new Error(storagePath + ': Byteanzahl ungültig');
  }
  if (metadata.contentType !== contentType) throw new Error(storagePath + ': Content-Type ungültig');
  if (!String(metadata.metadata?.firebaseStorageDownloadTokens || '').split(',').some(token => token.trim())) {
    throw new Error(storagePath + ': Download-Token fehlt');
  }
  return { bytes, metadata };
}

async function verifySubjectBundle({ fach, catalog, bucket, workDir, ffmpeg = runFfmpeg, targetPrefix }) {
  validateCatalog(catalog);
  const entries = orderedSubjectEntries(catalog, fach);
  const paths = continuousPodcastPaths(fach, targetPrefix ? { prefix: targetPrefix } : undefined);
  if (targetPrefix) assertStagingWriteTargets([paths.sidecarPath], { targetPrefix, sourcePaths: [] });
  const sidecarObject = await readBundleObject(bucket, paths.sidecarPath, 'application/json');
  let sidecar;
  try { sidecar = JSON.parse(sidecarObject.bytes.toString('utf8')); }
  catch { throw new Error(fach + ': Sidecar-JSON ungültig'); }
  // Validate the immutable path before following any path from remote JSON.
  if (!sidecar || !/^[a-f0-9]{64}$/.test(sidecar.bundleHash) || sidecar.mp3Path !== paths.mp3Prefix + sidecar.bundleHash + '.mp3') {
    throw new Error(fach + ': Bundle-Pfad ungültig');
  }
  const mp3Object = await readBundleObject(bucket, sidecar.mp3Path, 'audio/mpeg');
  if (sha256(mp3Object.bytes) !== sidecar.bundleHash) throw new Error(fach + ': MP3 bundleHash ungültig');
  const currentEntries = entries.map((entry, index) => ({ index, fach,
    ...(entry.id ? { lerntextId: String(entry.id) } : {}),
    titel: entry.titel,
    hauptkapitel: entry.hauptkapitel, hauptkapitelNr: String(entry.hauptkapitelNr), unterkapitelNr: String(entry.unterkapitelNr),
    lerntextHash: sha256Lerntext(entry.lerntext), legacyMp3Path: podcastPaths(fach, entry.titel).mp3Path,
    legacyJsonPath: podcastPaths(fach, entry.titel).jsonPath }));
  const validation = validateContinuousBundle({ manifest: sidecar, manifestHash: sha256(sidecarObject.bytes),
    mp3Metadata: { customMetadata: mp3Object.metadata.metadata }, currentEntries,
    expectedFach: fach, expectedMp3Prefix: paths.mp3Prefix, expectedStoragePrefix: targetPrefix });
  if (!validation.valid) throw new Error(fach + ': Bundle ungültig: ' + validation.reason);
  for (let index = 0; index < entries.length; index++) {
    const words = tokenizeVisibleWords(entries[index].lerntext), marks = sidecar.chapters[index].wortZeitmarken;
    if (marks.length !== words.length || marks.some((mark, wordIndex) => mark.wort !== words[wordIndex])) {
      throw new Error(fach + ': Wortzeitmarken-Coverage ungültig');
    }
  }
  const ownedDir = fs.mkdtempSync(path.join(workDir, paths.slug + '-verify-'));
  const mp3Path = path.join(ownedDir, 'bundle.mp3'), decodedPath = path.join(ownedDir, 'decoded.pcm');
  try {
    fs.writeFileSync(mp3Path, mp3Object.bytes);
    await ffmpeg(['-nostdin', '-v', 'error', '-xerror', '-y', '-i', mp3Path, '-f', 's16le', '-ac', '1', '-ar', '22050', decodedPath]);
    const decodedBytes = fs.statSync(decodedPath).size;
    if (!Number.isSafeInteger(decodedBytes) || decodedBytes <= 0 || decodedBytes % 2 || decodedBytes / 2 !== sidecar.sampleCount) {
      throw new Error(fach + ': Bundle-MP3 Decode-Samples stimmen nicht');
    }
    // A successful decode must not hide an object replacement during verification.
    for (const [storagePath, original] of [[paths.sidecarPath, sidecarObject.metadata], [sidecar.mp3Path, mp3Object.metadata]]) {
      const [latest] = await bucket.file(storagePath).getMetadata();
      if (latest.generation !== original.generation || latest.metageneration !== original.metageneration ||
          JSON.stringify(latest.metadata) !== JSON.stringify(original.metadata) || latest.contentType !== original.contentType) {
        throw new Error(storagePath + ': Generation oder Metadaten während Verifikation geändert');
      }
    }
    return { sidecar, sidecarBytes: sidecarObject.bytes, byteSize: mp3Object.bytes.length, decodedSamples: decodedBytes / 2 };
  } finally {
    for (const file of [mp3Path, decodedPath]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(ownedDir);
  }
}

async function syncBundles({ bucket, loadCatalog = loadBundleCatalog,
  onlySubject = null, dryRun = false, verifyOnly = false, workDir, ffmpeg, probeAudio, withLock,
  buildBundle = buildSubjectBundle, publishBundle = publishSubjectBundle, targetPrefix } = {}) {
  if (dryRun && verifyOnly) throw new Error('--dry-run und --verify-only dürfen nicht kombiniert werden');
  if (targetPrefix) {
    const preflight = continuousPodcastPaths('preflight', { prefix: targetPrefix });
    assertStagingWriteTargets([preflight.sidecarPath], { targetPrefix, sourcePaths: [] });
  }
  // Never pass a subject filter to the API loader: validation precedes selection.
  const catalog = await loadCatalog();
  const subjects = validateCatalog(catalog);
  if (onlySubject !== null && !subjects.includes(onlySubject)) throw new Error('Fach nicht im vollständigen Katalog: ' + onlySubject);
  const root = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-bundles-'));
  const report = { schemaVersion: 1, dryRun, verifyOnly, catalogSubjects: subjects.length, catalogChapters: catalog.length, subjects: [], failed: 0 };
  try {
    for (const fach of subjects.filter(value => onlySubject === null || value === onlySubject)) {
      const subjectDir = fs.mkdtempSync(path.join(root, continuousPodcastPaths(fach).slug + '-'));
      try {
        const bundle = await (verifyOnly ? verifySubjectBundle : buildBundle)({ fach, catalog, bucket,
          workDir: subjectDir, ffmpeg, probeAudio, targetPrefix });
        const targetPaths = continuousPodcastPaths(fach, targetPrefix ? { prefix: targetPrefix } : undefined);
        const result = { fach, status: verifyOnly ? 'VERIFIED' : dryRun ? 'DRY_RUN' : 'PUBLISHED', chapters: bundle.sidecar.chapters.length,
          words: bundle.sidecar.chapters.reduce((sum, chapter) => sum + chapter.wortZeitmarken.length, 0),
          bytes: bundle.byteSize, duration: bundle.sidecar.duration, sampleCount: bundle.sidecar.sampleCount,
          decodedSamples: bundle.decodedSamples, decodeStatus: 'VERIFIED', bundleHash: bundle.sidecar.bundleHash,
          manifestHash: createHash('sha256').update(bundle.sidecarBytes).digest('hex'),
          mp3Path: bundle.sidecar.mp3Path, sidecarPath: targetPaths.sidecarPath,
          historicalSources: bundle.sources?.filter(source => source.contract === 'historical').length };
        if (!dryRun && !verifyOnly) await publishBundle({ bundle, bucket, loadCatalog, withLock, targetPrefix });
        report.subjects.push(result);
      } catch (error) {
        report.failed++;
        report.subjects.push({ fach, status: 'FAILED', error: error.message });
      } finally {
        // subjectDir is an absolute mkdtemp child of this run, never a supplied directory.
        fs.rmSync(subjectDir, { recursive: true, force: true });
      }
    }
  } finally { if (!workDir) fs.rmdirSync(root); }
  return report;
}

async function runCli(argv = process.argv.slice(2), adapters = {}) {
  let onlySubject = null, dryRun = false, verifyOnly = false, targetPrefix;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--dry-run' && !dryRun) dryRun = true;
    else if (argv[index] === '--verify-only' && !verifyOnly) verifyOnly = true;
    else if (argv[index] === '--only-subject' && onlySubject === null && argv[index + 1] && !argv[index + 1].startsWith('--')) onlySubject = argv[++index];
    else if (argv[index] === '--target-prefix' && targetPrefix === undefined && argv[index + 1] && !argv[index + 1].startsWith('--')) targetPrefix = argv[++index];
    else throw new Error('Ungültiges Argument: ' + argv[index]);
  }
  if (dryRun && verifyOnly) throw new Error('--dry-run und --verify-only dürfen nicht kombiniert werden');
  if (targetPrefix) {
    const preflight = continuousPodcastPaths('preflight', { prefix: targetPrefix });
    assertStagingWriteTargets([preflight.sidecarPath], { targetPrefix, sourcePaths: [] });
  }
  const admin = await (adapters.createAdminClient || (() => require('./sync-all').createAdminClient()))();
  const result = await (adapters.sync || syncBundles)({ bucket: admin.storage().bucket(), onlySubject, dryRun, verifyOnly, targetPrefix });
  (adapters.write || console.log)(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
  return result;
}

if (require.main === module) runCli().catch(error => {
  console.log(JSON.stringify({ schemaVersion: 1, failed: 1, error: error.message }));
  process.exitCode = 1;
});

module.exports = { syncBundles, runCli, validateCatalog, loadBundleCatalog, verifySubjectBundle };
