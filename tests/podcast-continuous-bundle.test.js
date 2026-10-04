const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const { podcastPaths } = require('../tools/podcast-sync/hash-paths');
const builderPath = '../tools/podcast-sync/continuous-bundle';
const cliPath = '../tools/podcast-sync/sync-bundles';
const builder = fs.existsSync(path.join(__dirname, builderPath + '.js')) ? require(builderPath) : {};
const cli = fs.existsSync(path.join(__dirname, cliPath + '.js')) ? require(cliPath) : {};

function fixture(t, fach = 'Steuern', count = 2) {
  const catalog = Array.from({ length: count }, (_, i) => ({ fach, titel: `Kapitel ${i + 1}`,
    hauptkapitel: 'Grundlagen', hauptkapitelNr: '1', unterkapitelNr: `1.${i + 1}`,
    reihenfolgeFach: 1, reihenfolgeKapitel: i + 1, lerntext: `Wort${i}` }));
  const objects = new Map();
  for (const entry of catalog) {
    const paths = podcastPaths(fach, entry.titel);
    const manifest = { fach, titel: entry.titel, lerntextHash: hash(entry.lerntext), ...paths,
      wortZeitmarken: [{ wortIndex: 0, wort: entry.lerntext, start: 0, end: 0.2 }] };
    const bytes = Buffer.from(JSON.stringify(manifest));
    objects.set(paths.jsonPath, { bytes, generation: '2', metadata: {}, contentType: 'application/json' });
    objects.set(paths.mp3Path, { bytes: Buffer.from('source'), generation: '1', contentType: 'audio/mpeg',
      metadata: { lerntextHash: manifest.lerntextHash, manifestHash: hash(bytes) } });
  }
  const events = [], reads = [], calls = [], pcms = [];
  const bucket = { file(name, options = {}) { return {
    async exists() { return [objects.has(name)]; },
    async getMetadata() {
      const item = objects.get(name); if (!item) throw new Error('missing ' + name);
      return [{ name, generation: item.generation, contentType: item.contentType, size: String(item.bytes.length), metadata: { ...item.metadata } }];
    },
    async download() {
      const item = objects.get(name); if (!item) throw new Error('missing ' + name);
      reads.push({ name, generation: options.generation });
      if (options.generation !== undefined && options.generation !== item.generation) throw new Error('generation changed');
      return [Buffer.from(item.bytes)];
    },
    async save(bytes, opts) {
      assert.equal(opts.preconditionOpts.ifGenerationMatch, objects.get(name)?.generation || 0);
      events.push({ name, opts });
      objects.set(name, { bytes: Buffer.from(bytes), generation: String(10 + events.length),
        contentType: opts.metadata.contentType, metadata: { ...opts.metadata.metadata } });
    }
  }; } };
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'continuous-test-'));
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(workDir, 'keep.txt'), 'keep');
  const ffmpeg = async args => {
    calls.push(args);
    const input = args[args.indexOf('-i') + 1];
    if (args.includes('libmp3lame')) {
      pcms.push(fs.readFileSync(input));
      fs.writeFileSync(args.at(-1), Buffer.from('bundle-' + fach));
    } else {
      const match = input.match(/source-(\d+)\.mp3$/);
      fs.writeFileSync(args.at(-1), Buffer.alloc(match ? 8820 : count * 8820, match ? Number(match[1]) + 1 : 1));
    }
  };
  const loadCatalog = async () => catalog.map(entry => ({ ...entry }));
  const probeAudio = async () => ({ codec: 'mp3', sampleRateHz: 22050, channels: 1,
    bitrateKbps: 96, profile: 'mp3', encoder: 'test', startTimeSeconds: 0 });
  const withLock = async (_bucket, key, action) => { assert.equal(key, `podcast/continuous/${fach.toLowerCase()}.json`); return action(); };
  return { fach, catalog, objects, bucket, workDir, ffmpeg, probeAudio, calls, pcms, events, reads, loadCatalog, withLock };
}
const build = f => builder.buildSubjectBundle({ ...f, lerntexte: f.catalog });
const publish = (f, bundle) => builder.publishSubjectBundle({ ...f, bundle });
const source = f => podcastPaths(f.fach, f.catalog[0].titel);

test('generic builder and orchestrator expose subject operations', () => {
  assert.equal(typeof builder.buildSubjectBundle, 'function');
  assert.equal(typeof builder.publishSubjectBundle, 'function');
  assert.equal(typeof cli.syncBundles, 'function');
});

