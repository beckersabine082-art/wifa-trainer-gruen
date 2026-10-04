const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const {
  sha256Lerntext,
  podcastPaths,
  continuousPodcastPaths,
  assertStagingWriteTargets
} = require('./hash-paths');
const { tokenizeVisibleWords } = require('./normalize-lerntext');
const { withPublishLock } = require('./publish-lock');
const { validateContinuousBundle } = require('../../js/podcast-continuous');

const execFileAsync = promisify(execFile);
const SAMPLE_RATE = 22050;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function runFfmpeg(args, executable = process.env.PODCAST_FFMPEG || 'ffmpeg') {
  await execFileAsync(executable, args, { windowsHide: true, timeout: 30 * 60 * 1000, maxBuffer: 5 * 1024 * 1024 });
}

async function probeAudioProperties(filePath, executable = process.env.PODCAST_FFMPEG || 'ffmpeg') {
  const { stderr = '' } = await execFileAsync(executable, ['-hide_banner', '-nostdin', '-i', filePath,
    '-map', '0:a:0', '-c', 'copy', '-f', 'null', '-'], {
    windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 5 * 1024 * 1024
  });
  const audioLine = String(stderr).split(/\r?\n/).find(line => /Audio:/.test(line)) || '';
  const audio = audioLine.match(/Audio:\s*([^,]+),\s*(\d+)\s*Hz,\s*([^,]+)(?:,.*?\s(\d+)\s*kb\/s)?/i);
  if (!audio) throw new Error('Audioeigenschaften konnten nicht ermittelt werden');
  const channelText = audio[3].trim().toLowerCase();
  const channels = channelText === 'mono' ? 1 : channelText === 'stereo' ? 2 : Number((channelText.match(/(\d+)\s*channels?/) || [])[1]);
  if (!Number.isInteger(channels) || channels <= 0) throw new Error('Audiokanalzahl konnte nicht ermittelt werden');
  const encoder = (String(stderr).match(/encoder\s*:\s*([^\r\n]+)/i) || [])[1];
  const start = (String(stderr).match(/Duration:.*?start:\s*(-?\d+(?:\.\d+)?)/i) || [])[1];
  return {
    codec: audio[1].trim().split(/\s+/)[0],
    sampleRateHz: Number(audio[2]),
    channels,
    bitrateKbps: audio[4] ? Number(audio[4]) : null,
    profile: audio[1].trim(),
    encoder: encoder ? encoder.trim() : null,
    startTimeSeconds: start === undefined ? null : Number(start)
  };
}

// Stable sorting matches the production playlist, including API order for ties.
function orderedSubjectEntries(catalog, fach) {
  continuousPodcastPaths(fach);
  if (!Array.isArray(catalog)) throw new Error('Vollständiger Katalog fehlt');
  const entries = catalog.filter(entry => entry?.fach === fach).map(entry => ({ ...entry })).sort((a, b) =>
    (Number(a.reihenfolgeFach) || 0) - (Number(b.reihenfolgeFach) || 0) ||
    (Number(a.reihenfolgeKapitel) || 0) - (Number(b.reihenfolgeKapitel) || 0));
  if (!entries.length) throw new Error(fach + ': Fachliste leer');
  const seen = new Set();
  for (const entry of entries) {
    if (typeof entry.titel !== 'string' || !entry.titel.trim() || typeof entry.lerntext !== 'string' || !entry.lerntext.trim() ||
        typeof entry.hauptkapitel !== 'string' || !entry.hauptkapitel.trim() ||
        !String(entry.hauptkapitelNr ?? '').trim() || !String(entry.unterkapitelNr ?? '').trim()) {
      throw new Error(fach + ': Lerntext ohne Titel, lerntext oder Kapitelidentität');
    }
    const key = podcastPaths(fach, entry.titel).mp3Path;
    if (seen.has(key)) throw new Error('Legacy-Pfad-/Identitätskollision: ' + key);
    seen.add(key);
  }
  return entries;
}

