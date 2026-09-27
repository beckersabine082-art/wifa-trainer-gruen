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

## Kontinuierliche Fach-Bundles

`sync-bundles.js` verbindet bereits vorhandene Legacy-Paare. Es erzeugt keine neue Sprache und benötigt nur Node.js, die Node-Abhängigkeiten (`npm ci` im Verzeichnis `tools/podcast-sync`), Firebase-Zugang und FFmpeg mit `libmp3lame`. `-FfmpegPath` kann auf eine vorhandene FFmpeg-EXE zeigen; für Bundles werden weder Python noch Piper installiert. Service-Account-Schlüssel bleiben außerhalb des Repositorys.

```powershell
# Vollständige lokale Erzeugung und Decode-Prüfung, keine Firebase-Schreibzugriffe:
.\tools\podcast-sync\run-local.ps1 -Bundles -DryRun -ServiceAccountPath C:\Privat\firebase.json -FfmpegPath C:\Tools\ffmpeg.exe

# Ganzes einzelnes Fach veröffentlichen:
.\tools\podcast-sync\run-local.ps1 -Bundles -OnlySubject 'Steuern' -ServiceAccountPath C:\Privat\firebase.json -FfmpegPath C:\Tools\ffmpeg.exe

# Alle Fächer sequenziell veröffentlichen:
.\tools\podcast-sync\run-local.ps1 -Bundles -ServiceAccountPath C:\Privat\firebase.json -FfmpegPath C:\Tools\ffmpeg.exe
```

Direkter Einstieg mit `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_STORAGE_BUCKET`, `PODCAST_LERNTEXTE_API_URL` und optional `PODCAST_FFMPEG`:

```powershell
node tools/podcast-sync/sync-bundles.js --dry-run --only-subject 'Steuern'
node tools/podcast-sync/sync-bundles.js
# Vorhandene veröffentlichte Bundles nur authentifiziert prüfen und dekodieren:
node tools/podcast-sync/sync-bundles.js --verify-only
node tools/podcast-sync/sync-bundles.js --verify-only --only-subject 'Steuern'
```

Auch bei `--only-subject` wird zuerst der gesamte aktuelle API-Katalog geladen und auf Identitäts-/Pfadkollisionen geprüft. Leere oder falsch zugeordnete API-Fachantworten blockieren den Lauf. `--only` und Teil-Fach-Listen sind nicht erlaubt. Kapitel folgen derselben stabilen Sortierung wie der Player: `reihenfolgeFach`, dann `reihenfolgeKapitel`, bei Gleichstand API-Reihenfolge. Fächer laufen nach ihrer kleinsten `reihenfolgeFach`, mit Fachnamen als deterministischer Zweitsortierung.

Die CLI schreibt abschließend einen JSON-Bericht nach stdout. `subjects` enthält je Fach `status` (`DRY_RUN`, `PUBLISHED`, `FAILED`), Kapitel-/Wortzahl (`chapters`, `words`), `bytes`, `duration`, `sampleCount`, `decodedSamples`, `bundleHash`, `manifestHash`, `mp3Path`, `sidecarPath` und `historicalSources`; Fehler enthalten `error`. Exitcode 1 bedeutet mindestens einen Fehler. Ein fehlgeschlagenes Fach hält die übrigen Fächer nicht auf. Der Bericht lässt sich durch Umleitung in eine externe JSON-Datei speichern. Der PowerShell-Einstieg kann bei erstmaliger Einrichtung zusätzlich Installationsmeldungen ausgeben; für ausschließlich JSON stdout den direkten Node-Einstieg verwenden.

Jedes Legacy-Paar wird mit den zuvor gelesenen Objektgenerationen geladen. RAW-Lerntext-Hash, Fach, Titel, beide kanonischen Pfade, Byteanzahlen und sämtliche sichtbaren Wörter/Zeitmarken müssen stimmen. Ein vorhandenes `manifestHash` muss exakt dem SHA-256 der JSON-Bytes entsprechen; auch ein vorhandenes leeres Feld blockiert. Nur wenn dieses Feld auf einer Legacy-MP3 vollständig fehlt, gilt der historische Vertrag: zusätzlich werden beide Generationen und die SHA-256 beider Bytefolgen als Quellbelege festgehalten. Beide Quellen werden vor dem MP3-Upload und nochmals vor dem Sidecar-Publish generation-gepinnt gelesen und bytegenau gegen diese Belege geprüft; jeweils wird der aktuelle API-Katalog neu geladen. Neue Bundle-MP3s benötigen immer eine exakte `manifestHash`-Bindung. Legacy-Objekte werden niemals geschrieben oder gelöscht.

