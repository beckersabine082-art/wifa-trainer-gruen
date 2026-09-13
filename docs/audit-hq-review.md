# Unabhängiger HQ-Inhaltsreview

Stand: 13.09.2026. Ausschließlich lesende fachliche Prüfung von `data/pruefungssimulation/katalog.json`; diese Datei und Produktionscode wurden nicht geändert. Schlüsselnotation: `HQ_SIM_n / HQ_A1 bzw. HQ_A2 / AufgabeTeilaufgabe`. `PRUEFBERICHT.md` wurde erst nach der Inhaltsprüfung punktuell als Kontext gelesen; dortige Erfolgsaussagen sind keine Prüfnachweise dieses Reviews.

## Umfang und Ergebnisgrenzen

Alle **129 vorhandenen HQ-Teilaufgaben** wurden vollständig gelesen: Fragen/Operatoren, Teil- und Hauptsituationen, vollständige Musterlösungen einschließlich angehängter Präzisierungen, Stichpunkte und Aufgaben-HTML. Verteilung: Simulation 1 A1 **14**, A2 **29**; Simulation 2 A1 **18**, A2 **28**; Simulation 3 A1 **17**, A2 **23**. Die beiden HQ-Einheiten der Simulation 4 enthalten jeweils **0** Aufgaben. Sie bleiben leere Einheiten und sind nicht als inhaltlich geprüfte Aufgaben gezählt. HTML-Datentabellen wurden inhaltlich, nicht visuell im Browser, geprüft. Es gab in den gelesenen HQ-Aufgaben keine zu interpretierenden Bilddateien.

Die folgenden Befunde unterscheiden neue eigenständige Mängel von bereits in den Musterlösungen ausdrücklich richtiggestellten Altfehlern. Altfehler werden nicht erneut als neue Rechenfehler gezählt. Die Vorschläge sind additive Ergänzungen oder präzise Anpassungen der Kriterien/Fragen. Bestehende Musterlösungstexte sollen gemäß Auftrag vollständig erhalten bleiben; insbesondere darf ein widersprüchlicher Alttext nicht durch Verkürzen der Lösung verschwinden.

Fallwelt: Simulation 1 enthält die **Circle Harbor GmbH**, Kassel, Vehicle Systems/Urban Solutions; Simulation 2 die **Circle Harbor GmbH**, Wuppertal, Mobility-Hubs/Cargo Solutions; Simulation 3 die **Circle Harbor Service GmbH**, Darmstadt, mit Schweizer Softwareunternehmen/Luzern. Eine pauschale Umbenennung aller Gesellschaften in einen einzigen Namen wäre falsch. **NordCargo GmbH**, Hersteller/Lieferanten A–C, die Fahrradfachhandelskette, Personalberatung und das Schweizer Zielunternehmen sind externe Rollen; ihre Zuordnung darf nicht in Circle Harbor umgewandelt werden. Kein belegbarer neuer Fremdfirmen-/Rechtsformfehler in den 129 Aufgaben festgestellt.

## Neue eigenständige Befunde

### HQ-N01 — widersprüchliche Hauptkennzahlen

**Schlüssel:** `HQ_SIM_1/HQ_A1/1a`, `HQ_SIM_1/HQ_A2/1a`, jeweils `hauptsituation`.

Die Hauptsituationen nennen gleichzeitig Eigenkapitalquote **35 %** und Verschuldungsgrad **1,7**. Bei üblicher Definition FK/EK ist dies nicht vereinbar: FK/GK = 65 %, daher FK/EK = 65/35 = **1,857142…**, auf zwei Stellen **1,86**, auf eine Stelle **1,9**. Umgekehrt impliziert 1,7 eine EK-Quote von 1/2,7 = **37,037… %**. Normales Runden erklärt die Differenz nicht. Die Kennzahlenaufgabe `HQ_SIM_1/HQ_A2/2a–g` gibt zusätzlich andere Bilanz-/Umsatzwerte als die Hauptsituation an; dies kann ein gesonderter Datensatz sein, wird aber nicht ausdrücklich so bezeichnet.

**Minimalvorschlag:** Die zwei Hauptsituationen additiv klarstellen: „Für die hier genannten 35 % Eigenkapitalquote ergibt sich rechnerisch ein Verschuldungsgrad FK/EK von rund 1,86; die Angabe 1,7 ist damit nicht konsistent.“ Falls Stammdatenkorrekturen ausdrücklich zulässig sind, 1,7 an beiden Stellen konsistent auf rund 1,86 berichtigen. Vor `HQ_A2/2a` ergänzen: „Für Aufgabe 2 gelten ausschließlich die nachstehenden gesonderten Kennzahlengrundlagen; sie ersetzen für diese Berechnungen die allgemeinen Kennzahlen der Hauptsituation.“ Die vorhandenen Zahlen der einzelnen Rechenaufgaben nicht stillschweigend ändern.

### HQ-N02 — Vorzeichenregel nur im Lösungshinweis verfügbar

**Schlüssel:** `HQ_SIM_2/HQ_A2/3c`; `HQ_SIM_3/HQ_A2/3b`.

Die Fragen verlangen die „in der Prüfung verwendete“ bzw. „in den Lösungshinweisen verwendete“ Vorzeichenlogik, ohne diese in der Aufgabe zu definieren. Verbrauchs- und Beschäftigungsabweichungen werden in Lehrwerken mit unterschiedlichen Differenzrichtungen dargestellt. Ein Prüfling kann die geforderte Konvention ohne Zugriff auf die Lösung nicht sicher ableiten. Die berechneten Beträge und die Interpretation der gewählten Konvention sind korrekt.