function validateCatalog(catalog) {
  if (!Array.isArray(catalog) || !catalog.length) throw new Error('Vollständiger Katalog leer');
  const subjects = new Map(), legacyPaths = new Set(), sidecars = new Map();
  for (const entry of catalog) {
    const paths = continuousPodcastPaths(entry?.fach);
    if (sidecars.has(paths.sidecarPath) && sidecars.get(paths.sidecarPath) !== entry.fach) throw new Error('Fach-Pfadkollision');
    sidecars.set(paths.sidecarPath, entry.fach);
    const legacy = podcastPaths(entry.fach, entry.titel).mp3Path;
    if (legacyPaths.has(legacy)) throw new Error('Legacy-Pfad-/Identitätskollision: ' + legacy);
    legacyPaths.add(legacy);
    if (!subjects.has(entry.fach)) subjects.set(entry.fach, Number(entry.reihenfolgeFach) || 0);
    else subjects.set(entry.fach, Math.min(subjects.get(entry.fach), Number(entry.reihenfolgeFach) || 0));
  }
  for (const fach of subjects.keys()) orderedSubjectEntries(catalog, fach);
  return [...subjects.keys()].sort((a, b) => subjects.get(a) - subjects.get(b) || (a < b ? -1 : a > b ? 1 : 0));
}

function currentEntries(entries) {
  return entries.map((entry, index) => ({ index, fach: entry.fach,
    ...(entry.id ? { lerntextId: String(entry.id) } : {}),
    ...(entry.chapterKey ? { chapterKey: String(entry.chapterKey) } : {}),
    titel: entry.titel,
    hauptkapitel: entry.hauptkapitel, hauptkapitelNr: String(entry.hauptkapitelNr), unterkapitelNr: String(entry.unterkapitelNr),
    lerntextHash: sha256Lerntext(entry.lerntext), legacyMp3Path: podcastPaths(entry.fach, entry.titel).mp3Path,
    legacyJsonPath: podcastPaths(entry.fach, entry.titel).jsonPath }));
}

function requireSameEntries(expected, actual) {
  if (JSON.stringify(currentEntries(expected)) !== JSON.stringify(currentEntries(actual))) {
    throw new Error('Aktuelle vollständige Fachliste / Katalog stimmt nicht überein');
  }
}

function validateMarks(manifest, entry) {
  const words = tokenizeVisibleWords(entry.lerntext);
  if (!words.length || !Array.isArray(manifest.wortZeitmarken) || manifest.wortZeitmarken.length !== words.length) {
    throw new Error(entry.titel + ': wortZeitmarken-Coverage ungültig');
  }
  let previousStart = 0, previousEnd = 0;
  return manifest.wortZeitmarken.map((mark, index) => {
    if (!mark || mark.wortIndex !== index || mark.wort !== words[index] ||
        !Number.isFinite(mark.start) || !Number.isFinite(mark.end) || mark.end < mark.start ||
        mark.start < previousStart || mark.end < previousEnd) throw new Error(entry.titel + ': wortZeitmarke ungültig');
    previousStart = mark.start; previousEnd = mark.end;
    return { wortIndex: index, wort: mark.wort, start: mark.start, end: mark.end };
  });
}

function validateObjectBytes(metadata, bytes, label) {
  if (!metadata.generation || !/^\d+$/.test(String(metadata.generation))) throw new Error(label + ': Generation fehlt');
  if (!Buffer.isBuffer(bytes) || !bytes.length || !/^\d+$/.test(String(metadata.size)) || Number(metadata.size) !== bytes.length) {
    throw new Error(label + ': Byteanzahl ungültig');
  }
}

