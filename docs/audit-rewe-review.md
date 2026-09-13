# Unabhängiger Fachaudit WQ Rechnungswesen

Stand: 13.09.2026. Geprüft wurden alle 55 Teilaufgaben in `data/pruefungssimulation/katalog.json`: jeweils Hauptsituation, Situation, Frage, vollständiger Lösungstext einschließlich früherer Ergänzungen, fachlicher Inhalt aller HTML-Tabellen und sämtliche Stichpunktkriterien. HTML wurde für das fachliche Lesen von Formatierungsmarkierungen befreit, nicht inhaltlich gekürzt. `PRUEFBERICHT.md` diente lediglich als Kontext; Ergebnisse wurden selbst nachgerechnet. Keine Produktionsdatei wurde verändert.

## Ergebnis und Grenzen

Unter den jeweils erkennbaren Rechenannahmen sind alle numerischen Endergebnisse richtig. Es gibt keine neu nachgewiesene falsche Endsumme. Die vorhandenen Richtigstellungen zu SIM2 4a/4c sind mathematisch zutreffend. Vier Einheiten ergeben jeweils exakt 100 Punkte, zusammen 400. Die Zahl der Stichpunkte ist keine Punktezahl; unterschiedlich lange Kriterienlisten allein sind deshalb kein nachgewiesener Bewertungsfehler.

Drei verbleibende Präzisions-/Konsistenzbefunde werden unten unterschieden. Sie sind keine Aufforderung, Lösungen zu kürzen. Der unterschiedliche KG-Vergleichsfall in SIM2 5a–c ist richtig abgegrenzt und bleibt erhalten. Alle übrigen Fälle bleiben Circle Harbor GmbH mit den vorgegebenen Produktwelten und Zahlen.

## Befunde mit minimaler Korrektur

### R1 – SIM3 5c: Kriterium übernimmt die Einschränkung der Lösung nicht

`stichpunkte` nennt weiterhin schlicht `Absatzpreis`. Die vollständige Musterlösung schränkt diesen Schlüssel bereits sachgerecht auf einen nachweisbaren Zusammenhang mit der Kostenverursachung ein. Ein bloßer hoher Marktpreis erklärt keine höheren Fertigungskosten. Damit ist die Rubrik weniger präzise als die bereits berichtigte Lösung. Minimal: genau das vorhandene Kriterium in `Absatzpreis nur bei nachgewiesenem Zusammenhang mit der Kostenverursachung` ändern, Kriterienzahl und 2 Punkte erhalten. Der vorhandene Lösungstext benötigt keine Kürzung und keinen weiteren fachlichen Ersatz. Es ist ein Rubrikrisiko; eine tatsächlich erfolgte falsche KI-Bewertung wurde nicht getestet.

### R2 – SIM4 4: entscheidende Mengenannahme steht nur in der Lösung

Aufgabenfrage und HTML nennen nur Stufenkosten/Ausbringungsmengen 4.500, 4.000, 3.500 Stück und Absatz 3.000 Stück. Die vorhandene Ergänzung sagt selbst zutreffend, dass 18,95 €/Stück Bestandsänderungen und einmaliges Durchlaufen jeder Stufe voraussetzen; bei Schwund/Ausschuss wären nachfolgende Stufen anders zu belasten. Die Aufgabenangaben legen diese Voraussetzung nicht ausdrücklich fest. Beispiel: Werden alle 4.500 Einheiten weiterbearbeitet und fallen Mengen durch Ausschuss bis auf 3.500 Fertigprodukte, verteilen sich die gesamten 64.000 € Fertigungskosten auf 3.500 gute Stück, also 18,285714 €/Stück zuzüglich 3,50 € Vw/Vt = 21,785714 €/Stück. Bei reinen Zwischenlagerzugängen trägt dagegen jedes verkaufte Stück 8 + 3,85 + 3,60 € = 15,45 € Herstellkosten und insgesamt 18,95 €. Minimal nur die Situation ergänzen: `Die Mengenunterschiede entstehen ausschließlich durch Bestandsmehrungen; Ausschuss oder Schwund treten nicht auf. Jedes verkaufte Stück durchläuft jede Stufe einmal.` Die vorhandene ausführliche Lösung vollständig erhalten. Dies schließt eine belegbare Mehrdeutigkeit, korrigiert kein Rechenergebnis.

