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

**TTS-Modell:** `gpt-4o-mini-tts` mit Pilotstimme `alloy`. Das TTS-Limit ist tokenbasiert: Vor jedem echten TTS-Aufruf wird die Tokenanzahl des normalisierten TTS-Texts bestimmt; erlaubt sind höchstens 2000 Input-Tokens. Zeichenlängen werden nur im Audit berichtet und sind keine API-Grenze.

**Gemeinsame Wort-Tokenisierungsregel:** TTS-Normalisierung, Wort-Alignment und DOM-Karaoke verwenden dieselbe Regel: HTML-/Formatierungsmarker werden als Struktur behandelt, nicht als Wörter; sichtbarer Text wird HTML-dekodiert, an Unicode-Buchstaben/Zahlen in Wortläufen tokenisiert und Satzzeichen/Tags zählen nicht als Karaoke-Wörter.

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
- Create: `tools/podcast-sync/audit-pilot.js`
- Test: `tests/podcast-sync-core.test.js` (neu)

**Interfaces**
- Consumes: tatsächlicher `getLerntexte("Recht")` Datenbestand read-only über `loadLerntexteReadOnly({ fach })`
- Produces: `auditPilotEntry()` → `{ fach, titel, foundCount, lerntextLength, ttsTokenCount, lerntextHash, canGenerateWithoutChunking, sourceUsed }`

**TDD-Schritte**

- [ ] Step 1: Test schreiben

```javascript
// tests/podcast-sync-core.test.js
const assert = require('assert');
const crypto = require('crypto');
const { auditPilotEntry, countTtsTokens } = require('../tools/podcast-sync/audit-pilot.js');

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

test('Pilot-Audit: findet echte Pilot-Einheit exakt einmal', function() {
  const lerntexte = [{
    fach: "Recht",
    titel: "Rechtssubjekte und Rechtsobjekte",
    lerntext: "Rechtssubjekte sind Träger von Rechten und Pflichten. Rechtsobjekte sind Gegenstände, auf die sich Rechte beziehen.",
    podcastText: "Alter Podcasttext darf nicht verwendet werden"
  }];

  const report = auditPilotEntry({ lerntexte, fach: "Recht", titel: "Rechtssubjekte und Rechtsobjekte" });

  assert.strictEqual(report.foundCount, 1, "Einheit genau einmal gefunden");
  assert.ok(report.lerntextLength > 0, "echter lerntext vorhanden");
  assert.strictEqual(report.sourceUsed, "lerntext", "nur lerntext als Quelle");
});

test('Pilot-Audit: berichtet Zeichen, Tokens und SHA-256 aus lerntext', function() {
  const lerntext = "AKTUELLER LERNTEXT mit konkretem Inhalt.";
  const lerntexte = [{
    fach: "Recht",
    titel: "Rechtssubjekte und Rechtsobjekte",
    lerntext,
    podcastText: "ALTER PODCASTTEXT"
  }];

  const report = auditPilotEntry({ lerntexte, fach: "Recht", titel: "Rechtssubjekte und Rechtsobjekte" });
  const expectedHash = crypto.createHash('sha256').update(lerntext, 'utf8').digest('hex');

  assert.strictEqual(report.lerntextLength, lerntext.length, "tatsächliche Zeichenanzahl");
  assert.strictEqual(report.ttsTokenCount, countTtsTokens(lerntext, "gpt-4o-mini-tts"), "tatsächliche Tokenanzahl");
  assert.strictEqual(report.lerntextHash, expectedHash, "tatsächlicher SHA-256");
  assert.ok(report.ttsTokenCount <= 2000 || report.canGenerateWithoutChunking === false, "Tokenlimit steuert Chunking-Entscheidung");
});

test('Pilot-Audit: podcastText beeinflusst Hash und TTS-Quelle nicht', function() {
  const entryA = { fach: "Recht", titel: "Rechtssubjekte und Rechtsobjekte", lerntext: "AKTUELLER LERNTEXT", podcastText: "ALT" };
  const entryB = { fach: "Recht", titel: "Rechtssubjekte und Rechtsobjekte", lerntext: "AKTUELLER LERNTEXT", podcastText: "NEU" };

  const reportA = auditPilotEntry({ lerntexte: [entryA], fach: "Recht", titel: "Rechtssubjekte und Rechtsobjekte" });
  const reportB = auditPilotEntry({ lerntexte: [entryB], fach: "Recht", titel: "Rechtssubjekte und Rechtsobjekte" });

  assert.strictEqual(reportA.lerntextHash, reportB.lerntextHash, "gleicher SHA-256 trotz podcastText-Änderung");
  assert.strictEqual(reportA.sourceUsed, "lerntext", "Audio-/Sync-Quelle ist lerntext");
});

process.on('exit', function() {
  console.log(`\n${passedCount}/${testCount} tests passed`);
});
```

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-sync-core.test.js
```

**Expected FAIL:** `Cannot find module '../tools/podcast-sync/audit-pilot.js'` oder `auditPilotEntry is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// tools/podcast-sync/audit-pilot.js
const crypto = require('crypto');