async function readValidatedSource(bucket, entry, { paths = podcastPaths(entry.fach, entry.titel), origin = 'reused' } = {}) {
  const [mp3Metadata] = await bucket.file(paths.mp3Path).getMetadata();
  const [jsonMetadata] = await bucket.file(paths.jsonPath).getMetadata();
  if (!mp3Metadata.generation || !jsonMetadata.generation) throw new Error(entry.titel + ': Legacy-Generation fehlt');
  const [mp3Bytes] = await bucket.file(paths.mp3Path, { generation: mp3Metadata.generation }).download();
  const [jsonBytes] = await bucket.file(paths.jsonPath, { generation: jsonMetadata.generation }).download();
  validateObjectBytes(mp3Metadata, mp3Bytes, paths.mp3Path);
  validateObjectBytes(jsonMetadata, jsonBytes, paths.jsonPath);
  const lerntextHash = sha256Lerntext(entry.lerntext);
  if (mp3Metadata.metadata?.lerntextHash !== lerntextHash) throw new Error(entry.titel + ': MP3 lerntextHash ungültig');
  const jsonHash = sha256(jsonBytes), mp3Hash = sha256(mp3Bytes);
  // Only an ABSENT field on a canonical legacy object qualifies. Empty, null,
  // malformed and wrong hashes must never select the historical branch.
  const bound = Object.hasOwn(mp3Metadata.metadata || {}, 'manifestHash');
  if (bound && mp3Metadata.metadata.manifestHash !== jsonHash) throw new Error(entry.titel + ': MP3 manifestHash ungültig');
  let manifest;
  try { manifest = JSON.parse(jsonBytes.toString('utf8')); } catch { throw new Error(entry.titel + ': Legacy-JSON ungültig'); }
  if (!manifest || manifest.fach !== entry.fach || manifest.titel !== entry.titel || manifest.lerntextHash !== lerntextHash) {
    throw new Error(entry.titel + ': Legacy-Identität oder lerntextHash ungültig');
  }
  if (manifest.mp3Path !== paths.mp3Path || manifest.jsonPath !== paths.jsonPath) throw new Error(entry.titel + ': Legacy-mp3Path/jsonPath ungültig');
  const marks = validateMarks(manifest, entry);
  return { mp3Bytes, marks, receipt: { paths, lerntextHash, mp3Hash, jsonHash, origin,
    sourceIdentity: { fach: entry.fach, titel: entry.titel },
    contract: bound ? 'manifestHash' : 'historical', generations: { mp3: mp3Metadata.generation, json: jsonMetadata.generation } } };
}

function sampleCount(filePath, io) {
  const bytes = io.statSync(filePath).size;
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes % 2) throw new Error('PCM-Decode Samples ungültig');
  return bytes / 2;
}

function appendPcm(input, output, io) {
  const buffer = Buffer.alloc(1024 * 1024);
  const source = io.openSync(input, 'r');
  let destination;
  try {
    destination = io.openSync(output, 'a');
    let count;
    while ((count = io.readSync(source, buffer, 0, buffer.length, null)) > 0) {
      let offset = 0;
      while (offset < count) offset += io.writeSync(destination, buffer, offset, count - offset);
    }
  } finally { io.closeSync(source); if (destination !== undefined) io.closeSync(destination); }
}

function readBytes(filePath, offset, length, io) {
  if (length <= 0) return Buffer.alloc(0);
  const buffer = Buffer.alloc(length);
  const descriptor = io.openSync(filePath, 'r');
  try {
    const bytesRead = io.readSync(descriptor, buffer, 0, length, offset);
    if (bytesRead !== length) throw new Error('PCM-Grenzfenster unvollständig');
    return buffer;
  } finally { io.closeSync(descriptor); }
}

function auditPcmJoin({ previousTail, nextHead, actualJoin, previousSamples, nextSamples,
  previousOrigin = 'unknown', nextOrigin = 'unknown' }) {
  if (![previousTail, nextHead, actualJoin].every(Buffer.isBuffer) ||
      [previousTail, nextHead, actualJoin].some(buffer => buffer.length % 2)) {
    throw new Error('PCM-Grenze hat ungültige Samplebytes');
  }
  const expected = Buffer.concat([previousTail, nextHead]);
  if (actualJoin.length > expected.length) throw new Error('PCM-Grenze enthält künstliche Stille oder Lücke');
  if (actualJoin.length < expected.length) throw new Error('PCM-Grenze enthält Überlappung oder abgeschnittene Samples');
  if (!actualJoin.equals(expected)) throw new Error('PCM-Grenze enthält einen Timing-Sprung');
  return { verified: true, insertedSamples: 0, overlapSamples: 0,
    previousSamples, nextSamples, previousOrigin, nextOrigin,
    transition: previousOrigin + '->' + nextOrigin, joinHash: sha256(actualJoin) };
}

