# Rollbackplan

Release: `WIFA-GESAMT-PROD-20261007-RC1`

## Grundsatz

Ein Rollback spielt niemals pauschal eine alte Gesamtsheetkopie zurück. Dadurch
würden neue Nutzerleistungen seit der Sicherung verloren gehen. Die frische
Preflightkopie ist Beweismittel und Notfallquelle; der operative Rollback ist ein
komponentenweiser Gegenpatch anhand des Write-Journals.

## Unmittelbar vor dem späteren Rollout einzufrieren

- aktueller `main`-Commit und lokale Release-Referenz;
- frische vollständige Produktions-Sheetkopie samt Rücklesestichprobe;
- Apps Script Version 114 und Deployment-ID
  `AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA`;
- produktive Spreadsheet-ID
  `1_PGsBBjPZcc48B1PvwS3XKNVrQgH6Rvarzg4zBbPa7Y`;
- vollständiges Inventar der bisherigen produktiven Podcastobjekte mit Generationen
  und Aggregat-SHA-256;
- Release-Run-Report und append-only Write-Journal.

`production-preflight.js` erzeugt diese Basis atomar und vergleicht den
Produktionsfingerprint unmittelbar danach erneut. Bei Drift erfolgt kein erster
Write.

## Rollbackmatrix

| Komponente | Sofortmaßnahme | Datenrollback | Nutzerleistungen |
|---|---|---|---|
| Frontend | vorherigen Produktivcommit veröffentlichen | keiner | bleiben erhalten |
| Apps Script | bestehende Deployment-ID auf Version 114 zurückstellen | keiner | bleiben erhalten |
| Trainer-Metadaten | alten Code verwenden | keiner; Release schreibt hier 0 Zellen | stabile IDs bleiben lesbar |
| 9 Trainerinhalte | 32 Journalzellen auf Paket-`expectedFields` zurücksetzen | nur C/E/F/M/N der neun IDs | Attempts/Lernstand unverändert |
| Quiz | 14 Änderungen zurücksetzen; 53 neue IDs zunächst deaktivieren | nur Paketfelder/-zeilen | historische Leistungen erhalten |
| Karteikarten | Overlay im Backend ignorieren oder 38 Zeilen inaktiv setzen | A:O nie ändern | Trainerhistorie bleibt erhalten |
| Lerntexte | 454 Journalzellen auf `expectedOld` zurücksetzen | nur nach Finalwert-Gegenprüfung | Resume bleibt ID-basiert |
| Podcast | Frontend auf vorherige Version/Pfad zurückstellen | neue immutable Objekte können liegen bleiben | Podcastfortschritt bleibt erhalten |

## Sichere Rücksetzung

Vor jeder Gegenänderung muss der aktuelle Wert exakt dem im Write-Journal
gespeicherten Release-Sollwert entsprechen. Andernfalls wird die Rücksetzung
abgebrochen, weil seit dem Rollout eine Fremdänderung erfolgt sein kann.

1. Frontend und gegebenenfalls Apps Script zurückschalten.
2. Betroffene Komponente isolieren.
3. Journalgegenprüfung durchführen.
4. Nur bestätigte Releasefelder zurücksetzen.
5. Alle IDs, Parser, Pools und Benutzerpfade erneut testen.
6. Ursache, Zeitpunkt, Felder und Nachtests append-only protokollieren.

## Komponentengates nach Rollback

- Trainer: 2.686 eindeutige IDs; 48 Metadatenthemen bleiben ohne Duplikate.
- Quiz: bei vollständigem Inhaltsrollback 2.879 aktive IDs.
- Karteikarten: 2.686 Basiskarten, keine Overlaywirkung.
- Lerntexte: 521 stabile IDs.
- Podcast: vorheriger produktiver Pfad spielt reales Audio.
- Login, Resume, Lernstand, Podcastfortschritt und Analytics bleiben erhalten.
- Keine Nutzer-, Lernstands- oder Analyticszeile wird gelöscht oder aus Backup
  überschrieben.

Die neue Produktions-Podcastversion wird niemals in-place repariert. Bei einem
Artefaktfehler wird sie deaktiviert und eine neue Versionskennung erzeugt.