test('variable subjects build complete ordered sample timelines and clean only owned aggregates', async t => {
  const f = fixture(t); f.catalog.reverse();
  const bundle = await build(f);
  assert.equal(bundle.sidecar.fach, 'Steuern');
  assert.deepEqual(bundle.sidecar.chapters.map(c => [c.titel, c.startSample, c.endSample]), [
    ['Kapitel 1', 0, 4410], ['Kapitel 2', 4410, 8820]]);
  assert.equal(bundle.sidecar.sampleCount, 8820);
  assert.equal(bundle.sidecar.duration, 0.4);
  assert.equal(f.pcms[0][0], 1); assert.equal(f.pcms[0][8820], 2);
  assert.equal(f.calls.length, 4);
  assert.equal(f.calls.filter(args => args.includes('libmp3lame')).length, 1);
  for (const args of f.calls) {
    assert.equal(args[args.indexOf('-ar') + 1], '22050');
    assert.equal(args[args.indexOf('-ac') + 1], '1');
    assert.equal(args[args.indexOf('-f') + 1], 's16le');
  }
  assert.equal(f.calls[2][f.calls[2].indexOf('-b:a') + 1], '96k');
  assert.ok(f.reads.every(read => read.generation === (read.name.endsWith('.mp3') ? '1' : '2')));
  assert.deepEqual(fs.readdirSync(f.workDir).sort(), ['keep.txt', path.basename(bundle.workDir)].sort());
  assert.deepEqual(fs.readdirSync(bundle.workDir), ['bundle.mp3']);
});

test('Staging-Bundle liest produktive Segmente und veröffentlicht MP3 und Sidecar nur im Zielpräfix', async t => {
  const f = fixture(t);
  const targetPrefix = 'podcast/staging/lerntext-rev2/';
  const bundle = await builder.buildSubjectBundle({ ...f, lerntexte: f.catalog, targetPrefix });
  assert.match(bundle.sidecar.mp3Path, /^podcast\/staging\/lerntext-rev2\/continuous\/steuern\/[a-f0-9]{64}\.mp3$/);
  assert.ok(bundle.sources.every(receipt => receipt.paths.mp3Path.startsWith('podcast/') &&
    !receipt.paths.mp3Path.startsWith(targetPrefix)));
  f.withLock = async (_bucket, key, action) => {
    assert.equal(key, targetPrefix + 'continuous/steuern.json');
    return action();
  };
  const result = await builder.publishSubjectBundle({ ...f, bundle, targetPrefix });
  assert.equal(result.sidecarPath, targetPrefix + 'continuous/steuern.json');
  assert.ok(f.events.length > 0);
  assert.ok(f.events.every(event => event.name.startsWith(targetPrefix)));
  assert.equal([...f.objects.keys()].filter(name => name.startsWith('podcast/continuous/')).length, 0);
});

test('Staging-Bundle lehnt ein produktives Ziel vor Decode und Publish ab', async t => {
  const f = fixture(t);
  await assert.rejects(builder.buildSubjectBundle({ ...f, lerntexte: f.catalog, targetPrefix: 'podcast/' }), /Staging|Präfix|Ziel/i);
  assert.equal(f.calls.length, 0);
  const bundle = await build(f);
  await assert.rejects(builder.publishSubjectBundle({ ...f, bundle, targetPrefix: 'podcast/staging/lerntext-rev2/' }), /Staging|Pfad|Ziel/i);
  assert.equal(f.events.length, 0);
});

test('Bundle verwendet pro Lerntext den freigegebenen Quellpfad und bewahrt reused/regenerated Herkunft', async t => {
  const f = fixture(t);
  const current = f.catalog[0];
  const oldEntry = { ...current, fach: 'Altes Fach', titel: 'Alter Titel' };
  const oldPaths = podcastPaths(oldEntry.fach, oldEntry.titel);
  const oldManifest = { fach: oldEntry.fach, titel: oldEntry.titel, lerntextHash: hash(current.lerntext), ...oldPaths,
    wortZeitmarken: [{ wortIndex: 0, wort: current.lerntext, start: 0, end: 0.2 }] };
  const oldJson = Buffer.from(JSON.stringify(oldManifest));
  f.objects.set(oldPaths.jsonPath, { bytes: oldJson, generation: '22', metadata: {}, contentType: 'application/json' });
  f.objects.set(oldPaths.mp3Path, { bytes: Buffer.from('old-source'), generation: '21', contentType: 'audio/mpeg',
    metadata: { lerntextHash: oldManifest.lerntextHash, manifestHash: hash(oldJson) } });
  const targetPrefix = 'podcast/staging/lerntext-rev2/';
  const bundle = await builder.buildSubjectBundle({ ...f, lerntexte: f.catalog, targetPrefix,
    sourceResolver(entry) {
      if (entry.titel === current.titel) return { sourceEntry: oldEntry, paths: oldPaths, origin: 'reused' };
      return { sourceEntry: entry, paths: podcastPaths(entry.fach, entry.titel), origin: 'regenerated' };
    }
  });
  assert.deepEqual(bundle.sources.map(source => source.origin), ['reused', 'regenerated']);
  assert.equal(bundle.sources[0].paths.mp3Path, oldPaths.mp3Path);
  assert.equal(bundle.sources[0].sourceIdentity.fach, oldEntry.fach);
  assert.ok(f.reads.some(read => read.name === oldPaths.mp3Path));
  assert.equal(bundle.sidecar.chapters[0].titel, current.titel);
});

