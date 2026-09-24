const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { sha256Lerntext, podcastPaths } = require('./hash-paths.js');
const { tokenizeVisibleWords } = require('./normalize-lerntext.js');
const { withPublishLock } = require('./publish-lock.js');

const execFileAsync = promisify(execFile);
const SAMPLE_RATE = 22050;
const BYTES_PER_SAMPLE = 2;
const SIDECAR_PATH = 'podcast/continuous/recht.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function runFfmpeg(args, executable = process.env.PODCAST_FFMPEG || 'ffmpeg') {
  await execFileAsync(executable, args, { windowsHide: true, timeout: 30 * 60 * 1000, maxBuffer: 5 * 1024 * 1024 });
}

function orderedRechtEntries(lerntexte) {
  if (!Array.isArray(lerntexte) || lerntexte.length !== 57) throw new Error('Recht-Bundle benötigt exakt 57 Lerntexte');
  if (lerntexte.some(entry => !entry || entry.fach !== 'Recht')) throw new Error('Recht-Bundle darf nur Fach Recht enthalten');
  const entries = lerntexte.slice().sort((a, b) =>
    (Number(a.reihenfolgeFach) || 0) - (Number(b.reihenfolgeFach) || 0) ||
    (Number(a.reihenfolgeKapitel) || 0) - (Number(b.reihenfolgeKapitel) || 0));
  const seen = new Set();
  for (const entry of entries) {
    if (typeof entry.titel !== 'string' || !entry.titel.trim() || typeof entry.lerntext !== 'string' || !entry.lerntext.trim()) {
      throw new Error('Recht-Lerntext ohne Titel oder lerntext');
    }
    if (!String(entry.hauptkapitel || '').trim() || !String(entry.hauptkapitelNr ?? '').trim() ||
        !String(entry.unterkapitelNr ?? '').trim()) throw new Error('Recht-Lerntext ohne Kapitelidentität');
    const paths = podcastPaths('Recht', entry.titel);
    if (seen.has(paths.mp3Path)) throw new Error('Legacy-Pfadkollision: ' + paths.mp3Path);
    seen.add(paths.mp3Path);
  }
  return entries;
}

function validateMarks(manifest, entry, identity) {
  const words = tokenizeVisibleWords(entry.lerntext);
  const marks = manifest.wortZeitmarken;
  if (!words.length || !Array.isArray(marks) || marks.length !== words.length) throw new Error(identity + ': wortZeitmarken-Coverage ungültig');
  let previousStart = 0;
  let previousEnd = 0;
  marks.forEach((mark, index) => {
    if (!mark || mark.wortIndex !== index || mark.wort !== words[index] ||
        !Number.isFinite(mark.start) || !Number.isFinite(mark.end) || mark.end < mark.start ||
        mark.start < previousStart || mark.end < previousEnd) {
      throw new Error(identity + ': wortZeitmarke ' + index + ' ungültig');
    }
    previousStart = mark.start;
    previousEnd = mark.end;
  });
  return marks.map(mark => ({ wortIndex: mark.wortIndex, wort: mark.wort, start: mark.start, end: mark.end }));
}

async function readValidatedSource(bucket, entry) {
  const identity = 'Recht / ' + entry.titel;
  const paths = podcastPaths('Recht', entry.titel);
  const mp3File = bucket.file(paths.mp3Path);
  const jsonFile = bucket.file(paths.jsonPath);
  const [mp3Exists, jsonExists] = await Promise.all([mp3File.exists(), jsonFile.exists()]);
  if (!mp3Exists[0] || !jsonExists[0]) throw new Error(identity + ': Legacy-Paar fehlt');
  const [[mp3Metadata], [jsonMetadata]] = await Promise.all([mp3File.getMetadata(), jsonFile.getMetadata()]);
  if (!mp3Metadata.generation || !jsonMetadata.generation) throw new Error(identity + ': Legacy-Generation fehlt');
  const pinnedMp3File = bucket.file(paths.mp3Path, { generation: mp3Metadata.generation });
  const pinnedJsonFile = bucket.file(paths.jsonPath, { generation: jsonMetadata.generation });
  const [[mp3Bytes], [jsonBytes]] = await Promise.all([pinnedMp3File.download(), pinnedJsonFile.download()]);
  if (!Buffer.isBuffer(mp3Bytes) || mp3Bytes.length === 0 || !Buffer.isBuffer(jsonBytes) || jsonBytes.length === 0) {
    throw new Error(identity + ': Legacy-Paar leer');
  }
  const lerntextHash = sha256Lerntext(entry.lerntext);
  if (mp3Metadata.metadata?.lerntextHash !== lerntextHash) throw new Error(identity + ': MP3 lerntextHash ungültig');
  if (!/^[a-f0-9]{64}$/.test(String(mp3Metadata.metadata?.manifestHash || '')) ||
      mp3Metadata.metadata.manifestHash !== sha256(jsonBytes)) {
    throw new Error(identity + ': MP3 manifestHash ungültig');
  }
  let manifest;
  try { manifest = JSON.parse(jsonBytes.toString('utf8')); }
  catch { throw new Error(identity + ': Legacy-JSON ungültig'); }
  if (manifest.fach !== 'Recht' || manifest.titel !== entry.titel || manifest.lerntextHash !== lerntextHash) {
    throw new Error(identity + ': Legacy-Manifest-Identität oder lerntextHash ungültig');
  }
  if (manifest.mp3Path !== paths.mp3Path || manifest.jsonPath !== paths.jsonPath) {
    throw new Error(identity + ': Legacy-mp3Path/jsonPath ungültig');
  }
  const marks = validateMarks(manifest, entry, identity);
  return { entry, paths, mp3Bytes, marks, lerntextHash,
    sourceGenerations: { mp3: mp3Metadata.generation, json: jsonMetadata.generation } };
}