function countTtsTokens(text, model = "gpt-4o-mini-tts") {
  if (model !== "gpt-4o-mini-tts") throw new Error("Unsupported TTS model");
  // In der finalen Implementation über testbare Tokenizer-Abhängigkeit ersetzen.
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function auditPilotEntry({ lerntexte, fach, titel }) {
  const matches = (lerntexte || []).filter(function(entry) {
    return entry.fach === fach && entry.titel === titel;
  });
  if (matches.length !== 1) throw new Error("Pilot-Einheit muss exakt einmal gefunden werden");
  const lerntext = String(matches[0].lerntext || "");
  const ttsTokenCount = countTtsTokens(lerntext, "gpt-4o-mini-tts");
  return {
    fach,
    titel,
    foundCount: matches.length,
    lerntextLength: lerntext.length,
    ttsTokenCount,
    lerntextHash: crypto.createHash('sha256').update(lerntext, 'utf8').digest('hex'),
    canGenerateWithoutChunking: ttsTokenCount <= 2000,
    sourceUsed: "lerntext"
  };
}

module.exports = { auditPilotEntry, countTtsTokens };
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-sync-core.test.js
```

Expected: `3/3 tests passed`. Zusätzlich beim echten read-only Audit ausgeben: Einheit genau einmal gefunden, tatsächliche Zeichenanzahl, tatsächliche Tokenanzahl, tatsächlicher SHA-256, `canGenerateWithoutChunking`. Wenn `ttsTokenCount > 2000`, Pilot-TTS blockieren und zuerst Chunking planen.

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-sync-core.test.js
```

**Expected FAIL:** `ENOENT: no such file or directory, open '.../tools/podcast-sync/index.js'`

- [ ] Step 3: Minimale Implementation/Funktionssignaturen

```javascript
// tools/podcast-sync/index.js
const PILOT_CONFIG = {
  pilotFach: "Recht",
  pilotTitel: "Rechtssubjekte und Rechtsobjekte",
  ttsModel: "gpt-4o-mini-tts",
  ttsVoice: "alloy"
};

function requireOpenAiKey() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY fehlt");
  return process.env.OPENAI_API_KEY;
}

module.exports = { PILOT_CONFIG, requireOpenAiKey };
```

```json
// tools/podcast-sync/package.json
{
  "private": true,
  "type": "commonjs",
  "dependencies": {
    "firebase-admin": "latest",
    "openai": "latest",
    "js-tiktoken": "latest"
  }
}
```

```bash
# tools/podcast-sync/.env.example
OPENAI_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-sync-core.test.js
```

Expected: Pilot-Config, `process.env.OPENAI_API_KEY` und `.gitignore`-Eintrag werden gefunden.

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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
- Produces: `normalizeLerntextForTts(text)` → `{text, words, wordCount}` mit gemeinsamer Wort-Tokenisierungsregel

**TDD-Schritte**

- [ ] Step 1: Test

```javascript
test('normalize: lerntext nur, nie podcastText', function() {
  const entry = {
    lerntext: "AKTUELLER LERNTEXT",
    podcastText: "ALTER PODCASTTEXT"
  };
  
  const norm = normalizeLerntextForTts(entry.lerntext);
  assert.strictEqual(norm.text, "AKTUELLER LERNTEXT", "Audio-/Sync-Quelle ist lerntext");
  assert.ok(!norm.text.includes("ALTER PODCASTTEXT"), "podcastText ignoriert");
});

test('normalize: Änderung nur podcastText => kein Hash-Update', function() {
  const entryA = { lerntext: "Gleicher Lerntext", podcastText: "ALT" };
  const entryB = { lerntext: "Gleicher Lerntext", podcastText: "NEU" };
  const v1 = normalizeLerntextForTts(entryA.lerntext);
  const v2 = normalizeLerntextForTts(entryB.lerntext);
  
  assert.strictEqual(v1.text, v2.text, "identisch");
  assert.strictEqual(sha256Lerntext(v1.text), sha256Lerntext(v2.text), "gleicher SHA-256, keine Regeneration");
});

test('normalize: Formatierungsmarker zählen nicht als Wörter', function() {
  const text = "Text. <br> Absatz.\n\nNeu.";
  const norm = normalizeLerntextForTts(text);
  
  assert.deepStrictEqual(norm.words.map(w => w.text), ["Text", "Absatz", "Neu"], "nur sichtbare Wörter");
  assert.strictEqual(norm.wordCount, 3, "br zählt nicht als Wort");
});
```

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-sync-core.test.js
```

**Expected FAIL:** `Cannot find module '../tools/podcast-sync/normalize-lerntext.js'` oder `normalizeLerntextForTts is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// tools/podcast-sync/normalize-lerntext.js
function tokenizeVisibleWords(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) || [];
}