test('Bundle protokolliert Audioeigenschaften und prüft reused-regenerated Grenzen auf PCM-Sampleebene', async t => {
  const f = fixture(t, 'Steuern', 3);
  const origins = ['reused', 'regenerated', 'reused'];
  const probes = [
    { codec: 'mp3', sampleRateHz: 22050, channels: 1, bitrateKbps: 32, profile: 'layer3', encoder: 'LAME3.100', startTimeSeconds: 0.025 },
    { codec: 'mp3', sampleRateHz: 22050, channels: 1, bitrateKbps: 48, profile: 'layer3', encoder: 'LAME3.100', startTimeSeconds: 0.025 },
    { codec: 'mp3', sampleRateHz: 44100, channels: 2, bitrateKbps: 128, profile: 'layer3', encoder: 'other', startTimeSeconds: 0.011 }
  ];
  let probeIndex = 0;
  const bundle = await builder.buildSubjectBundle({ ...f, lerntexte: f.catalog,
    sourceResolver(entry) {
      const index = f.catalog.findIndex(candidate => candidate.titel === entry.titel);
      return { sourceEntry: entry, paths: podcastPaths(entry.fach, entry.titel), origin: origins[index] };
    },
    probeAudio: async () => probes[probeIndex++]
  });
  assert.deepEqual(bundle.sidecar.sourceAudioProperties, probes);
  assert.equal(bundle.sidecar.boundaryAudit.length, 2);
  assert.deepEqual(bundle.sidecar.boundaryAudit.map(boundary => boundary.transition), [
    'reused->regenerated', 'regenerated->reused'
  ]);
  assert.ok(bundle.sidecar.boundaryAudit.every(boundary => boundary.verified === true &&
    boundary.insertedSamples === 0 && boundary.overlapSamples === 0));
  assert.equal(bundle.sidecar.encoding.sourceNormalization, 'decode-each-to-canonical-pcm');
  assert.equal(f.calls.filter(args => args.includes('libmp3lame')).length, 1);
});

test('versioniertes Staging-Sidecar bindet stabile Lerntext-IDs, Kapitelgruppen, Herkunft und Segmenthashes', async t => {
  const f = fixture(t, 'Steuern', 3);
  f.catalog.forEach((entry, index) => {
    entry.id = `LZ-ST-${index + 1}`;
    entry.chapterKey = index < 2 ? 'ui-wq-steuern-1' : 'ui-wq-steuern-2';
    entry.hauptkapitelNr = index < 2 ? '1' : '2';
    entry.hauptkapitel = index < 2 ? 'Grundbegriffe des Steuerrechts' : 'Abgabenordnung';
  });
  const bundle = await builder.buildSubjectBundle({ ...f, lerntexte: f.catalog,
    targetPrefix: 'podcast/staging/lerntext-rev2/', bundleVersion: 'TEST-BUNDLE-v2' });

  assert.equal(bundle.sidecar.schemaVersion, 2);
  assert.equal(bundle.sidecar.bundleVersion, 'TEST-BUNDLE-v2');
  assert.deepEqual(bundle.sidecar.chapters.map(chapter => chapter.lerntextId), ['LZ-ST-1', 'LZ-ST-2', 'LZ-ST-3']);
  assert.deepEqual(bundle.sidecar.chapters.map(chapter => chapter.chapterKey), [
    'ui-wq-steuern-1', 'ui-wq-steuern-1', 'ui-wq-steuern-2'
  ]);
  assert.ok(bundle.sidecar.chapters.every(chapter => chapter.origin === 'reused' && /^[a-f0-9]{64}$/.test(chapter.segmentHash)));
  assert.deepEqual(bundle.sidecar.chapterGroups, [
    { chapterKey: 'ui-wq-steuern-1', chapterNumber: '1', chapterTitle: 'Grundbegriffe des Steuerrechts',
      startIndex: 0, endIndex: 1, lerntextIds: ['LZ-ST-1', 'LZ-ST-2'] },
    { chapterKey: 'ui-wq-steuern-2', chapterNumber: '2', chapterTitle: 'Abgabenordnung',
      startIndex: 2, endIndex: 2, lerntextIds: ['LZ-ST-3'] }
  ]);
});

test('PCM-Grenzprüfung erkennt künstliche Stille und Überlappung', () => {
  const previousTail = Buffer.from([1, 2, 3, 4]);
  const nextHead = Buffer.from([5, 6, 7, 8]);
  const expected = Buffer.concat([previousTail, nextHead]);
  const ok = builder.auditPcmJoin({ previousTail, nextHead, actualJoin: expected,
    previousSamples: 10, nextSamples: 20, previousOrigin: 'reused', nextOrigin: 'regenerated' });
  assert.equal(ok.verified, true);
  assert.equal(ok.insertedSamples, 0);
  assert.equal(ok.overlapSamples, 0);
  assert.throws(() => builder.auditPcmJoin({ previousTail, nextHead,
    actualJoin: Buffer.concat([previousTail, Buffer.alloc(2), nextHead]), previousSamples: 10, nextSamples: 20 }), /Stille|Lücke|Grenze/i);
  assert.throws(() => builder.auditPcmJoin({ previousTail, nextHead,
    actualJoin: Buffer.concat([previousTail.subarray(0, 2), nextHead]), previousSamples: 10, nextSamples: 20 }), /Überlapp|Grenze/i);
});