Jede Quelle wird einzeln nach mono/22.050 Hz/s16le dekodiert. PCM wird blockweise angehängt, Kapitelgrenzen werden ausschließlich aus ganzzahligen Samples berechnet. Das Fach wird einmal mit 96 kbit/s kodiert und vollständig zurückdekodiert; die Samplezahl muss exakt übereinstimmen. Temporäre PCM-/Quell-Dateien werden auch bei Fehlern entfernt. Der CLI-Lauf entfernt nach jedem Fach sein eigenes temporäres Verzeichnis samt Bundle-MP3.

Die Veröffentlichung hält ein fachbezogenes Schloss, schreibt zunächst die unveränderliche Hash-MP3 mit Create-only-Precondition, prüft deren Bytes, Content-Type, Token und Hashmetadaten und veröffentlicht erst danach das stabile Sidecar mit Generation-CAS. Beide Objekte werden anschließend authentifiziert zurückgelesen. Bei Fehlern vor Sidecar-Publish bleibt das bisherige Sidecar erhalten; höchstens eine unreferenzierte MP3 bleibt zurück. Ein Fehler beim abschließenden Readback wird als `FAILED` berichtet und kann nach bereits erfolgreichem Sidecar-Schreiben auftreten. Der Lauf löscht oder rollt keine veröffentlichten Objekte zurück; ein erneuter Aufruf validiert vorhandene unveränderliche MP3s und kann fortfahren.

Programmschnittstellen: `buildSubjectBundle({ fach, catalog, lerntexte?, bucket, workDir, ffmpeg? })` erwartet den vollständigen aktuellen Katalog; eine optionale Fachliste muss exakt dessen Fachgruppe entsprechen. Rückgabe: Sidecar/Bytes, MP3-Pfad, eigenes `workDir`, kopierte `entries`, Quellbelege `sources`, Byte-/Samplezahlen. Der Aufrufer übernimmt nach Verwendung die Entfernung dieses eigenen Verzeichnisses. `publishSubjectBundle({ bundle, bucket, loadCatalog, withLock? })` verlangt einen frischen vollständigen Kataloglader. Die Recht-Wrapper behalten ihre 57-Kapitel-Prüfung und laden beim Publish standardmäßig den vollständigen API-Katalog neu.

`--verify-only` lädt ebenfalls den vollständigen aktuellen Katalog und prüft alle Kollisionen vor einer optionalen Fachauswahl. Je Fach liest es das stabile Sidecar und die referenzierte Hash-MP3 authentifiziert und generation-gepinnt, prüft beide exakten Bytehashes, Metadatenbindung, Content-Types, Download-Tokens, Kapitelidentitäten, aktuelle Lerntext-Hashes und vollständige Wortdeckung. Es dekodiert die gesamte vorhandene MP3 mit FFmpeg nach mono/22.050 Hz/s16le und verlangt die exakte Samplezahl; Objektgenerationen und Metadaten werden anschließend nochmals auf Änderungen geprüft. Der Modus erzeugt kein Bundle, kodiert keine MP3 und schreibt keine Firebase-Objekte. Temporäre Downloads/PCM werden auch bei Fehlern entfernt.

Der Bericht enthält `verifyOnly:true`; geprüfte Fächer erhalten `status:'VERIFIED'`, `decodeStatus:'VERIFIED'` und die üblichen Kapitel-/Wort-/Byte-/Dauer-/Sample-/Hash-/Pfadfelder. `historicalSources` entfällt, weil die Legacy-Paare in diesem Modus nicht geladen werden. Jeder Fehler führt zu `FAILED` und Exitcode 1; weitere Fächer werden dennoch geprüft. `--verify-only` und `--dry-run` schließen sich aus. Im PowerShell-Einstieg entspricht dies `-Bundles -VerifyOnly` (optional `-OnlySubject`), mit denselben Service-Account- und FFmpeg-Parametern. Direkte Funktion: `verifySubjectBundle({ fach, catalog, bucket, workDir, ffmpeg? })` aus `sync-bundles.js`.
