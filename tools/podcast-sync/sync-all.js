const fs = require('fs');
const os = require('os');
const path = require('path');

const { sha256Lerntext, podcastPaths } = require('./hash-paths.js');
const { countTtsTokens } = require('./audit-pilot.js');
const { generateLocalAudio } = require('./local-audio.js');
const { buildPodcastManifest, writePodcastManifest } = require('./build-manifest.js');
const { publishToFirebase } = require('./firebase-publish.js');
const { withPublishLock } = require('./publish-lock.js');
const { createHash } = require('node:crypto');

const MAX_TTS_TOKENS = 2000;

function entryIdentity(entry) {
  return String(entry && entry.fach || '').trim() + ' / ' + String(entry && entry.titel || '').trim();
}

function selectOnlyLerntext(lerntexte, only) {
  if (only === null) return lerntexte;
  const selected = lerntexte.filter(entry => entryIdentity(entry) === only);
  if (selected.length === 0) throw new Error('Einheit nicht gefunden: ' + only);
  return selected;
}

function formatFailedReport(report) {
  return 'FAILED: ' + (report.identity || report) + ' | ERROR: ' + (report.error || 'unknown');
}

function validateEntries(lerntexte) {
  const reports = [];
  const collisions = [];
  const seenPaths = new Map();

  (Array.isArray(lerntexte) ? lerntexte : []).forEach(function (entry) {
    const fach = String(entry && entry.fach || '').trim();
    const titel = String(entry && entry.titel || '').trim();
    const lerntext = String(entry && entry.lerntext || '');
    const paths = podcastPaths(fach, titel);
    const report = {
      entry,
      fach,
      titel,
      identity: entryIdentity(entry),
      lerntext,
      lerntextHash: sha256Lerntext(lerntext),
      ttsTokenCount: countTtsTokens(lerntext),
      mp3Path: paths.mp3Path,
      jsonPath: paths.jsonPath,
      status: ''
    };

    [report.mp3Path, report.jsonPath].forEach(function (storagePath) {
      if (seenPaths.has(storagePath)) {
        collisions.push({ path: storagePath, units: [seenPaths.get(storagePath), report.identity] });
      } else {
        seenPaths.set(storagePath, report.identity);
      }
    });

    if (!lerntext.trim()) report.status = 'EMPTY';
    reports.push(report);
  });

  return { reports, collisions };
}

async function loadLerntexteReadOnly({ apiUrl, fetchImpl = globalThis.fetch } = {}) {
  const baseUrl = String(apiUrl || process.env.PODCAST_LERNTEXTE_API_URL || '').trim();
  if (!baseUrl) throw new Error('PODCAST_LERNTEXTE_API_URL fehlt');
  if (typeof fetchImpl !== 'function') throw new Error('fetch fehlt');

  async function fetchAction(action, fach) {
    const url = new URL(baseUrl);
    url.searchParams.set('action', action);
    if (fach !== undefined) url.searchParams.set('fach', fach);
    const response = await fetchImpl(url.toString(), { method: 'GET' });
    if (!response.ok) throw new Error(action + '-Lerntexte konnten nicht geladen werden: HTTP ' + response.status);
    const result = await response.json();
    if (!result || result.success === false || !Array.isArray(result.data)) {
      throw new Error(action + '-Antwort ist ungültig');
    }
    return result.data;
  }

  const subjects = await fetchAction('subjects');
  const podcastSubjects = Array.from(new Set([
    ...subjects,
    'Betriebliches Rechnungswesen und Controlling',
    'Investition und Finanzierung'
  ]));
  const lerntexte = [];
  for (const subject of podcastSubjects) {
    const fach = typeof subject === 'string' ? subject : subject && (subject.fach || subject.name || subject.subject);
    if (typeof fach !== 'string' || !fach.trim()) throw new Error('Fach-Antwort ist ungültig');
    const entries = await fetchAction('getLerntexte', fach);
    lerntexte.push(...entries);
  }
  return lerntexte;
}

