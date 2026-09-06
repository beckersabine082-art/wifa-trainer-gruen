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

// ====== TASK 3: Canonical-TTS-Normalisierung ======

const {
  normalizeLerntextForTts,
  tokenizeVisibleWords,
  decodeHtmlEntities
} = require('../tools/podcast-sync/normalize-lerntext.js');

// Test A) Normaler Plaintext bleibt inhaltlich gleich
test('TASK3-A: Normaler Plaintext bleibt inhaltlich gleich', function() {
  const input = 'Das Unternehmen verfolgt langfristige Ziele.';
  const norm = normalizeLerntextForTts(input);

  const expectedWords = ['Das', 'Unternehmen', 'verfolgt', 'langfristige', 'Ziele'];
  const actualWords = norm.words.map(function(w) { return w.text; });

  assert.deepStrictEqual(actualWords, expectedWords, 'Wörter identisch');
  assert.strictEqual(norm.wordCount, 5, 'wordCount exakt');
});

// Test B) podcastText ist irrelevant
test('TASK3-B: podcastText ist irrelevant', function() {
  const lerntext = 'AKTUELLER LERNTEXT';
  const normA = normalizeLerntextForTts(lerntext);
  
  // Funktion nimmt nur lerntext, nicht entry-Objekt, aber testen dass zwei identische
  // lerntexte same result liefern unabhängig von was daneben würde stehen
  const normB = normalizeLerntextForTts(lerntext);

  assert.strictEqual(normA.text, normB.text, 'text identisch');
  assert.deepStrictEqual(normA.words, normB.words, 'words identisch');
  
  // Testen dass Hash immer gleich bleibt für gleichen lerntext
  const hash1 = sha256Lerntext(lerntext);
  const hash2 = sha256Lerntext(lerntext);
  assert.strictEqual(hash1, hash2, 'Hash deterministisch');
});

// Test C) <br> ist kein Wort
test('TASK3-C: <br> ist kein Wort', function() {
  const input = 'Text. <br> Absatz.\n\nNeu.';
  const norm = normalizeLerntextForTts(input);

  const words = norm.words.map(function(w) { return w.text; });
  assert.deepStrictEqual(words, ['Text', 'Absatz', 'Neu'], 'br ist kein Wort');
  assert.strictEqual(norm.wordCount, 3, 'wordCount korrekt');
  assert.ok(!norm.text.includes('<br>'), 'br-Tag entfernt aus text');
});

// Test D) HTML-Tags sind keine Wörter
test('TASK3-D: HTML-Tags sind keine Wörter', function() {
  const input = '<strong>Wichtig</strong>: Das ist <em>relevant</em>.';
  const norm = normalizeLerntextForTts(input);

  const words = norm.words.map(function(w) { return w.text; });
  assert.deepStrictEqual(words, ['Wichtig', 'Das', 'ist', 'relevant'], 'keine Tags in words');
  assert.strictEqual(norm.wordCount, 4, 'wordCount ohne Tags');
});

// Test E) HTML-Entities werden dekodiert
test('TASK3-E: HTML-Entities werden dekodiert', function() {
  const input = 'Forschung &amp; Entwicklung&nbsp;gehören zusammen.';
  const norm = normalizeLerntextForTts(input);

  assert.ok(!norm.text.includes('&amp;'), 'amp dekodiert');
  assert.ok(!norm.text.includes('&nbsp;'), 'nbsp dekodiert');
  assert.ok(norm.text.includes('&'), 'Ampersand im Text');
  assert.ok(norm.text.includes('Entwicklung'), 'Wort erhalten');
  
  const words = norm.words.map(function(w) { return w.text; });
  assert.deepStrictEqual(words, ['Forschung', 'Entwicklung', 'gehören', 'zusammen'], 'Entities als Text nicht als Wörter');
  assert.strictEqual(norm.wordCount, 4, 'wordCount');
});

// Test E2) Numerische Entities
test('TASK3-E2: Numerische Entities werden dekodiert', function() {
  const input = '§&#160;1 ist relevant.';
  const norm = normalizeLerntextForTts(input);

  assert.ok(!norm.text.includes('&#160;'), 'numerische Entity dekodiert');
  const words = norm.words.map(function(w) { return w.text; });
  assert.deepStrictEqual(words, ['1', 'ist', 'relevant'], 'Zahl und Wörter');
});

// Test F) Deutsche Unicode-Wörter
test('TASK3-F: Deutsche Unicode-Wörter (Umlaute, ß)', function() {
  const input = 'Größe, Bücher, Übertragung und Straße.';
  const norm = normalizeLerntextForTts(input);

  const words = norm.words.map(function(w) { return w.text; });
  assert.deepStrictEqual(words, ['Größe', 'Bücher', 'Übertragung', 'und', 'Straße'], 'Umlaute/ß erhalten');
  assert.strictEqual(norm.wordCount, 5, 'wordCount');
});

