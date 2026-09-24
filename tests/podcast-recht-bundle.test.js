const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { sha256Lerntext, podcastPaths } = require('../tools/podcast-sync/hash-paths.js');
const { buildRechtBundle, publishRechtBundle } = require('../tools/podcast-sync/recht-bundle.js');

const hash = value => createHash('sha256').update(value).digest('hex');

function fixture(options = {}) {
  const entries = Array.from({ length: 57 }, (_, index) => ({
    fach: 'Recht', titel: `Kapitel ${index + 1}`, hauptkapitel: 'Grundlagen',
    hauptkapitelNr: Math.floor(index / 3) + 1, unterkapitelNr: `${Math.floor(index / 3) + 1}.${index % 3 + 1}`,
    reihenfolgeFach: index + 1, reihenfolgeKapitel: index % 3 + 1,
    lerntext: `Wort${index}.`
  }));
  if (options.mutateEntry) options.mutateEntry(entries);
  const objects = new Map();
  for (const entry of entries) {
    const paths = podcastPaths(entry.fach, entry.titel);
    const index = entry.reihenfolgeFach - 1;
    const manifest = {
      fach: entry.fach, titel: entry.titel, lerntextHash: sha256Lerntext(entry.lerntext),
      mp3Path: paths.mp3Path, jsonPath: paths.jsonPath,
      wortZeitmarken: [{ wortIndex: 0, wort: `Wort${index}`, start: 0, end: 0.2 }],
      updatedAt: '2026-09-24T00:00:00.000Z'
    };
    const json = Buffer.from(JSON.stringify(manifest));
    objects.set(paths.mp3Path, { bytes: Buffer.from(`mp3-${index}`), generation: '1', metadata: { lerntextHash: manifest.lerntextHash, manifestHash: hash(json) } });
    objects.set(paths.jsonPath, { bytes: json, generation: '2', metadata: {} });
  }
  const events = [];
  const reads = [];
  const bucket = { file(name, fileOptions = {}) { return {
    async exists() { return [objects.has(name)]; },
    async download() {
      if (!objects.has(name)) throw new Error(`missing ${name}`);
      const item = objects.get(name);
      reads.push({ name, generation: fileOptions.generation });
      if (fileOptions.generation !== undefined && String(fileOptions.generation) !== String(item.generation)) {
        throw new Error(`generation mismatch ${name}`);
      }
      return [item.bytes];
    },
    async getMetadata() { if (!objects.has(name)) throw new Error(`missing ${name}`); const item = objects.get(name); return [{ generation: item.generation, metadata: item.metadata, size: String(item.bytes.length) }]; },
    async save(bytes, options) {
      events.push({ name, bytes, options });
      assert.equal(options.preconditionOpts.ifGenerationMatch, objects.get(name)?.generation || 0);
      objects.set(name, { bytes: Buffer.from(bytes), generation: '3', metadata: options.metadata.metadata || {} });
    }
  }; } };
  const calls = [];
  const ffmpeg = async args => {
    calls.push(args);
    const output = args.at(-1);
    if (args.includes('libmp3lame')) fs.writeFileSync(output, Buffer.from('bundle-mp3'));
    else if (args.some(value => String(value).endsWith('bundle.mp3'))) fs.writeFileSync(output, Buffer.alloc(57 * 8820, 1));
    else {
      const input = String(args[args.indexOf('-i') + 1] || '');
      const sourceIndex = Number((input.match(/source-(\d+)\.mp3$/) || [])[1]);
      fs.writeFileSync(output, Buffer.alloc(8820, Number.isInteger(sourceIndex) ? sourceIndex % 251 + 1 : 1));
    }
  };
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recht-bundle-test-'));
  return { entries, objects, events, reads, bucket, calls, ffmpeg, workDir,
    cleanup() { fs.rmSync(workDir, { recursive: true, force: true }); } };
}

test('hard gates Recht and exactly 57 entries before decoding', async t => {
  const f = fixture(); t.after(f.cleanup);
  await assert.rejects(buildRechtBundle({ lerntexte: f.entries.slice(0, 56), bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir }), /57/);
  await assert.rejects(buildRechtBundle({ lerntexte: [{ ...f.entries[0], fach: 'Steuern' }, ...f.entries.slice(1)], bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir }), /Recht/);
  assert.equal(f.calls.length, 0);
});

