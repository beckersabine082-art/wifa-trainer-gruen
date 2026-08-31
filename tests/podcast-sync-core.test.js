const assert = require('assert');
const crypto = require('crypto');
const Module = require('module');

const {
  auditPilotEntry,
  countTtsTokens,
  sha256Lerntext
} = require('../tools/podcast-sync/audit-pilot.js');

function loadPodcastSyncFoundation() {
  const modulePath = require.resolve('../tools/podcast-sync/index.js');
  delete require.cache[modulePath];
  return require(modulePath);
}

let testCount = 0;
let passedCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passedCount++;
    console.log('✓ ' + name);
  } catch (error) {
    console.log('✗ ' + name);
    console.log('  Error: ' + error.message);
    process.exitCode = 1;
  }
}

test('countTtsTokens liefert positive Integerzahl', function() {
  const count = countTtsTokens('Hallo Welt');

  assert.strictEqual(Number.isInteger(count), true);
  assert.ok(count > 0, 'positive Tokenanzahl');
});

test('countTtsTokens verwendet echte Tokenisierung, nicht Whitespace-Zählung', function() {
  const text = 'Übermäßig präzise: § 433 BGB, Käuferrechte und Verkäuferpflichten.';
  const whitespaceWords = text.trim().split(/\s+/).filter(Boolean).length;
  const tokenCount = countTtsTokens(text);

  assert.notStrictEqual(tokenCount, whitespaceWords, 'Tokenzahl darf keine einfache Wortzählung sein');
  assert.ok(tokenCount > whitespaceWords, 'o200k_base tokenisiert Satzzeichen/Umlaute feiner als Whitespace');
});

test('auditPilotEntry findet Pilot-Einheit exakt einmal', function() {
  const lerntexte = [{
    fach: 'Recht',
    titel: 'Rechtssubjekte und Rechtsobjekte',
    lerntext: 'Rechtssubjekte sind Träger von Rechten und Pflichten.',
    podcastText: 'Alter Podcasttext darf nicht verwendet werden'
  }];

  const report = auditPilotEntry({ lerntexte, fach: 'Recht', titel: 'Rechtssubjekte und Rechtsobjekte' });

  assert.strictEqual(report.foundCount, 1);
  assert.strictEqual(report.fach, 'Recht');
  assert.strictEqual(report.titel, 'Rechtssubjekte und Rechtsobjekte');
  assert.ok(report.lerntextLength > 0, 'lerntext vorhanden');
});

test('auditPilotEntry ignoriert podcastText für Hash, Tokens und Quelle', function() {
  const entryA = {
    fach: 'Recht',
    titel: 'Rechtssubjekte und Rechtsobjekte',
    lerntext: 'AKTUELLER LERNTEXT',
    podcastText: 'ALT'
  };
  const entryB = {
    fach: 'Recht',
    titel: 'Rechtssubjekte und Rechtsobjekte',
    lerntext: 'AKTUELLER LERNTEXT',
    podcastText: 'NEU'
  };

  const reportA = auditPilotEntry({ lerntexte: [entryA], fach: 'Recht', titel: 'Rechtssubjekte und Rechtsobjekte' });
  const reportB = auditPilotEntry({ lerntexte: [entryB], fach: 'Recht', titel: 'Rechtssubjekte und Rechtsobjekte' });

  assert.strictEqual(reportA.lerntextHash, reportB.lerntextHash);
  assert.strictEqual(reportA.ttsTokenCount, reportB.ttsTokenCount);
  assert.strictEqual(reportA.sourceUsed, 'lerntext');
  assert.strictEqual(reportB.sourceUsed, 'lerntext');
});