**Exakter additiver Fragetext für beide:** „Verwenden Sie dabei folgende Vorzeichenkonvention: Verbrauchsabweichung = Sollkosten − Istkosten; Beschäftigungsabweichung = verrechnete Plankosten − Sollkosten.“ Keine Lösungskürzung nötig.

### HQ-N03 — explizit verlangte tabellarische Herleitung fehlt

**Schlüssel:** `HQ_SIM_2/HQ_A2/6a`.

Operator: „Führen Sie die Nutzwertanalyse **tabellarisch** durch“. Die Lösung nennt ausschließlich Gewichte und Summen. Die fachlich korrekten gewichteten Einzelbeiträge fehlen. Ergänzung als Tabelle:

| Kriterium | Gewicht | A gewichtet | B gewichtet | C gewichtet |
|---|---:|---:|---:|---:|
| Lieferzeit | 40 % | 1,60 | 1,60 | 2,00 |
| Zuverlässigkeit | 25 % | 1,00 | 1,25 | 1,00 |
| Flexibilität | 20 % | 1,00 | 0,80 | 0,80 |
| Service | 15 % | 0,60 | 0,45 | 0,60 |
| Summe | 100 % | 4,20 | 4,10 | 4,40 |

Gewichtsherleitung additiv: Zuverlässigkeit z + 1,6z = 0,65 ⇒ z = 0,25; Lieferzeit 0,40. Service s + (s + 0,05) = 0,35 ⇒ s = 0,15; Flexibilität 0,20. Kriterien können den bestehenden ersten Eintrag präzisieren zu `Gewichte 40/25/20/15 und tabellarische gewichtete Einzelwerte`.

### HQ-N04 — Einheiten der Kostenfunktion

**Schlüssel:** `HQ_SIM_2/HQ_A2/3a`, `HQ_SIM_3/HQ_A2/3a`.

Vorhanden: `K(x) = 36.708 € + 42 € × x` bzw. `K(x) = 106.200 € + 56,50 € × x`. x ist die Beschäftigung in Stunden. Der variable Koeffizient muss somit **€/Std.** tragen. In den Nachbarrechnungen sind die Stundensätze korrekt gemeint; es ist ein Darstellungs-/Dimensionsfehler, kein falscher Kostenbetrag.

**Exakte Ergänzungen:** „Mit x als Beschäftigung in Stunden lautet die dimensionsrichtige Kostenfunktion K(x) = 36.708 € + (42 €/Std.) × x.“ und „Mit x als Beschäftigung in Stunden lautet die dimensionsrichtige Kostenfunktion K(x) = 106.200 € + (56,50 €/Std.) × x.“

### HQ-N05 — Darlehensvergleich führt korrigierte Schlussrate nicht fort

**Schlüssel:** `HQ_SIM_3/HQ_A2/2b`, Folge zu `2a`.

2a präzisiert bereits, dass bei der gerundeten Jahresrate von 436.710 € die Schlussrate 436.705,46 € beträgt. 2b vergleicht dennoch 5 × 436.710 = **2.183.550 €** als Gesamtzahlung. Der zu 2a konsistente Betrag ist **4 × 436.710 + 436.705,46 = 2.183.545,46 €**. Die Aussage zur höheren Belastung mit tilgungsfreiem Jahr bleibt richtig. Auch 4 × 538.054 € ist eine Näherung, deren letzte Rate wegen Rundung angepasst werden müsste.

**Exakte additive Ergänzung:** „Die hier genannten Gesamtsummen sind Näherungswerte aus gerundeten gleichbleibenden Raten. Bei Fortführung der in Teilaufgabe a korrigierten Schlussrate beträgt die Gesamtzahlung ohne Tilgungsaussetzung 2.183.545,46 €. Ohne vorzeitige Rundung ergeben sich jährliche Annuitäten von 436.709,1428 € für fünf Jahre bzw. 538.054,0904 € für vier Jahre; damit betragen die rechnerischen Gesamtzahlungen rund 2.183.545,71 € bzw. 2.212.216,36 €. Bei einem centgenauen Zahlungsplan wird jeweils die Schlussrate ausgeglichen. Die Entscheidung gegen die Tilgungsaussetzung bleibt unverändert.“

Das ist eine nicht fortgeführte Rundungspräzisierung, kein neuer Fehler in der Annuitätenformel.

## Kriterien, die Präzisierungen nicht hinreichend abbilden

Die Bewertungstechnik wurde in diesem Auftrag nicht ausgeführt. Deshalb ist nicht behauptet, dass jede Nennung automatisch als starres Muss bewertet wird. Fachlich sind folgende Stichpunkte aber unbedingter oder enger als die inzwischen ergänzte Musterlösung. Die unten angegebenen Ersatzstrings erhalten die Anzahl vorhandener semikolongetrennter Einträge, sofern nur der jeweilige Eintrag ersetzt wird; bestehende Musterlösungen bleiben ungekürzt.

