const assert = require('node:assert/strict');
const test = require('node:test');
const { sha256Lerntext, podcastPaths } = require('../tools/podcast-sync/hash-paths.js');
const {
  inspectAll,
  dryRunBlocksLiveSync,
  syncAll
} = require('../tools/podcast-sync/sync-all.js');

function fakeBucket(files) {
  return {
    file(storagePath) {
      return {
        async exists() { return [Boolean(files[storagePath])]; },
        async getMetadata() { return [{ metadata: { lerntextHash: files[storagePath].hash } }]; }
      };
    }
  };
}

test('unterschiedliche Fächer erzeugen unterschiedliche Pfade', () => {
  assert.notEqual(
    podcastPaths('Recht', 'Einheit').mp3Path,
    podcastPaths('Steuern', 'Einheit').mp3Path
  );
});

test('gültiger vorhandener Hash wird als VALID/SKIP erkannt', async () => {
  const lerntext = 'Ein kanonischer Text.';
  const paths = podcastPaths('Recht', 'Einheit');
  const result = await inspectAll({
    lerntexte: [{ fach: 'Recht', titel: 'Einheit', lerntext }],
    bucket: fakeBucket({
      [paths.mp3Path]: { hash: sha256Lerntext(lerntext) },
      [paths.jsonPath]: { hash: sha256Lerntext(lerntext) }
    })
  });
  assert.equal(result.reports[0].status, 'VALID/SKIP');
});

test('geänderter Hash wird als SYNC_NEEDED erkannt', async () => {
  const paths = podcastPaths('Recht', 'Einheit');
  const result = await inspectAll({
    lerntexte: [{ fach: 'Recht', titel: 'Einheit', lerntext: 'Neu.' }],
    bucket: fakeBucket({
      [paths.mp3Path]: { hash: sha256Lerntext('Alt.') },
      [paths.jsonPath]: { hash: sha256Lerntext('Alt.') }
    })
  });
  assert.equal(result.reports[0].status, 'SYNC_NEEDED');
});

test('über 2000 Tokens blockieren den Dry-Run', async () => {
  const result = await inspectAll({
    lerntexte: [{ fach: 'Recht', titel: 'Lang', lerntext: 'Rechtssubjekte '.repeat(2500) }],
    bucket: fakeBucket({})
  });
  assert.equal(result.summary.OVER_2000_TOKENS, 1);
  assert.equal(dryRunBlocksLiveSync(result), true);
});

test('Pfadkollision blockiert den Dry-Run', async () => {
  const result = await inspectAll({
    lerntexte: [
      { fach: 'Recht', titel: 'A/B', lerntext: 'Text A.' },
      { fach: 'Recht', titel: 'A B', lerntext: 'Text B.' }
    ],
    bucket: fakeBucket({})
  });
  assert.equal(result.summary.PATH_COLLISIONS, 2);
  assert.equal(dryRunBlocksLiveSync(result), true);
});

test('blockierter Live-Sync ruft keine Erzeuger auf', async () => {
  let called = false;
  const result = await syncAll({
    lerntexte: [{ fach: 'Recht', titel: 'Leer', lerntext: '' }],
    adapters: { generateTts: async () => { called = true; } }
  });
  assert.equal(called, false);
  assert.equal(result.inspection.summary.EMPTY, 1);
});