### R3 – SIM4 3a–c: Absatzgleichheit und unveränderter Preis nicht ausdrücklich vorgegeben

3a benennt Produktion, nicht Absatz. 3b leitet dennoch 40 €/Stück aus 240.000 € / 6.000 produzierten Stück ab; 3c übernimmt denselben Preis für April. Die beabsichtigte Rechnung ist richtig, sofern beide Produktionsmengen vollständig im jeweiligen Monat abgesetzt werden und der Preis gleich bleibt. Minimal in die Ausgangssituation von 3a ergänzen: `Die produzierten Mengen werden im jeweiligen Monat vollständig verkauft; der Stückverkaufspreis ist in beiden Monaten gleich.` 3d kann diese Werte dann unverändert fortführen. Alle 8/4/2/6 Punkte und Rechnungen erhalten. Dies ist eine Aufgabenpräzisierung, kein neuer Zahlenfehler.

## Vollständiges Prüfprotokoll

Geldbeträge sind Euro, sofern nicht anders angegeben. In den Handelskalkulationen wurde wie in den Musterlösungen jede monetäre Zwischenstufe kaufmännisch auf Cent gerundet. Prozentwerte wurden erst am jeweiligen ausgewiesenen Ergebnis auf zwei Stellen gerundet. Erforderliche ganze Stückzahlen werden aufgerundet. Andere präzise Rechenwege mit erst abschließender Rundung sollten nicht allein wegen unvermeidbarer Centdifferenzen abgewertet werden.

### Simulation 1 – 14 Teilaufgaben, 100 Punkte

| Aufgabe | Punkte | Eigenständiger Prüfbeleg und Urteil |
| --- | ---: | --- |
| 1a | 20 | Alle fünf verlangten Gegenüberstellungen und HTML-Zeilen vorhanden: Dokumentation/Jahresabschluss gegenüber interner Steuerung; gesetzliche Fibu gegenüber betrieblicher KLR; externe/interne Adressaten; Unternehmen/Betrieb; Aufwand–Ertrag gegenüber Kosten–Leistungen. Im gegebenen GmbH-Fall fachlich stimmig. |
| 2a | 12 | Sechs neutrale Kategorien mit passenden Beispielen. Die vorhandene Ergänzung grenzt außergewöhnlichen Brandschaden, nur den Gewinn über Fahrzeugbuchwert und nur nicht bereits abgegrenzte Lohnnachzahlung zutreffend ab. Kein neuer Sachfehler. Die Kategorien sind KLR-Abgrenzungen, keine behaupteten heutigen GuV-Sonderposten. |
| 2b | 6 | Grundkosten = aufwandsgleich; Anderskosten = korrespondierender Aufwand in anderer Höhe; Zusatzkosten = ohne korrespondierenden Aufwand. Alle drei HTML-Zeilen und Kriterien passen. |
| 3a | 13 | 120 × 22 % = 26,40; SK = 146,40; Gewinn = 146,40 × 16 % = 23,424 → 23,42; BVP = 169,82; ZVP = 169,82 / 0,95 = 178,757895 → 178,76. Skonto 3,5752 → 3,58 und Provision 5,3628 → 5,36. LVP = 178,76 / 0,90 = 198,622222 → 198,62; Zuschlag = 78,62 / 120 × 100 = 65,516667 → 65,52 %. Alle Stufen stimmen. |
| 3b | 3 | 1.986,24 / 1,6552 = exakt 1.200,00; Zuschlag = 786,24. Der vorgegebene gerundete Satz wird korrekt verwendet. |
| 4a | 6 | MGK = 42.000 × 0,18 = 7.560; MK = 49.560. FGK = 31.000 × 0,75 = 23.250; FK = 54.250. HK = 103.810. Vw = 12.457,20; Vt = 8.304,80; SK = 124.572. Sämtliche Tabellenzeilen stimmen. |
| 4b | 3 | 124.572 / 1,20 = 103.810 HK; Vw bei ausdrücklich neuen 14 % = 14.533,40; Vt bei 6 % = 6.228,60. Die Summe bleibt 20 %. Kein Fehler aufgrund gegenüber a geänderter Aufteilung. |
| 4c | 4 | Getrennte Einzelkostenerfassung und Kostenstellenrechnung/Gemeinkostenzuordnung erfüllen die zwei verlangten Voraussetzungen. |
| 5a | 6 | Kapazität 4.800 / 0,8 = 6.000 Stück/Monat; bei 60 % 3.600 Stück; U = 900.000; K = 900.000 − (−144.000) = 1.044.000. Bei BE: K = 1.200.000. kv = (1.200.000 − 1.044.000)/(4.800 − 3.600) = 130 €/Stück. |
| 5b | 4 | 130 × 4.800 = 624.000 variable Kosten; 1.200.000 − 624.000 = 576.000 €/Monat fix. |
| 5c | 4 | 6.000 × 0,88 = 5.280 Stück; db = 250 − 130 = 120 €/Stück; DB = 633.600; BE = 57.600 €/Monat. |
| 5d | 4 | Neue Kf = 576.000 − 144.000 = 432.000; x = 6.000 × 0,70 = 4.200; db = 432.000/4.200 = 102,857143 → 102,86 €/Stück. Gerundeter Centwert erreicht das Ziel knapp. |
| 6a | 9 | EK = FK = 5.000.000; FK-Zins = 200.000/Jahr. Jahresgewinn nach Zinsen der ursprünglichen Finanzierung, wie in der Ergänzung ausdrücklich erläutert: rEK = 480.000/5.000.000 = 9,60 %; rGK = (480.000 + 200.000)/10.000.000 = 6,80 %. |
| 6b | 6 | FK 6.000.000, EK 4.000.000, Zins 240.000, Mehrzins 40.000; Gewinn 440.000; rEK = 11,00 %, Anstieg 1,40 Prozentpunkte. rGK bleibt (440.000 + 240.000)/10.000.000 = 6,80 %; positiver Hebel, weil 6,80 % > 4 %. |