| Schlüssel | Vorhandener Kriterien-Eintrag | Minimaler Ersatz |
|---|---|---|
| HQ_SIM_1/HQ_A2/2a | `solide Finanzierung` | `Eigenkapitalpuffer von 40 % mit Branchen- und Zeitvergleich bewerten` |
| HQ_SIM_1/HQ_A2/2b | `attraktive Verzinsung` | `14,40 € Gewinn je 100 € Eigenkapital und Attraktivität abhängig von Risiko und Eigentümeranforderungen` |
| HQ_SIM_1/HQ_A2/2d | `Überliquidität` | `Überliquidität ohne zeitlichen Liquiditätsplan nicht bewiesen` |
| HQ_SIM_1/HQ_A2/2e | `akzeptabler Bereich` | `140 % rechnerische Deckung bei kurzfristig einbringlichen Forderungen und passender Fälligkeit` |
| HQ_SIM_1/HQ_A2/2g | `angemessen` | `Angemessenheit anhand vereinbarter Zahlungsziele beurteilen` |
| HQ_SIM_1/HQ_A2/8b | `Bestellung in zwei Wochen` | `Bestellung in zwei Wochen bei 50 Verbrauchswochen oder rund 2,12 Wochen bei 52 Wochen und offengelegter Annahme` |
| HQ_SIM_2/HQ_A2/2c | `2:1-Regel` | `2:1- und 3:1-Regel erfüllt, 1:1-Regel nicht erfüllt` |
| HQ_SIM_2/HQ_A2/7b | `Anzeige nach fünf Tagen rechtzeitig` | `Anzeige nach fünf Tagen bei äußerlich nicht erkennbarer Fehlmenge rechtzeitig` |
| HQ_SIM_2/HQ_A2/7b | `beauftragte Spedition haftet/abwickelt` | `beauftragte Spedition als Vertragspartner abwickelt, Obhutshaftung bei Frachtführerpflichten, sonst § 461 HGB prüfen` |
| HQ_SIM_3/HQ_A2/2a | `Annuität 436.710` | `Annuität 436.709,14 € oder nachvollziehbar gerundet 436.710 € mit angepasster Schlussrate` |
| HQ_SIM_3/HQ_A2/2b | `ohne Aussetzung 2.183.550` | `ohne Aussetzung rund 2.183.546 € bei berücksichtigter Schlussrate, 2.183.550 € nur grobe Raten-Näherung` |
| HQ_SIM_3/HQ_A1/8a | `Donnerstag §8 Abs1/2a JArbSchG` | `Donnerstag 9,5 Std. Arbeit nach §8 Abs1/2a und 10,5 Std. Schicht nach §12 JArbSchG unzulässig` |
| HQ_SIM_3/HQ_A1/8a | `Dienstag §11 JArbSchG` | `Dienstag §11 JArbSchG: erste Pause zu früh und nur 45 Minuten rechtmäßig gelegene Pause statt erforderlicher 60` |

Weitere präzise Qualitätsverbesserungen bei sehr generischen Kriterien:

- `HQ_SIM_1/HQ_A1/5a`: `6-3-5 geeignet` → `6-3-5 bei sechs aktiv Schreibenden oder angepasster Teilnehmerzahl begründet geeignet`; `Brainwriting` → `Brainwriting oder eigenständige Kopfstandmethode`. Der Lösungstext erlaubt bereits ausdrücklich die Kopfstandmethode; sie fehlt bislang im Kriterienwortlaut.
- `HQ_SIM_1/HQ_A1/6a`: `Zeitplanung` → `Zeitplanung mit Verantwortlichkeiten und Erfolgskontrolle`. Die angehängte Lösung behandelt genau diese für einen Konzeptentwurf relevanten Gesichtspunkte.
- `HQ_SIM_2/HQ_A1/4b`: `Leverage-Effekt` → `positiver Leverage-Effekt bei rGK > iFK mit Formel rEK = rGK + (rGK − iFK) × FK/EK`.
- `HQ_SIM_2/HQ_A1/5a`: `drei höchste Risiken` → `Rangfolge Fehler 1 (900), Fehler 4 (120), Fehler 5 (70)`. Die Zahlen in den vorhandenen Kriterien sind schon korrekt, stehen aber nicht in Rangfolge.
- `HQ_SIM_2/HQ_A1/5c`: `drei Ishikawa-Ursachen` → `drei Ishikawa-Ursachen für Fehler 1, Akkus außerhalb zulässiger Lagertemperatur`. Damit wird der korrigierte Fallbezug explizit.

Diese Liste ist kein Auftrag, bestehende Kriterienzahl oder Punktgewichte zu erhöhen. Sie macht falsche Pauschalurteile konditional und nimmt bereits explizit zugelassene richtige Antworten auf.

## Bereits richtiggestellte Altfehler: verbleibendes Leserisiko, keine neuen Rechenfehler

- `HQ_SIM_1/HQ_A1/4a`: „bemühte sich“ wird zunächst als durchschnittliche Leistung bezeichnet und später ausdrücklich richtiggestellt. Die Zeugnisbeurteilung als Ganzes enthält damit die richtige Einordnung, aber erst im Nachtrag.
- `HQ_SIM_1/HQ_A1/5a`: Brainwriting und dessen Variante 6-3-5 werden zunächst als getrennte Techniken präsentiert; der Nachtrag liefert mit der Kopfstandmethode eine eigenständige Alternative und erklärt die Teilnehmerzahl.
- `HQ_SIM_1/HQ_A2/2a`, `2b`, `2d`, `2e`, `2g`: Pauschalurteile „gut“, „attraktiv“, „Überliquidität“, „akzeptabel“, „angemessen“ werden durch die jeweils spätere differenzierte Interpretation relativiert. Kriterien sollten diese Relativierung übernehmen.
- `HQ_SIM_1/HQ_A2/8b`: Die nicht vorgegebene Annahme von 50 Verbrauchswochen und die 52-Wochen-Alternative sind bereits ausdrücklich offengelegt. Kein neuer Fehler von 180 kg/Woche bei offengelegter 50-Wochen-Annahme.
- `HQ_SIM_2/HQ_A1/4b`: Die Hebelbedingung wird im Nachtrag zutreffend über Gesamtkapitalrentabilität und FK-Zins formuliert.
- `HQ_SIM_2/HQ_A1/5a`: Der Alttext behauptet 1 × 9 × 100 = 90 und priorisiert Fehler 4. Der Nachtrag berichtigt auf 900 und Rangfolge 1/4/5. `5c` behandelt zunächst den falschen Fehler 4, liefert danach aber drei konkrete Ketten für den richtigen Fehler 1. Diese Widersprüche sollten bei absolutem Texterhalt zumindest mit einem gut sichtbaren **vorangestellten** Hinweis zur maßgeblichen Präzisierung gekennzeichnet werden. Nicht noch einmal dieselbe Rechenberichtigung anhängen.
- `HQ_SIM_2/HQ_A2/2b`: Die Annahme langfristiger Darlehen und Rückstellungen ist bereits benannt. 120,15 % ist unter dieser Annahme richtig.
- `HQ_SIM_2/HQ_A2/2c`: 3:1 wird im Nachtrag bereits mitbeurteilt; Kriterien sind noch enger.
- `HQ_SIM_2/HQ_A2/7a–b`: Marktwertannahme, nur bedingt rechtzeitige Schadensanzeige und Haftungsrolle des Spediteurs sind inzwischen differenziert erläutert.
- `HQ_SIM_3/HQ_A1/7b`: Eine endgültig wirksame Abmahnung kann ohne Wortlaut der Äußerung nicht geprüft werden. Das ergänzte Platzhaltermuster und der Hinweis auf geschützte Kritik sind angemessen; aus der Situation dürfen keine erfundenen konkreten Beleidigungen ergänzt werden.
- `HQ_SIM_3/HQ_A1/8a`: Die fehlenden 60 Minuten rechtmäßig gelegener Dienstagspause und die Donnerstag-Schichtzeit stehen bereits im Nachtrag. Nicht erneut als neue Rechtsfehler zählen.
- `HQ_SIM_3/HQ_A2/1a`: 1.880.000 € als reale Höchstsumme ist bereits ausdrücklich richtiggestellt; 1,88 Mio. € nur als gerundete Darstellung. Bei ausschließlich ganzen Euro höchstens 1.879.410 €.
- `HQ_SIM_3/HQ_A2/2a`: Rundung und Schlussrate bereits berichtigt; nur die nicht fortgeführte Gesamtsumme in 2b ist oben neu herausgestellt.

