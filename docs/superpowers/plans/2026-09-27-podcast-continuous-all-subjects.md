# Continuous-Podcasts für alle Fächer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Recht-Direktwahl auf eindeutige logische Kapitel korrigieren und anschließend je Fach ein strikt validiertes, kontinuierliches Podcast-Bundle für alle 13 Fächer veröffentlichen und aktivieren.

**Architecture:** Das bestehende Recht-Schema und der Ein-Audioelement-Player werden fachneutral parametrisiert. Eindeutige Legacy-MP3-Pfade verbinden Dropdown, Playlist, Sidecar und Fortschritt; ein generischer Builder erzeugt und veröffentlicht die 13 Bundles fachweise und atomar, während Legacy-Audio vollständig erhalten bleibt.

**Tech Stack:** Browser-JavaScript, Node.js 24, Node Test Runner, Firebase Admin/Storage, FFmpeg/libmp3lame, PowerShell.

**Spec:** `docs/superpowers/specs/2026-09-27-podcast-continuous-all-subjects-design.md`

## Global Constraints

- Nur Podcast-/Lerntexte-Audiopfad und erforderliche Cachebuster ändern.
- Trainer, Quiz, Prüfungssimulation, Kilian, Login, Analytics und fachfremdes Backend nicht ändern.
- Recht-Dropdown zuerst per RED→GREEN korrigieren; erst danach fachneutral generalisieren.
- Eine Dropdown-Option pro logischer Lerneinheit; Navigation nie über `hauptkapitelNr`.
- Keine fach- oder kapitelzahlspezifische Hardcodierung im generischen Vertrag.
- Lerntext-, Asset-, Bundle- und Sidecar-Hashprüfungen nicht abschwächen.
- Legacy-MP3-/JSON-Dateien weder ändern noch löschen.
- MP3 je Fach zuerst, stabiles Sidecar zuletzt; unvollständige Publikation bleibt für den Player ungültig.
- Fach-, Playlist-, Dropdown-, Prefetch-, Fallback- und Media-Session-State strikt sitzungsgebunden halten.
- Unabhängige ungetrackte Dateien nicht verändern.
- Vor Merge/Push die vom Nutzer geforderten acht Ergebnisgruppen berichten.

## Review Focus

- Wiederholte `hauptkapitelNr` am Ende eines Fachs: beide Einträge müssen einzeln wählbar bleiben — Task 1 testet Recht 55/56.
- Zwei Dropdown-Selektionen vor `seeked`: nur das zuletzt gewählte Ziel darf aktiv bleiben — Task 1 testet realistische Media-Events.
- Verspätete Antwort eines vorherigen Fachs: sie darf weder State noch UI überschreiben — Task 3 testet überlappende Fachwechsel.
- Historisches Legacy-Paar ohne `manifestHash`: nur der streng definierte generation-gepinnte Legacy-Vertrag darf es zulassen — Task 4 testet positiven und manipulierten Fall.
- Fehler zwischen MP3- und Sidecar-Publikation: das stabile Sidecar darf nicht wechseln — Task 4 testet den Abbruchpfad und Task 5 prüft Produktionsobjekte.

---

### Task 1: Recht-Dropdown auf logische Einheiten korrigieren

**Files:**
- Modify: `tests/lerntexte-karaoke.test.js`
- Modify: `js/lerntexte.js`

**Interfaces:**
- Consumes: bestehende Recht-Playlist, `lerntextePodcastPfade()`, `lerntexteContinuousKapitelSpringen(index, localSeconds)`.
- Produces: eindeutiger Dropdown-Wert pro Lerntext über Legacy-MP3-Pfad und exakte Zuordnung zu Playlist-/Bundle-Index.

- [ ] **Step 1: Failing Recht regression tests schreiben**

Testdaten müssen die produktive nicht gruppierte Hauptkapitelfolge abbilden. Tests prüfen 57 eindeutige Optionswerte sowie direkte Wahl der Indizes 0, 28, 55 und 56, die Folge 55→56 und Auswahl während Pause sowie laufender Wiedergabe. Erwartet werden exakter State-Index, Titel/Textwurzel und `currentTime === chapters[index].start`; `src`, `load()` und automatische `play()`-Aufrufe bleiben unverändert. Ein Event-Mock emittiert `seeking`, `timeupdate`, `seeked` und zwei schnelle aufeinanderfolgende Selektionen.

- [ ] **Step 2: RED bestätigen**

Run: `node --test --test-name-pattern="Recht-Bundle: Dropdown" tests/lerntexte-karaoke.test.js`