### Simulation 2 – 15 Teilaufgaben, 100 Punkte

| Aufgabe | Punkte | Eigenständiger Prüfbeleg und Urteil |
| --- | ---: | --- |
| 1a | 5 | UV: min(AK 1,40; Markt 1,25) × 5.200 Liter = 6.500. Abwertung 780 gegenüber AK 7.280. Strenges Niederstwertprinzip §253 Abs.4 HGB zutreffend. |
| 1b | 5 | Alternativer Marktpreis 1,60: AK-Obergrenze 5.200 × 1,40 = 7.280; kein Ansatz von 8.320. Kein kumulativer Folgefall, sondern ausdrücklich anderer Marktpreis. |
| 2a | 14 | Sieben Positionen mit je zwei Zuordnungen: Grundstücke/Gebäude A/AV; LuL-Schulden P/FK; Handelsware A/UV; Kredit P/FK; LuL-Forderung A/UV; Bankguthaben A/UV; Jahresüberschuss P/EK. Alle zutreffend. |
| 3a | 15 | Rabatt 960 × 8 % = 76,80; ZEP 883,20; Skonto 26,496 → 26,50; BEP 856,70; BP 937,00; HK 187,40; SK 1.124,40. Verkauf: Rabatt 145; ZVP 1.305; Skonto 26,10; Provision 39,15; BVP 1.239,75; G 115,35; G/SK × 100 = 10,258805 → 10,26 %. |
| 3b | 3 | (1.450 − 937)/937 × 100 = 54,749200 → 54,75 %. |
| 4a | 12 | kv = 26.000/50 = 520; Kf = 784.000 − 700 × 520 = 420.000. August-Kontrolle: 420.000 + 680 × 520 = 773.600. 70 % von 800 = 560; K = 711.200; k = 1.270; p = 1.450. BE = 420.000/930 = 451,612903 Stück; theoretischer Umsatz 654.838,709677 → 654.838,71. Bei 452 Stück Umsatz 655.400 und Gewinn 360. Ergänzung korrekt. |
| 4b | 2 | (1.450 − 520) × 800 − 420.000 = 324.000 €/Monat. |
| 4c | 6 | Gewinnquote 20 % bedeutet 290 €/Stück Gewinn und Kosten 1.160. x = 420.000/(1.160 − 520) = 656,25. Durchschnittsauslastung 82,03125 %; mindestens 657 ganze Stück bzw. 82,125 %. Vorhandene Rundungsrichtigstellung stimmt. |
| 5a | 4 | Eigenständige Components KG: EK-Delta 60.000; Entnahmen 12 × 1.200 = 14.400; Einlage 20.000; G = 60.000 + 14.400 − 20.000 = 54.400. Keine Privatentnahme einer GmbH unterstellt. |
| 5b | 7 | Durchschnitt EK = 1.240.000; GK = 1.405.000. rEK = 54.400/1.240.000 × 100 = 4,387097 → 4,39 %. rGK = 58.000/1.405.000 × 100 = 4,128114 → 4,13 %. |
| 5c | 3 | Positiver Hebel verlangt i < exakt 4,128113879 %. Bei Zinssätzen mit zwei Dezimalstellen maximal 4,12 %, nicht 4,13 %. Der vorhandene Text ist damit richtig; die ungerundete Grenze erklärt die scheinbare Rundungsdifferenz. |
| 6a | 6 | FL = 36.000/1,20 = 30.000; MK = 40.000 + 4.000 = 44.000; FK = 30.000 + 36.000 = 66.000; HK vor Bestandskorrekturen 110.000; HKU = 110.000 + 3.000 − 16.000 = 97.000. Vw/Vt-Basis korrekt. |
| 6b | 6 | MGK = 40.000 × 0,10 = 4.000; Vw = 97.000 × 0,07 = 6.790; Vt = 97.000 × 0,05 = 4.850. |
| 6c | 2 | SKU = 97.000 + 6.790 + 4.850 = 108.640. |
| 7a | 10 | Gesamt 1.290.000 + 1.075.000 + 129.000 + 1.397.500 + 408.500 = 4.300.000. Fix 116.100 + 1.031.675 + 352.225 = 1.500.000. Variabel 1.290.000 + 1.075.000 + 12.900 + 365.825 + 56.275 = 2.800.000. DB = 4.000.000 − 2.800.000 = 1.200.000, DB-Quote 30 %, BEU = 1.500.000/0,30 = 5.000.000. |