## Unabhängige Rechenkontrolle

Barwerte und Annuitäten wurden zusätzlich mittels PowerShell/`Math.Pow` unabhängig aus den Aufgabendaten berechnet. Übrige einfache Tabellen-/Kennzahlenrechnungen wurden anhand der angegebenen Operanden vollständig nachgerechnet. Die folgende Liste deckt die im HQ-Bestand enthaltenen Zahlenketten ab.

| Aufgabe | Nachgerechnetes Ergebnis / Bewertung |
|---|---|
| 1/A1/2a Matrix | A 10, B 9, C 6, D 11, E 8; Rang D/A/B/E/C richtig |
| 1/A2/1a Kapitalwert | Barwerte ungerundet 92.592,5926; 81.447,1879; 71.643,3598; 45.939,3658; 42.536,4498 €. Summe 334.158,9559 €, C0 9.158,9559 €. Centwerte richtig. |
| 1/A2/1b Zinsfuß | 10-%-Barwerte 90.909,0909; 78.512,3967; 67.806,1608; 42.688,3410; 38.807,5827 €. Summe 318.723,5720 €. Interpolation rund 9,19 %, zulässige geforderte Näherung. |
| 1/A2/2a–g Kennzahlen | EK 10 Mio., 40 %; Gewinn 1,44 Mio., rEK 14,4 %; FK-Zins 1,2 Mio., rGK 10,56 %; kfr. FK 3 Mio., L1 60 %; Forderungen 2,4 Mio., L2 140 %; lfr. FK 7,5 Mio., ADII 87,5 % in enger Langfristdefinition; Debitorenziel 36 Tage bei 360 Tagen. Zahlen richtig. |
| 1/A2/3a–b Engpass | 1.152.000 Sekunden; Lieferpflichten 348.000; C 144.000, E 240.000, A 420.000. Programm A 5.250/B 2.800/C 2.000/D 2.000/E 3.000; DB 80.430 €. Zusätzliche 2.500 D können A verdrängen; Preisgrenze 12,60 + 90×0,0675 = 18,675 €, bei Centpreisen mindestens 18,68 €. |
| 1/A2/5a–b Nutzwert | Gewichte 0,36/0,24/0,15/0,25; A 4,91, B 4,97, C 5,15; 5,15/6 = 85,833… %. Richtig. |
| 1/A2/8a–e Lager | 860 kg Durchschnitt; 50-Wochen-Meldebestand 540 kg und Bestellung in 2 Wochen; bei 52 Wochen 533,0769 kg und 2,12 Wochen. Andler 600 kg. Kosten 4.680 vs. 3.510 €/Jahr, Differenz 1.170 bzw. 25 %. Richtig bei offengelegten Annahmen. |
| 2/A1/4b Kennzahlformeln | Im vollständigen Text sind Prozentfaktor, Kapitalwertformel und richtige Hebelbedingung vorhanden; keine zusätzliche Rechenaufgabe. |
| 2/A1/5a FMEA | Vorgegebene vereinfachte Formel liefert 900/40/50/120/70. Korrigierter Nachtrag richtig. Keine gewöhnliche 1–10-FMEA-Skala; dies wird bereits erläutert. |
| 2/A2/1a Nutzungsdauer | Exakte C0: −100.925,9259; −83.779,1495; −16.938,4748; 15.990,8626; 58.187,0208; 48.356,3746 €. Volle-Euro-Werte und Wahl Jahr 5 richtig. |
| 2/A2/2a–d Bilanz | Aktiva/Passiva jeweils 17,60 Mio.; AV 13,60, EK 7,74, FK 9,86. AI 77,27 %, EK 43,98 %, ADII 120,15 %, L2 246,03 %, FK/EK 1,2739. Annahmen zur Darlehenslaufzeit beachten. |
| 2/A2/3a–d Plankosten | 7×8×20×0,95 = 1.064 Std.; Kplan 81.396; kplan 76,50 €/Std.; verrechnet 87.210; Soll 84.588; VA −1.312, BA +2.622 nach verwendeter Konvention. Richtig. |
| 2/A2/5a–d Lager | 155 Stück; 180 €/Jahr; optimale Menge 150, Häufigkeit 10; Meldebestand 55; (190−55)/5 = 27 Tage. Richtig. |
| 2/A2/6a–b Nutzwert | Gewichte 40/25/20/15 %; A 4,20, B 4,10, C 4,40; C 88 %, A 84 %, B 82 %. Richtig. |
| 2/A2/7a Haftungsbetrag | 2×20×8,33×1,20 = 399,84 €. Bei begründet angesetztem Marktwert 240 € bleibt Warenwertersatz 240 €. |
| 3/A2/1a Höchstinvestition | Barwert einschließlich Förderungen 1.879.410,64 €. Korrigierte Höchstgrenze richtig. |
| 3/A2/2a–b Annuität | 2 Mio.×0,97 = 1,94 Mio.; Annuitäten exakt 436.709,142801152 und 538.054,090386164 €. Vorhandene Rundungsvariante in a samt korrigierter Schlussrate nachvollziehbar; Gesamtsummenfortführung siehe HQ-N05. |
| 3/A2/3a–d Kosten | Fix 106.200; variabel 169.500; Gesamt 275.700; kv 56,50. Ist 2.760 Std., Soll 262.140, verrechnet 253.644, BA −8.496, VA +420. AfA bei 106 %: 35.600+8.900×1,06 = 45.034. Richtig. |
| 3/A2/5a–c Bedarf | 65×12+33 = 813; 813−118−350+175+80 = 600. Negativer Nettobedarf −500 bedeutet 500 rechnerischer Überschuss. Richtig. |

