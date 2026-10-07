# Releasecheckliste

Release: `WIFA-GESAMT-PROD-20261007-RC1`

Audit: `FINAL-RELEASE-AUDIT-20261007-2`

Status: **NO-GO**

## Releasequelle

- [x] Branch `codex/rahmenplan-gesamtrollout-rev2`
- [x] vier logische Fach-/Migrationspakete revisionssicher im Releasebestand
- [x] fünf Ausführungsartefakte mit SHA-256 und Revision im Manifest
- [x] fehlendes/verändertes Artefakt bricht Release-Gate ab
- [x] alte Entwürfe und lokale Outputpfade als Ausführungsquelle ausgeschlossen
- [x] kein Merge und kein Push

## Umgebungen

- [x] expliziter STAGING-/PRODUCTION-Build ohne Heuristik
- [x] fehlende/ungültige Umgebung fail-closed
- [x] keine gemeinsam wirksame Script Property
- [x] Staging kann Produktionssheet nicht öffnen
- [x] Produktion kann Stagingsheet nicht öffnen
- [x] Produktion weiterhin Version 114 und bekannte Deployment-ID
- [x] kein produktives Deployment durchgeführt

## Podcast

- [x] immutable Produktionsversion
  `WIFA-PODCAST-PROD-LZREV2-20261007-v1`
- [x] neuer Produktionspräfix; kein Überschreiben alter Pfade
- [x] 110 Quell-/Zielobjekte mit Generation, Größe und Content-Type
- [x] 26 Runtimeobjekte explizit markiert
- [x] Produktionsclient referenziert nur die neue Version
- [x] fehlendes neues Bundle fail-closed
- [x] read-only Diagnosemodus nur bei explizitem lokalen Queryparameter
- [x] Diagnose zeigt/persistiert keine Tokens oder Download-URLs
- [ ] angemeldeter Normalbrowser meldet
  `13/13 Sidecars | 13/13 Bundles | 13/13 loadedmetadata | PASS`

## Read-only Produktions-Dry-Run

- [x] 9/9 Trainer-Altwerte
- [x] 53/53 Quiz-Neu-IDs erwartungsgemäß nicht vorhanden
- [x] 14/14 Quiz-Bestandswerte
- [x] 521/521 Lerntext-Altzeilen
- [x] Karteikarten-Overlaytabelle nicht vorhanden
- [x] 48/196/2.686/2.770/577 Trainer-Metadaten vorhanden
- [x] vorhandene Trainer-Metadaten als No-op, keine Duplikation
- [x] 0 unbekannte Konflikte
- [x] Nutzer-/Lernstand-/Analyticsdaten außerhalb des Scopes
- [x] 0 produktive Writes im Audit

## Tests

- [x] Artefakt-Hash-Gates
- [x] Environment-Routing und gegenseitige Isolation
- [x] Podcastversion und Pfade
- [x] Manifest gegen Ausführungspakete
- [x] idempotente Dry-Run-Klassifikation
- [x] Konfliktfall bricht ab
- [x] vorhandene Trainer-Metadaten werden nicht dupliziert
- [x] Nutzerdaten außerhalb der Migration
- [x] atomarer Preflight und Race-Abbruch
- [x] releasebezogene Tests 420/420
- [x] 11 bekannte Fehler als identische `main`-Baseline dokumentiert

## Unmittelbar vor einem später freigegebenen Write

- [ ] B4-PASS dokumentiert
- [ ] separate ausdrückliche Produktionsfreigabe
- [ ] Change Window aktiv
- [ ] aktueller `main`-Commit ermittelt
- [ ] erster vollständiger Altwertvergleich konfliktfrei
- [ ] frische vollständige Produktions-Sheetkopie erstellt und rückgelesen
- [ ] bisheriger Produktivstand als Git-Referenz gesichert
- [ ] Apps Script Version 114 / Deployment-ID dokumentiert
- [ ] altes Podcastinventar samt Hashes eingefroren
- [ ] Release-Run-Report geschrieben
- [ ] zweiter Altwertvergleich und Fingerprint unverändert

## Spätere Ausführung

- [ ] 110 Produktions-Podcastobjekte create-only kopiert/rückgelesen
- [ ] 32 Trainerzellen gepatcht
- [ ] 53 Quizzeilen angelegt und 84 Quizfelder gepatcht
- [ ] Karteikarten-Overlay mit 38 Zeilen angelegt
- [ ] 454 Lerntextzellen in 260 Zeilen gepatcht
- [ ] keine Trainer-Metadaten dupliziert
- [ ] keine Nutzerleistung verändert
- [ ] Backend und Frontend separat abgenommen
- [ ] kompletter Produktions-Smoke-Test

## Entscheidung

- Gelöste Blocker: **B1, B2, B3, B5**
- Offener Blocker: **B4**
- Offene Datenkonflikte: **0**
- Technischer Audit: **NO-GO**
- Produktionsausführung autorisiert: **nein**