### Simulation 3 – 15 Teilaufgaben, 100 Punkte

| Aufgabe | Punkte | Eigenständiger Prüfbeleg und Urteil |
| --- | ---: | --- |
| 1a | 20 | Vier verlangte Teilbereiche vollständig und zutreffend erklärt: Fibu, KLR, Statistik/Auswertung, Planungsrechnung. Keine unbeantwortete Teilanforderung. |
| 2a | 15 | MGK 3; MK 40,50; FGK 67,20; FK 109,20; HK 149,70. Vw 8,982 → 8,98; Vt 14,97; Spezialverpackung SEKV 1,35; SK 175,00. 206 × 0,9 = 185,40; Skonto 5,562 → 5,56; BVP 179,84; G 4,84; 4,84/175 × 100 = 2,765714 → 2,77 %. |
| 3a | 14 | Kantine: 180+300+150+500+480+290 = 1.900 Essen, Satz 9 €/Essen; Umlagen 1.620/2.700/1.350/4.500/4.320/2.610. Fuhrpark: 8.580+1.620 = 10.200; 900+150+450+500+6.500 = 8.500 km; Satz 1,20 €/km; Umlagen 1.080/180/540/600/7.800. Planung: 34.470+1.350+180 = 36.000; 600 Std.; 60 €/Std.; 21.600/14.400. Endkosten Material 68.000, FI 150.400, FII 136.800, Vw/Vt 189.953. Primärsumme und Endsumme identisch 545.153; alle Umlagen vollständig. |
| 3b | 6 | MGK 68.000/340.000 = 20 %; FI 150.400/64.000 = 235 %; FII 136.800/72.000 = 190 %. HK = 340.000+68.000+64.000+150.400+72.000+136.800 = 831.200; HKU 831.200+16.200−6.900 = 840.500; Vw/Vt = 189.953/840.500 = exakt 22,60 %. |
| 4a | 4 | U = 36 × 2.500 = 90.000; Kv = 16 × 2.500 = 40.000; DB 50.000; BE 24.000. |
| 4b | 2 | db = 20 €/Stück; xBE = 26.000/20 = 1.300 Stück. |
| 4c | 2 | UBE = 1.300 × 36 = 46.800. |
| 4d | 4 | x = (26.000 + 13.000)/20 = 1.950 Stück. |
| 4e | 3 | BE = DB − Kf = 0 impliziert DB = Kf, vollständig beantwortet. |
| 5a | 10 | ÄZ aus Länge 4/2, 6/2, 2/2 = 2/3/1; RE = 4.000/15.000/3.000, Summe 22.000; 242.000/22.000 = 11 €/RE. Je Stück 22/33/11, Sorten 44.000/165.000/33.000; Kontrollsumme 242.000. |
| 5b | 3 | 10.000 + 44.000 + 9.000 = 63.000; /2.000 = 31,50 €/Stück. |
| 5c | 2 | Zwei geeignete Kriterien wie Materialeinsatz/Länge und Fertigungszeit reichen. Vorhandene Einschränkung des Absatzpreises korrekt; Kriterienpräzision siehe R1. |
| 6a | 5 | Ergebnis vor Zins = 24 Mio. × 6,5 % = 1,56 Mio.; FK = 24−6 = 18 Mio.; Zins 18 Mio. × 4,5 % = 0,81 Mio.; G 0,75 Mio. |
| 6b | 6 | rEK = 0,75/6 = 12,5 %; rU = 0,75/30 = 2,5 %. |
| 6c | 4 | rEK = rGK + (rGK − i) × FK/EK: konstantes rGK und günstigeres FK unter rGK erhöhen bei den vorgegebenen positiven Kapitalbeträgen den EK-Hebel; Aussage stimmig. |