test('rejects a mismatched production source hash and legacy path', async t => {
  const f = fixture(); t.after(f.cleanup);
  const paths = podcastPaths('Recht', f.entries[0].titel);
  f.objects.get(paths.mp3Path).metadata.lerntextHash = '0'.repeat(64);
  await assert.rejects(buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir }), /lerntextHash/);
  f.objects.get(paths.mp3Path).metadata.lerntextHash = sha256Lerntext(f.entries[0].lerntext);
  const old = JSON.parse(f.objects.get(paths.jsonPath).bytes);
  old.mp3Path = 'podcast/other.mp3';
  f.objects.get(paths.jsonPath).bytes = Buffer.from(JSON.stringify(old));
  f.objects.get(paths.mp3Path).metadata.manifestHash = hash(f.objects.get(paths.jsonPath).bytes);
  await assert.rejects(buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir }), /mp3Path/);
  assert.equal(f.calls.length, 0);
});

test('requires every legacy MP3 to bind the exact JSON generation by manifestHash', async t => {
  const f = fixture(); t.after(f.cleanup);
  const paths = podcastPaths('Recht', f.entries[0].titel);
  delete f.objects.get(paths.mp3Path).metadata.manifestHash;

  await assert.rejects(
    buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir }),
    /manifestHash/
  );
  assert.equal(f.calls.length, 0);
});

test('preserves production word marks with zero duration under the legacy manifest contract', async t => {
  const f = fixture(); t.after(f.cleanup);
  const entry = f.entries[0];
  entry.lerntext = 'Alpha Beta';
  const paths = podcastPaths('Recht', entry.titel);
  const manifest = JSON.parse(f.objects.get(paths.jsonPath).bytes.toString('utf8'));
  manifest.lerntextHash = sha256Lerntext(entry.lerntext);
  manifest.wortZeitmarken = [
    { wortIndex: 0, wort: 'Alpha', start: 0, end: 0.1 },
    { wortIndex: 1, wort: 'Beta', start: 0.1, end: 0.1 }
  ];
  const json = Buffer.from(JSON.stringify(manifest));
  f.objects.get(paths.jsonPath).bytes = json;
  f.objects.get(paths.mp3Path).metadata.lerntextHash = manifest.lerntextHash;
  f.objects.get(paths.mp3Path).metadata.manifestHash = hash(json);

  const bundle = await buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });

  assert.deepEqual(bundle.sidecar.chapters[0].wortZeitmarken, manifest.wortZeitmarken);
});

test('orders chapters by production sequence and accumulates integer PCM samples', async t => {
  const f = fixture(); t.after(f.cleanup);
  const bundle = await buildRechtBundle({ lerntexte: f.entries.toReversed(), bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });
  assert.equal(bundle.sidecar.chapters.length, 57);
  assert.equal(bundle.sidecar.chapters[0].titel, 'Kapitel 1');
  assert.equal(bundle.sidecar.chapters[1].titel, 'Kapitel 2');
  assert.deepEqual(bundle.sidecar.chapters.slice(0, 2).map(c => [c.startSample, c.endSample]), [[0, 4410], [4410, 8820]]);
  assert.equal(bundle.sidecar.sampleCount, 57 * 4410);
  assert.equal(bundle.sidecar.chapters[1].start, 0.2);
  assert.equal(bundle.sidecar.chapters[1].wortZeitmarken[0].start, 0);
  assert.equal(bundle.sidecar.chapters[0].hauptkapitelNr, '1');
  assert.equal(bundle.sidecar.encoding.sampleRateHz, 22050);
  assert.equal(bundle.sidecar.mp3Path, `podcast/continuous/recht/${hash(Buffer.from('bundle-mp3'))}.mp3`);
});

test('pins every legacy MP3 and JSON download to the metadata generation', async t => {
  const f = fixture(); t.after(f.cleanup);
  await buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });

  const legacyReads = f.reads.filter(read => /^podcast\/recht-/.test(read.name));
  assert.equal(legacyReads.length, 114);
  assert.ok(legacyReads.every(read => read.generation === (read.name.endsWith('.mp3') ? '1' : '2')));
});

test('aggregate PCM contains every decoded chapter in production order', async t => {
  const f = fixture(); t.after(f.cleanup);
  await buildRechtBundle({ lerntexte: f.entries.toReversed(), bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });

  const pcm = fs.readFileSync(path.join(f.workDir, 'recht-bundle.pcm'));
  for (let index = 0; index < 57; index += 1) {
    assert.equal(pcm[index * 8820], index % 251 + 1, `PCM-Segment ${index + 1}`);
  }
});