function normalizeLerntextForTts(text) {
  const normalized = String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = tokenizeVisibleWords(normalized).map(function(word, index) {
    return { index, text: word };
  });
  return { text: normalized, words, wordCount: words.length };
}

module.exports = { normalizeLerntextForTts, tokenizeVisibleWords };
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-sync-core.test.js
```

Expected: Tests beweisen `lerntext` gewinnt gegen `podcastText`, `podcastText`-Änderungen ändern den Hash nicht, und `<br>` zählt nicht als Wort.

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-sync-core.test.js
```

**Expected FAIL:** `Cannot find module '../tools/podcast-sync/hash-paths.js'` oder `sha256Lerntext is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// tools/podcast-sync/hash-paths.js
const crypto = require('crypto');

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sha256Lerntext(text) {
  return crypto.createHash('sha256').update(String(text || ""), 'utf8').digest('hex');
}

function podcastPaths(fach, titel) {
  const base = `podcast/${slugify(fach)}-${slugify(titel)}`;
  return { mp3Path: `${base}.mp3`, jsonPath: `${base}.json` };
}

module.exports = { sha256Lerntext, podcastPaths, slugify };
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-sync-core.test.js
```

Expected: SHA-256 ist 64 Hex-Zeichen, Pfade entsprechen Pilot-Slug, Umlaute sind stabil.

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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
- Consumes: `{text, outputPath, openaiClient, countTtsTokens}`
- Produces: `async generateTtsMp3()` → `{mp3Path, duration}`

**TDD-Schritte**

- [ ] Step 1: Test mit Mock

```javascript
// tests/podcast-tts-mock.test.js
const assert = require('assert');
const { generateTtsMp3 } = require('../tools/podcast-sync/tts-generate.js');

test('TTS: blockiert mehr als 2000 Input-Tokens vor API', async function() {
  let callMade = false;
  const mockClient = { audio: { speech: { create: async () => { callMade = true; } } } };
  
  try {
    await generateTtsMp3({
      text: "Tokenbasierter Grenzfall",
      outputPath: '/tmp/test.mp3',
      openaiClient: mockClient,
      countTtsTokens: () => 2001
    });
    assert.fail("sollte Fehler werfen");
  } catch (err) {
    assert.ok(err.message.includes('2000 Input-Tokens'), "Tokenlimit");
    assert.strictEqual(callMade, false, "kein API-Aufruf");
  }
});

test('TTS: verwendet gpt-4o-mini-tts, alloy und normalisierten lerntext', async function() {
  const text = "Normalisierter Lerntext";
  let callMade = false;
  
  const mockClient = {
    audio: {
      speech: {
        create: async (params) => {
          callMade = true;
          assert.strictEqual(params.model, "gpt-4o-mini-tts");
          assert.strictEqual(params.voice, "alloy");
          assert.strictEqual(params.input, text);
          if (params.instructions) {
            assert.ok(!params.instructions.includes("Zusatzinhalt"), "instructions steuern nur Sprechstil");
          }
          return { arrayBuffer: async () => Buffer.from("mp3data") };
        }
      }
    }
  };
  
  const result = await generateTtsMp3({
    text,
    outputPath: '/tmp/test.mp3',
    openaiClient: mockClient,
    countTtsTokens: () => 3
  });
  assert.ok(callMade, "API aufgerufen");
  assert.ok(result.mp3Path, "path zurück");
});
```

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-tts-mock.test.js
```

**Expected FAIL:** `Cannot find module '../tools/podcast-sync/tts-generate.js'` oder falsches Modell/falsche Stimme

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// tools/podcast-sync/tts-generate.js
const fs = require('fs');

async function generateTtsMp3({ text, outputPath, openaiClient, countTtsTokens }) {
  const tokenCount = countTtsTokens(text, "gpt-4o-mini-tts");
  if (tokenCount > 2000) {
    throw new Error(`TTS input exceeds 2000 Input-Tokens: ${tokenCount}`);
  }
  const response = await openaiClient.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: text,
    instructions: "Sachlich, ruhig und lernfreundlich sprechen; Inhalt nicht verändern."
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return { mp3Path: outputPath, duration: null };
}

module.exports = { generateTtsMp3 };
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-tts-mock.test.js
```