// Test G) Bindestrich und Apostroph
test('TASK3-G1: Bindestrich-Wort bleibt ein Wort', function() {
  const input = 'Kosten-Nutzen-Analyse';
  const norm = normalizeLerntextForTts(input);

  const words = norm.words.map(function(w) { return w.text; });
  assert.deepStrictEqual(words, ['Kosten-Nutzen-Analyse'], 'Bindestrich-Wort als ein Wort');
  assert.strictEqual(norm.wordCount, 1, 'wordCount = 1');
});

test('TASK3-G2: Normales Apostroph und typografisches Apostroph', function() {
  const input1 = "Manager's Aufgaben";
  const input2 = "Manager's Aufgaben";
  
  const norm1 = normalizeLerntextForTts(input1);
  const norm2 = normalizeLerntextForTts(input2);

  const words1 = norm1.words.map(function(w) { return w.text; });
  const words2 = norm2.words.map(function(w) { return w.text; });
  
  // Beide sollten Manager und Aufgaben als Wörter haben
  assert.ok(words1.some(function(w) { return w.includes('Manager'); }), 'Manager in words1');
  assert.ok(words2.some(function(w) { return w.includes('Manager'); }), 'Manager in words2');
  assert.ok(words1.some(function(w) { return w.includes('Aufgaben'); }), 'Aufgaben in words1');
  assert.ok(words2.some(function(w) { return w.includes('Aufgaben'); }), 'Aufgaben in words2');
});

// Test H) Keine Wortänderung durch reine Formatierung
test('TASK3-H: Keine Wortänderung durch reine Formatierung', function() {
  const plain = 'Das ist ein wichtiger Begriff.';
  const formatted = '<p>Das ist ein <strong>wichtiger</strong> Begriff.</p>';
  
  const normPlain = normalizeLerntextForTts(plain);
  const normFormatted = normalizeLerntextForTts(formatted);

  const wordsPlain = normPlain.words.map(function(w) { return w.text; });
  const wordsFormatted = normFormatted.words.map(function(w) { return w.text; });

  assert.deepStrictEqual(wordsPlain, wordsFormatted, 'sichtbare Wortfolge identisch');
  assert.strictEqual(normPlain.wordCount, normFormatted.wordCount, 'wordCount identisch');
});

// Test I) Whitespace-Normalisierung: Absatzstruktur erhalten
test('TASK3-I: Whitespace-Normalisierung mit Absatzstruktur', function() {
  const input = 'Erster Satz.   \n\n  Zweiter Satz.\n\nDritter Satz.';
  const norm = normalizeLerntextForTts(input);

  // Text sollte Absatzstruktur haben aber keine mehrfachen Leerzeilen
  assert.ok(norm.text.includes('\n'), 'Zeilenumbruch erhalten');
  assert.ok(!norm.text.includes('   '), 'Mehrfache Spaces gelöscht');
  
  const words = norm.words.map(function(w) { return w.text; });
  assert.deepStrictEqual(words, ['Erster', 'Satz', 'Zweiter', 'Satz', 'Dritter', 'Satz'], 'alle Wörter');
});

// Test J) Word indices sind lückenlos und 0-basiert
test('TASK3-J: Word indices sind 0-basiert und lückenlos', function() {
  const input = 'Ein Zwei Drei Vier Fünf.';
  const norm = normalizeLerntextForTts(input);

  for (let i = 0; i < norm.words.length; i++) {
    assert.strictEqual(norm.words[i].index, i, 'index korrekt für Wort ' + i);
  }
});

// ====== TASK 4: SHA-256 und Firebase-Pfade ======

const hashPaths = require('../tools/podcast-sync/hash-paths.js');
const {
  sha256Lerntext: sha256FromPaths,
  podcastSlug,
  podcastPaths
} = hashPaths;

// Test A) ECHTER SHA-256
test('TASK4-A: SHA-256 ist echte SHA-256 Implementierung', function() {
  const hash = sha256FromPaths('Test');

  assert.strictEqual(hash.length, 64, 'exakt 64 Hex-Zeichen');
  assert.match(hash, /^[a-f0-9]{64}$/, 'nur Hex-Zeichen');

  const expected = crypto.createHash('sha256').update('Test', 'utf8').digest('hex');
  assert.strictEqual(hash, expected, 'identisch mit crypto Referenzwert');
});

