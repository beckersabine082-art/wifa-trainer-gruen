# Recht-Pilot: kontinuierlicher Podcast

## Ziel

Für das Fach `Recht` werden die 57 bestehenden Podcast-Einheiten zusätzlich als eine kontinuierliche MP3 veröffentlicht. Nach dem einmaligen Start behält das vorhandene `HTMLAudioElement` dieselbe Quelle über alle logischen Kapitelgrenzen hinweg. Alle anderen Fächer und die 57 bisherigen Recht-MP3-/JSON-Paare bleiben unverändert und dienen im Vordergrund als Fallback.

## Bundle und Sidecar

- Jede Produktions-MP3 wird vollständig zu PCM (`s16le`, 22.050 Hz, mono) dekodiert.
- Die PCM-Daten werden in der Reihenfolge der aktiven Recht-Lerntexte verbunden. Kapitelgrenzen werden als ganzzahlige Samplepositionen bestimmt.
- Der Gesamtstream wird einmal mit `libmp3lame` und 96 kbit/s kodiert und danach vollständig zurück zu PCM dekodiert und validiert.
- Die MP3 liegt unveränderlich unter `podcast/continuous/recht/<bundleHash>.mp3`; das stabile Sidecar liegt unter `podcast/continuous/recht.json`.
- `bundleHash` ist der SHA-256 der erzeugten MP3. Das MP3-Objekt bindet zusätzlich den SHA-256 der exakten Sidecar-Bytes als Metadatum.
- Das Sidecar enthält Schema, Fach, Gesamt-Samples/-Dauer, Encoding, MP3-Pfad und pro Kapitel Identität, Nummern, Lerntext-Hash, Legacy-Pfade, ganzzahlige Start-/End-Samples, Sekundenpositionen und relative Wortzeitmarken.
- Veröffentlichung erfolgt unter einer Publikationssperre: unveränderliche MP3 zuerst, stabiles Sidecar zuletzt, jeweils mit Generation-Preconditions. Kein Legacy-Objekt wird geschrieben oder gelöscht.

## Recht-Player

- Nur bei `lerntexteAktuellesFach === "Recht"` wird das Bundle versucht.
- Vor dem Abspielen werden Sidecar-Bytehash, MP3-Metadaten, MP3-Pfad/Bundlehash, alle 57 aktuellen Lerntext-Hashes, Legacy-Pfade und die monotone Sample-Timeline validiert.
- Ein fehlendes oder ungültiges Bundle fällt beim Start auf den bisherigen Einzeldateiweg zurück.
- Im Bundlemodus bleibt die Wiedergabeliste fachweit; eine Auswahl im Hauptkapitel-Dropdown ist ein Sprung zum ersten logischen Kapitel dieses Hauptkapitels. Die Auswahl folgt anschließend dem tatsächlich laufenden Kapitel.
- Automatische Kapitelgrenzen werden ausschließlich aus `audio.currentTime` rekonstruiert. Sie ändern weder `src` noch rufen sie `load()` oder `play()` auf.
- Vorher/Nachher und direkte Hauptkapitelwahl setzen nur `currentTime`; der Pausezustand bleibt erhalten.
- Karaoke, Überschrift, Textwurzel, lokaler Fortschritt und Media-Session-Metadaten werden mit `localTime = currentTime - chapter.start` aktualisiert.
- Bei Rückkehr aus dem Hintergrund wird aus der aktuellen absoluten Zeit sofort das richtige logische Kapitel rekonstruiert.
- Fortschritt bleibt im vorhandenen Backend pro Legacy-Kapitelpfad und Lerntext-Hash gespeichert; `sekundenPosition` ist kapitelrelativ.
- Ein Laufzeitfehler des Bundles bietet den bestehenden expliziten Vordergrund-Fallback über „Kapitel erneut laden“. Es gibt keinen automatischen Hintergrund-Fallback, kein Polling, keinen Wake-Lock und keinen Autoplay-Sonderweg.

## Grenzen

Der Ansatz entfernt alle 56 Medienwechsel innerhalb des Recht-Podcasts und ist deshalb für Android-Lock-Screen-Wiedergabe wesentlich robuster. Betriebssystem, Browser, Netzwerk oder Energiesparmodus können einen einzelnen langen Stream weiterhin unterbrechen; diese Plattformgrenze wird nicht umgangen.
