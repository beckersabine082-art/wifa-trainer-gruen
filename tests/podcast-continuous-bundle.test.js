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
  const withLock = async (_bucket, key, action) => { assert.equal(key, `podcast/continuous/${fach.toLowerCase()}.json`); return action(); };
  return { fach, catalog, objects, bucket, workDir, ffmpeg, calls, pcms, events, reads, loadCatalog, withLock };
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
  const result = await cli.syncBundles({ bucket: f.bucket, workDir: f.workDir, dryRun: true,
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
