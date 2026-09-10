# Kostenlose lokale Podcast-Erzeugung

Der aktive Einstieg `sync-all.js` verwendet ausschließlich lokale Piper-Synthese und lokale FFmpeg-MP3-Kodierung. Es gibt keinen Cloud-Audio-Fallback und keinen Audio-API-Key. Netzwerkzugriff ist nur für die erstmalige Installation, das Lesen aktueller Lerntexte und Firebase erforderlich. Bestehende Frontend-, Fortschritts-, Playlist- und Screen-Lock-Funktionen verwenden weiter dieselben MP3/JSON-Dateien.

## Windows

Voraussetzungen: Node.js und Python 3.12 oder neuer. Service-Account-Datei außerhalb des Repositorys aufbewahren. Nicht deren Inhalt kopieren oder einchecken.

```powershell
# Nur aktueller Quellen-/Firebase-Abgleich, keine Audioerzeugung:
.\tools\podcast-sync\run-local.ps1 -ServiceAccountPath C:\Pfad\firebase-service-account.json -DryRun

# Erster Aufruf installiert kostenlose lokale Abhängigkeiten und das Sprachmodell.
# Bei Unterbrechung denselben Aufruf wiederholen: gültige Paare werden übersprungen.
.\tools\podcast-sync\run-local.ps1 -ServiceAccountPath C:\Pfad\firebase-service-account.json

# Einzelne Einheit (Name exakt wie Fach / Titel):
.\tools\podcast-sync\run-local.ps1 -ServiceAccountPath C:\Pfad\firebase-service-account.json -Only 'Recht / Rechtsfähigkeit, Geschäftsfähigkeit und Deliktsfähigkeit'
```

Mit `-PythonPath C:\Pfad\python.exe` kann ein vorhandener Python-Interpreter gewählt werden. Installation, Stimme und `status.jsonl` liegen ignoriert unter `.local/`. Die Audios werden temporär erzeugt, vor Upload vollständig dekodiert und nach Verarbeitung entfernt. Nach Fehlern wird nur die betreffende Einheit beim nächsten Aufruf erneut erzeugt.

Direkter Node-Einstieg: `GOOGLE_APPLICATION_CREDENTIALS`, `PODCAST_LERNTEXTE_API_URL`, `PODCAST_PYTHON`, `PODCAST_PIPER_MODEL` und optional `PODCAST_STATUS_LOG` setzen, dann `node tools/podcast-sync/sync-all.js [--dry-run] [--only "Fach / Titel"]`.

## Datenintegrität

- Ausschließlich aktueller RAW `lerntext`, SHA-256 unverändert; `podcastText` wird nicht gelesen.
- Der Frontend-Text wird escaped dargestellt. Mathematische `<`/`>` bleiben deshalb Text; der lokale Erzeuger entfernt keine vermeintlichen HTML-Tags.
- MP3 und JSON müssen existieren und beide den aktuellen Lerntext-Hash tragen. Solche vorhandenen Paare werden niemals neu erzeugt.
- Vor Erzeugung und vor Veröffentlichung erfolgt erneut ein Abgleich. Die Veröffentlichung wird pro Einheit über ein Firebase-Sperrobjekt serialisiert und zusätzlich mit Objektversions-Vorbedingungen geschützt.
- MP3 zuerst, JSON zuletzt. Neue MP3-Metadaten binden mit `manifestHash` zusätzlich die exakten Manifestbytes. Dadurch kann eine unterbrochene Veröffentlichung nicht Audio und alte Zeitmarken als gültiges Paar ausgeben. Historische gültige Paare bleiben ohne diese Zusatzmetadaten gültig und unverändert.
- Sperrobjekte liegen unter `podcast-sync-locks/`, außerhalb der Audiodateien. Nach Prozessabbruch kann ein verwaistes Publikationsschloss nach 30 Minuten beim erneuten Aufruf automatisch übernommen werden.

## Stimme und Zeitmarken

[Piper](https://github.com/OHF-Voice/piper1-gpl) 1.8.0 (GPL-3.0), [Thorsten medium](https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/thorsten/medium) (deutsch; Dataset CC0), ONNX Runtime und FFmpeg. Die Modellkarte ist bei der Stimme verfügbar. Keine laufenden TTS/STT-Gebühren.

Die Synthese läuft satzweise aus vorab zugeordneten Wortphonemen. [Piper-Alignments](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/ALIGNMENTS.md) liefern tatsächliche Audiosamples je Phonem-ID; diese werden in Sekunden und Originalwortindizes übersetzt. Die Aussprache kann gegenüber einer vollständig kontextabhängigen Stimme vereinfacht sein. Deutsche Zahlen wie `10.000` und `13,90` bleiben eine zusammenhängende gesprochene Zahl. Weil das Frontend mehrere Wortindizes innerhalb solcher Zahlen hat, werden deren Phoneme auf diese Teilindizes aufgeteilt; diese internen Zahlengrenzen sind angenähert. Es wird keine Zeit über die gesamte Aufnahme geschätzt und keine automatische Transkription benötigt.

## Tests

```powershell
node --test tests/podcast-*.test.js tests/lerntexte-*.test.js tests/learning-progress-resume.test.js
python tests/podcast_local_audio_test.py
```

Die historischen TTS-/Transkriptionsmodule und ihre Mocktests dokumentieren das alte Verfahren. Sie werden vom aktiven Sync nicht importiert oder ausgeführt.