async function readFirebaseAssetState({ bucket, report }) {
  if (!bucket || typeof bucket.file !== 'function') return { mp3Exists: false, jsonExists: false, mp3Hash: '', jsonHash: '' };
  const mp3File = bucket.file(report.mp3Path);
  const jsonFile = bucket.file(report.jsonPath);
  const [mp3Exists, jsonExists] = await Promise.all([mp3File.exists(), jsonFile.exists()]);
  let mp3Hash = '';
  let jsonHash = '';
  let mp3Generation = 0;
  let jsonGeneration = 0;
  let expectedManifestHash = '';
  let actualManifestHash = '';
  if (mp3Exists[0] && typeof mp3File.getMetadata === 'function') {
    const metadata = await mp3File.getMetadata();
    mp3Hash = String(metadata[0] && metadata[0].metadata && metadata[0].metadata.lerntextHash || '');
    mp3Generation = metadata[0].generation;
    expectedManifestHash = metadata[0].metadata?.manifestHash || '';
  }
  if (jsonExists[0] && typeof jsonFile.download === 'function') {
    const metadata = await jsonFile.getMetadata();
    jsonGeneration = metadata[0].generation;
    try {
      const downloaded = await jsonFile.download();
      actualManifestHash = createHash('sha256').update(downloaded[0]).digest('hex');
      const manifest = JSON.parse(downloaded[0].toString('utf8'));
      jsonHash = String(manifest && manifest.lerntextHash || '');
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return { mp3Exists: Boolean(mp3Exists[0]), jsonExists: Boolean(jsonExists[0]), mp3Hash, jsonHash, mp3Generation, jsonGeneration,
    manifestMatches: !expectedManifestHash || expectedManifestHash === actualManifestHash };
}

function reportStatus(report, assetState) {
  report.assetState = assetState || { mp3Exists: false, jsonExists: false, mp3Hash: '', jsonHash: '' };
  report.status = report.lerntext.trim()
    && report.assetState.mp3Exists && report.assetState.jsonExists
    && report.assetState.mp3Hash === report.lerntextHash
    && report.assetState.manifestMatches !== false
    && report.assetState.jsonHash === report.lerntextHash ? 'VALID/SKIP' : (report.status || 'SYNC_NEEDED');
  return report;
}

function summarize(reports, collisions) {
  return {
    TOTAL: reports.length,
    'VALID/SKIP': reports.filter(report => report.status === 'VALID/SKIP').length,
    SYNC_NEEDED: reports.filter(report => report.status === 'SYNC_NEEDED').length,
    EMPTY: reports.filter(report => report.status === 'EMPTY').length,
    OVER_2000_TOKENS: reports.filter(report => report.status === 'OVER_2000_TOKENS').length,
    PATH_COLLISIONS: collisions.length
  };
}

async function inspectAll({ lerntexte, bucket }) {
  const inspected = validateEntries(lerntexte);
  for (let i = 0; i < inspected.reports.length; i += 8) {
    await Promise.all(inspected.reports.slice(i, i + 8).map(async report => {
      if (report.status === 'EMPTY') return;
      reportStatus(report, await readFirebaseAssetState({ bucket, report }));
    }));
  }
  inspected.collisions.forEach(function (collision) {
    inspected.reports.filter(report => collision.units.includes(report.identity)).forEach(report => {
      report.status = 'PATH_COLLISION';
    });
  });
  return { ...inspected, summary: summarize(inspected.reports, inspected.collisions) };
}

function dryRunBlocksLiveSync(result) {
  return result.summary.EMPTY > 0 || result.summary.OVER_2000_TOKENS > 0 || result.summary.PATH_COLLISIONS > 0;
}

async function syncAll({ lerntexte, adminClient, tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-sync-')), now = new Date().toISOString(), adapters = {}, onStatus = () => {} }) {
  const bucket = adminClient && adminClient.storage().bucket();
  const inspection = await inspectAll({ lerntexte, bucket });
  if (dryRunBlocksLiveSync(inspection)) return { inspection, generated: [], failed: inspection.reports.filter(report => report.status !== 'VALID/SKIP') };

  const generated = [];
  const failed = [];
  for (const report of inspection.reports.filter(item => item.status === 'SYNC_NEEDED')) {
    const localMp3Path = path.join(tempDir, path.basename(report.mp3Path));
    const localJsonPath = path.join(tempDir, path.basename(report.jsonPath));
    try {
      reportStatus(report, await readFirebaseAssetState({ bucket, report }));
      if (report.status === 'VALID/SKIP') { onStatus({status:'SKIP', identity:report.identity}); continue; }
      onStatus({status:'GENERATING', identity:report.identity});
      const audio = await (adapters.generateLocal || generateLocalAudio)({ lerntext: report.lerntext, outputPath: localMp3Path });
      const manifest = (adapters.buildManifest || buildPodcastManifest)({ fach: report.fach, titel: report.titel, lerntext: report.lerntext, lerntextHash: report.lerntextHash, wortZeitmarken: audio.wortZeitmarken, updatedAt: now });
      (adapters.writeManifest || writePodcastManifest)({ outputPath: localJsonPath, manifest });
      const published = await withPublishLock(bucket, report.mp3Path, async () => {
        reportStatus(report, await readFirebaseAssetState({ bucket, report }));
        if (report.status === 'VALID/SKIP') return false;
        await (adapters.publish || publishToFirebase)({ mp3Path: localMp3Path, jsonPath: localJsonPath, storageMp3Path: report.mp3Path, storageJsonPath: report.jsonPath, lerntextHash: report.lerntextHash, adminClient, expectedState: report.assetState });
        reportStatus(report, await readFirebaseAssetState({ bucket, report }));
        if (report.status !== 'VALID/SKIP') throw new Error('Firebase-Verifikation nach Upload fehlgeschlagen');
        return true;
      });
      if (!published) { onStatus({status:'SKIP', identity:report.identity}); continue; }
      generated.push(report.identity);
      onStatus({status:'GENERATED', identity:report.identity, duration:audio.duration});
    } catch (error) {
      failed.push({ identity: report.identity, error: error.message });
      onStatus({status:'FAILED', identity:report.identity, error:error.message});
    } finally {
      [localMp3Path, localJsonPath].forEach(function (filePath) { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); });
    }
  }
  return { inspection, generated, failed };
}

module.exports = { MAX_TTS_TOKENS, loadLerntexteReadOnly, validateEntries, inspectAll, readFirebaseAssetState, dryRunBlocksLiveSync, syncAll, selectOnlyLerntext, formatFailedReport, runCli, createAdminClient };

async function createAdminClient() {
  const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
  const { getStorage } = require('firebase-admin/storage');
  const { requireFirebaseAdminConfig } = require('./index.js');
  const accountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const account = accountPath ? JSON.parse(fs.readFileSync(accountPath, 'utf8')) : null;
  const config = account ? {
    projectId:account.project_id, clientEmail:account.client_email, privateKey:account.private_key,
    storageBucket:process.env.FIREBASE_STORAGE_BUCKET || account.project_id + '.firebasestorage.app'
  } : requireFirebaseAdminConfig();
  const app = getApps().length ? getApp() : initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey
    }),
    storageBucket: config.storageBucket
  });
  return {
    storage() {
      return getStorage(app);
    }
  };
}