async function buildSubjectBundle({ fach, catalog, lerntexte, bucket, workDir, ffmpeg = runFfmpeg,
  fsAdapter: io = fs, targetPrefix, sourceResolver, probeAudio,
  bundleVersion } = {}) {
  validateCatalog(catalog);
  const entries = orderedSubjectEntries(catalog, fach);
  if (lerntexte !== undefined) {
    if (!Array.isArray(lerntexte) || lerntexte.some(entry => entry?.fach !== fach)) throw new Error('Fachliste enthält fremdes Fach');
    requireSameEntries(entries, orderedSubjectEntries(lerntexte, fach));
  }
  if (!bucket || typeof bucket.file !== 'function') throw new Error('Firebase-Bucket fehlt');
  if (!workDir || !io.existsSync(workDir)) throw new Error('Arbeitsverzeichnis fehlt');
  const paths = continuousPodcastPaths(fach, targetPrefix ? { prefix: targetPrefix } : undefined);
  if (targetPrefix) assertStagingWriteTargets([paths.sidecarPath], { targetPrefix, sourcePaths: [] });
  const ownedDir = io.mkdtempSync(path.join(workDir, paths.slug + '-'));
  const pcm = path.join(ownedDir, 'bundle.pcm'), mp3FilePath = path.join(ownedDir, 'bundle.mp3');
  const decoded = path.join(ownedDir, 'decoded.pcm');
  const sources = [], chapters = [], sourceAudioProperties = [], boundaryAudit = [];
  const audioProbe = probeAudio || (ffmpeg === runFfmpeg ? probeAudioProperties : async () => ({
    codec: 'test-double', sampleRateHz: SAMPLE_RATE, channels: 1, bitrateKbps: null,
    profile: 'injected-ffmpeg', encoder: null, startTimeSeconds: null
  }));
  let total = 0, success = false;
  try {
    io.writeFileSync(pcm, Buffer.alloc(0));
    for (let index = 0; index < entries.length; index++) {
      // Read/decode one pair at a time; never retain a subject's source audio in memory.
      const entry = entries[index];
      const resolved = typeof sourceResolver === 'function' ? sourceResolver(entry) : null;
      const sourceEntry = resolved?.sourceEntry ? { ...resolved.sourceEntry, lerntext: entry.lerntext } : entry;
      const { mp3Bytes, marks, receipt } = await readValidatedSource(bucket, sourceEntry, {
        paths: resolved?.paths || podcastPaths(sourceEntry.fach, sourceEntry.titel),
        origin: resolved?.origin || 'reused'
      });
      const sourceMp3 = path.join(ownedDir, `source-${index}.mp3`), sourcePcm = path.join(ownedDir, `source-${index}.pcm`);
      try {
        io.writeFileSync(sourceMp3, mp3Bytes);
        const properties = await audioProbe(sourceMp3);
        if (!properties || typeof properties.codec !== 'string' || !Number.isFinite(properties.sampleRateHz) ||
            !Number.isInteger(properties.channels) || properties.channels <= 0) {
          throw new Error(entry.titel + ': Audioeigenschaften ungültig');
        }
        sourceAudioProperties.push({ ...properties });
        await ffmpeg(['-nostdin', '-v', 'error', '-xerror', '-y', '-i', sourceMp3,
          '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE), sourcePcm]);
        const samples = sampleCount(sourcePcm, io), end = total + samples;
        if (!Number.isSafeInteger(end)) throw new Error('Bundle-Samples überschreiten Integerbereich');
        if (marks.at(-1).end > samples / SAMPLE_RATE + 0.001) throw new Error(entry.titel + ': Wortzeitmarke überschreitet Decode-Dauer');
        if (index === 0) appendPcm(sourcePcm, pcm, io);
        else {
          const windowBytes = Math.min(4096, total * 2, samples * 2);
          const previousTail = readBytes(pcm, total * 2 - windowBytes, windowBytes, io);
          const nextHead = readBytes(sourcePcm, 0, windowBytes, io);
          appendPcm(sourcePcm, pcm, io);
          const actualJoin = readBytes(pcm, total * 2 - windowBytes, windowBytes * 2, io);
          boundaryAudit.push({ index: index - 1, atSample: total,
            previousTitel: entries[index - 1].titel, nextTitel: entry.titel,
            ...auditPcmJoin({ previousTail, nextHead, actualJoin,
              previousSamples: chapters[index - 1].endSample - chapters[index - 1].startSample,
              nextSamples: samples, previousOrigin: sources[index - 1].origin, nextOrigin: receipt.origin }) });
        }
        const { fach: _fach, ...identity } = currentEntries([entry])[0];
        chapters.push({ ...identity, index,
          ...(bundleVersion ? {
            lerntextId: String(entry.id || ''),
            chapterKey: String(entry.chapterKey || ''),
            origin: receipt.origin,
            segmentHash: receipt.mp3Hash
          } : {}),
          startSample: total, endSample: end,
          start: total / SAMPLE_RATE, end: end / SAMPLE_RATE, wortZeitmarken: marks });
        sources.push(receipt); total = end;
      } finally {
        for (const file of [sourceMp3, sourcePcm]) if (io.existsSync(file)) io.unlinkSync(file);
      }
    }
    if (sampleCount(pcm, io) !== total) throw new Error('Bundle-PCM Samples stimmen nicht');
    await ffmpeg(['-nostdin', '-v', 'error', '-xerror', '-y', '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-i', pcm,
      '-codec:a', 'libmp3lame', '-b:a', '96k', mp3FilePath]);
    const mp3Bytes = io.readFileSync(mp3FilePath);
    if (!mp3Bytes.length) throw new Error('Bundle-MP3 leer');
    await ffmpeg(['-nostdin', '-v', 'error', '-xerror', '-y', '-i', mp3FilePath,
      '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE), decoded]);
    if (sampleCount(decoded, io) !== total) throw new Error('Bundle-MP3 Decode-Samples stimmen nicht');
    const bundleHash = sha256(mp3Bytes);
    const comparableProperties = sourceAudioProperties.map(value => JSON.stringify(value));
    let chapterGroups;
    if (bundleVersion) {
      if (!chapters.every(chapter => chapter.lerntextId && chapter.chapterKey)) {
        throw new Error('Versioniertes Bundle benötigt stabile Lerntext-IDs und Kapitelkeys');
      }
      chapterGroups = [];
      for (const chapter of chapters) {
        let group = chapterGroups[chapterGroups.length - 1];
        if (!group || group.chapterKey !== chapter.chapterKey) {
          group = { chapterKey: chapter.chapterKey, chapterNumber: chapter.hauptkapitelNr,
            chapterTitle: chapter.hauptkapitel, startIndex: chapter.index, endIndex: chapter.index,
            lerntextIds: [] };
          chapterGroups.push(group);
        }
        group.endIndex = chapter.index;
        group.lerntextIds.push(chapter.lerntextId);
      }
      if (new Set(chapters.map(chapter => chapter.lerntextId)).size !== chapters.length) {
        throw new Error('Versioniertes Bundle enthält doppelte Lerntext-IDs');
      }
    }
    const sidecar = { schemaVersion: bundleVersion ? 2 : 1,
      ...(bundleVersion ? { bundleVersion: String(bundleVersion), chapterGroups } : {}),
      fach, bundleHash, mp3Path: paths.mp3Prefix + bundleHash + '.mp3',
      duration: total / SAMPLE_RATE, sampleCount: total,
      encoding: { container: 'mp3', codec: 'mp3', bitrateKbps: 96, sampleRateHz: SAMPLE_RATE, channels: 1,
        pcmFormat: 's16le', sourceNormalization: 'decode-each-to-canonical-pcm',
        encoderPaddingHandling: 'single-final-encode' },
      sourceAudioProperties, sourceAudioUniform: new Set(comparableProperties).size === 1,
      boundaryAudit, chapters };
    success = true;
    return { sidecar, sidecarBytes: Buffer.from(JSON.stringify(sidecar)), mp3FilePath, workDir: ownedDir,
      targetPrefix: targetPrefix || null,
      fsAdapter: io, entries, sources, byteSize: mp3Bytes.length, decodedSamples: total };
  } finally {
    // Only paths created in this invocation are removed; the caller owns workDir.
    for (const file of [pcm, decoded]) if (io.existsSync(file)) io.unlinkSync(file);
    if (!success) {
      if (io.existsSync(mp3FilePath)) io.unlinkSync(mp3FilePath);
      io.rmdirSync(ownedDir);
    }
  }
}

async function revalidateSources(bundle, bucket, loadCatalog) {
  if (typeof loadCatalog !== 'function') throw new Error('Aktueller Katalog: loadCatalog fehlt');
  const catalog = await loadCatalog();
  validateCatalog(catalog);
  const entries = orderedSubjectEntries(catalog, bundle.sidecar.fach);
  requireSameEntries(bundle.entries, entries);
  if (bundle.sources.length !== entries.length) throw new Error('Quellbelege unvollständig');
  for (let index = 0; index < entries.length; index++) {
    // Re-read both exact byte streams, including historical audio and JSON.
    const expected = bundle.sources[index];
    const sourceEntry = { ...entries[index], fach: expected.sourceIdentity.fach, titel: expected.sourceIdentity.titel };
    const { receipt, marks } = await readValidatedSource(bucket, sourceEntry, {
      paths: expected.paths,
      origin: expected.origin
    });
    if (JSON.stringify(receipt) !== JSON.stringify(bundle.sources[index])) throw new Error(entries[index].titel + ': Legacy-Generation oder Bytes geändert');
    if (JSON.stringify(marks) !== JSON.stringify(bundle.sidecar.chapters[index].wortZeitmarken)) throw new Error('Bundle-Wortzeitmarken stimmen nicht mit Quelle überein');
  }
}

function validateBundle(bundle, mp3Bytes, { targetPrefix } = {}) {
  if (!bundle?.sidecar || !Array.isArray(bundle.entries) || !Array.isArray(bundle.sources) || !Buffer.isBuffer(bundle.sidecarBytes)) {
    throw new Error('Bundle ungültig');
  }
  const manifestHash = sha256(bundle.sidecarBytes);
  if (!Buffer.from(JSON.stringify(bundle.sidecar)).equals(bundle.sidecarBytes) || sha256(mp3Bytes) !== bundle.sidecar.bundleHash) {
    throw new Error('Bundle-Hash oder Sidecar-Bytes ungültig');
  }
  const paths = continuousPodcastPaths(bundle.sidecar.fach, targetPrefix ? { prefix: targetPrefix } : undefined);
  if ((bundle.targetPrefix || null) !== (targetPrefix || null) || bundle.sidecar.mp3Path !== paths.mp3Prefix + bundle.sidecar.bundleHash + '.mp3') {
    throw new Error('Bundle-Zielpräfix stimmt nicht überein');
  }
  if (targetPrefix) assertStagingWriteTargets([paths.sidecarPath, bundle.sidecar.mp3Path], {
    targetPrefix,
    sourcePaths: bundle.sources.flatMap(source => [source.paths.mp3Path, source.paths.jsonPath])
  });
  const validation = validateContinuousBundle({ manifest: bundle.sidecar, manifestHash,
    expectedFach: bundle.sidecar.fach, expectedMp3Prefix: paths.mp3Prefix,
    expectedStoragePrefix: targetPrefix,
    currentEntries: currentEntries(bundle.entries),
    mp3Metadata: { customMetadata: { bundleHash: bundle.sidecar.bundleHash, manifestHash } } });
  if (!validation.valid) throw new Error('Bundle ungültig: ' + validation.reason);
  return manifestHash;
}

async function readPublished(bucket, storagePath, bytes, type, hashes = {}) {
  const [metadata] = await bucket.file(storagePath).getMetadata();
  const [downloaded] = await bucket.file(storagePath, { generation: metadata.generation }).download();
  validateObjectBytes(metadata, downloaded, storagePath);
  if (!downloaded.equals(bytes) || Object.entries(hashes).some(([key, value]) => metadata.metadata?.[key] !== value)) {
    throw new Error('Veröffentlichtes MP3/Sidecar hat falschen Hash oder Metadaten');
  }
  if (metadata.contentType !== type) throw new Error('Veröffentlichtes Objekt hat falschen Content-Type');
  if (!String(metadata.metadata?.firebaseStorageDownloadTokens || '').split(',').some(token => token.trim())) {
    throw new Error('Veröffentlichtes Objekt hat keinen Firebase-Download-Token');
  }
  return metadata;
}

async function publishSubjectBundle({ bundle, bucket, loadCatalog, withLock = withPublishLock, targetPrefix } = {}) {
  const mp3Bytes = (bundle?.fsAdapter || fs).readFileSync(bundle.mp3FilePath);
  const manifestHash = validateBundle(bundle, mp3Bytes, { targetPrefix });
  if (typeof loadCatalog !== 'function') throw new Error('Aktueller Katalog: loadCatalog fehlt');
  const paths = continuousPodcastPaths(bundle.sidecar.fach, targetPrefix ? { prefix: targetPrefix } : undefined);
  return withLock(bucket, paths.sidecarPath, async () => {
    const mp3File = bucket.file(bundle.sidecar.mp3Path), sidecarFile = bucket.file(paths.sidecarPath);
    const [sidecarExists] = await sidecarFile.exists();
    const sidecarGeneration = sidecarExists ? (await sidecarFile.getMetadata())[0].generation : 0;
    if (sidecarExists && !sidecarGeneration) throw new Error('Sidecar-Generation fehlt');
    await revalidateSources(bundle, bucket, loadCatalog);
    const [mp3Exists] = await mp3File.exists();
    if (!mp3Exists) await mp3File.save(mp3Bytes, {
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: 'audio/mpeg', cacheControl: 'public,max-age=31536000,immutable',
        metadata: { bundleHash: bundle.sidecar.bundleHash, manifestHash, firebaseStorageDownloadTokens: randomUUID() } }
    });
    const hashes = { bundleHash: bundle.sidecar.bundleHash, manifestHash };
    const mp3Metadata = await readPublished(bucket, bundle.sidecar.mp3Path, mp3Bytes, 'audio/mpeg', hashes);
    // Changes during upload/readback must not make a stale bundle visible.
    await revalidateSources(bundle, bucket, loadCatalog);
    const latestMp3 = await readPublished(bucket, bundle.sidecar.mp3Path, mp3Bytes, 'audio/mpeg', hashes);
    if (latestMp3.generation !== mp3Metadata.generation ||
        latestMp3.metageneration !== mp3Metadata.metageneration) throw new Error('Bundle-MP3 Generation geändert');
    await sidecarFile.save(bundle.sidecarBytes, {
      preconditionOpts: { ifGenerationMatch: sidecarGeneration },
      metadata: { contentType: 'application/json', cacheControl: 'no-cache,max-age=0',
        metadata: { firebaseStorageDownloadTokens: randomUUID() } }
    });
    await readPublished(bucket, bundle.sidecar.mp3Path, mp3Bytes, 'audio/mpeg', hashes);
    await readPublished(bucket, paths.sidecarPath, bundle.sidecarBytes, 'application/json');
    return { mp3Path: bundle.sidecar.mp3Path, sidecarPath: paths.sidecarPath, bundleHash: bundle.sidecar.bundleHash, manifestHash };
  });
}

module.exports = { buildSubjectBundle, publishSubjectBundle, orderedSubjectEntries, validateCatalog,
  revalidateSources, readValidatedSource, runFfmpeg, probeAudioProperties, auditPcmJoin };
