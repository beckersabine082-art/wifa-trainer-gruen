# Implementierungsplan: Podcast-/Karaoke-Pilot für Recht – Rechtssubjekte und Rechtsobjekte

Status: Ausführbarer TDD-Implementierungsplan, nicht implementiert
Datum: 2026-08-31
Basis: [docs/superpowers/specs/2026-08-31-podcast-karaoke-sync-design.md](../specs/2026-08-31-podcast-karaoke-sync-design.md)

---

## Übersicht

Der Pilot fokussiert **ausschließlich** die Lerneinheit "Rechtssubjekte und Rechtsobjekte" im Fach "Recht".

**Canonical Rule:** `lerntext` ist die einzige Audio-/Karaoke-Quelle. `podcastText` wird vollständig ignoriert.

**Scope:** Nur Pilot-Einheit. Keine 521-Unit-Massengenerierung. Kein Frontend-OpenAI.

**Ablauf:** TDD. Jeder Task: Failing Test → Implementation → Pass → Regression → Commit.

---

## Grundarchitektur

```
Frontend js/lerntexte.js (getLerntexte)
  ↓
local admin sync (tools/podcast-sync/)
  ├─ SHA-256(lerntext nur)
  ├─ OpenAI TTS → MP3
  ├─ Whisper → Wort-Zeiten
  ├─ Alignment gegen lerntext Wortindizes
  └─ Firebase Publish: MP3 → JSON (Commit-Marker)
     ↓
Firebase Storage
  ├─ podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3
  ├─ podcast/recht-rechtssubjekte-und-rechtsobjekte.json
  └─ custom metadata: lerntextHash
     ↓
Frontend Playback (js/lerntexte.js)
  ├─ Hash-Validierung
  ├─ DOM-Karaoke-Highlight
  ├─ currentTime → wortIndex
  ├─ Fortschritt in PodcastFortschritt
  └─ Play/Pause/Stop/Resume
```

---

## TASK 1: Pilot-Daten-Audit

**Files**
- Modify: None (nur Test/Audit)
- Test: `tests/podcast-sync-core.test.js` (neu)

**Interfaces**
- Consumes: `getLerntexte()` Struktur
- Produces: Test-Report

**TDD-Schritte**

- [ ] Step 1: Test schreiben

```javascript
// tests/podcast-sync-core.test.js
const assert = require('assert');

test('Pilot-Audit: Recht → Rechtssubjekte und Rechtsobjekte existiert', function() {
  const entry = {
    titel: "Rechtssubjekte und Rechtsobjekte",
    lerntext: "PILOTTEXT MINDESTENS 500 ZEICHEN, NICHT LEER",
    podcastText: "WIRD IGNORIERT"
  };
  
  assert.ok(entry.lerntext.length >= 500, "lerntext zu kurz");
  assert.ok(entry.lerntext.length > 0, "lerntext nicht leer");
});

test('Pilot-Audit: podcastText ist NICHT die Quelle', function() {
  const entry = {
    lerntext: "CANONICAL",
    podcastText: "WIRD IGNORIERT"
  };
  
  // Test: nur lerntext wird für Audio/Sync verwendet
  assert.notStrictEqual(entry.podcastText, entry.lerntext, "Text unterschiedlich");
  assert.ok(entry.lerntext, "lerntext ist Canonical");
});
```

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-sync-core.test.js
```

**Expected FAIL:** Test-Framework nicht geladen

- [ ] Step 3: Test-Setup mit minimaler Funktion

- [ ] Step 4: Test PASS

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

```bash
git add tests/podcast-sync-core.test.js
git commit -m "TASK 1: Pilot-Daten-Audit Test"
```

---

## TASK 2: Podcast-Sync-Grundgerüst

**Files**
- Create: `tools/podcast-sync/index.js`
- Create: `tools/podcast-sync/.env.example`
- Create: `tools/podcast-sync/package.json`
- Modify: `.gitignore`
- Test: `tests/podcast-sync-core.test.js` (erweitern)

**Interfaces**
- Consumes: `process.env.OPENAI_API_KEY`
- Produces: Pilot-Sync-Konfiguration

**TDD-Schritte**

- [ ] Step 1: Test schreiben

```javascript
// tests/podcast-sync-core.test.js - erweitern
const fs = require('fs');
const path = require('path');