test('sha256Lerntext liefert echten SHA-256 Hex-String', function() {
  const text = 'AKTUELLER LERNTEXT';
  const expected = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  const hash = sha256Lerntext(text);

  assert.strictEqual(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.strictEqual(hash, expected);
});

test('auditPilotEntry setzt canGenerateWithoutChunking anhand der 2000-Token-Grenze', function() {
  const shortEntry = {
    fach: 'Recht',
    titel: 'Rechtssubjekte und Rechtsobjekte',
    lerntext: 'Kurzer Lerntext',
    podcastText: 'IGNORIERT'
  };
  const longEntry = {
    fach: 'Recht',
    titel: 'Rechtssubjekte und Rechtsobjekte',
    lerntext: 'Rechtssubjekte '.repeat(2500),
    podcastText: 'IGNORIERT'
  };

  const shortReport = auditPilotEntry({ lerntexte: [shortEntry], fach: 'Recht', titel: 'Rechtssubjekte und Rechtsobjekte' });
  const longReport = auditPilotEntry({ lerntexte: [longEntry], fach: 'Recht', titel: 'Rechtssubjekte und Rechtsobjekte' });

  assert.ok(shortReport.ttsTokenCount <= 2000);
  assert.strictEqual(shortReport.canGenerateWithoutChunking, true);
  assert.ok(longReport.ttsTokenCount > 2000);
  assert.strictEqual(longReport.canGenerateWithoutChunking, false);
});

test('sync foundation liefert exakte Pilot-Konfiguration', function() {
  const { PILOT_CONFIG } = loadPodcastSyncFoundation();

  assert.deepStrictEqual(PILOT_CONFIG, {
    pilotFach: 'Recht',
    pilotTitel: 'Rechtssubjekte und Rechtsobjekte',
    ttsModel: 'gpt-4o-mini-tts',
    ttsVoice: 'alloy'
  });
});

test('getPodcastSyncConfig liefert Kopie ohne externe Verbindung', function() {
  const { PILOT_CONFIG, getPodcastSyncConfig } = loadPodcastSyncFoundation();
  const config = getPodcastSyncConfig();

  assert.deepStrictEqual(config, PILOT_CONFIG);
  assert.notStrictEqual(config, PILOT_CONFIG);
});

test('requireOpenAiKey liest injiziertes env und validiert fehlende Werte', function() {
  const { requireOpenAiKey } = loadPodcastSyncFoundation();

  assert.strictEqual(requireOpenAiKey({ OPENAI_API_KEY: 'test-openai-key' }), 'test-openai-key');
  assert.throws(function() {
    requireOpenAiKey({ OPENAI_API_KEY: '   ' });
  }, /OPENAI_API_KEY fehlt/);
});

test('requireFirebaseAdminConfig liest injiziertes env ohne Firebase-Initialisierung', function() {
  const { requireFirebaseAdminConfig } = loadPodcastSyncFoundation();
  const config = requireFirebaseAdminConfig({
    FIREBASE_PROJECT_ID: 'project-1',
    FIREBASE_CLIENT_EMAIL: 'client@example.test',
    FIREBASE_PRIVATE_KEY: 'line1\\nline2',
    FIREBASE_STORAGE_BUCKET: 'bucket.example'
  });

  assert.deepStrictEqual(config, {
    projectId: 'project-1',
    clientEmail: 'client@example.test',
    privateKey: 'line1\nline2',
    storageBucket: 'bucket.example'
  });
});

test('requireFirebaseAdminConfig meldet fehlende Pflichtwerte klar', function() {
  const { requireFirebaseAdminConfig } = loadPodcastSyncFoundation();

  assert.throws(function() {
    requireFirebaseAdminConfig({
      FIREBASE_CLIENT_EMAIL: 'client@example.test',
      FIREBASE_PRIVATE_KEY: 'line1',
      FIREBASE_STORAGE_BUCKET: 'bucket.example'
    });
  }, /FIREBASE_PROJECT_ID fehlt/);
  assert.throws(function() {
    requireFirebaseAdminConfig({
      FIREBASE_PROJECT_ID: 'project-1',
      FIREBASE_PRIVATE_KEY: 'line1',
      FIREBASE_STORAGE_BUCKET: 'bucket.example'
    });
  }, /FIREBASE_CLIENT_EMAIL fehlt/);
  assert.throws(function() {
    requireFirebaseAdminConfig({
      FIREBASE_PROJECT_ID: 'project-1',
      FIREBASE_CLIENT_EMAIL: 'client@example.test',
      FIREBASE_STORAGE_BUCKET: 'bucket.example'
    });
  }, /FIREBASE_PRIVATE_KEY fehlt/);
  assert.throws(function() {
    requireFirebaseAdminConfig({
      FIREBASE_PROJECT_ID: 'project-1',
      FIREBASE_CLIENT_EMAIL: 'client@example.test',
      FIREBASE_PRIVATE_KEY: 'line1'
    });
  }, /FIREBASE_STORAGE_BUCKET fehlt/);
});

test('sync foundation require lädt keine OpenAI- oder Firebase-Clients', function() {
  const originalLoad = Module._load;
  const loadedExternalClients = [];
  Module._load = function(request) {
    if (request === 'openai' || request === 'firebase-admin') {
      loadedExternalClients.push(request);
      throw new Error('Externer Client darf beim require nicht geladen werden: ' + request);
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    const foundation = loadPodcastSyncFoundation();
    assert.strictEqual(typeof foundation.getPodcastSyncConfig, 'function');
    assert.deepStrictEqual(loadedExternalClients, []);
  } finally {
    Module._load = originalLoad;
  }
});

process.on('exit', function() {
  console.log(`\n${passedCount}/${testCount} tests passed`);
});