test('rejects empty, partial, foreign and colliding subject lists before decode', async t => {
  const f = fixture(t);
  await assert.rejects(builder.buildSubjectBundle({ ...f, lerntexte: f.catalog.slice(0, 1) }), /vollständig|Fachliste/);
  await assert.rejects(builder.buildSubjectBundle({ ...f, catalog: [], lerntexte: [] }), /leer|Fachliste/);
  await assert.rejects(builder.buildSubjectBundle({ ...f, lerntexte: [{ ...f.catalog[0], fach: 'Recht' }] }), /Fachliste|Fach/);
  f.catalog[1].titel = 'Kapitel-1';
  await assert.rejects(build(f), /kollision/i);
  assert.equal(f.calls.length, 0);
});

for (const value of [null, '', ' ', 'bad', '0'.repeat(64)]) test('present invalid manifestHash blocks: ' + JSON.stringify(value), async t => {
  const f = fixture(t); f.objects.get(source(f).mp3Path).metadata.manifestHash = value;
  await assert.rejects(build(f), /manifestHash/); assert.equal(f.calls.length, 0);
});

test('absent manifestHash uses exact historical generation and byte receipts', async t => {
  const f = fixture(t); delete f.objects.get(source(f).mp3Path).metadata.manifestHash;
  const bundle = await build(f);
  assert.equal(bundle.sources[0].contract, 'historical');
  assert.equal(bundle.sources[0].mp3Hash, hash(Buffer.from('source')));
  assert.equal(bundle.sources[0].jsonHash, hash(f.objects.get(source(f).jsonPath).bytes));
  assert.deepEqual(bundle.sources[0].generations, { mp3: '1', json: '2' });
  await publish(f, bundle);
  assert.ok(f.reads.filter(r => r.name === source(f).mp3Path).length >= 3);
});

for (const mutation of ['hash', 'title', 'subject', 'mp3Path', 'jsonPath', 'coverage', 'word', 'negative', 'backward', 'duration', 'size', 'generation']) {
  test('historical source rejects altered ' + mutation, async t => {
    const f = fixture(t); const paths = source(f); const mp3 = f.objects.get(paths.mp3Path);
    delete mp3.metadata.manifestHash;
    const json = f.objects.get(paths.jsonPath); const manifest = JSON.parse(json.bytes);
    if (mutation === 'hash') manifest.lerntextHash = '0'.repeat(64);
    if (mutation === 'title') manifest.titel = 'Andere';
    if (mutation === 'subject') manifest.fach = 'Recht';
    if (mutation === 'mp3Path') manifest.mp3Path = 'podcast/other.mp3';
    if (mutation === 'jsonPath') manifest.jsonPath = 'podcast/other.json';
    if (mutation === 'coverage') manifest.wortZeitmarken = [];
    if (mutation === 'word') manifest.wortZeitmarken[0].wort = 'Andere';
    if (mutation === 'negative') manifest.wortZeitmarken[0].start = -1;
    if (mutation === 'backward') manifest.wortZeitmarken[0].end = -1;
    if (mutation === 'duration') manifest.wortZeitmarken[0].end = 50;
    json.bytes = Buffer.from(JSON.stringify(manifest));
    if (mutation === 'size') {
      const original = f.bucket.file; f.bucket.file = (name, opts) => { const file = original(name, opts); return { ...file,
        getMetadata: async () => { const result = await file.getMetadata(); result[0].size = '999'; return result; } }; };
    }
    if (mutation === 'generation') mp3.generation = undefined;
    await assert.rejects(build(f)); assert.deepEqual(fs.readdirSync(f.workDir), ['keep.txt']);
  });
}

for (const stage of ['source', 'encode', 'decode', 'one-sample']) test('cleans aggregate and output on ' + stage + ' failure', async t => {
  const f = fixture(t); const real = f.ffmpeg;
  f.ffmpeg = async args => {
    const index = f.calls.length;
    if ((stage === 'source' && index === 1) || (stage === 'encode' && index === 2) || (stage === 'decode' && index === 3)) throw new Error('ffmpeg failed');
    await real(args);
    if (stage === 'one-sample' && index === 3) fs.appendFileSync(args.at(-1), Buffer.alloc(2));
  };
  await assert.rejects(build(f)); assert.deepEqual(fs.readdirSync(f.workDir), ['keep.txt']);
});

