const test = require('node:test');
const assert = require('node:assert/strict');
const { sha256Lerntext, podcastPaths } = require('../tools/podcast-sync/hash-paths');
const migration = require('../tools/podcast-sync/staging-migration');

const TARGET = 'podcast/staging/lerntext-rev2/';

function fixture() {
  const catalog = [
    { id: 'LZ-A-01', fach: 'Fach A', titel: 'Eins', lerntext: 'Text eins', hauptkapitelNr: '1', hauptkapitel: 'Kapitel A', unterkapitelNr: '1.1', reihenfolgeFach: 1, reihenfolgeKapitel: 1 },
    { id: 'LZ-A-02', fach: 'Fach A', titel: 'Zwei', lerntext: 'Text zwei neu', hauptkapitelNr: '1', hauptkapitel: 'Kapitel A', unterkapitelNr: '1.2', reihenfolgeFach: 2, reihenfolgeKapitel: 2 },
    { id: 'LZ-B-01', fach: 'Fach B', titel: 'Neu', lerntext: 'Text drei', hauptkapitelNr: '1', hauptkapitel: 'Kapitel B', unterkapitelNr: '1.1', reihenfolgeFach: 1, reihenfolgeKapitel: 1 }
  ];
  const inventory = { items: [
    { id: 'LZ-A-01', fach: 'Fach A', titel: 'Eins', neuerTextHash: sha256Lerntext('Text eins'),
      vorhandenesVerwendbaresAudio: 'ja', ttsNeuerzeugungErforderlich: 'nein', pfadGeaendert: 'nein',
      quellpfad: podcastPaths('Fach A', 'Eins').mp3Path, alteFachzuordnung: 'Fach A', alterTitel: 'Eins' },
    { id: 'LZ-A-02', fach: 'Fach A', titel: 'Zwei', neuerTextHash: sha256Lerntext('Text zwei neu'),
      vorhandenesVerwendbaresAudio: 'nein', ttsNeuerzeugungErforderlich: 'ja', pfadGeaendert: 'nein',
      quellpfad: '', alteFachzuordnung: 'Fach A', alterTitel: 'Zwei' },
    { id: 'LZ-B-01', fach: 'Fach B', titel: 'Neu', neuerTextHash: sha256Lerntext('Text drei'),
      vorhandenesVerwendbaresAudio: 'ja', ttsNeuerzeugungErforderlich: 'nein', pfadGeaendert: 'ja',
      quellpfad: podcastPaths('Altes Fach', 'Alt').mp3Path, alteFachzuordnung: 'Altes Fach', alterTitel: 'Alt' }
  ] };
  const orderManifest = { subjects: [
    { fach: 'Fach A', chapters: [{ chapterKey: 'ui-a-1', chapterNumber: '1', chapterTitle: 'Kapitel A', entries: [
      { id: 'LZ-A-01', ordinalInFach: 1, sortKey: 1 }, { id: 'LZ-A-02', ordinalInFach: 2, sortKey: 2 }
    ] }] },
    { fach: 'Fach B', chapters: [{ chapterKey: 'ui-b-1', chapterNumber: '1', chapterTitle: 'Kapitel B', entries: [
      { id: 'LZ-B-01', ordinalInFach: 1, sortKey: 1 }
    ] }] }
  ] };
  return { catalog, inventory, orderManifest };
}

