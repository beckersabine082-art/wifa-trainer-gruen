# Kostenlose lokale Podcast-Pipeline

Ziel: 521 aktuelle Lerntexte mit gültigen MP3/JSON-Artefakten, 42 bestehende gültige Paare unverändert.

Die ausdrücklich autorisierte selbstständige Umsetzung erfolgt im vorhandenen Worktree auf feature/podcast-karaoke-pilot. Keine kostenpflichtige Audio-API, keine neue Frontend-Architektur.

## Entscheidung

Piper 1.8.0, deutsche Thorsten-medium-Stimme (Dataset CC0), lokale ONNX-Inferenz und FFmpeg. Piper stellt Sample-Dauern je Phonem-ID bereit. Wörter werden vor der satzweisen Synthese phonemisiert und ihre ID-Bereiche aufgezeichnet. Dadurch lassen sich die erzeugten Sample-Dauern direkt auf Originalwortindizes abbilden, einschließlich ausgeschriebener Zahlen und Komposita. Keine ASR, keine geschätzte Verteilung über die Gesamtdauer. Satzweise Synthese erhält Sprachfluss; die wortweise Phonemisierung kann die kontextabhängige Aussprache vereinfachen.

Alternativen: Piper plus lokale Whisper-Erkennung benötigt ein zweites Modell und fehleranfälliges Transkript-Alignment. Windows-SAPI ist hier nicht nutzbar (keine abrufbaren Stimmen). Die direkte Piper-Zuordnung hat den geringsten dauerhaften Betriebsaufwand.

Quelle bleibt der rohe aktuelle lerntext (wie im Frontend escaped dargestellt). Insbesondere mathematische Vergleichszeichen dürfen keine vermeintlichen HTML-Tags entfernen. SHA-256 und Pfade bleiben unverändert.

## Umsetzung und Nachweise

- [x] Tests für kostenlose Erzeugung, vollständige Wortabdeckung, fehlende Zeitmarken, lange Texte und Wiederaufnahme hinzufügen; erwartetes Scheitern prüfen.
- [x] Lokalen Python-Erzeuger und Node-Adapter hinzufügen; Audiodauer, Signal und vollständige MP3-Dekodierung vor Upload prüfen.
- [x] Sync ausschließlich auf lokalen Erzeuger umstellen; Service-Account-Datei lokal einlesen; Statusjournal und Einzelpilot unterstützen.
- [x] Vor Erzeugung und Upload erneut Hash/Existenz prüfen, Uploads mit Objektversions-Vorbedingungen schützen; JSON zuletzt veröffentlichen.
- [x] Genau eine fehlende Einheit erzeugen und hochladen; Remote-Dateien, Originalwörter, Hashes, MP3-Dekodierung und bestehenden Frontend-Ladepfad prüfen.
- [x] Alle übrigen Einheiten erzeugen, Erfolge überspringen, Fehler gezielt wiederholen; erfolgreiche temporäre Dateien entfernen.
- [x] Aktuelle 521 Quellen erneut laden; alle Artefakte und unveränderte Objektversionen der ursprünglichen 42 Paare prüfen.
- [x] Relevante vollständige Testsuite einmal abschließend ausführen; Review und Korrekturen prüfen.

## Bestand vor Schreibzugriff

2026-09-09: TOTAL 521, VALID/SKIP 42, SYNC_NEEDED 479, EMPTY 0, PATH_COLLISIONS 0. Objektversionen und MD5-Prüfsummen sind außerhalb des Repositories im lokalen Arbeitsverzeichnis gesichert. Es wurden keine Audio-APIs aufgerufen.

- [ ] Änderungen committen und Branch pushen: Windows-Sandbox verweigert Schreibzugriff im Git-Verzeichnis; GitHub-Integration verweigert Schreibzugriffe mit HTTP 403.

## Abschlussprüfung

2026-09-09, 20:02 UTC: 521 aktuelle Quellen, 521 gültige Paare, 42 ursprüngliche Paare mit identischer Objektversion und MD5, 479 neue gültige Paare, 0 EMPTY, 0 Path Collisions, 0 ungültige Artefakte. Alle 521 Manifeste vom bestehenden Frontend-Validator akzeptiert. Browser-DOM-Abgleich: 521 Texte, 118769 Wörter, 0 Abweichungen. Relevante Node-Testsuite: 165 bestanden, 0 Fehler; Python-Tests: 3 bestanden. Windows-Wrapper installiert lokale Laufzeit und überspringt den gültigen Pilot erfolgreich. Kein physischer Screen-Lock-Gerätetest durchgeführt; Frontend unverändert.

Präzisierung: Bei zusammenhängenden Zahlen mit mehreren Frontend-Wortindizes werden die Phoneme innerhalb der gesprochenen Zahl auf Teilindizes aufgeteilt. Diese internen Grenzen sind angenähert; alle übrigen Wortgrenzen stammen aus den gemessenen Phonem-Sample-Dauern.

