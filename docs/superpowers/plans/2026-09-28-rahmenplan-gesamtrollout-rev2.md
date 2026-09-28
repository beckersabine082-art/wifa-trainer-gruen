# WiFa-Trainer Rahmenplan-Gesamtrollout Revision 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die freigegebene Rahmenplanstruktur technisch für alle neun Trainerfächer vorbereiten, wobei Recht/Steuern aktiv bleibt und die acht neuen Fächer zunächst ausschließlich fachweise aktivierbar und inaktiv bereitgestellt werden.

**Architecture:** Ein gemeinsamer, manifestgesteuerter Runtime-Adapter ersetzt die hart codierte Pilotfachlogik. Metadaten werden versions- und fachweise validiert und gecacht; `Trainer_Migrationen` bleibt die bei jedem Request frisch gelesene Aktivierungsquelle. Die sechs gemeinsamen Metadatentabellen werden append-only erweitert, während A:O und alle nutzerspezifischen Daten unverändert bleiben.

**Tech Stack:** Vanilla JavaScript, Google Apps Script, Google Sheets API, Node.js `node:test`, CacheService, lokaler statischer Frontend-Testserver.

**Spec:** `migration/gesamtrollout-rev2/Gesamt-Migrationsplan.md`, `migration/gesamtrollout-rev2/Migrationsmanifest_Gesamtrollout.json`, `migration/gesamtrollout-rev2/Gesamtplanung.xlsx`, `migration/gesamtrollout-rev2/Validierung.json`

## Global Constraints

- Ausgangspunkt ist Commit `35a4e23f03674f916558956baa2467c3938dca33`; Branch `codex/rahmenplan-gesamtrollout-rev2` bleibt lokal.
- Produktivdeployment Version 114, `main`, der Referenzbranch `codex/recht-steuern-pilot-v2`, Quiz, Karteikarten, Lerntexte und Podcast bleiben unverändert.
- A:O aller Trainerquellblätter bleibt unverändert; Identität ausschließlich über stabile IDs und Keys.
- Recht/Steuern bleibt mit 10 Oberthemen, 35 Detailgruppen und 800 IDs zell-/datensatzgenau auf Pilot Revision 2.
- Die acht neuen Fächer werden unter `WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE` vorbereitet, aber nicht aktiviert.
- Die neun Inhaltsmaßnahmen bleiben offen und ändern weder Frageinhalt noch IDs.
- CacheService ist nie Source of Truth, enthält keine Nutzerdaten und wird fachweise/versioniert mit Größenprüfung betrieben.
- Vor dem ersten Sheet-Schreiben: frischer Live-Read, vollständige Drive-Kopie, Manifest-/Pilot-/Prüfsummen-Gates; bei Konflikt Abbruch.

## Review Focus

- Eine `VORBEREITET`-Migration darf niemals neue UI-Themen ausliefern; ein aktives Fach mit ungültigen Metadaten muss fail-closed enden.
- Ein Oberthema kann IDs aus mehreren Quellblättern enthalten; ID-Auflösung, Lernstand und Analytics müssen trotzdem das Originalquellfach erhalten.
- Cachekorruption, Eviction und Versionswechsel müssen aus den Tabellen korrekt rekonstruieren, ohne Auditblätter im Hot Path zu lesen.
- Verspätete Katalog-/Poolantworten nach Fachwechsel, Logout oder Rollback dürfen den neuen Kontext nicht überschreiben.
- Die Pilotzeilen und der bestehende Staging-/Produktions-Scope dürfen durch Import, Deployment oder Rollback nicht verändert werden.

---

### Task 1: Reproduzierbare Manifest- und Sheet-Payloads

**Files:**
- Create: `tools/trainer-rollout-rev2/manifest-adapter.cjs`
- Create: `tools/trainer-rollout-rev2/export-sheet-rows.cjs`
- Create: `tests/trainer-rollout-rev2-manifest.test.js`
- Use unchanged: `migration/gesamtrollout-rev2/Migrationsmanifest_Gesamtrollout.json`

**Interfaces:**
- Produces: `buildRolloutModel(manifest)`, `buildSheetRows(manifest)`, erwartete Fachverträge und deterministische Payload-Prüfsummen.
- Consumes: nur die vier freigegebenen Artefakte; keine Live-Zeilennummern.