Expected: FAIL, weil nur sieben nach `hauptkapitelNr` deduplizierte Optionen existieren oder das falsche Bundle-Kapitel aktiviert wird.

- [ ] **Step 3: Minimale eindeutige Auswahl implementieren**

`lerntexteBaueKapitelDropdown`, `lerntexteKapitelWaehlen`, `lerntexteAusgewaehlteEinheiten`, Startindex-Auflösung und `lerntexteContinuousAnsichtSynchronisieren` verwenden einen separaten stabilen Legacy-Pfadschlüssel. Kapitelnummern bleiben reine Beschriftung. Vor Continuous-Start und im Legacy-Fallback bleibt derselbe exakte Zielindex erhalten.

- [ ] **Step 4: Recht-Tests und fokussierte Suite GREEN ausführen**

Run: `node --test tests/lerntexte-karaoke.test.js tests/podcast-continuous.test.js tests/podcast-recht-bundle.test.js`

Expected: alle Tests PASS, insbesondere erstes/mittleres/vorletztes/letztes Kapitel in Pause und Wiedergabe.

- [ ] **Step 5: Commit**

`git add js/lerntexte.js tests/lerntexte-karaoke.test.js && git commit -m "Fix logical podcast chapter selection"`

### Task 2: Generischen Continuous-Vertrag und kanonische Pfade einführen

**Files:**
- Modify: `tests/podcast-continuous.test.js`
- Modify: `js/podcast-continuous.js`
- Modify: `tests/podcast-sync-core.test.js`
- Modify: `tools/podcast-sync/hash-paths.js`

**Interfaces:**
- Consumes: Schema 1, SHA-256- und Slugregeln, Recht-Sidecar.
- Produces: `continuousPodcastPaths(fach)`, `validateContinuousBundle(input)`, `chapterIndexAtTime`, `chapterLocalTime`, `chapterSeekTarget`; Recht-Aliasse bleiben erhalten.

- [ ] **Step 1: Failing generic contract tests schreiben**

Tests verwenden ein zweites Fach mit variabler, nicht 57 entsprechender Kapitelzahl. Sie prüfen Fach-/Slug-/Pfadabweichung, gemischte aktuelle Einträge, exakte dynamische Count-Gleichheit, Encoding/Hashbindung, Slugparität aller 13 Fächer und Recht-Kompatibilitätsaliase.

- [ ] **Step 2: RED bestätigen**

Run: `node --test tests/podcast-continuous.test.js tests/podcast-sync-core.test.js`

Expected: FAIL wegen fehlender generischer Exporte oder weiterhin festem Recht-/57-Gate.

- [ ] **Step 3: Generische Helper minimal implementieren**

Validierung erhält `expectedFach` und kanonische Pfade explizit, vergleicht `chapters.length` exakt mit `currentEntries.length > 0` und behält sämtliche bisherigen Struktur-, Hash-, Sample- und Wortmarkengates. Recht-Funktionen delegieren als Kompatibilitätswrapper.

- [ ] **Step 4: Helper-Suite GREEN ausführen**

Run: `node --test tests/podcast-continuous.test.js tests/podcast-sync-core.test.js`

Expected: alle Tests PASS.

- [ ] **Step 5: Commit**

`git add js/podcast-continuous.js tools/podcast-sync/hash-paths.js tests/podcast-continuous.test.js tests/podcast-sync-core.test.js && git commit -m "Generalize continuous podcast validation"`

### Task 3: Player fachneutral und fachwechsel-sicher machen

**Files:**
- Modify: `tests/lerntexte-karaoke.test.js`
- Modify: `js/lerntexte.js`

**Interfaces:**
- Consumes: Task-1-Identität und Task-2-Helper/Pfade.
- Produces: fachneutralen Continuous-State mit `{ fach, descriptor, manifest, ... }`, fachgebundenen Fallback und stale-response-sicheren Fachwechsel.

- [ ] **Step 1: Failing second-subject and isolation tests schreiben**

Tests prüfen ein zweites Fach über zwei Grenzen ohne `src`/`load`/`play`, lokale Karaoke-/Fortschrittszeit, Media Session, fehlendes/ungültiges Sidecar mit Legacy-Fallback, Recht → anderes Fach → Recht, einen während Sidecar/Metadaten/Play wechselnden Fachzustand und überlappende `getLerntexte`-Antworten einschließlich verspätetem Fehler.

- [ ] **Step 2: RED bestätigen**

Run: `node --test --test-name-pattern="Continuous-Fach|Fachwechsel" tests/lerntexte-karaoke.test.js`