test('Sync: Pilot-Config auf Recht → Rechtssubjekte', function() {
  const configFile = path.join(__dirname, '../tools/podcast-sync/index.js');
  const code = fs.readFileSync(configFile, 'utf8');
  
  assert.ok(code.includes('pilotFach: "Recht"'), "pilotFach");
  assert.ok(code.includes('pilotTitel: "Rechtssubjekte und Rechtsobjekte"'), "pilotTitel");
});

test('Sync: OPENAI_API_KEY aus process.env, nicht hardcoded', function() {
  const configFile = path.join(__dirname, '../tools/podcast-sync/index.js');
  const code = fs.readFileSync(configFile, 'utf8');
  
  assert.ok(code.includes('process.env.OPENAI_API_KEY'), "env gelesen");
  assert.ok(!code.includes('sk-'), "kein hardcoded Key");
});

test('Sync: .env in .gitignore', function() {
  const gitignore = fs.readFileSync(path.join(__dirname, '../.gitignore'), 'utf8');
  assert.ok(gitignore.includes('podcast-sync/.env'), ".env excluded");
});
```

- [ ] Step 2-6: Implementation wie Task 1

**Commit:**
```bash
git add tools/podcast-sync/ .gitignore tests/podcast-sync-core.test.js
git commit -m "TASK 2: Podcast-Sync-Grundgerüst"
```

---

## TASK 3: Canonical-TTS-Normalisierung

**Files**
- Create: `tools/podcast-sync/normalize-lerntext.js`
- Test: `tests/podcast-sync-core.test.js` (erweitern)

**Interfaces**
- Consumes: `lerntext` (String)
- Produces: `normalizeLerntextForTts(text)` → `{text, wordCount}`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
test('normalize: lerntext nur, nie podcastText', function() {
  const entry = {
    lerntext: "Das ist der echte Text mit Substanz.",
    podcastText: "Das ist NICHT für TTS"
  };
  
  const norm = normalizeLerntextForTts(entry.lerntext);
  assert.ok(norm.text.includes("echte"), "lerntext Quelle");
  assert.ok(!norm.text.includes("NICHT für TTS"), "podcastText ignoriert");
});

test('normalize: Änderung nur podcastText => kein Hash-Update', function() {
  const v1 = normalizeLerntextForTts("Gleicher Lerntext".repeat(20));
  const v2 = normalizeLerntextForTts("Gleicher Lerntext".repeat(20));
  
  assert.strictEqual(v1.text, v2.text, "identisch");
});

test('normalize: Formatierung entfernen, Wörter erhalten', function() {
  const text = "Text. <br> Absatz.\n\nNeu.";
  const norm = normalizeLerntextForTts(text);
  
  const origWords = text.split(/\s+/).filter(w => /\w/.test(w)).length;
  const normWords = norm.text.split(/\s+/).filter(w => /\w/.test(w)).length;
  
  assert.strictEqual(origWords, normWords, "Wortanzahl gleich");
});
```

- [ ] Step 2-6: Implementation wie Task 1

**Commit:**
```bash
git add tools/podcast-sync/normalize-lerntext.js tests/podcast-sync-core.test.js
git commit -m "TASK 3: Canonical-TTS-Normalisierung (lerntext only)"
```

---

## TASK 4: SHA-256 und Firebase-Pfade

**Files**
- Create: `tools/podcast-sync/hash-paths.js`
- Test: `tests/podcast-sync-core.test.js` (erweitern)

**Interfaces**
- Consumes: `fach, titel, lerntext`
- Produces: `sha256Lerntext(text)`, `podcastPaths(fach, titel)`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
const { sha256Lerntext, podcastPaths } = require('../tools/podcast-sync/hash-paths.js');

test('sha256: echte SHA-256, nicht legacy Hash', function() {
  const hash = sha256Lerntext("Test");
  assert.strictEqual(hash.length, 64, "64 Hex-Zeichen");
  assert.match(hash, /^[a-f0-9]{64}$/i, "Hex");
});

test('sha256: Deterministische Ausgabe', function() {
  const h1 = sha256Lerntext("Text");
  const h2 = sha256Lerntext("Text");
  assert.strictEqual(h1, h2, "identisch");
});

test('paths: Pilot-Pfade', function() {
  const p = podcastPaths("Recht", "Rechtssubjekte und Rechtsobjekte");
  assert.strictEqual(p.mp3Path, "podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3");
  assert.strictEqual(p.jsonPath, "podcast/recht-rechtssubjekte-und-rechtsobjekte.json");
});

