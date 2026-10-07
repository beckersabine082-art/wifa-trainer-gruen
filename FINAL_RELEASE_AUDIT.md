# Finaler Release-/Deployment-Audit

Auditkennung: `FINAL-RELEASE-AUDIT-20261007-4`

Release: `WIFA-GESAMT-PROD-20261007-RC1`

Fachrevision: `WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE`

Entscheidung: **GO**

Der authentifizierte read-only Podcast-Nachweis wurde am 7. Oktober 2026 im
angemeldeten normalen Browser vollständig bestanden. Die anschließend ausdrücklich
autorisierte Podcast- und Sheetmigration ist komponentenweise ausgeführt und
zurückgelesen; der Client-Cutover ist zum Stand dieses Dokuments noch ausstehend.
Der bisherige Apps-Script-Stand Version 114, Deployment
`AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA`
und das Produktionssheet `1_PGsBBjPZcc48B1PvwS3XKNVrQgH6Rvarzg4zBbPa7Y`
wurden vor dem ersten Write revisionssicher gesichert. Dieselbe Deployment-ID wurde
nach bestandenem Datengate kontrolliert auf Apps-Script-Version 121 aktualisiert;
der produktive Recht-Katalog lieferte anschließend 200 OK und 7 freigegebene Pools.

## Blockerstatus

| Blocker | Status | Nachweis |
|---|---|---|
| B1 – verbindliche Pakete revisionssicher | **GELÖST** | Vier logische Pakete mit fünf Endartefakten liegen unter `release/WIFA-GESAMT-PROD-20261007-RC1/packages/`. Pfad, Revision und SHA-256 sind im Produktionsmanifest festgelegt. `release-artifacts.js` bricht bei fehlender Datei, falschem Hash, falscher Revision oder nicht versioniertem Ausführungspfad ab. |
| B2 – Spreadsheet-Routing | **GELÖST** | `Code.gs` enthält nur den Build-Platzhalter. `build-apps-script.js` erzeugt explizit STAGING oder PRODUCTION. Fehlende/ungültige Umgebung endet fail-closed; Script Properties werden nicht verwendet. |
| B3 – Produktionspodcast | **GELÖST** | Version `WIFA-PODCAST-PROD-LZREV2-20261007-v2` wurde create-only im geschlossenen Produktionsnamespace bereitgestellt. 13 Sidecars und 13 byteidentische MP3-Bundles wurden zurückgelesen; 521 IDs, 48 Kapitel, unveränderte MP3-Hashes und 0 Staging-Referenzen sind nachgewiesen. Die fehlerhafte v1 bleibt unreferenziert und unverändert. |
| B4 – authentifizierter Live-Storage-Recheck | **GELÖST** | Nutzerbestätigter Normalbrowser-Nachweis: `13/13 Sidecars | 13/13 Bundles | 13/13 loadedmetadata | 13/13 duration > 0 | PASS`. Recht zusätzlich: 48-Kapitel-Navigation, Alle Kapitel, Kapitel 1, Einzeltextziel und Nummerierung bestanden; Start `1.1 Anspruchsprüfung und Gutachtenstil`. Der Lauf war read-only. |
| B5 – frische Rollbackbasis | **GELÖST** | `production-preflight.js` erzwingt Altwertprüfung, frische Sheetkopie, Git-Referenz, Apps-Script-114-Nachweis, Podcastinventar, Run-Report und unmittelbaren zweiten Konfliktcheck. Die Sicherung wird absichtlich erst unmittelbar vor einem freigegebenen ersten Write erzeugt. |

## Versionierte Ausführungsquellen

| Gruppe | Revision | SHA-256 |
|---|---|---|
| Trainerinhalte | `WIFA-TR-INHALT-9-20260929-REV1-FINAL` | `9d88979638c150d34bd498999837e407dd5cbb6eeaef27989415ef34404d2f9e` |
| Quiz | `WIFA-QUIZ-INHALT-20260929-FINAL1` | `b413e1f40f7f7610eccceb1fb0be38b4394689b8dbf1049b615604040d0371dd` |
| Karteikarten | `WIFA-KK-INHALTE-20260930-FINAL-1` | `52ba0bc59aae32798ff968985d07a6544d5c5e784b0b4f9f5d74a5cf64fa9537` |
| Lerntexte | `WIFA-LZ-GESAMT-20261004-FINAL` | `576d054af41fe5155f378d47aa6bfbba4daf2956faab74c754d72c9c568f59dd` |
| Lerntextreihenfolge | `WIFA-LZ-GESAMT-20261004-FINAL` | `562d13e64d2cfaf22980cba8cd8a24c0484321a0a36c29334e889098f4edd172` |

