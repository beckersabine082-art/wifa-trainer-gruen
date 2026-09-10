const assert = require('node:assert/strict');
const test = require('node:test');
const { sha256Lerntext, podcastPaths } = require('../tools/podcast-sync/hash-paths.js');
const {
  loadLerntexteReadOnly,
  inspectAll,
  dryRunBlocksLiveSync,
  syncAll,
  selectOnlyLerntext,
  formatFailedReport
} = require('../tools/podcast-sync/sync-all.js');

test('lädt Lerntexte sequenziell über subjects für jedes Fach', async () => {
  const calls = [];
  const result = await loadLerntexteReadOnly({
    apiUrl: 'https://example.test/exec?existing=1&action=wrong',
    fetchImpl: async requestUrl => {
      const url = new URL(requestUrl);
      calls.push({ action: url.searchParams.get('action'), fach: url.searchParams.get('fach') });
      if (url.searchParams.get('action') === 'subjects') {
        return { ok: true, json: async () => ({ success: true, data: ['Recht', 'Finance Controlling'] }) };
      }
      if (url.searchParams.get('fach') === 'Recht') {
        return { ok: true, json: async () => ({ success: true, data: [{ titel: 'R1' }, { titel: 'R2' }] }) };
      }
      if (url.searchParams.get('fach') === 'Finance Controlling') {
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
      if (url.searchParams.get('fach') === 'Betriebliches Rechnungswesen und Controlling') {
        return { ok: true, json: async () => ({ success: true, data: [{ titel: 'B1' }, { titel: 'B2' }] }) };
      }
      return { ok: true, json: async () => ({ success: true, data: [{ titel: 'I1' }, { titel: 'I2' }, { titel: 'I3' }] }) };
    }
  });

  assert.equal(result.length, 7);
  assert.deepEqual(calls, [
    { action: 'subjects', fach: null },
    { action: 'getLerntexte', fach: 'Recht' },
    { action: 'getLerntexte', fach: 'Finance Controlling' },
    { action: 'getLerntexte', fach: 'Betriebliches Rechnungswesen und Controlling' },
    { action: 'getLerntexte', fach: 'Investition und Finanzierung' }
  ]);
});

function fakeBucket(files) {
  return {
    file(storagePath) {
      return {
        async exists() { return [Boolean(files[storagePath])]; },
        async getMetadata() { return [{ metadata: { lerntextHash: files[storagePath].hash } }]; },
        async download() { return [Buffer.from(JSON.stringify(files[storagePath].json), 'utf8')]; }
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
      [paths.jsonPath]: { json: { lerntextHash: sha256Lerntext(lerntext) } }
    })
  });
  assert.equal(result.reports[0].status, 'VALID/SKIP');
});

test('aktueller MP3-Hash mit altem JSON-Hash wird als SYNC_NEEDED erkannt', async () => {
  const lerntext = 'Ein kanonischer Text.';
  const paths = podcastPaths('Recht', 'Einheit');
  const result = await inspectAll({
    lerntexte: [{ fach: 'Recht', titel: 'Einheit', lerntext }],
    bucket: fakeBucket({
      [paths.mp3Path]: { hash: sha256Lerntext(lerntext) },
      [paths.jsonPath]: { json: { lerntextHash: sha256Lerntext('Alt.') } }
    })
  });
  assert.equal(result.reports[0].status, 'SYNC_NEEDED');
});

test('geänderter Hash wird als SYNC_NEEDED erkannt', async () => {
  const paths = podcastPaths('Recht', 'Einheit');
  const result = await inspectAll({
    lerntexte: [{ fach: 'Recht', titel: 'Einheit', lerntext: 'Neu.' }],
    bucket: fakeBucket({
      [paths.mp3Path]: { hash: sha256Lerntext('Alt.') },
      [paths.jsonPath]: { json: {lerntextHash: sha256Lerntext('Alt.')} }
    })
  });
  assert.equal(result.reports[0].status, 'SYNC_NEEDED');
});

test('lange Texte sind für die satzweise lokale Synthese erlaubt', async () => {
  const result = await inspectAll({
    lerntexte: [{ fach: 'Recht', titel: 'Lang', lerntext: 'Rechtssubjekte '.repeat(2500) }],
    bucket: fakeBucket({})
  });
  assert.equal(result.summary.SYNC_NEEDED, 1);
  assert.equal(dryRunBlocksLiveSync(result), false);
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

test('--only filtert exakt eine Einheit', () => {
  const lerntexte = [
    { fach: 'Recht', titel: 'A', lerntext: 'A.' },
    { fach: 'Recht', titel: 'B', lerntext: 'B.' }
  ];
  assert.deepEqual(selectOnlyLerntext(lerntexte, 'Recht / B'), [lerntexte[1]]);
  assert.throws(() => selectOnlyLerntext(lerntexte, 'Recht / C'), /Einheit nicht gefunden/);
});

test('FAILED-Ausgabe enthält error.message', () => {
  assert.equal(
    formatFailedReport({ identity: 'Recht / Einheit', error: 'Transkription fehlgeschlagen' }),
    'FAILED: Recht / Einheit | ERROR: Transkription fehlgeschlagen'
  );
});
