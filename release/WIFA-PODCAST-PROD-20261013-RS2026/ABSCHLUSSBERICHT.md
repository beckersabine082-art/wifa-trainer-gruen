# Produktions-Rollout Podcast-Rechtsstandsprüfung 2026

Stand: 13.10.2026

## Ergebnis

Die vier freigegebenen kontinuierlichen Podcast-Bundles für `Steuern`, `Recht`, `Vertrieb` und `Logistik` wurden aus `podcast/staging/lerntext-rev2/` in den bereits aktiven Produktionsnamespace `podcast/production/lerntext-rev2/WIFA-PODCAST-PROD-LZREV2-20261007-v2/` übernommen und anschließend vollständig geprüft.

- Firebase-Projekt: `wifa-trainer-gruen`
- Bucket: `wifa-trainer-gruen.firebasestorage.app`
- Übertragene Produktionsartefakte: 8
- Neue unveränderliche Hash-MP3s: 4
- Per Generation-CAS aktualisierte Sidecars: 4
- In Inhalt, Generation, Größe, Prüfsummen und Content-Type unveränderte übrige Produktionsobjekte: 22
- App-Deployment: keines

Die MP3-Dateien wurden serverseitig und ohne Re-Encode aus ihren gepinnten Staging-Generationen kopiert. Bei den Sidecars wurden entsprechend dem bestehenden Produktionsverfahren ausschließlich `bundleVersion` und der aktive `mp3Path` auf den Produktionsnamespace gesetzt. Kapitel, Samplegrenzen, Wortmarken und alle fachlichen Daten blieben semantisch identisch mit den freigegebenen Staging-Sidecars.

## Veröffentlichte Artefakte und Verifikation

| Fach | Produktions-MP3 | Produktions-Sidecar | Bytes | Samples | Wortmarken | Ergebnis |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Steuern | `continuous/steuern/02b92c64f230e5fedc3417517ea8dc749419bc12315ebfdae18b579b5749d615.mp3` | `continuous/steuern.json` | 79.103.103 | 145.350.004 | 12.791 | PASS |
| Recht | `continuous/recht/6e50bc6f908f8d474260df17dd53781c5f8e72738a1b38eb374f2c2f0fb4111b.mp3` | `continuous/recht.json` | 109.024.697 | 200.330.879 | 17.592 | PASS |
| Vertrieb | `continuous/vertrieb/91e7faa71845ff4a4de2392ac68598a9b8d4271398cd170766eee62a2bdac1eb.mp3` | `continuous/vertrieb.json` | 32.550.078 | 59.808.768 | 4.976 | PASS |
| Logistik | `continuous/logistik/62f03891038882a0a2a4673a6e900f0dbb40fbd53ee7e5438e8d2eff460663d3.mp3` | `continuous/logistik.json` | 60.472.364 | 111.115.776 | 9.660 | PASS |

Der gemeinsame Präfix aller Tabellenpfade lautet `podcast/production/lerntext-rev2/WIFA-PODCAST-PROD-LZREV2-20261007-v2/`.

Gesamtbilanz: 281.150.242 MP3-Bytes, 516.605.427 veröffentlichte und vollständig dekodierte Samples sowie 45.019 Wortmarken. Für jedes Fach stimmten Produktionsgröße und SHA-256 mit der freigegebenen Staging-MP3 überein; die dekodierte Samplezahl entsprach exakt der Sidecar-Samplezahl.

## Produktions-Smoke-Test

- Authentifizierter Firebase-Download: 4/4 MP3s und 4/4 Sidecars bestanden.
- Podcaststart: erster Abschnitt beginnt jeweils bei Sample 0 und besitzt eine positive Dauer.
- Kontinuierliche Wiedergabe: 157/157 Segmentgrenzen sind samplegenau lückenlos.
- Kapitelwechsel: 18/18 sichtbare Kapitelgruppen decken die jeweiligen Fachdateien vollständig und ohne Überlappung ab.
- Wortmarkierung: 45.019/45.019 Marken sind indexrichtig, monoton und liegen innerhalb des jeweiligen Segments.
- Erreichbarkeit: alle vier produktiven MP3s besitzen gültige Download-Metadaten und waren vollständig abrufbar.
- Übrige Podcasts: 22 bereits vorhandene Produktionsobjekte waren im Vorher-/Nachher-Snapshot hinsichtlich Generation, Größe, Content-Type und Storage-Prüfsummen unverändert.

Eine zweite, vom Schreibvorgang getrennte read-only Prüfung bestätigte dieselben Byte-, Sample-, Wortmarken- und Snapshotwerte.

## Tests

- Selektiver Rollout und bestehender Produktionsschutz: 15/15 bestanden.
- Podcast-/Karaoke-/Kapitel-/Fortschrittsregressionen: 388/389 innerhalb der Sandbox. Der einzige Fehler war der bekannte `EACCES`-Loopbackeffekt der Preview; dieselbe Preview-Suite bestand außerhalb der Sandbox mit 6/6.
- Lokale Audio-/Decode-Tests: 3/3 bestanden.
- Gesamtsuite: 903 Tests; 882 bestanden, 20 fehlgeschlagen, 1 übersprungen.

Die Zahl und Identität der fehlgeschlagenen Gesamttests ist gegenüber dem dokumentierten Ausgangszustand unverändert. Die acht Produktionsrollout-Schutztests sind bestanden. Es wurde keine neue Fehlerklasse festgestellt.

## Authentifizierung und Sicherheit

Verwendet wurde ausschließlich die bereits vorhandene externe Service-Account-Datei. Es wurden keine neuen Schlüssel oder Service Accounts erzeugt und keine Zugangsdaten in Ausgaben oder Repository-Dateien übernommen. Vor dem ersten Write wurden Projekt, Bucket, sämtliche Quellgenerationen, Quellhashes, bestehende Sidecar-Ziele und die Abwesenheit der vier neuen Hash-MP3-Ziele geprüft.

## Restrisiken

- Staging und Produktion liegen im selben Firebase-Projekt und werden über getrennte Präfixe isoliert. Die verwendete Anmeldung ist nicht nachweislich IAM-seitig nur auf den Podcast-Präfix begrenzt; die Begrenzung erfolgte deshalb zusätzlich fail-closed im Rollout-Werkzeug.
- Die sechs browserbasierten Tests mit direkter Playwright-Abhängigkeit bleiben wegen des lokal fehlenden Node-Pakets Teil der 20 bekannten Vorfehler. Die vorhandenen Laufzeit-Harnesses sowie der externe Loopback-Preview-Test waren grün.
- Die vier vorherigen inhaltsadressierten MP3-Versionen bleiben als unveränderte Rollback-Artefakte im Produktionsnamespace erhalten; die aktiven Sidecars verweisen ausschließlich auf die neuen Hash-MP3s.
- Der vor dem bereits abgeschlossenen Write gespeicherte Snapshot enthielt noch keine Metagenerationen oder Hashes benutzerdefinierter Objektmetadaten. Eine ausschließlich Metadaten betreffende Fremdänderung an den 22 übrigen Objekten lässt sich deshalb rückwirkend nicht vollständig ausschließen. Inhalt, Generation, Größe, Content-Type und Storage-Prüfsummen blieben unverändert; das Rollout-Werkzeug erfasst diese zusätzlichen Metadatenfelder für künftige Läufe.

Maschinenlesbare Nachweise befinden sich im Unterverzeichnis `podcast/` sowie unter `runs/production-readback.json`. Commit-Hash, Push-Status und abschließender Repository-Status werden nach dem selektiven Commit im begleitenden Abschlussbericht ausgewiesen.
