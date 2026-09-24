# Recht Continuous Podcast Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-24-recht-continuous-podcast-design.md`

**Goal:** Einen produktiv veröffentlichten, validierten Recht-Bundle-Stream integrieren, der 57 logische Kapitel auf einer einzigen MP3 abbildet und bei Kapitelgrenzen keinen Medienwechsel ausführt.

**Global constraints:** Nur Podcast-/Lerntextepfad; nur Recht migrieren; alle Legacy-Assets behalten; keine Änderungen an Backend, Trainer, Quiz, Prüfung, Kilian oder fremden ungetrackten Dateien; fokussierte Tests; MP3 vor Sidecar; Sidecar vor Frontend-Push veröffentlichen; danach Commit und Push nach `origin/main`.

## Task 1: Bundle-Builder und atomare Veröffentlichung

**Files:**
- Create: `tools/podcast-sync/recht-bundle.js`
- Create: `tests/podcast-recht-bundle.test.js`
- Modify only if necessary: `tools/podcast-sync/README.md`

1. Zuerst Tests für Recht-Scope/57er-Gate, Produktionsreihenfolge, Quellhash-/Pfadprüfung, sample-exakte kumulative Grenzen, FFmpeg-Argumente/Decode-Validierung und MP3-first/Sidecar-last-CAS schreiben.
2. Die neuen Tests ausführen und den erwarteten RED-Zustand lesen.
3. Minimalen Builder mit injizierbaren Datei-, FFmpeg- und Firebase-Adaptern implementieren.
4. Tests GREEN ausführen.

## Task 2: Reine Bundle-Zeit- und Validierungslogik

**Files:**
- Create: `js/podcast-continuous.js`
- Create: `tests/podcast-continuous.test.js`
- Modify: `index.html` (Helper laden)

1. Tests für strukturelle/hashgebundene Sidecarvalidierung, `[start,end)`-Kapitelauflösung, Grenzwerte, lokale Zeit und Navigation schreiben.
2. RED bestätigen.
3. Browser/CommonJS-Helper implementieren und in `index.html` vor `lerntexte.js` laden.
4. Tests GREEN ausführen.

## Task 3: Recht-spezifische Playerintegration

**Files:**
- Modify: `js/lerntexte.js`
- Create or modify: `tests/lerntexte-continuous.test.js`, bei Bedarf bestehende fokussierte Lerntexte-Podcasttests
- Modify: `index.html` (statische Audioquelle entfernen; Cachebuster)

1. Integrationstests zuerst für eine einzige src/load/play-Sequenz über zwei Grenzen, keine weiteren Aufrufe am automatischen Übergang, currentTime-Navigation, Pausezustand, Karaoke-Lokalzeit, Sichtbarkeitsrekonstruktion, lokalen Fortschritt und Vordergrund-Fallback schreiben.
2. RED bestätigen.
3. Bundle nur für Recht laden/validieren/starten; eine Listener-Sitzung auf demselben Audioelement halten; UI/Text/Progress/Media Session logisch synchronisieren.
4. Legacy-Weg für andere Fächer und als Recht-Fallback unverändert erreichbar halten.
5. Integrationstests und bestehende fokussierte Podcasttests GREEN ausführen.

## Task 4: Produktionsbundle bauen und veröffentlichen

1. Mit Produktions-API, Firebase-Servicekonto und dem vorhandenen FFmpeg die 57 Recht-Quellen erneut validieren.
2. PCM normalisieren/verbinden, einmal kodieren, vollständig dekodieren und Kennzahlen erfassen.
3. Unter Lock die hashgebundene MP3 hochladen, verifizieren und das stabile Sidecar zuletzt veröffentlichen.
4. Sidecar und MP3 aus Firebase erneut laden; HTTP/Metadaten, Hashbindung, Größe, Dauer, 57 Kapitel und Wortmarkenzahl bestätigen.

## Task 5: Abschlussprüfung und Veröffentlichung des Frontends

1. Alle fokussierten Podcast-/Lerntexttests einschließlich lokaler Audio-Validierung ausführen.
2. Diff und Scope prüfen; fremde ungetrackte Dateien müssen exakt unangetastet bleiben.
3. Frischen Gesamt-Review durch einen separaten Reviewer durchführen und wichtige Befunde testgetrieben beheben.
4. Nur die geplanten Dateien committen und `HEAD` nach `origin/main` pushen.

## Review Focus

- Kein `src`, `load()` oder automatisches `play()` an logischen Grenzen.
- Kein Bundlepfad außerhalb von Recht.
- Keine absolute Bundlezeit im bestehenden Kapitel-Fortschritt.
- Keine Übernahme unvalidierter Sidecar-/Cache-Daten.
- Keine Änderung oder Löschung der 57 Legacy-Paare.
- Kein Hintergrund-Polling, Wake-Lock oder Autoplay-Hack.
