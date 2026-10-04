# Podcast-Staging-Migration – freigegebener Entwurf

## Ziel

Der finale Staging-Lerntextbestand mit 521 IDs, 13 Fächern und 48 sichtbaren Kapiteln wird in einen vollständig isolierten Podcastbestand unter `podcast/staging/lerntext-rev2/` überführt. Produktive Podcastobjekte bleiben read-only und Produktion Version 114 unverändert.

## Audioquellen und Bundles

- 475 unveränderte Segmente werden nach erneuter Text-, MP3- und Sidecar-Hashprüfung am aktuellen Produktionspfad gelesen.
- Vier unveränderte Segmente (`LZ-FZ-55`, `LZ-VT-02`, `LZ-VT-03`, `LZ-LO-12`) werden nach derselben Prüfung am dokumentierten Altpfad gelesen.
- Ausschließlich die 42 im Inventar markierten Lerntexte werden aus dem finalen Staging-Text mit den bestehenden Piper-/Audioeinstellungen neu vertont.
- Quell- und Zielpfade werden getrennt modelliert. Jedes Schreibziel muss mit `podcast/staging/lerntext-rev2/` beginnen und darf keinem produktiven Pfad entsprechen.
- Segmentaudio wird nicht als MP3 blind verkettet. Alle Quellen werden auf Audioeigenschaften geprüft, zu 22,05 kHz, mono, s16le PCM dekodiert, lückenlos auf Sampleebene zusammengesetzt und das vollständige Fachbundle einmal mit libmp3lame bei 96 kbit/s kodiert.
- An allen 520 Segmentgrenzen wird samplebasiert geprüft: monotone Grenze, keine Überlappung, keine künstlich eingefügte Lücke und korrekte Offsets. Grenzen `reused → regenerated` und `regenerated → reused` werden explizit ausgewiesen.

## Staging-Artefakte

Die neue Bundleversion enthält pro Fach MP3 und Sidecar. Der Sidecar enthält mindestens Bundleversion, Fach, Bundlehash, Gesamtdauer, 48 Kapitelgruppen über alle Fächer, Lerntext-ID, Start-/Endoffset, Segment-/Texthash und Herkunft `reused` oder `regenerated`.

## Navigation und Resume

- Sichtbar: 13 Fächer → 48 Kapitelgruppen → 521 direkt auswählbare Lerntexte.
- Die 196 Detailgruppen bleiben unsichtbar.
- Auswahl und Navigation verwenden Fachkennung, Kapitelkennung und stabile Lerntext-ID; Audiooffsets stammen ausschließlich aus dem Sidecar.
- Jede Lerntext-ID besitzt exakt ein Bundle sowie genau einen Start- und Endoffset.
- Resume speichert und löst stabile Lerntext-ID plus Bundleversion auf. Alte ID-basierte Zustände werden auf den neuen Offset abgebildet; alte Sekundenoffsets werden nach einer Versionsänderung nicht blind übernommen.

## Sicherheits- und Abnahmegates

- Vor dem ersten Write wird die vollständige Zielliste geprüft: nur Staging-Präfix, keine Ziel-/Produktionspfadgleichheit, kein Delete und kein produktiver Overwrite.
- Bei einer ungültigen der 479 Wiederverwendungsquellen wird abgebrochen; keine automatische TTS-Erzeugung.
- Exakt 521 eindeutige Segmente, 479 reused, 42 regenerated, 13 Bundles und 48 sichtbare Kapitel.
- Reihenfolge exakt gemäß `Lerntexte_Reihenfolge_Manifest.json`.
- Alle 521 Auswahlziele sowie erste/letzte Lerntexte je Fach und Kapitel, Vor/Zurück, Fachwechsel, Kapitelwechsel und Resume werden automatisch geprüft.
- Neue Artefakte werden ausschließlich auf Staging veröffentlicht. Kein produktives Deployment, Merge oder Push.