function decodedSampleCount(filePath, io, label) {
  const bytes = io.statSync(filePath).size;
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes % BYTES_PER_SAMPLE !== 0) {
    throw new Error(label + ': PCM-Decode ungültig');
  }
  return bytes / BYTES_PER_SAMPLE;
}

async function buildRechtBundle({ lerntexte, bucket, ffmpeg = runFfmpeg, workDir, fsAdapter = fs }) {
  const entries = orderedRechtEntries(lerntexte);
  if (!bucket || typeof bucket.file !== 'function') throw new Error('Firebase-Bucket fehlt');
  if (!workDir || !fsAdapter.existsSync(workDir)) throw new Error('Arbeitsverzeichnis fehlt');
  const sources = [];
  for (const entry of entries) sources.push(await readValidatedSource(bucket, entry));

  const pcmPath = path.join(workDir, 'recht-bundle.pcm');
  const mp3FilePath = path.join(workDir, 'bundle.mp3');
  const decodedPath = path.join(workDir, 'recht-bundle-decoded.pcm');
  fsAdapter.writeFileSync(pcmPath, Buffer.alloc(0));
  const chapters = [];
  let sampleCount = 0;
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    const sourceMp3 = path.join(workDir, `source-${index}.mp3`);
    const sourcePcm = path.join(workDir, `source-${index}.pcm`);
    fsAdapter.writeFileSync(sourceMp3, source.mp3Bytes);
    try {
      await ffmpeg(['-nostdin', '-v', 'error', '-xerror', '-y', '-i', sourceMp3,
        '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE), sourcePcm]);
      const chapterSamples = decodedSampleCount(sourcePcm, fsAdapter, source.entry.titel);
      if (source.marks.at(-1).end > chapterSamples / SAMPLE_RATE + 0.001) {
        throw new Error(source.entry.titel + ': Wortzeitmarke überschreitet Decode-Dauer');
      }
      fsAdapter.appendFileSync(pcmPath, fsAdapter.readFileSync(sourcePcm));
      const endSample = sampleCount + chapterSamples;
      if (!Number.isSafeInteger(endSample)) throw new Error('Bundle-Sampleposition überschreitet Integerbereich');
      chapters.push({
        index, titel: source.entry.titel,
        hauptkapitel: source.entry.hauptkapitel,
        hauptkapitelNr: String(source.entry.hauptkapitelNr),
        unterkapitelNr: String(source.entry.unterkapitelNr),
        lerntextHash: source.lerntextHash,
        legacyMp3Path: source.paths.mp3Path,
        legacyJsonPath: source.paths.jsonPath,
        startSample: sampleCount, endSample,
        start: sampleCount / SAMPLE_RATE, end: endSample / SAMPLE_RATE,
        wortZeitmarken: source.marks
      });
      sampleCount = endSample;
    } finally {
      if (fsAdapter.existsSync(sourceMp3)) fsAdapter.unlinkSync(sourceMp3);
      if (fsAdapter.existsSync(sourcePcm)) fsAdapter.unlinkSync(sourcePcm);
    }
  }
  if (decodedSampleCount(pcmPath, fsAdapter, 'Bundle') !== sampleCount) throw new Error('Bundle-PCM-Samples stimmen nicht');
  await ffmpeg(['-nostdin', '-v', 'error', '-y', '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-i', pcmPath,
    '-codec:a', 'libmp3lame', '-b:a', '96k', mp3FilePath]);
  const mp3Bytes = fsAdapter.readFileSync(mp3FilePath);
  if (!mp3Bytes.length) throw new Error('Bundle-MP3 leer');
  await ffmpeg(['-nostdin', '-v', 'error', '-xerror', '-y', '-i', mp3FilePath,
    '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE), decodedPath]);
  const decodedSamples = decodedSampleCount(decodedPath, fsAdapter, 'Bundle-MP3');
  if (Math.abs(decodedSamples - sampleCount) > SAMPLE_RATE / 10) throw new Error('Bundle-MP3 Decode-Dauer weicht ab');
  const bundleHash = sha256(mp3Bytes);
  const sidecar = {
    schemaVersion: 1, fach: 'Recht', bundleHash,
    mp3Path: `podcast/continuous/recht/${bundleHash}.mp3`,
    duration: sampleCount / SAMPLE_RATE, sampleCount,
    encoding: { container: 'mp3', codec: 'mp3', bitrateKbps: 96, sampleRateHz: SAMPLE_RATE, channels: 1, pcmFormat: 's16le' },
    chapters
  };
  return { sidecar, sidecarBytes: Buffer.from(JSON.stringify(sidecar)), mp3FilePath, fsAdapter };
}

async function publishRechtBundle({ bundle, bucket, withLock = withPublishLock }) {
  if (!bundle || bundle.sidecar?.fach !== 'Recht' || bundle.sidecar?.chapters?.length !== 57 ||
      !/^podcast\/continuous\/recht\/[a-f0-9]{64}\.mp3$/.test(bundle.sidecar.mp3Path)) {
    throw new Error('Recht-Bundle ungültig');
  }
  const mp3Bytes = (bundle.fsAdapter || fs).readFileSync(bundle.mp3FilePath);
  if (sha256(mp3Bytes) !== bundle.sidecar.bundleHash || sha256(Buffer.from(JSON.stringify(bundle.sidecar))) !== sha256(bundle.sidecarBytes)) {
    throw new Error('Bundle-Hash oder Sidecar-Bytes ungültig');
  }
  return withLock(bucket, SIDECAR_PATH, async () => {
    const mp3File = bucket.file(bundle.sidecar.mp3Path);
    const sidecarFile = bucket.file(SIDECAR_PATH);
    const [mp3Exists, sidecarExists] = await Promise.all([mp3File.exists(), sidecarFile.exists()]);
    if (mp3Exists[0]) {
      const [[existingBytes], [existingMetadata]] = await Promise.all([mp3File.download(), mp3File.getMetadata()]);
      if (sha256(existingBytes) !== bundle.sidecar.bundleHash ||
          existingMetadata.metadata?.manifestHash !== sha256(bundle.sidecarBytes)) {
        throw new Error('Vorhandenes unveränderliches Bundle-MP3 widerspricht Hashbindung');
      }
    } else {
      await mp3File.save(mp3Bytes, {
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          contentType: 'audio/mpeg',
          cacheControl: 'public,max-age=31536000,immutable',
          metadata: {
            bundleHash: bundle.sidecar.bundleHash,
            manifestHash: sha256(bundle.sidecarBytes),
            firebaseStorageDownloadTokens: randomUUID()
          }
        }
      });
    }
    const [[publishedMp3], [publishedMetadata]] = await Promise.all([mp3File.download(), mp3File.getMetadata()]);
    if (sha256(publishedMp3) !== bundle.sidecar.bundleHash ||
        publishedMetadata.metadata?.bundleHash !== bundle.sidecar.bundleHash ||
        publishedMetadata.metadata?.manifestHash !== sha256(bundle.sidecarBytes)) {
      throw new Error('Veröffentlichtes MP3 hat falschen Hash oder Metadaten');
    }
    const downloadTokens = String(publishedMetadata.metadata?.firebaseStorageDownloadTokens || '')
      .split(',').map(token => token.trim()).filter(Boolean);
    if (!downloadTokens.length) throw new Error('Veröffentlichtes MP3 hat keinen Firebase-Download-Token');
    const sidecarGeneration = sidecarExists[0] ? (await sidecarFile.getMetadata())[0].generation : 0;
    await sidecarFile.save(bundle.sidecarBytes, {
      preconditionOpts: { ifGenerationMatch: sidecarGeneration },
      metadata: {
        contentType: 'application/json',
        cacheControl: 'no-cache,max-age=0',
        metadata: { firebaseStorageDownloadTokens: randomUUID() }
      }
    });
    return { mp3Path: bundle.sidecar.mp3Path, sidecarPath: SIDECAR_PATH, bundleHash: bundle.sidecar.bundleHash };
  });
}

async function buildAndPublishRechtBundle(options) {
  const bundle = await buildRechtBundle(options);
  const published = await publishRechtBundle({ bundle, bucket: options.bucket, withLock: options.withLock });
  return { bundle, published };
}

module.exports = { buildRechtBundle, publishRechtBundle, buildAndPublishRechtBundle, runFfmpeg, SIDECAR_PATH };