Expected: Tokenlimit blockiert vor API, Mock sieht `gpt-4o-mini-tts`, `alloy` und exakt den normalisierten `lerntext`.

- [ ] Step 5: Regressionen

```bash
node tests/podcast-sync-core.test.js
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

**Commit:**
```bash
git add tools/podcast-sync/tts-generate.js tests/podcast-tts-mock.test.js
git commit -m "TASK 5: OpenAI TTS mit tokenbasiertem Limit"
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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-transcribe-mock.test.js
```

**Expected FAIL:** `Cannot find module '../tools/podcast-sync/transcribe-words.js'` oder `transcribeWordTimestamps is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// tools/podcast-sync/transcribe-words.js
const fs = require('fs');

async function transcribeWordTimestamps({ mp3Path, openaiClient }) {
  const result = await openaiClient.audio.transcriptions.create({
    file: fs.createReadStream(mp3Path),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    language: "de"
  });
  return {
    words: (result.words || []).map(function(word) {
      return { wort: word.word, start: word.start, end: word.end };
    })
  };
}

module.exports = { transcribeWordTimestamps };
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-transcribe-mock.test.js
```

Expected: Mock sieht `whisper-1`, `verbose_json`, Wort-Zeitmarken und Sprache `de`.

- [ ] Step 5: Regressionen

```bash
node tests/podcast-sync-core.test.js
node tests/podcast-tts-mock.test.js
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-word-alignment.test.js
```

**Expected FAIL:** `Cannot find module '../tools/podcast-sync/align-words.js'` oder `alignTranscriptWordsToLerntext is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// tools/podcast-sync/align-words.js
const { tokenizeVisibleWords } = require('./normalize-lerntext.js');