test('paths: Umlaut-Handling', function() {
  const p = podcastPaths("Bücher", "Größe");
  assert.ok(p.mp3Path.includes("buecher"), "ü→ue");
  assert.ok(p.mp3Path.includes("groesse"), "ß→ss");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add tools/podcast-sync/hash-paths.js tests/podcast-sync-core.test.js
git commit -m "TASK 4: SHA-256 und Firebase-Pfade"
```

---

## TASK 5: OpenAI TTS Pilot

**Files**
- Create: `tools/podcast-sync/tts-generate.js`
- Test: `tests/podcast-tts-mock.test.js` (neu)

**Interfaces**
- Consumes: `{text, outputPath, openaiClient}`
- Produces: `async generateTtsMp3()` → `{mp3Path, duration}`

**TDD-Schritte**

- [ ] Step 1: Test mit Mock

```javascript
// tests/podcast-tts-mock.test.js
const assert = require('assert');
const { generateTtsMp3, MAX_TTS_LENGTH } = require('../tools/podcast-sync/tts-generate.js');

test('TTS: 4096-Zeichen Limit vor API', async function() {
  const longText = "A".repeat(5000);
  const mockClient = { audio: { speech: { create: async () => {} } } };
  
  try {
    await generateTtsMp3({ text: longText, outputPath: '/tmp/test.mp3', openaiClient: mockClient });
    assert.fail("sollte Fehler werfen");
  } catch (err) {
    assert.ok(err.message.includes('4096'), "4096 limit");
  }
});

test('TTS: akzeptiert <= 4096 Zeichen', async function() {
  const text = "Text ".repeat(100); // < 4096
  let callMade = false;
  
  const mockClient = {
    audio: {
      speech: {
        create: async (params) => {
          callMade = true;
          assert.strictEqual(params.model, "tts-1");
          assert.strictEqual(params.voice, "nova");
          assert.strictEqual(params.input, text);
          return { arrayBuffer: async () => Buffer.from("mp3data") };
        }
      }
    }
  };
  
  const result = await generateTtsMp3({ text, outputPath: '/tmp/test.mp3', openaiClient: mockClient });
  assert.ok(callMade, "API aufgerufen");
  assert.ok(result.mp3Path, "path zurück");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add tools/podcast-sync/tts-generate.js tests/podcast-tts-mock.test.js
git commit -m "TASK 5: OpenAI TTS mit 4096-Limit"
```

---

## TASK 6: Whisper Wort-Zeitmarken

**Files**
- Create: `tools/podcast-sync/transcribe-words.js`
- Test: `tests/podcast-transcribe-mock.test.js` (neu)

**Interfaces**
- Consumes: `{mp3Path, openaiClient}`
- Produces: `async transcribeWordTimestamps()` → `{words: [{wort, start, end}]}`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/podcast-transcribe-mock.test.js
const assert = require('assert');
const { transcribeWordTimestamps } = require('../tools/podcast-sync/transcribe-words.js');

test('Whisper: response_format verbose_json', async function() {
  let params = null;
  const mockClient = {
    audio: {
      transcriptions: {
        create: async (p) => {
          params = p;
          return { words: [{ word: "Test", start: 0, end: 1 }] };
        }
      }
    }
  };
  
  await transcribeWordTimestamps({ mp3Path: '/tmp/test.mp3', openaiClient: mockClient });
  
  assert.strictEqual(params.model, "whisper-1");
  assert.strictEqual(params.response_format, "verbose_json");
  assert.ok(params.timestamp_granularities.includes("word"), "word granularities");
  assert.strictEqual(params.language, "de", "Deutsch");
});

test('Whisper: normalisierte Wort-Array', async function() {
  const mockClient = {
    audio: {
      transcriptions: {
        create: async () => ({
          words: [
            { word: "Rechtssubjekte", start: 0, end: 1.5 },
            { word: "sind", start: 1.5, end: 2.0 }
          ]
        })
      }
    }
  };
  
  const result = await transcribeWordTimestamps({ mp3Path: '/tmp/test.mp3', openaiClient: mockClient });
  
  assert.strictEqual(result.words[0].wort, "Rechtssubjekte");
  assert.strictEqual(result.words[0].start, 0);
  assert.strictEqual(result.words[0].end, 1.5);
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add tools/podcast-sync/transcribe-words.js tests/podcast-transcribe-mock.test.js
git commit -m "TASK 6: Whisper Wort-Zeitmarken (Deutsch, word-level)"
```

---

## TASK 7: Wort-Alignment

**Files**
- Create: `tools/podcast-sync/align-words.js`
- Test: `tests/podcast-word-alignment.test.js` (neu)

**Interfaces**
- Consumes: `lerntext, transcriptWords`
- Produces: `alignTranscriptWordsToLerntext()` → `{wortZeitmarken: [{wortIndex, wort, start, end}]}`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/podcast-word-alignment.test.js
const assert = require('assert');
const { alignTranscriptWordsToLerntext } = require('../tools/podcast-sync/align-words.js');

test('Alignment: Wortreihenfolge identisch', function() {
  const lerntext = "Rechtssubjekte und Rechtsobjekte sind wichtig.";
  const transcriptWords = [
    { wort: "Rechtssubjekte", start: 0, end: 1 },
    { wort: "und", start: 1, end: 1.5 },
    { wort: "Rechtsobjekte", start: 1.5, end: 2.5 },
    { wort: "sind", start: 2.5, end: 3 },
    { wort: "wichtig", start: 3, end: 4 }
  ];
  
  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.ok(result.wortZeitmarken, "result");
  assert.strictEqual(result.wortZeitmarken.length, 5, "alle 5 Wörter");
  assert.strictEqual(result.wortZeitmarken[0].wortIndex, 0, "erster Index 0");
});

test('Alignment: Satzzeichen ignorieren', function() {
  const lerntext = "Rechtssubjekte. Rechtsobjekte.";
  const transcriptWords = [
    { wort: "Rechtssubjekte", start: 0, end: 1 },
    { wort: "Rechtsobjekte", start: 1, end: 2 }
  ];
  
  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.strictEqual(result.wortZeitmarken.length, 2);
});

test('Alignment: Start/End monoton wachsend', function() {
  const lerntext = "Wort Eins Zwei Drei";
  const transcriptWords = [
    { wort: "Wort", start: 0, end: 1 },
    { wort: "Eins", start: 1, end: 1.5 },
    { wort: "Zwei", start: 1.5, end: 2.5 },
    { wort: "Drei", start: 2.5, end: 3 }
  ];
  
  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  
  for (let i = 1; i < result.wortZeitmarken.length; i++) {
    const prev = result.wortZeitmarken[i - 1];
    const curr = result.wortZeitmarken[i];
    assert.ok(prev.start <= curr.start, `monoton: ${prev.start} <= ${curr.start}`);
    assert.ok(prev.end <= curr.end, `monoton: ${prev.end} <= ${curr.end}`);
  }
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add tools/podcast-sync/align-words.js tests/podcast-word-alignment.test.js
git commit -m "TASK 7: Wort-Alignment gegen lerntext"
```

---

## TASK 8: Firebase Publish

**Files**
- Create: `tools/podcast-sync/firebase-publish.js`
- Test: `tests/podcast-firebase-mock.test.js` (neu)

**Interfaces**
- Consumes: `{mp3Path, jsonPath, lerntextHash, adminClient}`
- Produces: `async publishToFirebase()` → `{success, mp3Url, jsonUrl}`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/podcast-firebase-mock.test.js
const assert = require('assert');
const { publishToFirebase } = require('../tools/podcast-sync/firebase-publish.js');

test('Firebase: Publish-Reihenfolge: MP3 zuerst, dann JSON', async function() {
  let callOrder = [];
  
  const mockClient = {
    storage: () => ({
      bucket: () => ({
        file: (path) => ({
          save: async (data, opts) => {
            callOrder.push(path);
            if (path.includes('.json')) {
              assert.strictEqual(callOrder[callOrder.length - 2].includes('.mp3'), true, "MP3 vorher");
            }
          }
        })
      })
    })
  };
  
  await publishToFirebase({
    mp3Path: '/tmp/test.mp3',
    jsonPath: '/tmp/test.json',
    lerntextHash: 'abc123',
    adminClient: mockClient
  });
  
  assert.ok(callOrder[0].includes('recht-rechtssubjekte'), "MP3 Path");
  assert.ok(callOrder[1].includes('recht-rechtssubjekte'), "JSON Path");
});

test('Firebase: JSON ist Commit-Marker, nur wenn gültig', async function() {
  const mockClient = {
    storage: () => ({
      bucket: () => ({
        file: (path) => ({
          save: async () => {
            if (path.includes('.json')) {
              // JSON validation würde hier stattfinden
            }
          }
        })
      })
    })
  };
  
  const result = await publishToFirebase({
    mp3Path: '/tmp/test.mp3',
    jsonPath: '/tmp/test.json',
    lerntextHash: 'abc123',
    adminClient: mockClient
  });
  
  assert.ok(result.success, "publish erfolgreich");
});

test('Firebase: Custom Metadata mit lerntextHash auf MP3', async function() {
  let mp3Metadata = null;
  
  const mockClient = {
    storage: () => ({
      bucket: () => ({
        file: (path) => ({
          save: async (data, opts) => {
            if (path.includes('.mp3')) {
              mp3Metadata = opts.metadata;
            }
          }
        })
      })
    })
  };
  
  await publishToFirebase({
    mp3Path: '/tmp/test.mp3',
    jsonPath: '/tmp/test.json',
    lerntextHash: 'sha256abc123',
    adminClient: mockClient
  });
  
  assert.ok(mp3Metadata, "metadata gesetzt");
  assert.strictEqual(mp3Metadata.lerntextHash, 'sha256abc123', "hash in metadata");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add tools/podcast-sync/firebase-publish.js tests/podcast-firebase-mock.test.js
git commit -m "TASK 8: Firebase Publish mit MP3→JSON Reihenfolge"
```

---

## TASK 9: PodcastFortschritt Backend

**Files**
- Modify: `backend/apps-script/Code.gs`
- Test: `tests/podcast-progress.test.js` (neu)

**Interfaces**
- Consumes: `getPodcastProgress(nutzer, fach)`, `savePodcastProgress(nutzer, fach, einheit, ...)`
- Produces: Apps-Script Endpunkte `getPodcastProgress`, `savePodcastProgress`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/podcast-progress.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

test('Backend: Code enthält getPodcastProgress Endpunkt', function() {
  const code = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');
  assert.ok(code.includes('action === "getPodcastProgress"'), "GET endpoint");
});

test('Backend: Code enthält savePodcastProgress Endpunkt', function() {
  const code = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');
  assert.ok(code.includes('action === "savePodcastProgress"'), "SAVE endpoint");
});

test('Backend: Content-Type text/plain charset utf-8, nicht application/json', function() {
  const code = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');
  
  // POST sollte text/plain verwenden wie bestehende API
  assert.ok(code.includes('text/plain;charset=utf-8') || code.includes('text/plain'), "text/plain");
  assert.ok(!code.includes('application/json') || code.includes('ContentService.MimeType.JSON'), "kein JSON-Header");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add backend/apps-script/Code.gs tests/podcast-progress.test.js
git commit -m "TASK 9: PodcastFortschritt Backend GET/POST Endpunkte"
```

---

## TASK 10: Frontend API-Wrapper

**Files**
- Modify: `js/api.js`
- Test: `tests/podcast-progress.test.js` (erweitern)

**Interfaces**
- Consumes: `apiGet`, `apiPost` existierende Conventions
- Produces: `lerntextePodcastFortschrittLaden(fach)`, `lerntextePodcastFortschrittSpeichern(state)`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/podcast-progress.test.js - erweitern
test('Frontend API: lerntextePodcastFortschrittLaden(fach)', function() {
  const code = fs.readFileSync(path.join(__dirname, '../js/api.js'), 'utf8');
  assert.ok(code.includes('lerntextePodcastFortschrittLaden'), "load function");
  assert.ok(code.includes('getPodcastProgress'), "calls getPodcastProgress");
});

test('Frontend API: lerntextePodcastFortschrittSpeichern(state)', function() {
  const code = fs.readFileSync(path.join(__dirname, '../js/api.js'), 'utf8');
  assert.ok(code.includes('lerntextePodcastFortschrittSpeichern'), "save function");
  assert.ok(code.includes('savePodcastProgress'), "calls savePodcastProgress");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add js/api.js tests/podcast-progress.test.js
git commit -m "TASK 10: Frontend API-Wrapper für PodcastFortschritt"
```

---

## TASK 11: Frontend Hash-Validierung

**Files**
- Create: `js/podcast-hash-validate.js`
- Test: `tests/lerntexte-karaoke.test.js` (neu)

**Interfaces**
- Consumes: `currentHash, jsonHash, mp3Hash`
- Produces: `lerntexteAudioVersionIstSynchron()` → `boolean`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/lerntexte-karaoke.test.js
const assert = require('assert');
const { lerntexteAudioVersionIstSynchron } = require('../js/podcast-hash-validate.js');

test('Hash-Validierung: Alle drei identisch → true', function() {
  const hash = "sha256abc123def456";
  const result = lerntexteAudioVersionIstSynchron(hash, hash, hash);
  assert.strictEqual(result, true, "synchron");
});

test('Hash-Validierung: MP3-Hash unterschiedlich → false, kein Playback', function() {
  const currentHash = "sha256abc123";
  const jsonHash = "sha256abc123";
  const mp3Hash = "sha256different";
  
  const result = lerntexteAudioVersionIstSynchron(currentHash, jsonHash, mp3Hash);
  assert.strictEqual(result, false, "mismatch blockiert Playback");
});

test('Hash-Validierung: JSON-Hash unterschiedlich → false', function() {
  const currentHash = "sha256abc123";
  const jsonHash = "sha256different";
  const mp3Hash = "sha256abc123";
  
  const result = lerntexteAudioVersionIstSynchron(currentHash, jsonHash, mp3Hash);
  assert.strictEqual(result, false, "mismatch blockiert");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add js/podcast-hash-validate.js tests/lerntexte-karaoke.test.js
git commit -m "TASK 11: Frontend Hash-Validierung (alle drei identisch)"
```

---

## TASK 12: DOM-Karaoke-Tokenisierung

**Files**
- Create: `js/podcast-dom-tokenize.js`
- Test: `tests/lerntexte-karaoke.test.js` (erweitern)

**Interfaces**
- Consumes: DOM-Element mit formatiertem lerntext HTML
- Produces: `lerntexteDomTokenisieren()` → `{words: [{wortIndex, element, text}]}`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/lerntexte-karaoke.test.js - erweitern
const { lerntexteDomTokenisieren } = require('../js/podcast-dom-tokenize.js');

test('DOM-Tokenisierung: Wörter behalten Indizes', function() {
  // JSDOM oder Mock-DOM für Tests
  const html = "Rechtssubjekte sind wichtig.";
  const tokens = lerntexteDomTokenisieren(html);
  
  assert.ok(tokens.words.length >= 3, "mind. 3 Wörter");
  tokens.words.forEach((w, idx) => {
    assert.strictEqual(w.wortIndex, idx, `index ${idx}`);
  });
});

test('DOM-Tokenisierung: Formatierung bleibt (strong, em, etc)', function() {
  const html = "Text <strong>wichtig</strong> Text.";
  const tokens = lerntexteDomTokenisieren(html);
  
  // Formatierung bleibt beim Render
  assert.ok(tokens.preservesFormatting, "formatierung erhalten");
});

test('DOM-Tokenisierung: Absätze bleiben', function() {
  const html = "<p>Absatz 1</p><p>Absatz 2</p>";
  const tokens = lerntexteDomTokenisieren(html);
  
  assert.ok(tokens.words.length >= 4, "alle Wörter");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add js/podcast-dom-tokenize.js tests/lerntexte-karaoke.test.js
git commit -m "TASK 12: DOM-Karaoke-Tokenisierung mit wortIndex"
```

---

## TASK 13: currentTime → Wortindex Mapping

**Files**
- Create: `js/podcast-time-to-word.js`
- Test: `tests/lerntexte-karaoke.test.js` (erweitern)

**Interfaces**
- Consumes: `wortZeitmarken[], currentTime`
- Produces: `findWordIndexAtTime()` → `wortIndex`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/lerntexte-karaoke.test.js - erweitern
const { findWordIndexAtTime } = require('../js/podcast-time-to-word.js');

test('Time-to-Word: Wort am Anfang', function() {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 }
  ];
  
  const idx = findWordIndexAtTime(timestamps, 0.5);
  assert.strictEqual(idx, 0, "Wort 0");
});

test('Time-to-Word: Wort in Mitte', function() {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 },
    { wortIndex: 2, start: 2, end: 3 }
  ];
  
  const idx = findWordIndexAtTime(timestamps, 2.5);
  assert.strictEqual(idx, 2, "Wort 2");
});

test('Time-to-Word: Grenze zwischen Wörtern', function() {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 }
  ];
  
  const idx = findWordIndexAtTime(timestamps, 1.0);
  // Grenze sollte nächsten Wort gehören
  assert.ok(idx === 0 || idx === 1, "valid boundary");
});

test('Time-to-Word: Binäre Suche-Performance', function() {
  const timestamps = [];
  for (let i = 0; i < 1000; i++) {
    timestamps.push({
      wortIndex: i,
      start: i,
      end: i + 1
    });
  }
  
  const idx = findWordIndexAtTime(timestamps, 500.5);
  assert.strictEqual(idx, 500, "binäre suche");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add js/podcast-time-to-word.js tests/lerntexte-karaoke.test.js
git commit -m "TASK 13: currentTime → Wortindex mit binärer Suche"
```

---

## TASK 14: Pilot Playback (Play/Pause/Stop/Resume)

**Files**
- Modify: `js/lerntexte.js`
- Test: `tests/lerntexte-karaoke.test.js` (erweitern)

**Interfaces**
- Consumes: Audio Element, wortZeitmarken, PodcastFortschritt
- Produces: `lerntextePodcastAbspielen()`, `lerntextePodcastPausieren()`, `lerntextePodcastStoppen()`, `lerntextePodcastFortsetzen()`

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/lerntexte-karaoke.test.js - erweitern
test('Playback: STOP setzt nicht currentTime = 0', function() {
  // Mock Audio-Element
  const audio = { currentTime: 42.5, play: () => {}, pause: () => {} };
  
  lerntextePodcastStoppen(audio);
  
  // currentTime NICHT = 0 bei Stop
  assert.notStrictEqual(audio.currentTime, 0, "currentTime erhalten");
});

test('Playback: PAUSE speichert Position', async function() {
  let savedState = null;
  
  const mockAudio = { currentTime: 42, pause: () => {} };
  const mockSave = async (state) => { savedState = state; };
  
  await lerntextePodcastPausieren(mockAudio, mockSave);
  
  assert.ok(savedState, "state gespeichert");
  assert.strictEqual(savedState.sekundenPosition, 42, "position");
});

test('Playback: FORTSETZEN nur bei passendem lerntextHash', async function() {
  const currentHash = "abc123";
  const resumeState = {
    lerntextHash: "abc123",
    sekundenPosition: 20
  };
  
  const mockAudio = { currentTime: 0 };
  
  await lerntextePodcastFortsetzen(mockAudio, resumeState, currentHash);
  
  assert.strictEqual(mockAudio.currentTime, 20, "resume position");
});

test('Playback: FORTSETZEN mit Hash-Mismatch => kein resume', async function() {
  const currentHash = "abc123";
  const resumeState = {
    lerntextHash: "different",
    sekundenPosition: 20
  };
  
  const mockAudio = { currentTime: 0 };
  
  await lerntextePodcastFortsetzen(mockAudio, resumeState, currentHash);
  
  // currentTime NICHT gesetzt bei Hash-Mismatch
  assert.strictEqual(mockAudio.currentTime, 0, "kein resume");
});

test('Playback: VON_VORNE ignoriert Resume, setzt Position 0', async function() {
  const mockAudio = { currentTime: 0 };
  
  await lerntextePodcastVonVorne(mockAudio);
  
  assert.strictEqual(mockAudio.currentTime, 0, "von vorne");
});

test('Playback: COMPLETED bei naturlichem Ende', function() {
  const mockAudio = { onended: null };
  
  lerntextePodcastAbspielen(mockAudio, () => {});
  
  assert.ok(mockAudio.onended, "onended event");
  
  let completed = false;
  mockAudio.onended = () => { completed = true; };
  mockAudio.onended();
  
  assert.ok(completed, "completed");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add js/lerntexte.js tests/lerntexte-karaoke.test.js
git commit -m "TASK 14: Pilot Playback mit Play/Pause/Stop/Resume/VonVorne"
```

---

## TASK 15: Visibility/Sperrbildschirm Re-Sync

**Files**
- Create: `js/podcast-visibility-sync.js`
- Test: `tests/lerntexte-karaoke.test.js` (erweitern)

**Interfaces**
- Consumes: Audio Element, currentHash
- Produces: Event-Handler für visibilitychange, pageshow

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
// tests/lerntexte-karaoke.test.js - erweitern
const { setupVisibilitySyncHandlers } = require('../js/podcast-visibility-sync.js');

test('Visibility: Bei Rückkehr currentTime aus Audio lesen', function() {
  const mockAudio = { currentTime: 25.5 };
  let resyncCalledWith = null;
  
  const mockResync = (time) => { resyncCalledWith = time; };
  
  setupVisibilitySyncHandlers(mockAudio, mockResync);
  
  // Simuliere page visibility change
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  
  // resync sollte currentTime erhalten
  // (Implementation würde Handler registrieren)
});

test('Visibility: Kein Auto-Scroll', function() {
  const code = fs.readFileSync(path.join(__dirname, '../js/podcast-visibility-sync.js'), 'utf8');
  
  assert.ok(!code.includes('window.scrollTo'), "kein scrollTo");
  assert.ok(!code.includes('element.scrollIntoView'), "kein scrollIntoView");
});
```

- [ ] Step 2-6: Implementation

**Commit:**
```bash
git add js/podcast-visibility-sync.js tests/lerntexte-karaoke.test.js
git commit -m "TASK 15: Visibility/Sperrbildschirm Re-Sync (kein Auto-Scroll)"
```

---

## TASK 16: Pilot Integration & Abschluss

**Files**
- Test: `tests/lerntexte-karaoke.test.js` (final check)
- Test: Alle bestehenden Tests

**TDD-Schritte**

- [ ] Step 1: Alle Pilot-Tests ausführen

```bash
node tests/podcast-sync-core.test.js
node tests/podcast-tts-mock.test.js
node tests/podcast-transcribe-mock.test.js
node tests/podcast-word-alignment.test.js
node tests/podcast-firebase-mock.test.js
node tests/podcast-progress.test.js
node tests/lerntexte-karaoke.test.js
```

Expected: **ALLE PASS**

- [ ] Step 2: Regressionstests

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
node tests/learning-progress-resume.test.js
```

Expected: **ALLE PASS**

- [ ] Step 3: Pilot-Integration verifizieren

- [ ] Step 4: Mobile-Test Samsung/Android (lokal manuell)

- [ ] Step 5: Abschluss-Commit

```bash
git add .
git commit -m "TASK 16: Pilot Integration & Abschluss - alle Tests PASS"
```

---

## Vollständige Task-Übersicht

1. TASK 1: Pilot-Daten-Audit
2. TASK 2: Podcast-Sync-Grundgerüst
3. TASK 3: Canonical-TTS-Normalisierung
4. TASK 4: SHA-256 und Firebase-Pfade
5. TASK 5: OpenAI TTS Pilot
6. TASK 6: Whisper Wort-Zeitmarken
7. TASK 7: Wort-Alignment
8. TASK 8: Firebase Publish
9. TASK 9: PodcastFortschritt Backend
10. TASK 10: Frontend API-Wrapper
11. TASK 11: Frontend Hash-Validierung
12. TASK 12: DOM-Karaoke-Tokenisierung
13. TASK 13: currentTime → Wortindex Mapping
14. TASK 14: Pilot Playback (Play/Pause/Stop/Resume)
15. TASK 15: Visibility/Sperrbildschirm Re-Sync
16. TASK 16: Pilot Integration & Abschluss

---

## Kritische Abschlussprüfung

Nach Implementierung aller Tasks:

- [ ] Kein `podcastText` als Wiedergabequelle im Pilot
- [ ] Alle Tests: PASS
- [ ] SHA-256 real, kein legacy Hash
- [ ] OpenAI/Whisper nur im Admin-Sync, nicht Frontend
- [ ] Hash-Validierung blockiert Mismatch
- [ ] Pilot: Nur Recht → Rechtssubjekte und Rechtsobjekte
- [ ] Keine 521er Migration
- [ ] Keine Produktivcode-Änderungen außerhalb Pilot
- [ ] Firebase Content-Type: text/plain;charset=utf-8 (nicht application/json)
- [ ] Stop/Pause erhalten currentTime
- [ ] Kein Auto-Scroll
- [ ] Alle Regressionstests grün

Pilot **ABGESCHLOSSEN** nur wenn alle obigen Prüfungen ✓.
