# Continuous-Podcasts für alle Fächer

## Ziel und Umfang

Der produktiv bewährte kontinuierliche Recht-Podcast wird korrigiert und anschließend fachneutral auf alle 13 Podcast-Fächer ausgerollt. Jedes Fach erhält genau eine kontinuierliche MP3 und ein stabiles Sidecar. Die 521 bisherigen Einzel-MP3-/JSON-Paare bleiben unverändert erhalten und bilden den Vordergrund-Fallback.

Nicht betroffen sind Trainer, Quiz, Prüfungssimulation, Kilian, Login, Analytics und fachfremde Backendlogik. Das vorhandene Fortschrittsbackend bleibt unverändert.

## Dropdown und logische Kapitelidentität

- Das Dropdown enthält eine Option pro logischer Lerneinheit in derselben Reihenfolge wie Fach-Playlist und Sidecar.
- Der Optionswert ist der kanonische, eindeutige Legacy-MP3-Pfad. `hauptkapitelNr` und `unterkapitelNr` dienen ausschließlich Beschriftung und Übersicht.
- „Alle Kapitel“ bleibt als leere Auswahl erhalten.
- Eine Auswahl wird über den Legacy-Pfad auf genau einen Playlist-/Sidecar-Index aufgelöst.
- Im Continuous-Modus setzt die Auswahl nur `audio.currentTime` auf `chapter.start`. Sie ändert weder `src` noch ruft sie `load()` oder automatisch `play()` auf; der Pausezustand bleibt erhalten.
- Vor dem ersten Bundle-Start merkt die Ansicht den eindeutigen Eintrag. `Anhören` erstellt die vollständige Fach-Playlist und startet am gewählten Index. Der Legacy-Fallback verwendet denselben Index.
- Automatische Grenzen und Wiederherstellung nach einem eingefrorenen Dokument aktualisieren Dropdown, Überschrift, Lerntextwurzel, Karaoke und Fortschritt anhand des tatsächlich aus `currentTime` ermittelten logischen Eintrags.

## Fachneutrales Sidecar

Schema 1 bleibt erhalten. Stabile Sidecars liegen unter `podcast/continuous/<fach-slug>.json`, unveränderliche MP3s unter `podcast/continuous/<fach-slug>/<bundleHash>.mp3`.

Die Prüfung erhält erwartetes Fach und erwarteten Pfadpräfix explizit. Sie akzeptiert ein Bundle nur, wenn:

- `schemaVersion`, Fach, Encoding und hashgebundener MP3-Pfad exakt stimmen;
- `bundleHash` und Hash der exakten Sidecar-Bytes mit den MP3-Metadaten übereinstimmen;
- `chapters.length` exakt der vollständigen aktuellen Fachliste entspricht und größer null ist;
- jede Kapitelidentität, jeder Lerntext-Hash und beide Legacy-Pfade indexgenau der aktuellen Fachliste entsprechen;
- ganzzahlige Samplegrenzen lückenlos und monoton sind und das letzte Kapitel exakt am Gesamt-Sampleende endet;
- Wortmarken vollständig, kapitelrelativ, monoton und innerhalb der Kapiteldauer liegen.

Es gibt keine fest kodierten Fachnamen oder Kapitelzahlen im generischen Vertrag. Recht-Kompatibilitätswrapper bleiben nur für gemischte Browser-Caches und bestehende Tests erhalten.

## Player- und Sitzungsisolation

Der Continuous-State enthält das validierte Fach und dessen unveränderlichen Descriptor. Alle asynchronen Sidecar-, Metadaten-, URL-, Lerntext- und Progressantworten werden zusätzlich zu `sessionId` gegen dieses Fach geprüft.

Ein Fachwechsel beendet Listener, AbortController, Playlist, Auswahl, Prefetch, Fallbackzustand, Media-Session-Position und Continuous-State des alten Fachs. Eine verspätete Antwort darf weder Daten noch UI des neuen Fachs überschreiben. Recht → anderes Fach → Recht erzeugt jeweils einen neuen, ausschließlich fachgebundenen Zustand.

