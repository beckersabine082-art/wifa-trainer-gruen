# Podcastmigration Lerntext-Revision 2 – Staging-Abnahme

**Bundleversion:** `WIFA-PODCAST-STAGING-LZREV2-20261004-v1`

**Staging-Präfix:** `podcast/staging/lerntext-rev2/`

**Datenstand:** 4. Oktober 2026

## Ergebnis

- 521 Lerntext-IDs sind exakt einmal in 13 Fachbundles enthalten.
- 479 bestehende Audiosegmente wurden nach Text-, Manifest- und Audiohashprüfung wiederverwendet; 42 freigegebene Texte wurden neu vertont.
- Die vier Altpfadmigrationen wurden ausschließlich als Lesequellen verwendet und nicht neu vertont.
- 48 sichtbare Kapitelgruppen und 521 stabile ID-Ziele sind im realen Staging-Katalog vorhanden. Die 196 internen Detailgruppen werden nicht angezeigt.
- Alle 110 erzeugten Storageobjekte (55 × JSON, 55 × MP3) liegen unter dem freigegebenen Staging-Präfix. Die vollständige Pfadliste steht in `storage-paths.json`.
- Der geschlossene Zielplan umfasst vor dem Schreibpfad 110 Slots: 84 konkrete Segmentobjekte, 13 konkrete Bundle-Sidecars und 13 fachgebundene MP3-Zielmuster mit exakt 64-stelligem SHA-256-Dateinamen. Jeder tatsächlich erzeugte Bundlepfad wird vor seiner Veröffentlichung nochmals gegen sein vorab freigegebenes Muster geprüft.
- Sämtliche veröffentlichten MP3s wurden unabhängig zurückgelesen, per SHA-256 geprüft, dekodiert und gegen die logische Samplezahl des Sidecars validiert.
- Produktion Version 114 und produktive Podcastpfade wurden weder deployed noch beschrieben, überschrieben oder gelöscht.

## Audioentscheidung und Grenzprüfung

Die 479 wiederverwendeten Quellen sind technisch nicht einheitlich:

- 446 Segmente: MP3, 22.050 Hz, mono, 96 kbit/s, `Lavf61.7.100`, Startzeit 0,050113 s.
- 33 Segmente: MP3, 24.000 Hz, mono, 128 kbit/s, `Lavf61.7.100`, Startzeit 0 s.

Eine direkte MP3-Verkettung wurde deshalb ausgeschlossen. Jedes Quellsegment wurde separat nach 22.050 Hz, mono, s16le PCM dekodiert. Die PCM-Daten wurden ohne eingefügte Pause samplegenau aneinandergehängt; jedes Fachbundle wurde anschließend genau einmal mit libmp3lame und 96 kbit/s encodiert.

Geprüfte Übergänge:

- 431 × `reused → reused`
- 35 × `reused → regenerated`
- 35 × `regenerated → reused`
- 7 × `regenerated → regenerated`
- insgesamt 508 hörbare Intra-Bundle-Grenzen: jeweils `insertedSamples = 0`, `overlapSamples = 0`, Timing exakt.
- zusätzlich 12 strukturelle Übergänge zwischen den 13 getrennten Fachdateien; damit sind alle 520 geordneten Nachbarschaften der 521 Lerntexte bilanziert. Diese 12 Übergänge sind bewusst keine Audioverkettungen.

## Fachbundles

| Fach | Kapitel | Lerntexte | reused | regenerated | Dauer | Größe | Bundlehash | Navigation | Resume |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| Führung und Zusammenarbeit | 7 | 56 | 53 | 3 | 1:48:22 | 74,4 MiB | `5a1b9c855949d5546f2efc32b24e9fe18a7dec2ef9b44916958fb25d2c98255c` | bestanden | bestanden |
| Betriebliches Management | 4 | 49 | 46 | 3 | 1:10:33 | 48,4 MiB | `3a05b2e80357d92bbef6862c4bb38635e8f0295d577fb9a4a05a969ef72d7b10` | bestanden | bestanden |
| Rechnungswesen | 5 | 36 | 34 | 2 | 1:28:54 | 61,0 MiB | `0a898de63a0498f569f3afda8db16e5c3d691958c23e19d8e8831b9182fdb2b8` | bestanden | bestanden |
| Steuern | 3 | 43 | 35 | 8 | 1:50:34 | 75,9 MiB | `59397d2faf523983a175d90cfa6d4e884c5a51fb77db45f7569731ef095b8849` | bestanden | bestanden |
| Marketing | 2 | 44 | 43 | 1 | 0:50:11 | 34,5 MiB | `6d886374cb064254d8550898595aa680ec9dbf11ce7239c381700396090a0878` | bestanden | bestanden |
| Vertrieb | 3 | 26 | 24 | 2 | 0:45:56 | 31,5 MiB | `a65ab703f96d9cf053e4177d448553dab79940eb91d7f1fa40884e772392d265` | bestanden | bestanden |
| Recht | 7 | 57 | 47 | 10 | 2:34:36 | 106,2 MiB | `a838b3c8daef519e4150e3342f27ea6d97840a38eadae953666768fa3bce1d97` | bestanden | bestanden |
| VWL | 1 | 48 | 40 | 8 | 0:45:07 | 31,0 MiB | `024604ee870990564daf3de7fd79b44808d6e2d02c7fff16e354e0a8cd5bd87f` | bestanden | bestanden |
| BWL | 3 | 40 | 37 | 3 | 1:40:01 | 68,7 MiB | `e0b6d9ef1d6f284099b8aef26afc9b5debf00754266f6f04f90f16ff62c5bb12` | bestanden | bestanden |
| Logistik | 5 | 35 | 35 | 0 | 1:24:10 | 57,8 MiB | `c75225a47b4505e9e09b556db7a5e43c30f079ec526189807921cc2e6febff8c` | bestanden | bestanden |
| Unternehmensführung | 3 | 31 | 30 | 1 | 1:26:18 | 59,3 MiB | `6b4e5235aa9ef2fd8d996f090e6b765b1b23557fe53772e69b8bee8f5dbb9255` | bestanden | bestanden |
| Investition und Finanzierung | 3 | 34 | 33 | 1 | 1:00:54 | 41,8 MiB | `c3c98bb8e26e77b534750322851178a63ceb388eec9225042e9993fc72a59077` | bestanden | bestanden |
| Betriebliches Rechnungswesen und Controlling | 2 | 22 | 22 | 0 | 0:59:54 | 41,1 MiB | `91d82dfe0ca1985e2e08d5688c685706881b18d1bb1ff4ee5f397bd212ef3a66` | bestanden | bestanden |