test('publishes MP3 first and sidecar last with CAS, tokens and exact byte hash; reads both back', async t => {
  const f = fixture(t); const bundle = await build(f);
  const result = await publish(f, bundle);
  assert.deepEqual(f.events.map(e => e.name), [bundle.sidecar.mp3Path, 'podcast/continuous/steuern.json']);
  assert.equal(f.events[0].opts.preconditionOpts.ifGenerationMatch, 0);
  assert.equal(f.events[0].opts.metadata.metadata.manifestHash, hash(bundle.sidecarBytes));
  assert.match(f.events[0].opts.metadata.metadata.firebaseStorageDownloadTokens, /^[0-9a-f-]{36}$/);
  assert.equal(result.manifestHash, hash(bundle.sidecarBytes));
  assert.ok(f.reads.some(r => r.name === result.sidecarPath));
  assert.ok(f.events.every(e => e.name.startsWith('podcast/continuous/')));
});

for (const failure of ['upload', 'download', 'bytes', 'contentType', 'token', 'bundleHash', 'manifestHash', 'api', 'mp3Generation', 'jsonGeneration', 'historicalBytes', 'historicalJsonBytes']) {
  test('suppresses sidecar after MP3/revalidation failure: ' + failure, async t => {
    const f = fixture(t); delete f.objects.get(source(f).mp3Path).metadata.manifestHash;
    const bundle = await build(f); const original = f.bucket.file;
    f.bucket.file = (name, opts) => { const file = original(name, opts); return { ...file,
      async download() { if (name === bundle.sidecar.mp3Path && failure === 'download') throw new Error('read failed'); return file.download(); },
      async save(bytes, options) {
        if (name === bundle.sidecar.mp3Path && failure === 'upload') throw new Error('upload failed');
        await file.save(bytes, options);
        if (name !== bundle.sidecar.mp3Path) return;
        const object = f.objects.get(name);
        if (failure === 'bytes') object.bytes = Buffer.from('bad');
        if (failure === 'contentType') object.contentType = 'text/plain';
        if (failure === 'token') delete object.metadata.firebaseStorageDownloadTokens;
        if (failure === 'bundleHash') object.metadata.bundleHash = '0'.repeat(64);
        if (failure === 'manifestHash') object.metadata.manifestHash = '0'.repeat(64);
        if (failure === 'api') f.catalog[0].lerntext = 'changed';
        if (failure === 'mp3Generation') f.objects.get(source(f).mp3Path).generation = '99';
        if (failure === 'jsonGeneration') f.objects.get(source(f).jsonPath).generation = '99';
        if (failure === 'historicalBytes') f.objects.get(source(f).mp3Path).bytes = Buffer.from('change');
        if (failure === 'historicalJsonBytes') f.objects.get(source(f).jsonPath).bytes = Buffer.from('{}');
      }
    }; };
    await assert.rejects(publish(f, bundle));
    assert.equal(f.events.some(e => e.name.endsWith('steuern.json')), false);
  });
}

test('publisher requires API reload and rejects stale source before any upload', async t => {
  const f = fixture(t); const bundle = await build(f);
  await assert.rejects(builder.publishSubjectBundle({ ...f, bundle, loadCatalog: undefined }), /Katalog|loadCatalog/);
  f.catalog.pop(); await assert.rejects(publish(f, bundle), /Fachliste|Katalog/);
  assert.equal(f.events.length, 0);
});

test('orchestrator loads full catalog before filtering, validates all collisions, builds sequentially and reports/cleans failures', async t => {
  const f = fixture(t); const g = fixture(t, 'Recht', 1); const catalog = [...f.catalog, ...g.catalog];
  for (const [key, value] of g.objects) f.objects.set(key, value);
  let loads = 0, active = 0, maximum = 0; const order = [];
  const result = await cli.syncBundles({ bucket: f.bucket, workDir: f.workDir, dryRun: true, probeAudio: f.probeAudio,
    loadCatalog: async (...args) => { assert.equal(args.length, 0); loads++; return catalog; },
    buildBundle: async options => { active++; maximum = Math.max(maximum, active); order.push(options.fach);
      try { if (options.fach === 'Recht') throw new Error('source failed'); return await builder.buildSubjectBundle({ ...options, ffmpeg: f.ffmpeg }); }
      finally { active--; }
    }
  });
  assert.equal(loads, 1); assert.equal(maximum, 1);
  assert.deepEqual(order, ['Recht', 'Steuern']);
  assert.deepEqual(result.subjects.map(s => s.status), ['FAILED', 'DRY_RUN']);
  assert.equal(result.subjects[1].chapters, 2); assert.equal(result.subjects[1].words, 2);
  assert.deepEqual(fs.readdirSync(f.workDir), ['keep.txt']); assert.equal(f.events.length, 0);
  const invalid = [...catalog, { ...f.catalog[0], titel: 'Kapitel-1' }];
  await assert.rejects(cli.syncBundles({ ...f, onlySubject: 'Recht', loadCatalog: async () => invalid }), /kollision/i);
});