Karaoke verwendet `localTime = currentTime - chapter.start`. Fortschritt wird weiterhin pro Legacy-Kapitelpfad und Lerntext-Hash mit lokaler Zeit gespeichert. Media Session arbeitet logisch pro Kapitel, ohne den physischen Medienstrom zu wechseln.

## Generierung und Quellvalidierung

Für jedes Fach werden die vollständigen aktuellen Lerntexte geladen und die Legacy-Pfade kanonisch bestimmt. Jedes MP3-/JSON-Paar wird generation-gepinnt geladen und vor Verwendung geprüft:

- aktueller RAW-Lerntext-Hash entspricht MP3-Metadatum und JSON;
- Fach, Titel, MP3-/JSON-Pfad und Wortmarken entsprechen dem aktuellen Eintrag;
- vorhandenes `manifestHash` muss dem Hash der exakten JSON-Bytes entsprechen;
- bei historischen Paaren ohne `manifestHash` gelten zusätzlich generation-gepinnte Downloads, exakte Identitäts-/Pfadprüfung, vollständige Wortdeckung und strikte Zeitmarkenprüfung. Dieser Legacy-Vertrag wird nicht auf neu erzeugte oder neue Bundle-Assets ausgeweitet.

Die Legacy-MP3s werden einzeln nach `s16le`, 22.050 Hz, mono dekodiert. PCM wird in Fachreihenfolge verbunden, Kapitelgrenzen werden aus ganzzahligen Samplepositionen berechnet, und das Fach wird einmal mit `libmp3lame` bei 96 kbit/s kodiert. Jede Bundle-MP3 wird vollständig zurückdekodiert und gegen Samplezahl und Dauer geprüft.

Unmittelbar vor Veröffentlichung werden aktuelle Lerntext-Hashes und verwendete Firebase-Generationen erneut geprüft. Eine zwischenzeitliche Änderung verwirft nur das betreffende Fach-Bundle.

## Atomare Veröffentlichung

Die Veröffentlichung läuft fachweise und sequenziell:

1. Bundle vollständig lokal bauen und validieren.
2. Fachbezogenes Publikationsschloss erwerben.
3. Hashgebundene MP3 mit Create-only-Precondition hochladen.
4. MP3 erneut laden und Bytes, Content-Type, Token und Hashmetadaten prüfen.
5. Stabiles Sidecar als letzten Schritt mit Generation-Precondition veröffentlichen.
6. Beide Objekte authentifiziert erneut lesen und vollständig validieren.

Ein fehlgeschlagenes oder abgebrochenes Fach kann höchstens eine nicht referenzierte unveränderliche MP3 hinterlassen. Ohne abschließend veröffentlichtes gültiges Sidecar verwendet der Player weiterhin Legacy-Audio. Bestehende Legacy- und ältere unveränderliche Bundle-Objekte werden nicht gelöscht.

## Inventar und Abnahme

Erwartet werden 13 Fach-Bundles, 521 Kapitel und 118.814 Wortmarken:

| Fach | Kapitel | Wortmarken |
|---|---:|---:|
| Recht | 57 | 16.932 |
| Steuern | 43 | 12.633 |
| Rechnungswesen | 36 | 9.768 |
| BWL | 40 | 10.836 |
| VWL | 48 | 4.466 |
| Unternehmensführung | 31 | 9.769 |
| Führung und Zusammenarbeit | 57 | 12.832 |
| Betriebliches Management | 48 | 7.497 |
| Logistik | 35 | 9.677 |
| Marketing | 42 | 5.378 |
| Vertrieb | 28 | 5.196 |
| Betriebliches Rechnungswesen und Controlling | 22 | 7.141 |
| Investition und Finanzierung | 34 | 6.689 |

Vor Merge/Push werden pro Fach Größe, Dauer, Kapitel, Wortmarken, Bundle-/Sidecar-Hash, Pfade, vollständiger FFmpeg-Decode und produktiver HTTP-/Content-Type-/Range-Spotcheck berichtet. Recht-Direktwahl wird für erstes, mittleres, vorletztes und letztes Kapitel im pausierten und laufenden Zustand verifiziert.