- [ ] **Step 1: Write failing manifest tests** für 48/196/2686/577, alle neun Fachsummen, genau eine Primärzuordnung, getrennte Querverweise, neun offene Inhaltsmaßnahmen und unveränderte 800 Pilotzuordnungen.
- [ ] **Step 2: Run RED** mit `node --test tests/trainer-rollout-rev2-manifest.test.js`; erwartet fehlendes Adaptermodul.
- [ ] **Step 3: Implement adapter and row builders** für die sechs bestehenden Tabellen; Pilotzeilen werden als unveränderte Baseline referenziert, neue Zeilen erhalten fachunabhängige Keys, `FachKey`/Quellfach-Allowlist und Status `VORBEREITET`.
- [ ] **Step 4: Run GREEN** und prüfen, dass keine der neun Inhaltsmaßnahmen als erledigt erscheint.
- [ ] **Step 5: Commit** Manifestadapter, Tests und die unveränderten Planungsartefakte.

### Task 2: Parametrischer Backend-Runtime-Adapter

**Files:**
- Modify: `backend/apps-script/Code.gs`
- Create: `tests/trainer-rollout-rev2-backend.test.js`
- Preserve: `tests/trainer-pilot-v2.test.js`

**Interfaces:**
- Consumes: Fachverträge und Tabellenzeilen aus Task 1.
- Produces: fachneutrale Varianten von Migration-, Runtime-, Audit-, Katalog-, Pool- und Resume-Auflösung; bestehende öffentliche Aktionen bleiben `trainerCatalog` und `trainerQuestions`.

- [ ] **Step 1: Write failing parameterized backend tests** für alle neun Fächer, fachweise `VORBEREITET`/`AKTIV`/`ZURUECKGEROLLT`, Mehrquellenpools, Primär-/Querverweisbilanz und unsichtbare Detailgruppen.
- [ ] **Step 2: Run RED**; erwartet Pilot-Hardcodierungen für Version, Fachliste und 10/35/800-Gates.
- [ ] **Step 3: Implement minimal generic configuration** aus versionierten Metadaten und `Trainer_Migrationen`; Pilotvertrag bleibt eigenständiger unveränderter Vertrag.
- [ ] **Step 4: Implement fachweise cache chunks** mit validiertem Core plus Fach-/Quellfachsegmenten unter 90.000 Bytes; Migrationstatus wird pro Request frisch gelesen, Auditdaten bleiben cold path.
- [ ] **Step 5: Run GREEN** einschließlich Cache-Miss, Eviction, Beschädigung, Versionswechsel, Rollback und Quellbestandsabweichung.
- [ ] **Step 6: Run pilot regression** `node --test tests/trainer-pilot-v2.test.js tests/trainer-rollout-rev2-backend.test.js`.
- [ ] **Step 7: Commit** Backend und Tests.

### Task 3: Generischer Frontend-Katalog, Poolcache und Kompatibilität

**Files:**
- Modify: `js/trainer.js`
- Modify as needed: `js/lernstand.js`, `js/analytics-core.js`
- Create: `tests/trainer-rollout-rev2-client.test.js`
- Preserve: `tests/trainer-pilot-v2-client.test.js`, `tests/trainer-navigation.test.js`, `tests/learning-progress-resume.test.js`

**Interfaces:**
- Consumes: `trainerCatalog`/`trainerQuestions` mit Version, FachKey, UI-Key und Migrationstatus aus Task 2.
- Produces: fachneutralen Katalogvertrag, Cachekey mindestens `Version + Fach + UI-Key`, Aliasauflösung und Kontextinvalidierung.

- [ ] **Step 1: Write failing client tests** für neun Fachverträge sowie Resume alt→neu, neu→Rollback, Lernstand, Analytics, Logout und Fachwechsel während laufender Requests.
- [ ] **Step 2: Run RED**; erwartet harte Recht/Steuern-Verträge und `ui-wq-*`-Erkennung.
- [ ] **Step 3: Generalize client logic** auf servergelieferte Fachverträge, ohne Legacy-/Detailoptionen im aktiven Pfad.
- [ ] **Step 4: Preserve context safety** bei Logout, Version/Fach/Moduswechsel und verspäteten Responses.
- [ ] **Step 5: Run GREEN** für Client-, Navigation-, Resume-, Lernstand- und Analytics-Regressionen.
- [ ] **Step 6: Commit** Frontend und Tests.

### Task 4: Live-Abgleich, Drive-Backup und inaktiver Sheet-Import

**Files:**
- Create: `migration/gesamtrollout-rev2/live-preflight.json`
- Create: `migration/gesamtrollout-rev2/import-report.json`
- Create: `migration/gesamtrollout-rev2/cache-sizes.json`

**Interfaces:**
- Consumes: deterministische Sheet-Payloads aus Task 1 und das produktive Spreadsheet `1_PGsBBjPZcc48B1PvwS3XKNVrQgH6Rvarzg4zBbPa7Y`.
- Produces: vollständiges Drive-Backup, append-only Metadatenimport, Prüfsummen und Ist-Zählungen.