Alte Entwürfe, absolute lokale Outputpfade und Zwischenrevisionen sind keine
Ausführungsquelle.

## Read-only Produktions-Dry-Run

Nach dem B4-Nachweis am 7. Oktober 2026 erneut live und read-only gelesen. Stabile
IDs wurden verwendet; Zeilennummern sind keine Identität.

- 9/9 Trainerdatensätze entsprechen vollständig den erwarteten Altwerten.
- 53/53 neue Quiz-IDs fehlen wie erwartet; 14/14 Bestandsfragen entsprechen den
  erwarteten Altwerten.
- 521/521 Lerntextzeilen entsprechen dem erwarteten Altstand; 260 davon würden
  tatsächlich gepatcht.
- `Karteikarten_Ergaenzungen` ist noch nicht vorhanden.
- Die fünf fachlichen Trainer-Metadatentabellen sind in Produktion und Staging
  weiterhin vollständig und ohne doppelte stabile Schlüssel vorhanden: 48 Themen,
  196 Detailgruppen, 2.686 Primärzuordnungen, 2.770 Rahmenplanbezüge und 577
  Abdeckungsknoten.
- Die acht Gesamtrollout-Fachgruppen haben im produktiven append-only
  Migrationsledger bereits den jüngsten Status `AKTIV`; diese vorhandenen
  Metadaten werden nicht dupliziert.
- Unbekannte Konflikte: **0**.
- Tatsächliche Writes während des Audits: **0**.

Der vollständige zellgenaue Patchplan liegt in
`release/WIFA-GESAMT-PROD-20261007-RC1/dry-run/PRODUCTION_DRY_RUN_20261007.json`.

## Autorisierte und verifizierte Produktionswrites

| Bereich | Ausgeführter Write |
|---|---:|
| Trainer-Metadaten | 0 |
| Trainerinhalte | 32 Zellen in 9 bestehenden IDs |
| Quiz | 53 neue Zeilen / 742 Zellen und 84 Zellen in 14 bestehenden IDs |
| Karteikarten | neue Overlaytabelle mit 38 Zeilen; A:O bleibt unverändert |
| Lerntexte | 454 Zellen in 260 bestehenden Zeilen |
| Podcast | 110 unreferenzierte immutable v1-Objekte sowie 26 korrigierte immutable v2-Runtimeobjekte; kein Altobjekt überschrieben oder gelöscht |
| Nutzer-/Lernstand-/Resume-/Analyticsdaten | 0 |

Alle Sheetkomponenten wurden nach jedem Schritt zurückgelesen. Der finale Readback
bestätigt 2.932 aktive Quizfragen, 2.699 wirksame Karteikarten, 521 Lerntexte in
48 Kapiteln sowie unveränderte Trainer-Metadaten und unveränderte geschützte
Nutzer-/Fortschrittsblätter.

## Tests

- Aktuelle releasebezogene Auswahl: **431/431 bestanden**.
- Gesamte JavaScript-/MJS-Suite: **804/815 bestanden**.
- Die 11 Fehler sind dieselben auf `main`: 3 Prüfungssimulation, 3
  Quiz-Kilian-Tastatur, 1 robots, 1 Erfolgsanimation und 3 Usage-Client.
- Zusätzliche Browser-`.cjs`-Runner benötigen ihre Browserumgebung und sind nicht
  Bestandteil der vergleichbaren Node-Baseline.

## Schlussentscheidung

**GO.** B1 bis B5 sind gelöst. Der atomare Preflight und die Datenmigration sind
konfliktfrei abgeschlossen. Der Client-Cutover darf gemäß dem ausdrücklich
freigegebenen Rolloutplan fortgesetzt werden; Backend, Frontend und unmittelbarer
Produktions-Smoke-Test bleiben eigenständige Go/No-Go-Gates.