### Simulation 4 – 11 Teilaufgaben, 100 Punkte

| Aufgabe | Punkte | Eigenständiger Prüfbeleg und Urteil |
| --- | ---: | --- |
| 1 | 20 | Fünf Gegenüberstellungen stimmen wie SIM1 1a; sämtliche HTML-Kriterien berücksichtigt, kein fehlender Aspekt. |
| 2 | 20 | Kita-MA = 6+14+10+42+88+40 = 200, 60 €/MA; Umlagen 360/840/600/2.520/5.280/2.400. Kantine 6.240+360 = 6.600, Mahlzeiten 120+60+360+320+240 = 1.100, 6 €/Essen; 720/360/2.160/1.920/1.440. Hilfsstelle 12.000+600+360 = 12.960, je 6.480. Endkosten 85.560/167.160/193.680/75.840; Summe 522.240 = Primärsumme. Zuschläge 11,640816 → 11,64 %; 103,826087 → 103,83 %; 114,603550 → 114,60 %. HKU = 1.511.400 + 15.000 = 1.526.400; Vw/Vt = 4,968553 → 4,97 %. |
| 3a | 8 | April x = 6.000/1,20 = 5.000; kv = (214.000−190.000)/1.000 = 24 €/Stück; Kf = 214.000−144.000 = 70.000. Aprilprobe 70.000+120.000 = 190.000. |
| 3b | 4 | Bei Vollabsatz: Mai-U 214.000+26.000 = 240.000; p 40; db 16; BE 70.000/16 = 4.375 Stück, UBE 175.000. Aufgabenannahmen siehe R3. |
| 3c | 2 | Bei gleichem Preis und Vollabsatz: 5.000 × 40−190.000 = 10.000. Siehe R3. |
| 3d | 6 | Gewinn je Stück 40 × 8 % = 3,20; Deckung Kf 40−24−3,20 = 12,80; x = 70.000/12,80 = 5.468,75, mindestens 5.469. Bei dieser Menge Gewinn 17.504, Umsatz 218.760, Quote rund 8,00146 %, Ziel erreicht. |
| 4 | 9 | 36.000/4.500 = 8; 15.400/4.000 = 3,85; 12.600/3.500 = 3,60; 10.500/3.000 = 3,50; Summe 18,95 €/Stück. Rechenweg korrekt unter der nur lösungsseitig erklärten Bestandsannahme; siehe R2. |
| 5 | 15 | Rabatt 1.080; ZEP 12.420; Skonto 372,60; BEP 12.047,40; BP 12.167,40. HK = 2.920,176 → 2.920,18; SK 15.087,58. G = 1.810,5096 → 1.810,51; BVP 16.898,09; ZVP = /0,94 = 17.976,691489 → 17.976,69; LVP = /0,94 = 19.124,138298 → 19.124,14. |
| 6a | 6 | GK-Ertrag 40 Mio. × 6 % = 2,4 Mio.; FK 28 Mio.; Zins 1,26 Mio.; Ergebnis vor Ertragsteuern 1,14 Mio. Die Aufgabe legt die Vorsteuerbetrachtung ausdrücklich fest. |
| 6b | 6 | rEK = 1,14/12 = 9,50 %; rU = 1,14/48 = 2,375 % → kaufmännisch 2,38 %. |
| 6c | 4 | Mit rGK 6 % über i 4,5 % verstärkt fallendes i den positiven Hebel: d(rEK)/di = −FK/EK < 0. Fallbezogene Wirkung richtig. |