test('CLI parses exact subject, rejects unit filtering and emits JSON report', async () => {
  const lines = []; const loads = [];
  const result = await cli.runCli(['--only-subject', 'Steuern', '--dry-run'], {
    sync: async options => { loads.push(options); return { subjects: [], failed: 0 }; },
    createAdminClient: async () => ({ storage: () => ({ bucket: () => ({}) }) }),
    write: line => lines.push(line)
  });
  assert.equal(loads[0].onlySubject, 'Steuern'); assert.equal(loads[0].dryRun, true);
  assert.deepEqual(JSON.parse(lines[0]), result);
  await assert.rejects(cli.runCli(['--only', 'Steuern / Kapitel 1']), /Argument/);
  await assert.rejects(cli.runCli(['--only-subject']), /Argument/);
});

test('Bundle-Orchestrator propagates the exact staging target prefix through build, publish and report', async t => {
  const f = fixture(t);
  const targetPrefix = 'podcast/staging/lerntext-rev2/';
  f.withLock = async (_bucket, key, action) => {
    assert.equal(key, targetPrefix + 'continuous/steuern.json');
    return action();
  };
  const seen = [];
  const result = await cli.syncBundles({ ...f, targetPrefix,
    buildBundle: async options => {
      seen.push(['build', options.targetPrefix]);
      return builder.buildSubjectBundle({ ...options, ffmpeg: f.ffmpeg, lerntexte: options.catalog });
    },
    publishBundle: async options => {
      seen.push(['publish', options.targetPrefix]);
      return builder.publishSubjectBundle(options);
    }
  });
  assert.deepEqual(seen, [['build', targetPrefix], ['publish', targetPrefix]]);
  assert.equal(result.failed, 0);
  assert.equal(result.subjects[0].sidecarPath, targetPrefix + 'continuous/steuern.json');
  assert.ok(f.events.every(event => event.name.startsWith(targetPrefix)));
});

test('CLI accepts only the approved staging target prefix', async () => {
  const targetPrefix = 'podcast/staging/lerntext-rev2/';
  const calls = [];
  await cli.runCli(['--dry-run', '--target-prefix', targetPrefix], {
    createAdminClient: async () => ({ storage: () => ({ bucket: () => ({}) }) }),
    sync: async options => { calls.push(options); return { subjects: [], failed: 0 }; },
    write() {}
  });
  assert.equal(calls[0].targetPrefix, targetPrefix);
  await assert.rejects(cli.runCli(['--dry-run', '--target-prefix', 'podcast/'], {
    createAdminClient: async () => { throw new Error('must not access storage'); }
  }), /Staging|Präfix|Ziel/i);
});

test('complete API loader rejects empty and foreign subject responses, including an unselected subject', async () => {
  for (const broken of ['empty', 'foreign']) {
    const fetchImpl = async url => {
      const params = new URL(url).searchParams;
      return { ok: true, json: async () => ({ success: true, data: params.get('action') === 'subjects' ? ['Steuern'] :
        params.get('fach') === 'Steuern' ? [{ fach: 'Steuern' }] : broken === 'empty' ? [] : [{ fach: 'Recht' }] }) };
    };
    await assert.rejects(cli.loadBundleCatalog({ apiUrl: 'https://example.test/api', fetchImpl }), /Fachliste/);
  }
});

test('complete API loader fetches every discovered and supplementary subject without unit filtering', async () => {
  const requests = [];
  const catalog = await cli.loadBundleCatalog({ apiUrl: 'https://example.test/api', fetchImpl: async url => {
    const params = new URL(url).searchParams; requests.push(params.get('fach'));
    return { ok: true, json: async () => ({ success: true, data: params.get('action') === 'subjects' ? ['Steuern'] : [{ fach: params.get('fach') }] }) };
  } });
  assert.deepEqual(requests, [null, 'Steuern', 'Betriebliches Rechnungswesen und Controlling', 'Investition und Finanzierung']);
  assert.equal(catalog.length, 3);
});

for (const field of ['wort', 'end']) test('publisher rejects mutated sidecar word data: ' + field, async t => {
  const f = fixture(t); const bundle = await build(f);
  bundle.sidecar.chapters[0].wortZeitmarken[0][field] = field === 'wort' ? 'Wrong' : 0.1;
  bundle.sidecarBytes = Buffer.from(JSON.stringify(bundle.sidecar));
  await assert.rejects(publish(f, bundle), /Wort|wort/);
  assert.equal(f.events.length, 0);
});

test('publisher checks MP3 metadata again after source revalidation, even if generation is unchanged', async t => {
  const f = fixture(t); const bundle = await build(f); let loads = 0;
  f.loadCatalog = async () => {
    if (++loads === 2) f.objects.get(bundle.sidecar.mp3Path).metadata.manifestHash = '0'.repeat(64);
    return f.catalog;
  };
  await assert.rejects(publish(f, bundle), /Hash|Metadaten/);
  assert.equal(f.events.some(e => e.name.endsWith('steuern.json')), false);
});

