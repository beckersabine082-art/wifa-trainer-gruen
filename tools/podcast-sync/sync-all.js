const fs = require('fs');
const os = require('os');
const path = require('path');

const { sha256Lerntext, podcastPaths } = require('./hash-paths.js');
const { countTtsTokens } = require('./audit-pilot.js');
const { normalizeLerntextForTts } = require('./normalize-lerntext.js');
const { generateTtsMp3 } = require('./tts-generate.js');
const { transcribeWordTimestamps } = require('./transcribe-words.js');
const { alignTranscriptWordsToLerntext } = require('./align-words.js');
const { buildPodcastManifest, writePodcastManifest } = require('./build-manifest.js');
const { publishToFirebase } = require('./firebase-publish.js');

const MAX_TTS_TOKENS = 2000;

function entryIdentity(entry) {
  return String(entry && entry.fach || '').trim() + ' / ' + String(entry && entry.titel || '').trim();
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
    else if (report.ttsTokenCount > MAX_TTS_TOKENS) report.status = 'OVER_2000_TOKENS';
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
  const lerntexte = [];
  for (const subject of subjects) {
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
  if (mp3Exists[0] && typeof mp3File.getMetadata === 'function') {
    const metadata = await mp3File.getMetadata();
    mp3Hash = String(metadata[0] && metadata[0].metadata && metadata[0].metadata.lerntextHash || '');
  }
  if (jsonExists[0] && typeof jsonFile.download === 'function') {
    try {
      const downloaded = await jsonFile.download();
      const manifest = JSON.parse(downloaded[0].toString('utf8'));
      jsonHash = String(manifest && manifest.lerntextHash || '');
    } catch (error) {
      jsonHash = '';
    }
  }
  return { mp3Exists: Boolean(mp3Exists[0]), jsonExists: Boolean(jsonExists[0]), mp3Hash, jsonHash };
}

function reportStatus(report, assetState) {
  report.assetState = assetState || { mp3Exists: false, jsonExists: false, mp3Hash: '', jsonHash: '' };
  report.status = report.lerntext.trim() && report.ttsTokenCount <= MAX_TTS_TOKENS
    && report.assetState.mp3Exists && report.assetState.jsonExists
    && report.assetState.mp3Hash === report.lerntextHash
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
  for (const report of inspected.reports) {
    if (report.status === 'EMPTY' || report.status === 'OVER_2000_TOKENS') continue;
    reportStatus(report, await readFirebaseAssetState({ bucket, report }));
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

async function syncAll({ lerntexte, adminClient, openaiClient, tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-sync-')), now = new Date().toISOString(), adapters = {} }) {
  const bucket = adminClient && adminClient.storage().bucket();
  const inspection = await inspectAll({ lerntexte, bucket });
  if (dryRunBlocksLiveSync(inspection)) return { inspection, generated: [], failed: inspection.reports.filter(report => report.status !== 'VALID/SKIP') };

  const generated = [];
  const failed = [];
  for (const report of inspection.reports.filter(item => item.status === 'SYNC_NEEDED')) {
    const localMp3Path = path.join(tempDir, path.basename(report.mp3Path));
    const localJsonPath = path.join(tempDir, path.basename(report.jsonPath));
    try {
      const normalized = normalizeLerntextForTts(report.lerntext);
      await (adapters.generateTts || generateTtsMp3)({ text: normalized.text, outputPath: localMp3Path, openaiClient, countTtsTokens });
      const transcript = await (adapters.transcribe || transcribeWordTimestamps)({ mp3Path: localMp3Path, openaiClient });
      const aligned = await (adapters.align || alignTranscriptWordsToLerntext)(report.lerntext, transcript.words);
      const manifest = (adapters.buildManifest || buildPodcastManifest)({ fach: report.fach, titel: report.titel, lerntext: report.lerntext, lerntextHash: report.lerntextHash, wortZeitmarken: aligned.wortZeitmarken, updatedAt: now });
      (adapters.writeManifest || writePodcastManifest)({ outputPath: localJsonPath, manifest });
      await (adapters.publish || publishToFirebase)({ mp3Path: localMp3Path, jsonPath: localJsonPath, storageMp3Path: report.mp3Path, storageJsonPath: report.jsonPath, lerntextHash: report.lerntextHash, adminClient });
      generated.push(report.identity);
    } catch (error) {
      failed.push({ identity: report.identity, error: error.message });
    } finally {
      [localMp3Path, localJsonPath].forEach(function (filePath) { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); });
    }
  }
  return { inspection, generated, failed };
}

module.exports = { MAX_TTS_TOKENS, loadLerntexteReadOnly, validateEntries, inspectAll, dryRunBlocksLiveSync, syncAll };

async function createAdminClient() {
  const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
  const { getStorage } = require('firebase-admin/storage');
  const { requireFirebaseAdminConfig } = require('./index.js');
  const config = requireFirebaseAdminConfig();
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
  const lerntexte = await loadLerntexteReadOnly();
  const adminClient = await createAdminClient();

  if (dryRun) {
    const inspection = await inspectAll({ lerntexte, bucket: adminClient.storage().bucket() });
    Object.entries(inspection.summary).forEach(function ([key, value]) { console.log(key + ': ' + value); });
    inspection.reports.filter(report => ['EMPTY', 'OVER_2000_TOKENS', 'PATH_COLLISION'].includes(report.status))
      .forEach(report => console.log(report.status + ': ' + report.identity));
    if (dryRunBlocksLiveSync(inspection)) process.exitCode = 2;
    return inspection;
  }

  const OpenAI = require('openai');
  const { requireOpenAiKey } = require('./index.js');
  const result = await syncAll({
    lerntexte,
    adminClient,
    openaiClient: new OpenAI({ apiKey: requireOpenAiKey() })
  });
  console.log('TOTAL: ' + result.inspection.summary.TOTAL);
  console.log('SKIPPED: ' + result.inspection.summary['VALID/SKIP']);
  console.log('GENERATED: ' + result.generated.length);
  console.log('FAILED: ' + result.failed.length);
  result.failed.forEach(report => console.log('FAILED: ' + (report.identity || report)));
  if (result.failed.length) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  runCli().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
  });
}