## Quellen und technische Nachrechnung

Die Bilanzbewertung wurde am amtlichen [§253 HGB](https://www.gesetze-im-internet.de/hgb/__253.html) geprüft: Anschaffungskostenobergrenze und Abwertung des Umlaufvermögens auf niedrigeren Stichtagswert tragen SIM2 1a/1b. Der gesonderte Abruf von §252 lieferte einen Toolfehler; für die hier geprüften Bilanzbeträge reicht §253 aus.

Die Kapitalrentabilitätsformeln wurden zusätzlich mit dem [IHK-Würzburg-Leitfaden Unternehmensrisiken, Anhang Kennzahlen](https://www.wuerzburg.ihk.de/fileadmin/user_upload/Mediathek/Schriftenreihe/Unternehmensrisiken_2008.pdf) abgeglichen. Die Definition rGK = (Gewinn + Fremdkapitalzinsen)/GK bestätigt das Zurückaddieren der Zinsen. Der Leverage-Zusammenhang wurde algebraisch daraus abgeleitet; keine aktuelle Zinsprognose oder Anlageempfehlung wird unterstellt.

Die Bestandskorrektur ist mit dem vom Verlag selbst bereitgestellten [Merkur-Lehrwerksauszug, Herstell- und Selbstkosten](https://www.merkur-verlag.de/media/41/df/f9/1708417204/1032-01_dl_vorl.pdf?ts=1752768327) vereinbar: Mehrbestände abziehen, Minderbestände addieren. Deshalb wurde die verwendete Bezeichnung „Herstellkosten der Erzeugung“ vor der gemeinsamen Bestandskorrektur in SIM2 6a nicht als Fehler gemeldet.

Zusätzlich zur eigenen Einzelrechnung wurden über Node die Handelszuschläge/Rundungen, Rentabilitäten, BE-Schwellen, Fix-/Variabelsummen sowie beide BAB-Gesamtkostenkontrollen numerisch nachgerechnet. Katalogauswertung: Teilaufgabenzahlen 14/15/15/11; Punktesummen 100/100/100/100. Eine Browserprüfung oder tatsächliche KI-Bewertung gehört nicht zu diesem read-only Fachaudit und wurde nicht behauptet.

## Nachprüfung der Rubriken unter der tatsächlichen Punkteformel

Nach ergänzendem Auftrag wurden erneut alle 55 Kriterienstrings geprüft, nun ausdrücklich gegen `berechnePunkteAusKriterien_` in `backend/apps-script/Code.gs:1185`: `Math.round(erfüllteKriterien / Kriterienanzahl * maxPunkte)`. Der KI-Prompt verlangt eine unabhängige Prüfung jedes einzelnen Kriteriums. Deshalb dürfen alternative Beispiele oder Umformulierungen eines Antwortaspekts nicht als weitere Pflichtantworten auftreten. Der oben stehende Hinweis, dass unterschiedliche Listenlängen allein keinen Fehler beweisen, bleibt richtig, reicht aber für diese nun konkret belegten Fälle nicht als Entwarnung.

Die ausschließlich vorbereitende Datei `tests/fixtures/audit-rewe-kriterien.json` enthält drei Einträge mit vollständigem aktuellem `before`, präzisem `after`, Feld und Katalogschlüssel. Produktion, Punktelogik und Maximalpunkte sind unverändert.

| Aufgabe | Beleg der Fehlgewichtung | Reparatur |
| --- | --- | --- |
| SIM1 2a | Sechs geeignete Beispiele sind gefragt, die Rubrik fixiert sechs bestimmte Beispiele. Eine betriebsfremde Mieteinnahme beantwortet die Ertragskategorie richtig, ist aber kein Ertrag aus Wertpapierverkauf. Wird bei sonst fünf vollständig erfüllten Beispielen deshalb das Wertpapierkriterium nicht erfüllt, ergeben sich `round(5/6*12)=10` statt 12 Punkte. Es geht um fachlich andere Beispiele, nicht Synonyme. | Sechs eigenständige Kategorien bleiben sechs Slots. Die Beispiele werden ausdrücklich als Alternativen genannt und andere fachlich passende Beispiele akzeptiert. Einschränkungen zu neutralem/periodenfremdem Aufwand bleiben enthalten. |
| SIM1 4c | Zwei beschriebene Voraussetzungen sind gefragt. Die Rubrik verteilt dieselben Themen auf sechs Kriterien: getrennte Einzelkostenerfassung/Kostenartenrechnung sowie Kostenstellen/Gemeinkostenverteilung, zusätzlich Bildung unterschiedlicher Sätze und ausdrückliche Benennung aller vier Bereiche. Eine Antwort, die Einzelkostenerfassung nach Kostenarten und verursachungsgerechte Gemeinkostenzuordnung zu Kostenstellen vollständig beschreibt, muss nicht zusätzlich Material/Fertigung/Verwaltung/Vertrieb aufzählen. Selbst bei Anerkennung der ersten fünf Kriterien führt das fehlende letzte Kriterium zu `round(5/6*4)=3` statt 4 Punkten. | Zwei unabhängige beschriebene Voraussetzungen als Slots. Die bloße Umformulierung derselben Voraussetzung zählt nicht nochmals. |
| SIM3 5c | Die vollständige Antwort `Materialeinsatz und Fertigungszeit` erfüllt `zwei Kriterien`, `Materialeinsatz`, `Fertigigungszeit`, aber weder `Prozessschritte` noch `Absatzpreis`. Ergebnis `round(3/5*2)=1` statt der geforderten 2 Punkte. Dieser Fall ist die eindeutige Alternativenfalle. | Genau zwei voneinander unabhängige fachlich geeignete Kriterien. Beispiele innerhalb der Slots mit `oder`, keine zusätzlichen Semikolon-Pflichten. Die Einschränkung des Absatzpreises aus R1 ist integriert. |

Für die übrigen 52 Rubriken wurde kein gleichermaßen eindeutiger Alternativenfehler festgestellt. Insbesondere werden Rechenschritte nicht pauschal entfernt: Ihre eigenständige Bepunktung ist durch Rechenaufgaben und HTML-Zeilen gedeckt. SIM1 2b hat zwar sechs Formulierungen für drei Kostenarten, aber je zwei gleichbedeutende Aussagen pro Kategorie: Bei semantisch korrekter Anerkennung bleibt eine richtige Kategorie `round(2/6*6)=2` Punkte, ebenso wie bei drei Slots `round(1/3*6)=2`. Daraus allein entsteht kein belegbarer Punktefehler, daher kein Fixture-Eintrag.

Die aufgeführten Punktzahlen sind deterministische Folgerechnungen der fachlich beschriebenen Kriterienbelegung, keine Behauptung eines ausgeführten externen KI-Laufs. Die neue Slotrubrik verändert weder die Musterlösungen noch deren Umfang.
