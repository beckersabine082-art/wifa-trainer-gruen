'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  STAGING_PODCAST_PREFIX,
  assertStagingWriteTargets,
  continuousPodcastPaths,
  podcastPaths,
  sha256Lerntext
} = require('./hash-paths');
const { syncAll, loadLerntexteReadOnly, createAdminClient } = require('./sync-all');
const { buildSubjectBundle, publishSubjectBundle, readValidatedSource,
  probeAudioProperties } = require('./continuous-bundle');
const { verifySubjectBundle } = require('./sync-bundles');

const DEFAULT_EXPECTED = Object.freeze({
  ids: 521,
  subjects: 13,
  chapters: 48,
  reused: 479,
  regenerated: 42,
  pathMigrations: 4
});

const DEFAULT_BUNDLE_VERSION = 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1';

function text(value) {
  return String(value ?? '').trim();
}

function uniqueIndex(items, label) {
  if (!Array.isArray(items)) throw new Error(label + ': Liste fehlt');
  const index = new Map();
  for (const item of items) {
    const id = text(item?.id);
    if (!id) throw new Error(label + ': ID fehlt');
    if (index.has(id)) throw new Error(label + ': ID doppelt: ' + id);
    index.set(id, item);
  }
  return index;
}

function flattenOrderManifest(orderManifest) {
  if (!Array.isArray(orderManifest?.subjects)) throw new Error('Reihenfolgemanifest: Fächer fehlen');
  const entries = [];
  const subjects = [];
  let chapterCount = 0;
  for (const subject of orderManifest.subjects) {
    const fach = text(subject?.fach);
    if (!fach || !Array.isArray(subject.chapters) || !subject.chapters.length) {
      throw new Error('Reihenfolgemanifest: Fach oder Kapitel fehlt');
    }
    subjects.push(fach);
    for (const chapter of subject.chapters) {
      const chapterKey = text(chapter?.chapterKey);
      if (!chapterKey || !Array.isArray(chapter.entries) || !chapter.entries.length) {
        throw new Error(fach + ': chapterKey oder Kapiteleinträge fehlen');
      }
      chapterCount += 1;
      for (let chapterIndex = 0; chapterIndex < chapter.entries.length; chapterIndex++) {
        const orderEntry = chapter.entries[chapterIndex];
        entries.push({
          id: text(orderEntry?.id),
          fach,
          chapterKey,
          chapterNumber: text(chapter.chapterNumber),
          chapterTitle: text(chapter.chapterTitle),
          ordinalInFach: Number(orderEntry.ordinalInFach),
          ordinalInChapter: Number(orderEntry.ordinalInChapter || chapterIndex + 1),
          sourceSortKey: Number(orderEntry.sortKey)
        });
      }
    }
  }
  uniqueIndex(entries, 'Reihenfolgemanifest');
  return { entries, subjects, chapterCount };
}

function yes(value) {
  return text(value).toLowerCase() === 'ja';
}

function requireCount(actual, expected, label) {
  if (actual !== expected) throw new Error(label + ': erwartete Anzahl ' + expected + ', tatsächlich ' + actual);
}

function requireManifestValue(id, label, actual, expected) {
  if (text(actual) !== text(expected)) {
    throw new Error(id + ': ' + label + ' weicht vom freigegebenen Reihenfolgemanifest ab');
  }
}

function bundleTargetSpec(fach, targetPrefix) {
  const paths = continuousPodcastPaths(fach, { prefix: targetPrefix });
  return {
    kind: 'bundle-mp3',
    fach,
    pathPrefix: paths.mp3Prefix,
    suffix: '.mp3',
    hashAlgorithm: 'sha256',
    hashHexLength: 64
  };
}