test('migration plan fixes exact IDs, order, origins and staging-only targets', () => {
  const plan = migration.createMigrationPlan({ ...fixture(), targetPrefix: TARGET,
    bundleVersion: 'TEST-BUNDLE-v1', expected: { ids: 3, subjects: 2, chapters: 2, reused: 2, regenerated: 1, pathMigrations: 1 } });
  assert.deepEqual(plan.entries.map(entry => entry.id), ['LZ-A-01', 'LZ-A-02', 'LZ-B-01']);
  assert.deepEqual(plan.entries.map(entry => entry.origin), ['reused', 'regenerated', 'reused']);
  assert.equal(plan.entries[0].sourcePaths.mp3Path, podcastPaths('Fach A', 'Eins').mp3Path);
  assert.equal(plan.entries[1].sourcePaths.mp3Path, podcastPaths('Fach A', 'Zwei', { prefix: TARGET }).mp3Path);
  assert.equal(plan.entries[2].sourcePaths.mp3Path, podcastPaths('Altes Fach', 'Alt').mp3Path);
  assert.equal(plan.entries[2].sourceEntry.fach, 'Altes Fach');
  assert.equal(plan.entries[2].chapterKey, 'ui-b-1');
  assert.deepEqual(plan.entries.map(entry => entry.catalogEntry.reihenfolgeFach), [1, 2, 1]);
  assert.deepEqual(plan.entries.map(entry => entry.catalogEntry.reihenfolgeKapitel), [1, 2, 1]);
  assert.deepEqual(plan.entries.map(entry => entry.catalogEntry.hauptkapitel), ['Kapitel A', 'Kapitel A', 'Kapitel B']);
  assert.equal(plan.regeneratedEntries.length, 1);
  assert.ok(plan.writeTargets.every(target => target.startsWith(TARGET)));
  assert.equal(plan.writeTargetSpecs.length, 6, '2 Segmentziele + 2 Sidecars + 2 Bundle-MP3-Zielmuster');
  assert.equal(plan.writeTargetSpecs.filter(spec => spec.kind === 'bundle-mp3').length, 2);
  assert.ok(plan.writeTargetSpecs.every(spec => spec.path ? spec.path.startsWith(TARGET) : spec.pathPrefix.startsWith(TARGET)));
  assert.equal(new Set(plan.entries.map(entry => entry.id)).size, 3);
});

test('migration preflight fails closed on catalog, hash, count and source drift', () => {
  const base = fixture();
  const expected = { ids: 3, subjects: 2, chapters: 2, reused: 2, regenerated: 1, pathMigrations: 1 };
  assert.throws(() => migration.createMigrationPlan({ ...base, catalog: base.catalog.slice(1), targetPrefix: TARGET, bundleVersion: 'v1', expected }), /ID|Katalog|Anzahl/i);
  assert.throws(() => migration.createMigrationPlan({ ...base, catalog: base.catalog.map((entry, index) => index ? entry : { ...entry, lerntext: 'Drift' }), targetPrefix: TARGET, bundleVersion: 'v1', expected }), /Hash|Text/i);
  assert.throws(() => migration.createMigrationPlan({ ...base, inventory: { items: [...base.inventory.items, base.inventory.items[0]] }, targetPrefix: TARGET, bundleVersion: 'v1', expected }), /doppelt|Anzahl/i);
  assert.throws(() => migration.createMigrationPlan({ ...base, targetPrefix: 'podcast/', bundleVersion: 'v1', expected }), /Staging|Präfix|Ziel/i);
  assert.throws(() => migration.createMigrationPlan({ ...base,
    catalog: base.catalog.map(entry => entry.id === 'LZ-A-02' ? { ...entry, reihenfolgeFach: 99 } : entry),
    targetPrefix: TARGET, bundleVersion: 'v1', expected }), /Reihenfolge|Manifest/i);
  assert.throws(() => migration.createMigrationPlan({ ...base,
    catalog: base.catalog.map(entry => entry.id === 'LZ-A-02' ? { ...entry, hauptkapitel: 'Falsches Kapitel' } : entry),
    targetPrefix: TARGET, bundleVersion: 'v1', expected }), /Kapitel|Manifest/i);
});

test('content-addressed bundle path must match its predeclared staging target specification', () => {
  const plan = migration.createMigrationPlan({ ...fixture(), targetPrefix: TARGET,
    bundleVersion: 'TEST-BUNDLE-v1', expected: { ids: 3, subjects: 2, chapters: 2, reused: 2, regenerated: 1, pathMigrations: 1 } });
  const spec = plan.writeTargetSpecs.find(item => item.kind === 'bundle-mp3' && item.fach === 'Fach A');
  const valid = spec.pathPrefix + 'a'.repeat(64) + '.mp3';
  assert.equal(migration.assertBundleTargetMatches(valid, spec), valid);
  assert.throws(() => migration.assertBundleTargetMatches(spec.pathPrefix + 'not-a-hash.mp3', spec), /Ziel|Hash|Muster/i);
  assert.throws(() => migration.assertBundleTargetMatches('podcast/continuous/fach-a/' + 'a'.repeat(64) + '.mp3', spec), /Ziel|Staging|Muster/i);
});