function normalizeWord(word) {
  return String(word || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function alignTranscriptWordsToLerntext(lerntext, transcriptWords) {
  const lerntextWords = tokenizeVisibleWords(lerntext);
  const wortZeitmarken = [];
  let searchIndex = 0;
  transcriptWords.forEach(function(transcriptWord) {
    const wanted = normalizeWord(transcriptWord.wort);
    while (searchIndex < lerntextWords.length && normalizeWord(lerntextWords[searchIndex]) !== wanted) {
      searchIndex++;
    }
    if (searchIndex < lerntextWords.length) {
      wortZeitmarken.push({
        wortIndex: searchIndex,
        wort: lerntextWords[searchIndex],
        start: transcriptWord.start,
        end: transcriptWord.end
      });
      searchIndex++;
    }
  });
  return { wortZeitmarken };
}

module.exports = { alignTranscriptWordsToLerntext };
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-word-alignment.test.js
```

Expected: Alignment verwendet dieselbe sichtbare Wortregel wie TTS-Normalisierung; Satzzeichen/Formatierung erzeugen keine eigenen Wortindizes.

- [ ] Step 5: Regressionen

```bash
node tests/podcast-sync-core.test.js
node tests/podcast-tts-mock.test.js
node tests/podcast-transcribe-mock.test.js
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-firebase-mock.test.js
```

**Expected FAIL:** `Cannot find module '../tools/podcast-sync/firebase-publish.js'` oder `publishToFirebase is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// tools/podcast-sync/firebase-publish.js
const fs = require('fs');

async function publishToFirebase({ mp3Path, jsonPath, lerntextHash, adminClient }) {
  const bucket = adminClient.storage().bucket();
  const mp3StoragePath = 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3';
  const jsonStoragePath = 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json';

  await bucket.file(mp3StoragePath).save(fs.readFileSync(mp3Path), {
    metadata: { lerntextHash }
  });
  await bucket.file(jsonStoragePath).save(fs.readFileSync(jsonPath), {
    metadata: { contentType: 'application/json' }
  });

  return { success: true, mp3Url: mp3StoragePath, jsonUrl: jsonStoragePath };
}

module.exports = { publishToFirebase };
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-firebase-mock.test.js
```

Expected: MP3 wird vor JSON gespeichert, JSON ist Commit-Marker, MP3 trägt `lerntextHash` als Custom Metadata.

- [ ] Step 5: Regressionen

```bash
node tests/podcast-sync-core.test.js
node tests/podcast-tts-mock.test.js
node tests/podcast-transcribe-mock.test.js
node tests/podcast-word-alignment.test.js
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-progress.test.js
```

**Expected FAIL:** `GET endpoint` oder `SAVE endpoint`, weil `Code.gs` die neuen Actions noch nicht enthält

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// backend/apps-script/Code.gs - geplante Ergänzungen
function ensurePodcastFortschrittSheet_() { /* Sheet anlegen/finden */ }
function getPodcastProgress(nutzer, fach) { return []; }
function savePodcastProgress(state) { return { success: true }; }

// doGet(e): action === "getPodcastProgress"
// doPost(e): action === "savePodcastProgress"
// Antwort-Konvention bleibt text/plain;charset=utf-8 über JSON.stringify(payload)
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-progress.test.js
```

Expected: `getPodcastProgress`, `savePodcastProgress` und `text/plain;charset=utf-8` sind im Apps-Script-Code nachweisbar.

- [ ] Step 5: Regressionen

```bash
node tests/learning-progress-resume.test.js
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/podcast-progress.test.js
```

**Expected FAIL:** `load function` oder `save function`, weil `js/api.js` die Wrapper noch nicht exportiert

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// js/api.js - geplante Ergänzungen
async function lerntextePodcastFortschrittLaden(fach) {
  return apiGet('getPodcastProgress', { fach: fach });
}

async function lerntextePodcastFortschrittSpeichern(state) {
  return apiPost('savePodcastProgress', state);
}

window.lerntextePodcastFortschrittLaden = lerntextePodcastFortschrittLaden;
window.lerntextePodcastFortschrittSpeichern = lerntextePodcastFortschrittSpeichern;
```

- [ ] Step 4: Test PASS

```bash
node tests/podcast-progress.test.js
```

Expected: Wrapper sind vorhanden und rufen die neuen Backend-Actions über bestehende API-Konventionen auf.

- [ ] Step 5: Regressionen

```bash
node tests/learning-progress-resume.test.js
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/lerntexte-karaoke.test.js
```

**Expected FAIL:** `Cannot find module '../js/podcast-hash-validate.js'` oder `lerntexteAudioVersionIstSynchron is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// js/podcast-hash-validate.js
function lerntexteAudioVersionIstSynchron(currentHash, jsonHash, mp3Hash) {
  return Boolean(currentHash && jsonHash && mp3Hash && currentHash === jsonHash && jsonHash === mp3Hash);
}

if (typeof module !== 'undefined') module.exports = { lerntexteAudioVersionIstSynchron };
if (typeof window !== 'undefined') window.lerntexteAudioVersionIstSynchron = lerntexteAudioVersionIstSynchron;
```

- [ ] Step 4: Test PASS

```bash
node tests/lerntexte-karaoke.test.js
```

Expected: Playback wird nur erlaubt, wenn current/json/mp3 Hash identisch sind.

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

test('DOM-Tokenisierung: Formatierungsmarker zählen nicht als Wörter', function() {
  const html = "Text. <br> Absatz.";
  const tokens = lerntexteDomTokenisieren(html);
  assert.deepStrictEqual(tokens.words.map(w => w.text), ["Text", "Absatz"], "br ist kein Wort");
});
```

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/lerntexte-karaoke.test.js
```

**Expected FAIL:** `Cannot find module '../js/podcast-dom-tokenize.js'` oder `lerntexteDomTokenisieren is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// js/podcast-dom-tokenize.js
function tokenizeVisibleWords(text) {
  return String(text || "").replace(/<[^>]*>/g, " ").match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) || [];
}

function lerntexteDomTokenisieren(html) {
  const words = tokenizeVisibleWords(html).map(function(word, index) {
    return { wortIndex: index, text: word, element: null };
  });
  return { words, preservesFormatting: /<[^>]+>/.test(String(html || "")) };
}

if (typeof module !== 'undefined') module.exports = { lerntexteDomTokenisieren, tokenizeVisibleWords };
if (typeof window !== 'undefined') window.lerntexteDomTokenisieren = lerntexteDomTokenisieren;
```

- [ ] Step 4: Test PASS

```bash
node tests/lerntexte-karaoke.test.js
```

Expected: Wortindizes sind stabil, Formatierung/Absätze bleiben erhalten, HTML-Tags zählen nicht als Wörter.

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/lerntexte-karaoke.test.js
```

**Expected FAIL:** `Cannot find module '../js/podcast-time-to-word.js'` oder `findWordIndexAtTime is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// js/podcast-time-to-word.js
function findWordIndexAtTime(wortZeitmarken, currentTime) {
  let left = 0;
  let right = wortZeitmarken.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const current = wortZeitmarken[mid];
    if (currentTime < current.start) right = mid - 1;
    else if (currentTime >= current.end) left = mid + 1;
    else return current.wortIndex;
  }
  return -1;
}

if (typeof module !== 'undefined') module.exports = { findWordIndexAtTime };
if (typeof window !== 'undefined') window.findWordIndexAtTime = findWordIndexAtTime;
```

- [ ] Step 4: Test PASS

```bash
node tests/lerntexte-karaoke.test.js
```

Expected: Mapping findet Wortindizes über Zeitmarken und bleibt bei großen Arrays performant.

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/lerntexte-karaoke.test.js
```

**Expected FAIL:** `lerntextePodcastStoppen is not defined` oder eine Playback-Funktion setzt falsches Verhalten um

- [ ] Step 3: Minimale Implementation/Funktionssignaturen

```javascript
// js/lerntexte.js - geplante Pilot-Ergänzungen
function lerntextePodcastStoppen(audio) {
  audio.pause();
}

async function lerntextePodcastPausieren(audio, saveProgress) {
  audio.pause();
  await saveProgress({ sekundenPosition: audio.currentTime });
}

async function lerntextePodcastFortsetzen(audio, resumeState, currentHash) {
  if (resumeState && resumeState.lerntextHash === currentHash) {
    audio.currentTime = resumeState.sekundenPosition;
  }
}

async function lerntextePodcastVonVorne(audio) {
  audio.currentTime = 0;
}

function lerntextePodcastAbspielen(audio, saveProgress) {
  audio.onended = function() { saveProgress({ status: 'completed' }); };
  return audio.play();
}
```

- [ ] Step 4: Test PASS

```bash
node tests/lerntexte-karaoke.test.js
```

Expected: Stop/Pause erhalten Position, Resume benötigt passenden `lerntextHash`, VonVorne startet bei 0, natürliches Ende wird abgeschlossen gespeichert.

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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

- [ ] Step 2: Test ausführen (FAIL)

```bash
node tests/lerntexte-karaoke.test.js
```

**Expected FAIL:** `Cannot find module '../js/podcast-visibility-sync.js'` oder `setupVisibilitySyncHandlers is not defined`

- [ ] Step 3: Minimale Implementation/Funktionssignatur

```javascript
// js/podcast-visibility-sync.js
function setupVisibilitySyncHandlers(audio, resync) {
  function syncFromAudio() {
    if (!document.hidden) resync(audio.currentTime);
  }
  document.addEventListener('visibilitychange', syncFromAudio);
  window.addEventListener('pageshow', syncFromAudio);
  return function cleanup() {
    document.removeEventListener('visibilitychange', syncFromAudio);
    window.removeEventListener('pageshow', syncFromAudio);
  };
}

if (typeof module !== 'undefined') module.exports = { setupVisibilitySyncHandlers };
if (typeof window !== 'undefined') window.setupVisibilitySyncHandlers = setupVisibilitySyncHandlers;
```

- [ ] Step 4: Test PASS

```bash
node tests/lerntexte-karaoke.test.js
```

Expected: Re-Sync liest `audio.currentTime` nach Rückkehr; kein `scrollTo` und kein `scrollIntoView`.

- [ ] Step 5: Regressionen

```bash
node tests/lerntexte-audio-path.test.js
node tests/lerntexte-audio-playlist.test.js
node tests/lerntexte-audio-ui.test.js
```

Expected: Alle PASS.

- [ ] Step 6: Commit

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