test('decodes every source to mono 22050 s16le, encodes once with libmp3lame 96k, and fully decodes result', async t => {
  const f = fixture(); t.after(f.cleanup);
  await buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });
  assert.equal(f.calls.length, 59);
  assert.equal(f.calls.filter(args => args.includes('libmp3lame')).length, 1);
  for (const args of f.calls.filter(args => args.includes('s16le'))) {
    assert.ok(args.includes('-ac') && args.includes('1'));
    assert.ok(args.includes('-ar') && args.includes('22050'));
    assert.ok(args.includes('-f') && args.includes('s16le'));
  }
  for (const args of f.calls.filter(args => !args.includes('libmp3lame'))) assert.ok(args.includes('-xerror'));
  const encode = f.calls.find(args => args.includes('libmp3lame'));
  assert.ok(encode.includes('-b:a') && encode.includes('96k'));
  assert.ok(f.calls.at(-1).includes('-i') && f.calls.at(-1).some(value => String(value).endsWith('.mp3')));
});

test('rejects a truncated final decode before publishing', async t => {
  const f = fixture(); t.after(f.cleanup);
  const original = f.ffmpeg;
  const ffmpeg = async args => {
    if (f.calls.length === 58) { f.calls.push(args); fs.writeFileSync(args.at(-1), Buffer.alloc(2)); }
    else await original(args);
  };
  await assert.rejects(buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg, workDir: f.workDir }), /decode|Dauer|Samples/i);
  assert.equal(f.events.length, 0);
});

test('publishes hash path MP3 first under lock with CAS and exact sidecar hash, then stable sidecar last', async t => {
  const f = fixture(); t.after(f.cleanup);
  const bundle = await buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });
  let lockPath;
  await publishRechtBundle({ bundle, bucket: f.bucket, withLock: async (bucket, key, action) => { lockPath = key; return action(); } });
  assert.equal(lockPath, 'podcast/continuous/recht.json');
  assert.deepEqual(f.events.map(event => event.name), [bundle.sidecar.mp3Path, 'podcast/continuous/recht.json']);
  assert.equal(f.events[0].options.preconditionOpts.ifGenerationMatch, 0);
  assert.equal(f.events[0].options.metadata.metadata.bundleHash, bundle.sidecar.bundleHash);
  assert.equal(f.events[0].options.metadata.metadata.manifestHash, hash(f.events[1].bytes));
  assert.match(f.events[0].options.metadata.metadata.firebaseStorageDownloadTokens, /^[0-9a-f-]{36}$/);
  assert.equal(f.events[0].options.metadata.cacheControl, 'public,max-age=31536000,immutable');
  assert.equal(f.events[1].options.preconditionOpts.ifGenerationMatch, 0);
  assert.match(f.events[1].options.metadata.metadata.firebaseStorageDownloadTokens, /^[0-9a-f-]{36}$/);
  assert.equal(f.events[1].options.metadata.cacheControl, 'no-cache,max-age=0');
});

test('rejects a reused immutable MP3 without Firebase download token before sidecar publication', async t => {
  const f = fixture(); t.after(f.cleanup);
  const bundle = await buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });
  f.objects.set(bundle.sidecar.mp3Path, {
    bytes: fs.readFileSync(bundle.mp3FilePath),
    generation: '9',
    metadata: {
      bundleHash: bundle.sidecar.bundleHash,
      manifestHash: hash(bundle.sidecarBytes)
    }
  });

  await assert.rejects(
    publishRechtBundle({ bundle, bucket: f.bucket, withLock: async (_bucket, _path, work) => work() }),
    /Download-Token/
  );
  assert.equal(f.events.some(event => event.name === 'podcast/continuous/recht.json'), false);
});

test('never publishes sidecar after MP3 failure or writes legacy objects', async t => {
  const f = fixture(); t.after(f.cleanup);
  const bundle = await buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });
  const bucket = { file(name) { const file = f.bucket.file(name); return { ...file, async save(bytes, options) { if (name.endsWith('.mp3')) throw new Error('upload failed'); return file.save(bytes, options); } }; } };
  await assert.rejects(publishRechtBundle({ bundle, bucket, withLock: async (_, __, action) => action() }), /upload failed/);
  assert.equal(f.events.length, 0);
});

test('does not publish sidecar when uploaded MP3 bytes are corrupted', async t => {
  const f = fixture(); t.after(f.cleanup);
  const bundle = await buildRechtBundle({ lerntexte: f.entries, bucket: f.bucket, ffmpeg: f.ffmpeg, workDir: f.workDir });
  const bucket = { file(name) { const file = f.bucket.file(name); return {
    ...file,
    async save(bytes, options) {
      await file.save(bytes, options);
      if (name.endsWith('.mp3')) f.objects.get(name).bytes = Buffer.from('corrupted');
    }
  }; } };
  await assert.rejects(publishRechtBundle({ bundle, bucket, withLock: async (_, __, action) => action() }), /MP3.*Hash|Hash.*MP3/);
  assert.deepEqual(f.events.map(event => event.name), [bundle.sidecar.mp3Path]);
});