function assertBundleTargetMatches(storagePath, spec) {
  if (!spec || spec.kind !== 'bundle-mp3' || !text(spec.pathPrefix)) {
    throw new Error('Bundle-Zielmuster fehlt');
  }
  const candidate = text(storagePath).replace(/\\/g, '/');
  const prefix = text(spec.pathPrefix).replace(/\\/g, '/');
  const suffix = text(spec.suffix);
  const relative = candidate.startsWith(prefix) ? candidate.slice(prefix.length) : '';
  const expectedLength = Number(spec.hashHexLength);
  const hash = suffix && relative.endsWith(suffix) ? relative.slice(0, -suffix.length) : '';
  if (!candidate.startsWith(STAGING_PODCAST_PREFIX) || !relative ||
      !Number.isInteger(expectedLength) || expectedLength < 1 ||
      hash.length !== expectedLength || !/^[a-f0-9]+$/.test(hash) ||
      relative !== hash + suffix) {
    throw new Error('Bundle-Ziel entspricht nicht dem vorab freigegebenen Staging-Hashmuster: ' + candidate);
  }
  return candidate;
}

function createMigrationPlan({ catalog, inventory, orderManifest,
  targetPrefix = STAGING_PODCAST_PREFIX,
  bundleVersion = DEFAULT_BUNDLE_VERSION,
  expected = DEFAULT_EXPECTED } = {}) {
  if (targetPrefix !== STAGING_PODCAST_PREFIX) {
    throw new Error('Zielpräfix muss das freigegebene Staging-Präfix sein');
  }
  if (!text(bundleVersion)) throw new Error('Bundle-Version fehlt');
  const catalogIndex = uniqueIndex(catalog, 'Lerntext-Katalog');
  const inventoryItems = Array.isArray(inventory) ? inventory : inventory?.items;
  const inventoryIndex = uniqueIndex(inventoryItems, 'Podcast-Inventar');
  const ordered = flattenOrderManifest(orderManifest);

  requireCount(catalogIndex.size, expected.ids, 'Katalog-IDs');
  requireCount(inventoryIndex.size, expected.ids, 'Inventar-IDs');
  requireCount(ordered.entries.length, expected.ids, 'Reihenfolge-IDs');
  requireCount(ordered.subjects.length, expected.subjects, 'Fächer');
  requireCount(ordered.chapterCount, expected.chapters, 'sichtbare Kapitel');

  const entries = ordered.entries.map(order => {
    const catalogEntry = catalogIndex.get(order.id);
    const item = inventoryIndex.get(order.id);
    if (!catalogEntry || !item) throw new Error(order.id + ': ID fehlt in Katalog oder Inventar');
    if (text(catalogEntry.fach) !== order.fach) throw new Error(order.id + ': Fach weicht vom Reihenfolgemanifest ab');
    if (!Number.isFinite(order.sourceSortKey)) throw new Error(order.id + ': Sortierschlüssel fehlt im Reihenfolgemanifest');
    requireManifestValue(order.id, 'Fachreihenfolge', catalogEntry.reihenfolgeFach, order.sourceSortKey);
    requireManifestValue(order.id, 'Kapitelnummer', catalogEntry.hauptkapitelNr, order.chapterNumber);
    requireManifestValue(order.id, 'Kapitelbezeichnung', catalogEntry.hauptkapitel, order.chapterTitle);
    if (text(item.fach) && text(item.fach) !== order.fach) throw new Error(order.id + ': Inventar-Fach weicht ab');
    if (text(item.titel) && text(item.titel) !== text(catalogEntry.titel)) throw new Error(order.id + ': Inventar-Titel weicht ab');
    const actualTextHash = sha256Lerntext(catalogEntry.lerntext);
    if (actualTextHash !== text(item.neuerTextHash)) throw new Error(order.id + ': Text-Hash weicht vom freigegebenen Inventar ab');

    const regenerated = yes(item.ttsNeuerzeugungErforderlich);
    const pathMigration = yes(item.pfadGeaendert);
    if (regenerated && yes(item.vorhandenesVerwendbaresAudio)) throw new Error(order.id + ': widersprüchliche Audioentscheidung');
    let sourceEntry;
    let sourcePaths;
    let origin;
    if (regenerated) {
      origin = 'regenerated';
      sourceEntry = { ...catalogEntry };
      sourcePaths = podcastPaths(catalogEntry.fach, catalogEntry.titel, { prefix: targetPrefix });
    } else {
      if (!yes(item.vorhandenesVerwendbaresAudio)) throw new Error(order.id + ': weder wiederverwendbar noch neu zu erzeugen');
      origin = 'reused';
      if (pathMigration) {
        const sourceMp3 = text(item.quellpfad);
        if (!sourceMp3 || !sourceMp3.endsWith('.mp3')) throw new Error(order.id + ': alter Quellpfad ungültig');
        sourcePaths = { mp3Path: sourceMp3, jsonPath: sourceMp3.slice(0, -4) + '.json' };
        sourceEntry = { ...catalogEntry, fach: text(item.alteFachzuordnung), titel: text(item.alterTitel) };
        if (!sourceEntry.fach || !sourceEntry.titel) throw new Error(order.id + ': alte Audioidentität fehlt');
      } else {
        const canonical = podcastPaths(catalogEntry.fach, catalogEntry.titel);
        if (text(item.quellpfad) !== canonical.mp3Path) throw new Error(order.id + ': produktiver Quellpfad weicht ab');
        sourcePaths = canonical;
        sourceEntry = { ...catalogEntry };
      }
    }
    return {
      ...order,
      id: order.id,
      catalogEntry: {
        ...catalogEntry,
        chapterKey: order.chapterKey,
        hauptkapitelNr: order.chapterNumber,
        hauptkapitel: order.chapterTitle,
        reihenfolgeFach: order.ordinalInFach,
        reihenfolgeKapitel: order.ordinalInChapter
      },
      sourceEntry,
      sourcePaths,
      origin,
      pathMigration,
      expectedTextHash: actualTextHash
    };
  });

  const reused = entries.filter(entry => entry.origin === 'reused');
  const regenerated = entries.filter(entry => entry.origin === 'regenerated');
  const pathMigrations = entries.filter(entry => entry.pathMigration);
  requireCount(reused.length, expected.reused, 'wiederverwendete Audios');
  requireCount(regenerated.length, expected.regenerated, 'neu erzeugte Audios');
  requireCount(pathMigrations.length, expected.pathMigrations, 'Pfadmigrationen');

  const regeneratedTargets = regenerated.flatMap(entry => Object.values(
    podcastPaths(entry.catalogEntry.fach, entry.catalogEntry.titel, { prefix: targetPrefix })
  ));
  const bundleTargets = ordered.subjects.map(fach => continuousPodcastPaths(fach, { prefix: targetPrefix }).sidecarPath);
  const writeTargets = [...regeneratedTargets, ...bundleTargets];
  assertStagingWriteTargets(writeTargets, {
    targetPrefix,
    // Regenerated segment targets intentionally become bundle sources after
    // the TTS phase. Only immutable production sources must be disjoint from
    // the Staging write set.
    sourcePaths: reused.flatMap(entry => Object.values(entry.sourcePaths))
  });
  const writeTargetSpecs = [
    ...regeneratedTargets.map(storagePath => ({ kind: 'exact', path: storagePath })),
    ...bundleTargets.map(storagePath => ({ kind: 'exact', path: storagePath })),
    ...ordered.subjects.map(fach => bundleTargetSpec(fach, targetPrefix))
  ];
  // Content-addressed bundle names are only known after the single final
  // encode. Their complete namespace is nevertheless closed and validated
  // before the first write: one SHA-256 MP3 slot per approved subject.
  const representativePatternTargets = writeTargetSpecs
    .filter(spec => spec.kind === 'bundle-mp3')
    .map(spec => assertBundleTargetMatches(spec.pathPrefix + '0'.repeat(spec.hashHexLength) + spec.suffix, spec));
  assertStagingWriteTargets([...writeTargets, ...representativePatternTargets], {
    targetPrefix,
    sourcePaths: reused.flatMap(entry => Object.values(entry.sourcePaths))
  });

  return {
    bundleVersion,
    targetPrefix,
    entries,
    subjects: [...ordered.subjects],
    regeneratedEntries: regenerated.map(entry => entry.catalogEntry),
    reusedEntries: reused.map(entry => entry.catalogEntry),
    pathMigrationEntries: pathMigrations.map(entry => entry.catalogEntry),
    writeTargets,
    writeTargetSpecs,
    counts: {
      ids: entries.length,
      subjects: ordered.subjects.length,
      chapters: ordered.chapterCount,
      reused: reused.length,
      regenerated: regenerated.length,
      pathMigrations: pathMigrations.length
    }
  };
}