Expected: FAIL wegen Recht-Gates, hartcodiertem Fortschrittsfach oder übernommener alter Sitzung.

- [ ] **Step 3: Player minimal parametrisieren**

Descriptor und Fach werden vor jedem `await` eingefroren und danach mit `sessionId` validiert. Fortschritt/Status/Analytics verwenden das validierte Entry-Fach. Fachwechsel räumt Continuous-, Playlist-, Auswahl-, Prefetch-, Fallback- und Media-Session-State vollständig auf. Kernmechanik des Einzel-Audioelements bleibt erhalten.

- [ ] **Step 4: Player-Suite GREEN ausführen**

Run: `node --test tests/lerntexte-karaoke.test.js tests/podcast-continuous.test.js tests/podcast-progress.test.js tests/lerntexte-audio-playlist.test.js`

Expected: alle Tests PASS.

- [ ] **Step 5: Commit**

`git add js/lerntexte.js tests/lerntexte-karaoke.test.js && git commit -m "Use continuous playback for every podcast subject"`

### Task 4: Generischen Bundle-Builder und Orchestrator implementieren

**Files:**
- Create: `tools/podcast-sync/continuous-bundle.js`
- Create: `tools/podcast-sync/sync-bundles.js`
- Modify: `tools/podcast-sync/recht-bundle.js`
- Modify: `tools/podcast-sync/run-local.ps1`
- Modify: `tools/podcast-sync/README.md`
- Create: `tests/podcast-continuous-bundle.test.js`
- Modify: `tests/podcast-recht-bundle.test.js`

**Interfaces:**
- Consumes: `continuousPodcastPaths(fach)`, vollständige API-Fachlisten, Firebase-Bucket, FFmpeg.
- Produces: `buildSubjectBundle`, `publishSubjectBundle`, Recht-Kompatibilitätswrapper und CLI mit `--only-subject`, `--dry-run`, sequenziellem All-Fach-Lauf und maschinenlesbarem Ergebnisbericht.

- [ ] **Step 1: Failing builder/source/publish tests schreiben**

Tests prüfen variables Fach/Count, Sortierung, Pfadkollisionen, generation-gepinnte Downloads, aktuelle Lerntext-Hashes, vorhandenes korrektes/falsches `manifestHash`, strengen historischen Ohne-Hash-Vertrag, Wortdeckung, 22.050-Hz-mono-s16le-Decode, Sampleakkumulation, einmaliges 96-kbit/s-Encoding, vollständigen Re-Decode, erneute API-/Generation-Prüfung, MP3-first/Sidecar-last-CAS und Sidecar-Unterdrückung nach jedem MP3-Fehler.

- [ ] **Step 2: RED bestätigen**

Run: `node --test tests/podcast-continuous-bundle.test.js tests/podcast-recht-bundle.test.js`

Expected: FAIL, weil generischer Builder und CLI fehlen.

- [ ] **Step 3: Builder und Orchestrator minimal implementieren**

Ein Fach wird vollständig und sequenziell verarbeitet; temporäre Aggregate werden nach Abschluss entfernt. Recht-Wrapper delegieren. Der Orchestrator lädt immer den vollständigen Katalog, gruppiert exakt nach Fach und verweigert Teil-Bundles. Veröffentlichung schreibt niemals Legacy-Objekte.

- [ ] **Step 4: Builder- und Sync-Suite GREEN ausführen**

Run: `node --test tests/podcast-continuous-bundle.test.js tests/podcast-recht-bundle.test.js tests/podcast-sync-all.test.js tests/podcast-sync-core.test.js`

Expected: alle Tests PASS.

- [ ] **Step 5: Commit**

`git add tools/podcast-sync/continuous-bundle.js tools/podcast-sync/sync-bundles.js tools/podcast-sync/recht-bundle.js tools/podcast-sync/run-local.ps1 tools/podcast-sync/README.md tests/podcast-continuous-bundle.test.js tests/podcast-recht-bundle.test.js && git commit -m "Build continuous bundles by subject"`

### Task 5: Produktionsaudit, Build und atomare Veröffentlichung

**Files:**
- No tracked source changes expected.
- Generated report: ignored SDD/work directory only.

**Interfaces:**
- Consumes: Task-4-CLI, Firebase-Servicekonto, FFmpeg und die 521 Legacy-Paare.
- Produces: 13 veröffentlichte, rückgelesene Fach-Bundles und einen Bericht mit Größe, Dauer, Counts, Wortmarken, Hashes, Pfaden und Decode-Ergebnis.

- [ ] **Step 1: Credentialed dry-run und Quellenprüfung ausführen**

