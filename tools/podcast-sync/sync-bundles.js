const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { continuousPodcastPaths } = require('./hash-paths');
const { buildSubjectBundle, publishSubjectBundle, validateCatalog } = require('./continuous-bundle');

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

async function syncBundles({ bucket, loadCatalog = loadBundleCatalog,
  onlySubject = null, dryRun = false, workDir, ffmpeg, withLock,
  buildBundle = buildSubjectBundle, publishBundle = publishSubjectBundle } = {}) {
  // Never pass a subject filter to the API loader: validation precedes selection.
  const catalog = await loadCatalog();
  const subjects = validateCatalog(catalog);
  if (onlySubject !== null && !subjects.includes(onlySubject)) throw new Error('Fach nicht im vollständigen Katalog: ' + onlySubject);
  const root = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-bundles-'));
  const report = { schemaVersion: 1, dryRun, catalogSubjects: subjects.length, catalogChapters: catalog.length, subjects: [], failed: 0 };
  try {
    for (const fach of subjects.filter(value => onlySubject === null || value === onlySubject)) {
      const subjectDir = fs.mkdtempSync(path.join(root, continuousPodcastPaths(fach).slug + '-'));
      try {
        const bundle = await buildBundle({ fach, catalog, bucket, workDir: subjectDir, ffmpeg });
        const result = { fach, status: dryRun ? 'DRY_RUN' : 'PUBLISHED', chapters: bundle.sidecar.chapters.length,
          words: bundle.sidecar.chapters.reduce((sum, chapter) => sum + chapter.wortZeitmarken.length, 0),
          bytes: bundle.byteSize, duration: bundle.sidecar.duration, sampleCount: bundle.sidecar.sampleCount,
          decodedSamples: bundle.decodedSamples, bundleHash: bundle.sidecar.bundleHash,
          manifestHash: createHash('sha256').update(bundle.sidecarBytes).digest('hex'),
          mp3Path: bundle.sidecar.mp3Path, sidecarPath: continuousPodcastPaths(fach).sidecarPath,
          historicalSources: bundle.sources.filter(source => source.contract === 'historical').length };
        if (!dryRun) await publishBundle({ bundle, bucket, loadCatalog, withLock });
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
  let onlySubject = null, dryRun = false;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--dry-run' && !dryRun) dryRun = true;
    else if (argv[index] === '--only-subject' && onlySubject === null && argv[index + 1] && !argv[index + 1].startsWith('--')) onlySubject = argv[++index];
    else throw new Error('Ungültiges Argument: ' + argv[index]);
  }
  const admin = await (adapters.createAdminClient || (() => require('./sync-all').createAdminClient()))();
  const result = await (adapters.sync || syncBundles)({ bucket: admin.storage().bucket(), onlySubject, dryRun });
  (adapters.write || console.log)(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
  return result;
}

if (require.main === module) runCli().catch(error => {
  console.log(JSON.stringify({ schemaVersion: 1, failed: 1, error: error.message }));
  process.exitCode = 1;
});

module.exports = { syncBundles, runCli, validateCatalog, loadBundleCatalog };