- [ ] **Step 1: Read metadata and bounded live ranges** aller sechs Tabellen und der 13 Trainerquellblätter; IDs/Headers/Pilotprüfsummen gegen Manifest prüfen.
- [ ] **Step 2: Abort on conflict**; andernfalls vollständige Drive-Kopie mit neuer File-ID erstellen und im Preflight protokollieren.
- [ ] **Step 3: Write only new rollout rows** atomar/chunkweise in die sechs gemeinsamen Tabellen; Pilotdaten und A:O nicht anfassen. Acht Fachmigrationen erhalten `VORBEREITET`.
- [ ] **Step 4: Re-read exact written ranges** und beweisen: 48 Themen, 196 Gruppen, 2.686 Primärzuordnungen, 577 Abdeckungsknoten, 800 Pilotzeilen unverändert, keine Duplikate/Verluste.
- [ ] **Step 5: Record cache sizes** pro Fach aus den exakt serialisierten Runtime-Chunks.
- [ ] **Step 6: Commit** nur lokale Reports/Tools; keine Secrets oder Backup-Zugriffstoken.

### Task 5: Staging-Codeupdate ohne Aktivierung neuer Fächer

**Files:**
- Modify only if required: staging-local configuration ignored by Git
- Create: `migration/gesamtrollout-rev2/staging-verification.json`

**Interfaces:**
- Consumes: getesteten Code aus Tasks 2–3 und vorbereitete Sheetdaten aus Task 4.
- Produces: aktualisiertes bestehendes separates Staging-Deployment; Produktion 114 bleibt unverändert.

- [ ] **Step 1: Verify deployment inventory** und erfasse produktive Deployment-ID/Version 114 sowie separate Staging-ID.
- [ ] **Step 2: Update only staging** mit dem aktuellen Branchcode; keinen neuen produktiven oder Frontend-Deploy auslösen.
- [ ] **Step 3: Verify Recht/Steuern** auf Staging exakt 7/567 und 3/233 sowie Poolversion/UI-Key, Resume und Vor/Zurück.
- [ ] **Step 4: Verify all eight new subjects remain legacy/inactive** und sind nur als `VORBEREITET` in Metadaten vorhanden.
- [ ] **Step 5: Commit** Staging-Nachweis ohne Credentials.

### Task 6: Rollback-, Aktivierungs- und Performance-Gates

**Files:**
- Create or modify: `tests/trainer-rollout-rev2-staging.test.js`
- Create: `migration/gesamtrollout-rev2/rollback-report.json`
- Create: `migration/gesamtrollout-rev2/performance-report.json`

**Interfaces:**
- Consumes: Staging-Endpunkte und Fachverträge.
- Produces: Nachweis, dass jedes neue Fach einzeln aktivierbar wäre, ohne es dauerhaft zu aktivieren.

- [ ] **Step 1: Write failing gate tests** für eine simulierte einzelne Aktivierung, Rückkehr zu `VORBEREITET`, Rollback mit bestehender Nutzerleistung und unveränderte übrige Fächer.
- [ ] **Step 2: Run RED/GREEN** gegen Testfixtures und anschließend gegen Staging, soweit ohne dauerhafte Aktivierung möglich.
- [ ] **Step 3: Measure cold-like and warm requests** pro Fach, dokumentiere Chunkgrößen und vergleiche Recht/Steuern mit Pilotbaseline.
- [ ] **Step 4: Confirm content-action invariance** über Quellinhaltshashes der neun IDs.
- [ ] **Step 5: Commit** Gateberichte und Tests.

### Task 7: Gesamtverifikation und lokaler Abschlusscommit

**Files:**
- Update: `migration/gesamtrollout-rev2/Pruefprotokoll.json`
- Update: `migration/gesamtrollout-rev2/SHA256SUMS.txt`

**Interfaces:**
- Consumes: sämtliche Ergebnisse aus Tasks 1–6.
- Produces: revisionssicheren Abschlussnachweis und lokalen Commit-Hash.

- [ ] **Step 1: Run focused trainer suite** einschließlich aller neuen parametrischen Tests und bestehender Pilot-/Navigation-/Resume-/Lernstand-/Analytics-Tests.
- [ ] **Step 2: Run repository-wide suite** und trenne bekannte Baselinefehler (insbesondere fehlendes Playwright) von neuen Regressionen.
- [ ] **Step 3: Verify git scope**: keine Quiz-/Karteikarten-/Lerntexte-/Podcaständerung, kein Secret, kein `main`-/Pilotbranch-Drift, kein Remote-Push.
- [ ] **Step 4: Create final hashes and report** mit Sheetzahlen, Fachsummen, Cachegrößen, Stagingstatus und offenen Inhaltsmaßnahmen.
- [ ] **Step 5: Commit locally** und führe die abschließende Branch-Verifikation aus; nicht mergen und nicht pushen.