function createSourceResolver(plan) {
  const index = uniqueIndex(plan?.entries, 'Migrationsplan');
  return entry => {
    const id = text(entry?.id);
    const planned = index.get(id);
    if (!planned) throw new Error(id + ': nicht im Migrationsplan');
    return { sourceEntry: planned.sourceEntry, paths: planned.sourcePaths, origin: planned.origin };
  };
}

function readJson(filePath, label) {
  let value;
  try { value = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { throw new Error(label + ' konnte nicht gelesen werden: ' + error.message); }
  return value;
}

function propertySignature(properties) {
  return JSON.stringify({ codec: properties.codec, profile: properties.profile,
    sampleRateHz: properties.sampleRateHz, channels: properties.channels,
    bitrateKbps: properties.bitrateKbps, encoder: properties.encoder,
    startTimeSeconds: properties.startTimeSeconds });
}

async function auditReusableSources({ plan, bucket, workDir,
  probeAudio = probeAudioProperties, onStatus = () => {} } = {}) {
  if (!plan || !Array.isArray(plan.entries) || !bucket) throw new Error('Quell-Audit benötigt Plan und Bucket');
  const root = fs.mkdtempSync(path.join(workDir || os.tmpdir(), 'podcast-reuse-audit-'));
  const properties = [];
  try {
    for (let index = 0; index < plan.entries.length; index++) {
      const entry = plan.entries[index];
      if (entry.origin !== 'reused') continue;
      const source = await readValidatedSource(bucket, entry.sourceEntry, {
        paths: entry.sourcePaths,
        origin: entry.origin
      });
      const localPath = path.join(root, 'source-' + index + '.mp3');
      try {
        fs.writeFileSync(localPath, source.mp3Bytes);
        const audio = await probeAudio(localPath);
        properties.push({ id: entry.id, fach: entry.fach, paths: entry.sourcePaths,
          mp3Hash: source.receipt.mp3Hash, jsonHash: source.receipt.jsonHash,
          generations: source.receipt.generations, audio });
        onStatus({ phase: 'REUSE_AUDIT', current: properties.length, total: plan.counts.reused, id: entry.id });
      } finally {
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  requireCount(properties.length, plan.counts.reused, 'geprüfte Wiederverwendungsquellen');
  const distribution = {};
  for (const item of properties) {
    const signature = propertySignature(item.audio);
    distribution[signature] = (distribution[signature] || 0) + 1;
  }
  return { count: properties.length, uniform: Object.keys(distribution).length === 1,
    distribution, properties };
}

async function loadApprovedPlan({ apiUrl, inventoryPath, orderManifestPath,
  targetPrefix = STAGING_PODCAST_PREFIX, bundleVersion = DEFAULT_BUNDLE_VERSION,
  expected = DEFAULT_EXPECTED, fetchImpl } = {}) {
  const [catalog, inventory, orderManifest] = await Promise.all([
    loadLerntexteReadOnly({ apiUrl, fetchImpl }),
    Promise.resolve(readJson(inventoryPath, 'Podcast-Inventar')),
    Promise.resolve(readJson(orderManifestPath, 'Lerntext-Reihenfolgemanifest'))
  ]);
  return createMigrationPlan({ catalog, inventory, orderManifest, targetPrefix, bundleVersion, expected });
}

async function runStagingMigration({ apiUrl, inventoryPath, orderManifestPath,
  targetPrefix = STAGING_PODCAST_PREFIX, bundleVersion = DEFAULT_BUNDLE_VERSION,
  expected = DEFAULT_EXPECTED, dryRun = false, adminClient, workDir,
  ffmpeg, probeAudio, onStatus = () => {} } = {}) {
  if (targetPrefix !== STAGING_PODCAST_PREFIX) throw new Error('Nur das freigegebene Staging-Ziel ist zulässig');
  const client = adminClient || await createAdminClient();
  const bucket = client.storage().bucket();
  const root = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-staging-rev2-'));
  let ownsRoot = !workDir;
  try {
    const plan = await loadApprovedPlan({ apiUrl, inventoryPath, orderManifestPath,
      targetPrefix, bundleVersion, expected });
    onStatus({ phase: 'PLAN_VALID', counts: plan.counts });
    const reuseAudit = await auditReusableSources({ plan, bucket, workDir: root, probeAudio, onStatus });
    onStatus({ phase: 'REUSE_VALID', count: reuseAudit.count, uniform: reuseAudit.uniform });
    const baseReport = { schemaVersion: 1, bundleVersion, targetPrefix, dryRun,
      plan: plan.counts, reuseAudit: { count: reuseAudit.count, uniform: reuseAudit.uniform,
        distribution: reuseAudit.distribution }, writeTargetSlots: plan.writeTargetSpecs.length, subjects: [] };
    if (dryRun) return baseReport;

    const generated = await syncAll({ lerntexte: plan.regeneratedEntries, adminClient: client,
      tempDir: root, sourcePrefix: 'podcast/', targetPrefix, onStatus });
    if (generated.failed.length) throw new Error('TTS-Erzeugung fehlgeschlagen: ' + JSON.stringify(generated.failed));
    const targetReady = await Promise.all(plan.regeneratedEntries.map(async entry => {
      const paths = podcastPaths(entry.fach, entry.titel, { prefix: targetPrefix });
      const [mp3Exists, jsonExists] = await Promise.all([bucket.file(paths.mp3Path).exists(), bucket.file(paths.jsonPath).exists()]);
      return Boolean(mp3Exists[0] && jsonExists[0]);
    }));
    requireCount(targetReady.filter(Boolean).length, plan.counts.regenerated, 'verfügbare neu erzeugte Staging-Segmente');

    const buildPlan = await loadApprovedPlan({ apiUrl, inventoryPath, orderManifestPath,
      targetPrefix, bundleVersion, expected });
    const catalog = buildPlan.entries.map(entry => entry.catalogEntry);
    const sourceResolver = createSourceResolver(buildPlan);
    for (const fach of buildPlan.subjects) {
      const subjectDir = fs.mkdtempSync(path.join(root, 'bundle-'));
      let bundle;
      try {
        bundle = await buildSubjectBundle({ fach, catalog, lerntexte: catalog.filter(entry => entry.fach === fach),
          bucket, workDir: subjectDir, ffmpeg, probeAudio, targetPrefix, bundleVersion, sourceResolver });
        const bundleTarget = buildPlan.writeTargetSpecs.find(spec => spec.kind === 'bundle-mp3' && spec.fach === fach);
        assertBundleTargetMatches(bundle.sidecar.mp3Path, bundleTarget);
        const publication = await publishSubjectBundle({ bundle, bucket, targetPrefix,
          loadCatalog: async () => {
            const current = await loadApprovedPlan({ apiUrl, inventoryPath, orderManifestPath,
              targetPrefix, bundleVersion, expected });
            return current.entries.map(entry => entry.catalogEntry);
          } });
        baseReport.subjects.push({ fach, status: 'PUBLISHED', publication,
          ids: bundle.sidecar.chapters.length, chapterGroups: bundle.sidecar.chapterGroups.length,
          duration: bundle.sidecar.duration, byteSize: bundle.byteSize,
          bundleHash: bundle.sidecar.bundleHash, mp3Path: bundle.sidecar.mp3Path,
          sidecarPath: publication.sidecarPath, sourceAudioUniform: bundle.sidecar.sourceAudioUniform,
          sourceAudioProperties: bundle.sidecar.sourceAudioProperties,
          boundaryAudit: bundle.sidecar.boundaryAudit });
        onStatus({ phase: 'BUNDLE_PUBLISHED', fach, ids: bundle.sidecar.chapters.length });
      } finally {
        if (bundle?.workDir && fs.existsSync(bundle.workDir)) fs.rmSync(bundle.workDir, { recursive: true, force: true });
        if (fs.existsSync(subjectDir)) fs.rmSync(subjectDir, { recursive: true, force: true });
      }
    }
    requireCount(baseReport.subjects.length, expected.subjects, 'veröffentlichte Fachbundles');

    const verified = [];
    for (const fach of buildPlan.subjects) {
      const result = await verifySubjectBundle({ fach, catalog, bucket, workDir: root, ffmpeg, targetPrefix });
      if (result.sidecar.bundleVersion !== bundleVersion) throw new Error(fach + ': Bundle-Version weicht ab');
      verified.push({ fach, ids: result.sidecar.chapters.length,
        chapterGroups: result.sidecar.chapterGroups.length, bundleHash: result.sidecar.bundleHash,
        duration: result.sidecar.duration, byteSize: result.byteSize,
        boundaries: result.sidecar.boundaryAudit.length });
    }
    const audibleBoundaries = verified.reduce((sum, subject) => sum + subject.boundaries, 0);
    const structuralSubjectBoundaries = expected.subjects - 1;
    requireCount(audibleBoundaries, expected.ids - expected.subjects, 'audible Segmentgrenzen innerhalb der Fachbundles');
    requireCount(audibleBoundaries + structuralSubjectBoundaries, expected.ids - 1, 'geordnete Übergänge über alle Lerntexte');
    baseReport.generatedSegments = { requested: expected.regenerated, generatedNow: generated.generated.length,
      ready: targetReady.filter(Boolean).length };
    baseReport.verification = { subjects: verified, ids: verified.reduce((sum, item) => sum + item.ids, 0),
      chapterGroups: verified.reduce((sum, item) => sum + item.chapterGroups, 0),
      audibleBoundaries, structuralSubjectBoundaries,
      orderedAdjacencies: audibleBoundaries + structuralSubjectBoundaries };
    return baseReport;
  } finally {
    if (ownsRoot && fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  }
}

async function runCli(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const value = name => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const reportPath = value('--report');
  const report = await runStagingMigration({
    dryRun,
    apiUrl: value('--api-url') || process.env.PODCAST_LERNTEXTE_API_URL,
    inventoryPath: value('--inventory'),
    orderManifestPath: value('--order-manifest'),
    targetPrefix: value('--target-prefix') || STAGING_PODCAST_PREFIX,
    bundleVersion: value('--bundle-version') || DEFAULT_BUNDLE_VERSION,
    onStatus(event) { console.log(JSON.stringify({ at: new Date().toISOString(), ...event })); }
  });
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  return report;
}

if (require.main === module) runCli().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = {
  DEFAULT_BUNDLE_VERSION,
  DEFAULT_EXPECTED,
  createMigrationPlan,
  assertBundleTargetMatches,
  createSourceResolver,
  flattenOrderManifest,
  auditReusableSources,
  loadApprovedPlan,
  runStagingMigration,
  runCli
};