## 42 neu erzeugte Lerntext-IDs

`LZ-FZ-23`, `LZ-FZ-26`, `LZ-FZ-30`, `LZ-BM-16`, `LZ-BM-18`, `LZ-BM-32`, `LZ-RW-04`, `LZ-RW-09`, `LZ-ST-08`, `LZ-ST-09`, `LZ-ST-16`, `LZ-ST-20`, `LZ-ST-24`, `LZ-ST-26`, `LZ-ST-06`, `LZ-ST-36`, `LZ-MKT-14`, `LZ-VT-23`, `LZ-VT-24`, `LZ-RE-07`, `LZ-RE-05`, `LZ-RE-13`, `LZ-RE-14`, `LZ-RE-15`, `LZ-RE-17`, `LZ-RE-18`, `LZ-RE-27`, `LZ-RE-24`, `LZ-RE-47`, `LZ-VWL-05`, `LZ-VWL-06`, `LZ-VWL-07`, `LZ-VWL-09`, `LZ-VWL-13`, `LZ-VWL-14`, `LZ-VWL-21`, `LZ-VWL-40`, `LZ-BWL-13`, `LZ-BWL-26`, `LZ-BWL-30`, `LZ-UF-08`, `LZ-IF-16`.

Die vollständigen Listen der 479 wiederverwendeten IDs, der 42 neu erzeugten IDs und der vier Pfadmigrationen stehen maschinenlesbar in `id-bilanz.json`.

## Navigation, Resume und Browserprüfung

- Alle 13 Staging-Fächer wurden im lokalen Staging-Frontend gegen die reale Staging-Lerntext-API geladen: 521 Dropdown-Optionen in 48 `optgroup`-Kapiteln.
- Erste und letzte ID jedes Fachs sowie erste und letzte ID jedes sichtbaren Kapitels werden im automatisierten Test gegen genau einen Sidecar-Eintrag und genau einen Start-/Endoffset aufgelöst.
- Direktsprung, Vor/Zurück, Kapitelwechsel und Fachwechsel verwenden stabile Lerntext-IDs; innerhalb eines geladenen Bundles wird die MP3-Quelle nicht erneut gesetzt.
- Versionierter Resume speichert Lerntext-ID plus `Sidecarpfad#Bundleversion`. Ein alter ID-basierter Zustand wird auf den neuen Offset aufgelöst; eine veraltete Bundleversion übernimmt keinen alten absoluten Sekundenwert.
- Media Session sowie Mobil-/Sperrbildschirmlogik blieben unverändert und sind durch die bestehende Regression abgedeckt.
- Die lokale Vorschau umgeht keine Firebase-Anmeldung. Daher wurde die Browserwiedergabe ohne angemeldetes Testkonto erwartungsgemäß durch die Storage-Regeln abgewiesen. Die tatsächlichen Staging-MP3s wurden stattdessen vollständig serverseitig geladen und dekodiert; Player-, Play/Pause-, Resume- und Navigationslogik wurde automatisiert mit den bestehenden Auth-/Medien-Doubles geprüft.

## Prüfartefakte

- `preflight.json`: Sollbilanz und Audioeigenschaften vor dem ersten Write.
- `migration-result.json`: vollständige Build-, Grenz- und Rückleseprüfung.
- `storage-paths.json`: alle 110 tatsächlich vorhandenen Stagingobjekte mit Generation, Größe und Content-Type.
- `id-bilanz.json`: 479 reused, 42 regenerated, vier Pfadmigrationen.
- Vollständige Podcast-/Lerntext-Regression: 343 Tests, 343 bestanden, 0 fehlgeschlagen.
- Verschärfter schreibgeschützter Live-Abgleich nach Review: 521 IDs, 13 Fächer, 48 Kapitel und 110 geschlossene Zielslots bestätigt.

Es erfolgte kein Merge nach `main`, kein Push und kein produktives Deployment.