async function runCli(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const onlyIndex = argv.indexOf('--only');
  const only = onlyIndex === -1 ? null : String(argv[onlyIndex + 1] || '').trim();
  const lerntexte = await loadLerntexteReadOnly();
  const selectedLerntexte = selectOnlyLerntext(lerntexte, only);
  const adminClient = await createAdminClient();

  if (dryRun) {
    const inspection = await inspectAll({ lerntexte: selectedLerntexte, bucket: adminClient.storage().bucket() });
    Object.entries(inspection.summary).forEach(function ([key, value]) { console.log(key + ': ' + value); });
    inspection.reports.filter(report => ['EMPTY', 'OVER_2000_TOKENS', 'PATH_COLLISION'].includes(report.status))
      .forEach(report => console.log(report.status + ': ' + report.identity));
    if (dryRunBlocksLiveSync(inspection)) process.exitCode = 2;
    return inspection;
  }

  const journal = process.env.PODCAST_STATUS_LOG;
  const result = await syncAll({
    lerntexte: selectedLerntexte,
    adminClient,
    onStatus(event) {
      const line = JSON.stringify({at:new Date().toISOString(),...event});
      console.log(line);
      if (journal) fs.appendFileSync(journal, line + '\n');
    }
  });
  console.log('TOTAL: ' + result.inspection.summary.TOTAL);
  console.log('SKIPPED: ' + result.inspection.summary['VALID/SKIP']);
  console.log('GENERATED: ' + result.generated.length);
  console.log('FAILED: ' + result.failed.length);
  result.failed.forEach(report => console.log(formatFailedReport(report)));
  if (result.failed.length) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  runCli().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
  });
}