test('resumes with valid immutable MP3 and replaces existing sidecar only under its captured generation', async t => {
  const f = fixture(t); const bundle = await build(f);
  await publish(f, bundle);
  f.events.length = 0;
  await publish(f, bundle);
  assert.deepEqual(f.events.map(e => e.name), ['podcast/continuous/steuern.json']);
  assert.equal(f.events[0].opts.preconditionOpts.ifGenerationMatch, '12');
});

test('sidecar CAS conflict preserves the concurrently published version', async t => {
  const f = fixture(t); const bundle = await build(f); const original = f.bucket.file;
  f.bucket.file = (name, opts) => { const file = original(name, opts); return { ...file,
    async save(bytes, options) {
      if (name.endsWith('steuern.json')) {
        f.objects.set(name, { bytes: Buffer.from('concurrent'), generation: '99' });
      }
      return file.save(bytes, options);
    }
  }; };
  await assert.rejects(publish(f, bundle));
  assert.equal(f.objects.get('podcast/continuous/steuern.json').bytes.toString(), 'concurrent');
});

test('reports final sidecar readback failure instead of claiming publication verified', async t => {
  const f = fixture(t); const bundle = await build(f); const original = f.bucket.file;
  f.bucket.file = (name, opts) => { const file = original(name, opts); return { ...file,
    async download() { if (name.endsWith('steuern.json')) throw new Error('final readback failed'); return file.download(); }
  }; };
  await assert.rejects(publish(f, bundle), /final readback failed/);
});

test('subject slug collisions outside selected subject abort the entire catalog', async t => {
  const f = fixture(t);
  const catalog = [...f.catalog, { ...f.catalog[0], fach: 'Stéuern', titel: 'Extra' }];
  await assert.rejects(cli.syncBundles({ ...f, onlySubject: 'Steuern', loadCatalog: async () => catalog }), /Fach-Pfadkollision/);
});

test('direct builder and publish reload reject global collisions even outside the selected subject', async t => {
  const f = fixture(t); const invalid = [...f.catalog, { ...f.catalog[0], fach: 'Stéuern', titel: 'Extra' }];
  await assert.rejects(builder.buildSubjectBundle({ ...f, catalog: invalid }), /kollision/);
  const bundle = await build(f);
  f.loadCatalog = async () => invalid;
  await assert.rejects(publish(f, bundle), /kollision/);
  assert.equal(f.events.length, 0);
});

async function publishedFixture(t) {
  const f = fixture(t); const bundle = await build(f); await publish(f, bundle);
  // Keep the published objects, but remove local build artifacts before verification.
  fs.rmSync(bundle.workDir, { recursive: true, force: true });
  f.events.length = 0; f.calls.length = 0; f.reads.length = 0;
  return { ...f, bundle };
}

test('verify-only validates published hashes, complete current entries and full decode without build or writes', async t => {
  const f = await publishedFixture(t);
  const result = await cli.syncBundles({ ...f, verifyOnly: true,
    buildBundle: async () => { throw new Error('must not build'); },
    publishBundle: async () => { throw new Error('must not publish'); } });
  assert.equal(result.failed, 0); assert.equal(result.verifyOnly, true);
  const report = result.subjects[0];
  assert.equal(report.status, 'VERIFIED'); assert.equal(report.decodeStatus, 'VERIFIED');
  assert.equal(report.chapters, 2); assert.equal(report.words, 2);
  assert.equal(report.sampleCount, 8820); assert.equal(report.decodedSamples, 8820);
  assert.equal(report.duration, 0.4); assert.equal(report.bytes, Buffer.byteLength('bundle-Steuern'));
  assert.equal(report.bundleHash, f.bundle.sidecar.bundleHash);
  assert.equal(report.manifestHash, hash(f.bundle.sidecarBytes));
  assert.equal(report.sidecarPath, 'podcast/continuous/steuern.json');
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].includes('libmp3lame'), false);
  assert.ok(f.calls[0].includes('-xerror')); assert.equal(f.calls[0][f.calls[0].indexOf('-ar') + 1], '22050');
  assert.ok(f.reads.every(read => read.generation !== undefined));
  assert.equal(f.events.length, 0); assert.deepEqual(fs.readdirSync(f.workDir), ['keep.txt']);
});