## Rechts-/Aktualitätsabgleich und Grenzen

- Die aktuelle Fassung von [§ 3 GüKG](https://www.gesetze-im-internet.de/g_kg_1998/__3.html) nennt für Unternehmen mit Sitz im Inland die Gemeinschaftslizenz. Die HQ1-Lösung darf daher nicht ohne Datumsprüfung wieder auf eine ältere generelle Unterscheidung nationaler Erlaubnis/Gemeinschaftslizenz zurückgesetzt werden. Der gefundene aktuelle Normtext bestätigt insoweit 7b/7c.
- [§ 11 JArbSchG](https://www.gesetze-im-internet.de/jarbschg/__11.html) bestätigt die zeitliche Pausenlage, 30/60 Minuten und 4,5-Stunden-Grenze; [§ 8 JArbSchG](https://www.gesetze-im-internet.de/jarbschg/__8.html) bestätigt 8 Stunden täglich/40 wöchentlich und die bedingte 8,5-Stunden-Verteilung. Die vollständige HQ3-Lösung erfasst die Tagesfehler. Eine zusätzliche Wochenrechnung müsste die vertragliche durchschnittliche tägliche Ausbildungszeit für die Berufsschulanrechnung ausdrücklich voraussetzen; sie wird hier nicht als eindeutiger neuer Zahlenfehler behauptet.
- [§ 429 HGB](https://www.gesetze-im-internet.de/hgb/__429.html) bestätigt, dass der Marktwert bei Übernahme maßgeblich ist. Deshalb ist die inzwischen offen benannte Marktwertannahme in HQ2/7a wichtig; Einkaufspreis ist nicht universell der gesetzlich einzig zulässige Maßstab.
- Die [Anlage zur IndKflAusbV](https://www.gesetze-im-internet.de/indkflausbv/anlage.html) bestätigt die Berufsbildposition Vertriebsprozesse und Angebotserstellung in HQ3/A1/6a.
- Die offizielle [WTO-Darstellung](https://www.wto.org/english/thewto_e/whatis_e/who_we_are_e.htm) bestätigt 166 Mitglieder; der Suchtreffer zum WTO-Jahresbericht 2026 verwendet ebenfalls 166. Kein belegbarer neuer Mitgliederzahlfehler in HQ3/A2/9a.

Nicht behauptet: Vollständige juristische Einzelfallprüfung jedes möglichen alternativen Lösungswegs, verbindliche Abmahnungswirksamkeit ohne konkreten Wortlaut, verifizierte interne Daten realer Firmen oder ein erfolgreicher Bewertungs-/UI-End-to-End-Lauf. Der Auftrag dieses Dokuments ist ein unabhängiger Inhaltsreview der 129 vorhandenen HQ-Aufgaben.

## Nachprüfung: Mengenoperatoren gegen tatsächliche Einzelkriterienbewertung

Die zuvor ausdrücklich offengelassene Bewertungstechnik wurde nun im Backend gelesen: `berechnePunkteAusKriterien_` (Code.gs ab Zeile 1185) berechnet `Math.round(erfüllte Kriterien / alle Kriterien × Maximalpunkte)`. `bewertePruefungFrontend` lässt jedes Semikolon-Kriterium einzeln prüfen. Alternative richtige Beispiele werden laut Prompt nur bei entsprechend allgemein formulierten Kriterien anerkannt. Ein einzelner pauschaler Eintrag wie „drei Kriterien“ beseitigt deshalb die daneben einzeln bewerteten Alternativen nicht.

**Ergänzender Auftrag:** Anders als bei den vorausgehenden Einzelwortpräzisierungen ist für diese belegte Rubrikenreparatur die Änderung der Kriterienanzahl ausdrücklich erlaubt. Die nachstehenden Vorschläge ersetzen nur die Stichpunkte durch unabhängige Antwortpositionen. Die ursprünglichen Musterlösungen, Aufgabenpunkte und Bewertungscode bleiben unverändert. `tests/fixtures/audit-hq-kriterien.json` enthält 49 Vorschläge mit exaktem vorherigem String, Schlüssel, Feld und Ersatzstring. Diese Datei ist eine Review-Fixture und verändert selbst keine Produktionsdaten.

Alle 129 HQ-Aufgaben wurden noch einmal auf Mengenanforderungen und Alternativenlisten durchgesehen. Die 49 vorgeschlagenen Reparaturen betreffen belegbare Alternativen-/Doppelzählungsprobleme oder zusätzliche, vom Operator nicht verlangte Pflichtinhalte. Nicht allein wegen abstrakter Formulierungen geändert wurden etwa die festen Balanced-Scorecard-Dimensionen, die festen Logistikfunktionen, Maslow-Stufen, SMART-Kriterien, Wissenskategorien oder Rechenaufgaben. HQ3/A2/2c ist ausdrücklich **kein** Negativbeispiel: zwei Gründe plus Mengenanforderung ergeben 3/4 × 2 = 1,5 und damit bereits volle zwei Punkte.

Die folgende Rechnung zeigt jeweils eine fachlich vollständige zulässige Antwort, die bei einer den einzelnen Kriterien entsprechenden Klassifizierung zu wenig Punkte erhält. Wo ein Beispiel mehrere Umschreibungen berührt, ist die angegebene Trefferzahl eine konservative mögliche Einzelbewertung bzw. obere Schranke. Es wurde **kein externer KI-Bewertungslauf** ausgeführt; demonstriert wird der deterministische Punktefehler bei diesen nachvollziehbaren Erfüllungsmengen. Einzige umgekehrte Ausnahme: HQ1/A2/5c zeigt volle Punkte für nur einen Kritikpunkt. Eine Rundung oberhalb oder unterhalb der hier angenommenen Menge wurde nicht als tatsächliches KI-Ergebnis behauptet.

| Schlüssel | Erfüllt / Anzahl × Maximalpunkte → gerundete Punkte | Vollständige erlaubte Antwort / Beleg |
|---|---|---|
| HQ_SIM_1/HQ_A1/1/a | 4 / 8 × 8 → 4 | Zwei passende und zwei konfliktäre Ziele etwa Deckungsbeitrag/Prozesskosten und Beratungsintensität/Provisionen mit jeweiliger Partnerrolle benötigen weder Qualitätssteigerung noch Markterschließung noch Kundenzufriedenheit noch Marktkenntnisse. |
| HQ_SIM_1/HQ_A1/1/c | 4 / 7 × 4 → 2 | Zuverlässigkeit, Marktkenntnisse, wirtschaftliche Stabilität und Servicequalität jeweils erläutert: vier der sieben Alternativen. |
| HQ_SIM_1/HQ_A1/3/a | 12 / 19 × 8 → 5 | Je zwei genannte Indikatoren pro Dimension plus vier Dimensionsbezeichnungen: zwölf von neunzehn Einträgen. |
| HQ_SIM_1/HQ_A1/3/b | 8 / 10 × 4 → 3 | Feedback der Mitarbeitenden erweitert Perspektiven und zeigt blinde Flecken, Selbst-Fremdbild-Abgleich ermöglicht Entwicklung: Kollegen und externe Partner müssen nicht zusätzlich vorkommen. |
| HQ_SIM_1/HQ_A1/3/c | 4 / 10 × 4 → 2 | Risiko offener Kritik aus Angst vor Vergeltung durch Anonymisierung begegnen, uneinheitliche Bewertung durch gemeinsame Maßstäbe reduzieren. Frustration, unqualifizierte Antworten und Zielvereinbarung sind keine zusätzlichen Pflichtmaßnahmen. |
| HQ_SIM_1/HQ_A1/3/d | 8 / 10 × 4 → 3 | Schulung und individuelles Mentoring beschrieben, Mentoring wegen gezielter praktischer Defizitbearbeitung empfohlen. Coach und Coaching empfohlen bleiben ungenannt. |
| HQ_SIM_1/HQ_A1/4/b | 4 / 9 × 4 → 2 | Ungestörten Raum reservieren, Interviewrollen vorab zuordnen, Lebensläufe auf Widersprüche prüfen und einen einheitlichen Fragenleitfaden vorbereiten. Höchstens vier der vorhandenen spezifischen Einträge werden dadurch vertreten. |
| HQ_SIM_1/HQ_A1/5/a | 9 / 11 × 9 → 7 | Brainwriting, Walt-Disney- und Kopfstandmethode dargestellt, Kopfstandmethode begründet gewählt. Die zwei auf 6-3-5 festgelegten Einträge bleiben jedenfalls unerfüllt. |
| HQ_SIM_1/HQ_A1/5/b | 4 / 7 × 4 → 2 | Zeit für die eigene Moderationsvorbereitung reservieren und eigene Belastbarkeit/Konzentration prüfen. Gruppenzusammensetzung, Konfliktpotenziale und Teilnehmerinteressen sind dann nicht zusätzlich erforderlich. |
| HQ_SIM_1/HQ_A1/5/c | 8 / 11 × 6 → 4 | Homepage, private Ausbildungs-Jobbörse und Instagram erläutert. Agentur für Arbeit, Facebook und LinkedIn bleiben ungenannt. |
| HQ_SIM_1/HQ_A2/4/a | 4 / 6 × 2 → 1 | SWOT zur Vorbereitung langfristiger Entscheidungen und Bewertung strategischer Alternativen formuliert. Frühwarnsystem und strategische Risiken sind keine weiteren geforderten Aufgaben. |
| HQ_SIM_1/HQ_A2/5/c | 3 / 4 × 2 → 2 | Nur EIN Kritikpunkt: persönliche Präferenzen bei der Gewichtung beeinträchtigen die Objektivität. Erfüllt Gewichtung, Beeinflussung, eingeschränkte Objektivität und erzielt bereits volle zwei Punkte. |
| HQ_SIM_1/HQ_A2/7/c | 7 / 9 × 5 → 4 | Gemeinschaftslizenz sowie Niederlassung, Zuverlässigkeit, finanzielle Leistungsfähigkeit und fachliche Eignung beschrieben. Versicherungs- und Mitführungspflichten sind weitere Alternativen, die nicht zusätzlich gefordert sind. |
| HQ_SIM_1/HQ_A2/9/b | 4 / 5 × 4 → 3 | Einheitliche Bedingungen, weniger Verhandlungen, Transparenz und Rechtssicherheit beschrieben. Informationspflichten müssen nicht als fünfter Vorteil genannt werden. |
| HQ_SIM_1/HQ_A2/9/c | 5 / 6 × 4 → 3 | Vier unwirksame Klauselbeispiele genannt und als unwirksam bezeichnet, ohne nicht geforderte Paragraphennennung. Der Norm-Eintrag bleibt unerfüllt. |
| HQ_SIM_2/HQ_A1/1/a | 6 / 8 × 8 → 6 | Vier Ziele Image, Kosten, Beschaffungssicherheit und Qualität begründet. Sechs Kriterien einschließlich Mengen- und Begründungseintrag, ohne zusätzliche Expansion/Produktentwicklung. |
| HQ_SIM_2/HQ_A1/1/b | 4 / 7 × 6 → 3 | Die drei Messkriterien der ergänzten Musterlösung: Liefertreue, Wiederbeschaffungszeit und Gesamteinstandskosten. Diese betreffen Zuverlässigkeit/Kosten, nicht Image, Entwicklungspotenzial oder Marktmacht. |
| HQ_SIM_2/HQ_A1/2/a | 4 / 6 × 6 → 4 | Promotion und Price fallbezogen beschrieben. Product und Place sind weitere Alternativen, nicht ebenfalls verlangt. |
| HQ_SIM_2/HQ_A1/4/a | 5 / 8 × 4 → 3 | Umsatz, Marktanteil, Sortimentsbreite und Preisniveau beschrieben: vier Größen plus Mengenanforderung. |
| HQ_SIM_2/HQ_A1/5/c | 5 / 8 × 6 → 4 | Drei Ishikawa-Ketten Mensch, Methode und Messung mit Maßnahmen für Akku-Lagertemperatur analysiert. Drei weitere M-Kategorien sind nicht ebenfalls verlangt. |
| HQ_SIM_2/HQ_A1/7/a | 6 / 7 × 9 → 8 | Mehrsprachige Beratung, barrierefreie Arbeitsplätze und Altersmischung mit Wissensweitergabe samt betrieblicher Wirkung erläutert. Reputation ist keine zusätzliche Pflichtwirkung. |
| HQ_SIM_2/HQ_A1/9/a | 6 / 7 × 5 → 4 | Mentoring, Stützunterricht, alte Prüfungen, Prüfungssimulationen und geeignete externe persönliche Hilfe eingeplant. Assistierte Ausbildung ist eine weitere mögliche Maßnahme, nicht zusätzlich gefordert. |
| HQ_SIM_2/HQ_A2/1/b | 3 / 5 × 2 → 1 | Unsichere Prognosen künftiger Zahlungsüberschüsse und unterjährige statt nachschüssige Zahlungszeitpunkte genannt. Mengenanforderung plus zwei Fachkriterien. |
| HQ_SIM_2/HQ_A2/4/c | 6 / 9 × 5 → 3 | Lage, Infrastruktur, Kosten, Fachkräfte und Genehmigungen beschrieben: Mengenanforderung plus fünf Faktoren statt aller acht. |
| HQ_SIM_2/HQ_A2/6/c | 4 / 5 × 3 → 2 | Subjektive Kriterienauswahl, subjektive Gewichtung und subjektive Bewertung beschrieben. Momentaufnahme ist ein vierter alternativer Kritikpunkt. |
| HQ_SIM_2/HQ_A2/8/b | 3 / 6 × 4 → 2 | Registereintragung und Benutzung mit Verkehrsgeltung unter Nennung §4 MarkenG erläutert. §47, zehnjährige Dauer und Verlängerung werden nicht gefragt. |
| HQ_SIM_2/HQ_A2/8/c | 8 / 10 × 6 → 5 | Beide Anwendungsbereiche samt Normen, zwei GWB-Beispiele und zwei UWG-Beispiele genannt. Zwei weitere UWG-Beispiele bleiben Alternativen. |
| HQ_SIM_2/HQ_A2/9/a | 7 / 9 × 4 → 3 | Direktvertrieb mit Kontrolle/Kundenkontakt, indirekter Vertrieb mit Marktabdeckung/bestehenden Strukturen: vier Vorteile plus Mengenangabe und zwei Vertriebsformen. |
| HQ_SIM_2/HQ_A2/9/b | 7 / 9 × 4 → 3 | Gebietsmodell vollständig beschrieben und mit Marktkenntnis, Kundenbindung und klaren Zuständigkeiten begründet. Reisekosten und Besuchseffizienz sind weitere Alternativen. |
| HQ_SIM_2/HQ_A2/9/c | 4 / 9 × 3 → 1 | Umsatz, Deckungsbeitrag und Reklamationsquote samt Strategiebezug erläutert: Mengenanforderung plus drei Kennzahlen. |
| HQ_SIM_3/HQ_A1/1/a | 7 / 8 × 8 → 7 | Vier wirtschaftliche Vorteile anhand Forming/Storming/Norming/Performing erläutert. Adjourning ist eine fünfte mögliche Phase und nicht zusätzlich gefordert. |
| HQ_SIM_3/HQ_A1/1/b | 3 / 9 × 2 → 1 | Freistellung verbindlich klären und Berichtswege festlegen, beide Schritte beschrieben. Weitere mögliche Schritte sind nicht ebenfalls Pflicht. |
| HQ_SIM_3/HQ_A1/1/c | 7 / 9 × 5 → 4 | Budgetkompetenz/kurze Entscheidungswege sowie Hierarchie/Rollenkonflikt erläutert und Empfehlung begründet. Fachliche Erfahrung und Dominanz sind weitere Alternativen. |
| HQ_SIM_3/HQ_A1/2/a | 5 / 7 × 6 → 4 | Je zwei Maßnahmen: Veränderungsbedarf erklären/Informationsmaterial, neue Strukturen einführen/Systemtraining, verbindliche Abläufe dokumentieren/Auffrischungstrainings. Beteiligung und Monitoring sind plausible weitere Maßnahmen, keine Pflichtalternativen. |
| HQ_SIM_3/HQ_A1/3/a | 7 / 10 × 10 → 7 | Klare Sprache, Beispiele, rhetorische Fragen, Stimme und aktives Zuhören jeweils begründet: Mengen-/Begründungseintrag plus fünf Grundsätze. |
| HQ_SIM_3/HQ_A1/4/c | 5 / 6 × 4 → 3 | ABC- und chronologische Ordnung für Suche/Auswertungen empfohlen. Sachliche Ordnung ist eine dritte Alternative. |
| HQ_SIM_3/HQ_A1/5/a | 4 / 7 × 3 → 2 | Beratung, Handelsmarke und Umweltkonzept erläutert: Mengenanforderung plus drei Merkmale. |
| HQ_SIM_3/HQ_A1/5/b | 6 / 7 × 6 → 5 | Zielorientierter und Umsatzanteilsansatz samt Begründung, Liquiditätsgrenze und Prozyklik erläutert. Antizyklische Planung ist eine dritte zusätzliche Alternative. |
| HQ_SIM_3/HQ_A1/5/c | 5 / 8 × 6 → 4 | Bekanntheitsgrad durch Befragung und ökonomischen Erfolg durch Umsatzvergleich erläutert. Seitenaufrufe, Bestellungen und Bestellwert müssen nicht ebenfalls genannt werden. |
| HQ_SIM_3/HQ_A1/6/b | 3 / 7 × 7 → 3 | Geeignete Vier-Stufen-Unterweisung mit Ablauf und drei eigenen Argumenten erläutert. Leittextmethode, vollständige Handlung, Selbstständigkeit und Verantwortung sind keine für jede zulässige Methode notwendigen Argumente. |
| HQ_SIM_3/HQ_A1/6/c | 2 / 5 × 2 → 1 | Erfolg durch neue praktische Transferaufgabe und mündliche Erklärung von Angebotsbestandteilen prüfen. Zwei zulässige Kontrollen, ohne die vier spezifischen Kontrollbeispiele zu wählen. |
| HQ_SIM_3/HQ_A1/7/a | 6 / 7 × 5 → 4 | Aktives Zuhören, Nachfragen, Zusammenfassen, Interessenklärung und offene Fragen beschrieben. Denkanstöße sind eine weitere Alternative. |
| HQ_SIM_3/HQ_A2/4/a | 4 / 8 × 3 → 2 | Rentabilität, Liquidität und Informationsversorgung erläutert: Mengenanforderung plus drei Ziele, ohne zusätzliches Frühwarnsystem/Benchmarking. |
| HQ_SIM_3/HQ_A2/4/b | 5 / 6 × 9 → 8 | Planung, Kontrolle und Information je beschrieben und je zwei Beispiele genannt. Steuerung ist ein vierter alternativer Aufgabenbereich. |
| HQ_SIM_3/HQ_A2/4/c | 3 / 7 × 2 → 1 | Informationsverdichtung und Vergleichbarkeit ausführlich beschrieben. Zwei-Aspekte-Eintrag plus zwei Inhalte, keine zusätzlichen System-/Benchmarking-/Entscheidungsaspekte nötig. |
| HQ_SIM_3/HQ_A2/6/b | 6 / 8 × 8 → 6 | Lage, Infrastruktur, Kosten und Fachkräfte mit jeweils einem Fallbeispiel. Mengen-/Beispieleintrag plus vier Faktoren. |
| HQ_SIM_3/HQ_A2/7/a | 6 / 7 × 6 → 5 | Umschlags-, Verteiler-, Sammel- und Vorratslager beschrieben, Verteillager fallbezogen empfohlen. Konsignationslager ist eine weitere Alternative. |
| HQ_SIM_3/HQ_A2/8/b | 3 / 4 × 4 → 3 | Konzept mit vermiedener Mehrfachunterstellung und Softwarekomplexität begründet. Der Webshop ist ein dritter möglicher Sachverhalt. |
| HQ_SIM_3/HQ_A2/9/b | 4 / 8 × 6 → 3 | Wachstum, geringere Heimatmarktabhängigkeit und Stückkostendegression differenziert erläutert. Mengenanforderung plus drei Chancen. |


Der zunächst mitbetrachtete Franchisekonzept-Fall HQ_SIM_2/HQ_A1/6a wurde mangels gleich eindeutiger Fehlskalierungsmenge aus der Reparatur-Fixture herausgenommen. Die Fixture enthält zu allen 49 verbliebenen Fällen einen konkreten Antwortzeugen und die Felder oldMatched, expectedPoints und oldPoints. Diese Erfüllungsmengen sind fachlich begründete Testannahmen für den deterministischen Skalierungstest, keine protokollierten KI-Ausgaben. Bei HQ3/A1/6c kann die neue praktische Aufgabe auch dem breiten alten Qualitätskontrollkriterium entsprechen: selbst mit zwei alten Treffern bleibt nur ein statt zwei Punkten.
