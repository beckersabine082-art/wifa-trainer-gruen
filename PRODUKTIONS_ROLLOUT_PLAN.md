# Produktions-Rolloutplan

Release: `WIFA-GESAMT-PROD-20261007-RC1`

Status: **Produktionsausführung freigegeben; Datenmigration verifiziert, Client-Cutover ausstehend**

Produktionsausführung: **ja**

## Unveränderliche Regeln

- Ausschließlich die im `PRODUCTION_MIGRATION_MANIFEST.json` als
  `executionSource` markierten Pakete verwenden.
- Identität nur über stabile IDs/Keys, niemals über Zeilennummern.
- Erst alle erwarteten Altwerte vergleichen, danach gezielt patchen.
- Nutzerfortschritt, Podcastfortschritt, Lernstand, Resume, Auth und Analytics sind
  außerhalb des Migrationsumfangs.
- Produktion wird niemals durch das Staging-Sheet ersetzt.
- Jeder Konflikt oder jede Veränderung zwischen Preflight und erstem Write beendet
  den Lauf.

## Noch vor jeder Ausführung

1. B4-Nachweis aus `FINAL_RELEASE_AUDIT.md` gegenprüfen:
   `13/13 Sidecars | 13/13 Bundles | 13/13 loadedmetadata | 13/13 duration > 0 | PASS`.
2. Separate ausdrückliche Produktionsfreigabe einholen.
3. Festes Change Window beginnen; keine parallelen redaktionellen Writes.

## Atomarer Preflight

`tools/release/production-preflight.js` ist verbindlich und läuft unmittelbar vor
dem ersten Write:

1. aktuellen `main`-Commit lesen;
2. Produktionswerte vollständig gegen die versionierten Altwerte prüfen;
3. frische vollständige Kopie des produktiven Sheets erzeugen und rücklesen;
4. bisherigen Produktivcommit durch lokale Release-Referenz sichern;
5. Apps Script Version 114 und bekannte Deployment-ID bestätigen;
6. produktive Podcastversion, Objektgenerationen und Aggregat-SHA-256 einfrieren;
7. Backup-IDs und Hashes in den Release-Run-Report schreiben;
8. alle erwarteten Altwerte erneut lesen;
9. Fingerprint vor/nach Backup vergleichen;
10. nur bei identischem Fingerprint den ersten Write zulassen.

Die frische Sicherung wird nicht vorgezogen, weil sie sonst vor dem Rollout bereits
veralten könnte.

## Reihenfolge nach Freigabe

### 1. Podcastobjekte vorbereiten

- Die maßgeblichen Runtimeobjekte anhand
  `release/WIFA-GESAMT-PROD-20261007-RC1/podcast/PRODUCTION_PODCAST_PROMOTION_MANIFEST_V2.json`
  create-only in den geschlossenen v2-Präfix kopieren.
- `ifGenerationMatch=0` beziehungsweise gleichwertiges Create-only-Gate verwenden.
- Größen, Content-Types, Generationen, Identitäts- und Inhaltshashes rücklesen.
- 13 Sidecars, 13 MP3-Bundles, 521 IDs, 48 Kapitel und alle Runtimepfade prüfen;
  in den Runtimeartefakten muss `staging` 0-mal vorkommen.
- Alte Produktionspfade niemals überschreiben.

### 2. Fachliche Sheetpatches

Vor dem ersten Patch wird der zweite Preflightvergleich nochmals bestätigt.

| Schritt | Exakter Umfang |
|---|---|
| Trainer-Metadaten | No-op; vorhandene 48/196/2.686/2.770/577 unverändert lassen |
| Trainerinhalte | 32 Zellen in 9 IDs, nur C/E/F/M/N gemäß Paket |
| Quiz | 53 neue eindeutige Zeilen; 84 Feldwrites in 14 Bestands-IDs |
| Karteikarten | `Karteikarten_Ergaenzungen` mit 8 Spalten und 38 Zeilen neu anlegen |
| Lerntexte | 454 Zellen in 260 IDs; 521/521 Zeilenguards vorher prüfen |

Jeder Write erhält einen Journal-Eintrag mit ID, Feld, Altwert, Neuwert und
Rücklesewert. Neue Produktionsdaten außerhalb dieser stabilen IDs bleiben erhalten.

### 3. Produktionsbuilds

- Apps Script nur mit
  `node tools/release/build-apps-script.js --environment PRODUCTION --output <datei>`
  erzeugen.
- Im gebauten Artefakt muss ausschließlich
  `1_PGsBBjPZcc48B1PvwS3XKNVrQgH6Rvarzg4zBbPa7Y` vorkommen.
- Produktionsfrontend verwendet nur
  `WIFA-PODCAST-PROD-LZREV2-20261007-v2` und den neuen immutable Präfix.
- Fehlende neue Bundles sind ein Fehler; kein Legacy-Fallback.
- Staging-Deployment und Staging-Sheet bleiben unberührt.

### 4. Cutover und Smoke-Test

Nach gesonderter Freigabe zuerst Backendversion erstellen und die bestehende
produktive Deployment-ID gezielt auf diese Version stellen; danach exakt den
freigegebenen Frontendcommit veröffentlichen.

Pflichtprüfungen:

- Login/Logout;
- Trainer 48 Pools / 2.686 IDs, Recht und Steuern unverändert;
- Quiz 2.932 aktiv und Parser/Lösungsschlüssel;
- Karteikarten 2.699 aktiv, Trainer weiterhin 2.686;
- Lerntexte 521 IDs / 48 Kapitel;
- alle 13 Produktionsbundles mit realem Play;
- Kapitel, Einzeltext, Alle Kapitel, Resume, Lernstand und Analytics;
- kein Stagingpfad oder Staging-Sheet im Network-Log.

## Konflikt- und Idempotenzregeln

- Istwert = erwarteter Altwert → patchen.
- Istwert = finaler Sollwert → idempotenter No-op.
- anderer Istwert → sofortiger Abbruch, keine weiteren Komponenten.
- unerwartet vorhandene neue Quiz-ID oder Overlaytabelle → Abbruch.
- vorhandene korrekte Trainer-Metadaten → überspringen, nie duplizieren.

Der aktuelle read-only Dry-Run weist 0 unbekannte Konflikte aus. Das ersetzt nicht
den atomaren Preflight direkt vor dem späteren Write.