for (const failure of ['sidecarBytes', 'mp3Bytes', 'manifestHash', 'bundleHash', 'sidecarType', 'mp3Type',
  'sidecarToken', 'mp3Token', 'path', 'count', 'identity', 'wordCoverage', 'word', 'api', 'decode', 'samples', 'generation']) {
  test('verify-only fails without writes or leftover files: ' + failure, async t => {
    const f = await publishedFixture(t);
    const sidecar = f.objects.get('podcast/continuous/steuern.json'), mp3 = f.objects.get(f.bundle.sidecar.mp3Path);
    const manifest = JSON.parse(sidecar.bytes);
    if (failure === 'sidecarBytes') sidecar.bytes = Buffer.from('{');
    if (failure === 'mp3Bytes') mp3.bytes = Buffer.from('corrupt');
    if (failure === 'manifestHash') mp3.metadata.manifestHash = '0'.repeat(64);
    if (failure === 'bundleHash') mp3.metadata.bundleHash = '0'.repeat(64);
    if (failure === 'sidecarType') sidecar.contentType = 'text/plain';
    if (failure === 'mp3Type') mp3.contentType = 'text/plain';
    if (failure === 'sidecarToken') delete sidecar.metadata.firebaseStorageDownloadTokens;
    if (failure === 'mp3Token') delete mp3.metadata.firebaseStorageDownloadTokens;
    if (failure === 'path') manifest.mp3Path = 'podcast/legacy.mp3';
    if (failure === 'count') manifest.chapters.pop();
    if (failure === 'identity') manifest.chapters[0].titel = 'Wrong';
    if (failure === 'wordCoverage') manifest.chapters[0].wortZeitmarken.push({ wortIndex: 1, wort: 'Wrong', start: 0.2, end: 0.2 });
    if (failure === 'word') manifest.chapters[0].wortZeitmarken[0].wort = 'Wrong';
    if (['path', 'count', 'identity', 'wordCoverage', 'word'].includes(failure)) {
      sidecar.bytes = Buffer.from(JSON.stringify(manifest)); mp3.metadata.manifestHash = hash(sidecar.bytes);
    }
    if (failure === 'api') f.catalog[0].lerntext = 'Changed';
    if (failure === 'decode') f.ffmpeg = async () => { throw new Error('decode failed'); };
    if (failure === 'samples') { const original = f.ffmpeg; f.ffmpeg = async args => { await original(args); fs.appendFileSync(args.at(-1), Buffer.alloc(2)); }; }
    if (failure === 'generation') sidecar.generation = undefined;
    const result = await cli.syncBundles({ ...f, verifyOnly: true });
    assert.equal(result.failed, 1); assert.equal(result.subjects[0].status, 'FAILED');
    assert.equal(typeof result.subjects[0].error, 'string');
    assert.equal(f.events.length, 0); assert.deepEqual(fs.readdirSync(f.workDir), ['keep.txt']);
  });
}

test('verify-only audits entire catalog before exact subject selection and continues after a missing published subject', async t => {
  const f = await publishedFixture(t);
  const catalog = [...f.catalog, { ...f.catalog[0], fach: 'Recht' }];
  let loads = 0;
  const options = { ...f, verifyOnly: true, loadCatalog: async (...args) => { assert.equal(args.length, 0); loads++; return catalog; } };
  const result = await cli.syncBundles(options);
  assert.equal(loads, 1);
  assert.deepEqual(result.subjects.map(row => [row.fach, row.status]), [['Recht', 'FAILED'], ['Steuern', 'VERIFIED']]);
  const selected = await cli.syncBundles({ ...options, onlySubject: 'Steuern' });
  assert.equal(selected.subjects.length, 1); assert.equal(selected.failed, 0);
  catalog.push({ ...f.catalog[0], fach: 'Stéuern', titel: 'Extra' });
  await assert.rejects(cli.syncBundles({ ...options, onlySubject: 'Steuern' }), /kollision/);
  assert.equal(f.events.length, 0);
});

test('CLI verify-only reports verification and nonzero failure, and rejects dry-run combination before access', async t => {
  const previousExitCode = process.exitCode; t.after(() => { process.exitCode = previousExitCode; });
  const lines = []; let calls = 0;
  const adapters = { createAdminClient: async () => { calls++; return { storage: () => ({ bucket: () => ({}) }) }; },
    sync: async options => { assert.equal(options.verifyOnly, true); return { failed: 1, subjects: [{ status: 'FAILED' }] }; },
    write: line => lines.push(line) };
  await cli.runCli(['--verify-only'], adapters);
  assert.equal(process.exitCode, 1); assert.equal(JSON.parse(lines[0]).failed, 1);
  await assert.rejects(cli.runCli(['--verify-only', '--dry-run'], adapters), /kombiniert|Argument/);
  await assert.rejects(cli.runCli(['--dry-run', '--verify-only'], adapters), /kombiniert|Argument/);
  await assert.rejects(cli.syncBundles({ dryRun: true, verifyOnly: true, loadCatalog: async () => { throw new Error('must not load'); } }), /kombiniert|Argument/);
  assert.equal(calls, 1);
});

for (const changed of ['sidecar', 'mp3Metadata']) test('verify-only rejects concurrent object changes during full decode: ' + changed, async t => {
  const f = await publishedFixture(t); const decode = f.ffmpeg;
  f.ffmpeg = async args => {
    await decode(args);
    if (changed === 'sidecar') f.objects.get('podcast/continuous/steuern.json').generation = '99';
    else f.objects.get(f.bundle.sidecar.mp3Path).metadata.manifestHash = '0'.repeat(64);
  };
  const result = await cli.syncBundles({ ...f, verifyOnly: true });
  assert.equal(result.failed, 1); assert.match(result.subjects[0].error, /Generation|Metadaten/);
  assert.equal(f.events.length, 0); assert.deepEqual(fs.readdirSync(f.workDir), ['keep.txt']);
});
