# Releasecheckliste

Release: `WIFA-GESAMT-PROD-20261007-RC1`

Audit: `FINAL-RELEASE-AUDIT-20261007-4`

Status: **GO**

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
- [x] bisherige Version 114 und bekannte Deployment-ID vor dem Cutover gesichert
- [x] bestehende produktive Deployment-ID auf Version 121 aktualisiert und per Recht-Katalog abgenommen

## Podcast

- [x] immutable Produktionsversion
  `WIFA-PODCAST-PROD-LZREV2-20261007-v2`
- [x] neuer Produktionspräfix; kein Überschreiben alter Pfade
- [x] 13 v2-Sidecars und 13 byteidentische v2-MP3-Bundles create-only kopiert und zurückgelesen
- [x] 521 IDs, 48 Kapitel, unveränderte MP3-Hashes und 0 Staging-Referenzen
- [x] abgebrochene v1 unverändert und unreferenziert belassen
- [x] Produktionsclient referenziert nur die neue Version
- [x] fehlendes neues Bundle fail-closed
- [x] read-only Diagnosemodus nur bei explizitem lokalen Queryparameter
- [x] Diagnose zeigt/persistiert keine Tokens oder Download-URLs
- [x] angemeldeter Normalbrowser meldet
  `13/13 Sidecars | 13/13 Bundles | 13/13 loadedmetadata | 13/13 duration > 0 | PASS`
- [x] Recht meldet 48-Kapitel-Navigation, Alle Kapitel, Kapitel 1,
  Einzeltextziel und Nummerierung als PASS; Start bei
  `1.1 Anspruchsprüfung und Gutachtenstil`

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
- [x] aktuelle releasebezogene Tests 431/431
- [x] 11 bekannte Fehler als identische `main`-Baseline dokumentiert

## Unmittelbar vor einem später freigegebenen Write

- [x] B4-PASS dokumentiert
- [x] separate ausdrückliche Produktionsfreigabe
- [x] Change Window aktiv
- [x] aktueller `main`-Commit ermittelt
- [x] erster vollständiger Altwertvergleich konfliktfrei
- [x] frische vollständige Produktions-Sheetkopie erstellt und rückgelesen
- [x] bisheriger Produktivstand als Git-Referenz gesichert
- [x] Apps Script Version 114 / Deployment-ID dokumentiert
- [x] altes Podcastinventar samt Hashes eingefroren
- [x] Release-Run-Report geschrieben
- [x] zweiter Altwertvergleich und Fingerprint unverändert

## Spätere Ausführung

- [x] Podcast-v2-Runtimeobjekte create-only kopiert/rückgelesen
- [x] 32 Trainerzellen gepatcht
- [x] 53 Quizzeilen angelegt und 84 Quizfelder gepatcht
- [x] Karteikarten-Overlay mit 38 Zeilen angelegt
- [x] 454 Lerntextzellen in 260 Zeilen gepatcht
- [x] keine Trainer-Metadaten dupliziert
- [x] keine Nutzerleistung verändert
- [x] Backend Version 121 separat abgenommen
- [ ] Frontend abgenommen
- [ ] kompletter Produktions-Smoke-Test

## Entscheidung

- Gelöste Blocker: **B1, B2, B3, B4, B5**
- Offener Blocker: **keiner**
- Offene Datenkonflikte: **0**
- Technischer Audit: **GO**
- Produktionsausführung autorisiert: **ja; Datenmigration abgeschlossen, Client-Cutover ausstehend**