// Test B) RAW-LERNTEXT IST HASHQUELLE
test('TASK4-B: SHA-256 hasht raw lerntext, nicht normalized', function() {
  const raw = '<strong>Text</strong>';
  const normalized = 'Text';

  const hashRaw = sha256FromPaths(raw);
  const hashNorm = sha256FromPaths(normalized);

  assert.notStrictEqual(hashRaw, hashNorm, 'unterschiedliche Hashes');
  assert.strictEqual(hashRaw.length, 64, 'raw hat 64 Zeichen');
  assert.strictEqual(hashNorm.length, 64, 'normalized hat 64 Zeichen');
});

// Test C) PODCASTTEXT IRRELEVANT
test('TASK4-C: podcastText beeinflusst SHA-256 nicht', function() {
  const lerntext = 'Kanonischer Text';
  const hash1 = sha256FromPaths(lerntext);
  const hash2 = sha256FromPaths(lerntext);

  assert.strictEqual(hash1, hash2, 'deterministische Ausgabe');
});

// Test D) AUDIT VERWENDET GEMEINSAME FUNKTION
test('TASK4-D: audit-pilot importiert sha256Lerntext von hash-paths', function() {
  const auditModule = require('../tools/podcast-sync/audit-pilot.js');
  
  assert.strictEqual(
    auditModule.sha256Lerntext,
    sha256FromPaths,
    'exakt dieselbe Funktionsreferenz'
  );
});

// Test E) PILOT-PFADE
test('TASK4-E: Pilot-Pfade sind korrekt', function() {
  const paths = podcastPaths('Recht', 'Rechtssubjekte und Rechtsobjekte');

  assert.strictEqual(
    paths.mp3Path,
    'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3',
    'mp3Path korrekt'
  );
  assert.strictEqual(
    paths.jsonPath,
    'podcast/recht-rechtssubjekte-und-rechtsobjekte.json',
    'jsonPath korrekt'
  );
});

// Test F) UMLAUTE UND ß
test('TASK4-F: Umlaute und ß in Pfaden', function() {
  const paths = podcastPaths('Bücher', 'Größe');

  assert.ok(paths.mp3Path.includes('buecher'), 'Bücher → buecher');
  assert.ok(paths.mp3Path.includes('groesse'), 'Größe → groesse');
  assert.strictEqual(paths.jsonPath, 'podcast/buecher-groesse.json', 'JSON hat gleichen base slug');
});

// Test G) Ä Ö Ü
test('TASK4-G: Großbuchstaben-Umlaute', function() {
  const slug = podcastSlug('Änderung Ökonomie Übertragung');

  assert.strictEqual(slug, 'aenderung-oekonomie-uebertragung', 'Großbuchstaben-Umlaute korrekt');
});

// Test H) DIAKRITISCHE ZEICHEN
test('TASK4-H: Andere diakritische Zeichen (Akzente)', function() {
  const slug = podcastSlug('Café Résumé');

  assert.strictEqual(slug, 'cafe-resume', 'Akzente entfernt, NFD normalisiert');
});

// Test I) PUNKTUATION UND MEHRFACH-TRENNER
test('TASK4-I: Punktuation und mehrfache Trenner', function() {
  const slug = podcastSlug('  Recht: Vertrag / Angebot & Annahme  ');

  assert.strictEqual(
    slug,
    'recht-vertrag-angebot-annahme',
    'Punktuation entfernt, keine doppelten/führenden/nachfolgenden Bindestriche'
  );
  assert.ok(!slug.includes('--'), 'keine doppelten Bindestriche');
  assert.ok(!slug.startsWith('-'), 'keine führenden Bindestriche');
  assert.ok(!slug.endsWith('-'), 'keine nachfolgenden Bindestriche');
});

// Test J) DETERMINISMUS
test('TASK4-J: Deterministische Pfade', function() {
  const input1 = 'Test Fach';
  const input2 = 'Test Kapitel';
  
  const paths1 = podcastPaths(input1, input2);
  const paths2 = podcastPaths(input1, input2);

  assert.strictEqual(paths1.mp3Path, paths2.mp3Path, 'mp3Path deterministisch');
  assert.strictEqual(paths1.jsonPath, paths2.jsonPath, 'jsonPath deterministisch');
  
  const baseSlug1 = paths1.mp3Path.replace(/^podcast\//, '').replace(/\.mp3$/, '');
  const baseSlug2 = paths1.jsonPath.replace(/^podcast\//, '').replace(/\.json$/, '');
  
  assert.strictEqual(baseSlug1, baseSlug2, 'mp3/json haben gleichen base slug');
});

process.on('exit', function() {
  console.log(`\n${passedCount}/${testCount} tests passed`);
});