Run: `node tools/podcast-sync/sync-bundles.js --dry-run`

Expected: 13 Fächer, 521 gültige eindeutige Kapitel, 118.814 Wortmarken, keine fehlenden/stalen Assets, keine Kollisionen. Abweichungen werden fachbezogen berichtet und verhindern Build/Publish.

- [ ] **Step 2: Fachweise bauen und veröffentlichen**

Run: `node tools/podcast-sync/sync-bundles.js`

Expected: je Fach vollständiger Decode/Encode/Re-Decode, MP3-Verifikation und Sidecar als letzter erfolgreicher Schreibvorgang; Fehler stoppt vor Aktivierung des betroffenen Fachs.

- [ ] **Step 3: Authentifizierten Readback validieren**

Run: `node tools/podcast-sync/sync-bundles.js --verify-only`

Expected: 13/13 Bundles gültig, Kapitel- und Wortmarkensummen exakt oder eine explizit begründete aktuelle API-Abweichung.

### Task 6: Frontend-Cachebuster, fokussierte Gesamtverifikation und Produktionsspotchecks

**Files:**
- Modify: `index.html`
- Modify only if commands changed: `tools/podcast-sync/README.md`

**Interfaces:**
- Consumes: produktiv veröffentlichte Sidecars und fertigen Player.
- Produces: neue gemeinsam versionierte Script-URLs und finalen Verifikationsbericht.

- [ ] **Step 1: Cachebuster beider Continuous-Skripte gemeinsam erhöhen**

`podcast-continuous.js` und `lerntexte.js` erhalten denselben neuen Rollout-Bezug; Scriptreihenfolge bleibt Helper vor Player. Diese reine Deploymentkonfiguration erhält keinen Source-Text-Change-Detector-Test.

- [ ] **Step 2: Fokussierte Podcast-/Lerntexte-Suite ausführen**

Run: `node --test tests/podcast-*.test.js tests/lerntexte-*.test.js tests/learning-progress-resume.test.js`

Expected: 0 Fehler.

- [ ] **Step 3: Lokale Audio- und Syntaxprüfung ausführen**

Run: `python tests/podcast_local_audio_test.py` mit dem konfigurierten lokalen Python; zusätzlich `node --check js/lerntexte.js`, `node --check js/podcast-continuous.js`, `node --check tools/podcast-sync/continuous-bundle.js`, `node --check tools/podcast-sync/sync-bundles.js`.

Expected: alle Prüfungen PASS.

- [ ] **Step 4: Produktive URLs stichprobenartig prüfen**

Mindestens Recht, ein mittleres Fach und das letzte Fach: Sidecar HTTP 200/JSON; MP3 HTTP 200 oder Range 206, `audio/mpeg`, Byte-Range-Unterstützung und Pfad-/Hashbindung stimmen.

- [ ] **Step 5: Scope und Fremddateien prüfen**

Run: `git status --short`, `git diff --check`, `git diff $(git merge-base origin/main HEAD)..HEAD --stat`.

Expected: nur geplante Podcast-/Lerntexte-, Test-, Dokumentations- und Cachebuster-Dateien; ursprüngliche ungetrackte Dateien des Hauptcheckouts bleiben unangetastet.

- [ ] **Step 6: Commit**

`git add index.html tools/podcast-sync/README.md && git commit -m "Enable continuous podcast bundles"`

### Task 7: Review, Vorabbericht und Integration

**Files:**
- No new product files.

**Interfaces:**
- Consumes: vollständigen Branchdiff und Produktionsbericht.
- Produces: sauberen Gesamt-Review, Nutzerbericht vor Integration und anschließend den freigegebenen Merge/Push nach `origin/main`.

- [ ] **Step 1: Frischen Gesamt-Code-Review ausführen und wichtige Befunde per RED→GREEN beheben**

- [ ] **Step 2: Gesamttests nach allen Reviewfixes frisch wiederholen**

- [ ] **Step 3: Vor Merge/Push berichten**

Bericht enthält die acht ausdrücklich angeforderten Punkte: Recht-Direktwahl; Bundlezahl; Kapitel je Fach/521; Wortmarken/118.814; Hash-/FFmpeg-/Pfadvalidierung; Größe/Dauer je Fach; Player-Regressionen; Recht → anderes Fach → Recht.

- [ ] **Step 4: Nach dem Vorabbericht Worktree-Branch in `main` übernehmen und `origin/main` pushen**

- [ ] **Step 5: Nach Push Live-Cachebuster und repräsentative produktive Bundle-URLs erneut prüfen**

