# Fachlicher Zweitreview WQ ohne Rechnungswesen

Stand: 13.09.2026. Lesender Review von `data/pruefungssimulation/katalog.json`; nur diese Reviewdatei wurde geschrieben.

## Prüfumfang

Alle 172 Teilaufgaben der zwölf Einheiten vollständig gelesen: Hauptsituationen, Teilaufgabensituationen, Frage mit Operator und geforderter Anzahl, gesamte Musterlösung einschließlich aller bisherigen Ergänzungen, Stichpunkte, Punkte und vorhandenes Aufgaben-HTML. Die acht nichtleeren HTML-Felder enthalten sieben Tabellen und eine Grafik; Bilddateien sind in diesem Bereich nicht hinterlegt. Vorhandene Richtigstellungen wurden bei der Prüfung berücksichtigt, nicht als neue Befunde wiederholt.

| Simulation | Recht und Steuern | Unternehmensführung | VWL/BWL | Punkte pro Einheit |
| --- | ---: | ---: | ---: | --- |
| 1 | 15 | 13 | 16 | jeweils 100 |
| 2 | 17 | 11 | 14 | jeweils 100 |
| 3 | 19 | 12 | 12 | jeweils 100 |
| 4 | 15 | 11 | 17 | jeweils 100 |

Die Zahlenaufgaben wurden anhand ihrer Ausgangswerte nachgerechnet, insbesondere Umsatzalternativen, Zusatzkosten, Elastizitäten, Vorsteuer/Zahllast, Bewirtung und lineares Marktgleichgewicht. Keine zusätzlichen Rechen- oder Punktesummenfehler festgestellt. Mehr angebotene Lösungsalternativen als verlangt sind kein Fehler. Bereits eindeutig als falsch zurückgenommene Ursprungssätze werden wegen des verlangten Bestandsschutzes nicht erneut als eigenständiger Befund gezählt.

## Neue belegte Befunde

### 1. WQ_RS_SIM_4 / Recht und Steuern / 4 / c – falsches zuständiges Gericht

Frage: sachliche und örtliche Zuständigkeit einer UWG-Klage gegen eine in Essen ansässige AG wegen Werbung in Essen, 6 Punkte. Lösung und letzter Stichpunkt nennen ausdrücklich das Landgericht Essen. Die Lösung berücksichtigt nicht die Zuständigkeitskonzentration in NRW. Für den OLG-Bezirk Hamm einschließlich Essen ist bei neuen UWG-Verfahren das **Landgericht Bochum** zuständig (§ 24 Abs. 1 Nr. 2 JuZuVO NRW). Der Sitzgerichtsstand allein liefert deshalb das falsche Ergebnis.

Minimale Korrektur: Original vollständig erhalten und ausdrücklich ergänzen: „Fachliche Richtigstellung: Für die hier erst erwogene UWG-Klage ist aufgrund der Zuständigkeitskonzentration nach § 24 Abs. 1 Nr. 2 JuZuVO NRW das Landgericht Bochum zuständig. Essen gehört zum OLG-Bezirk Hamm; die ursprüngliche Angabe Landgericht Essen ist daher zu berichtigen.“ Im bestehenden letzten Stichpunkt `Landgericht Essen` durch `Landgericht Bochum; Zuständigkeitskonzentration § 24 Abs. 1 Nr. 2 JuZuVO NRW` ersetzen, technisch jedoch als ein Kriterium ohne zusätzliches Semikolon speichern, falls Kriterienanzahl geschützt ist.

Amtliche Quelle: [JuZuVO NRW, Fassung 01.03.2026, § 24](https://recht.nrw.de/lrgv/rechtsverordnung/01032026-justizzustaendigkeitsverordnung-juzuvo/). § 1 derselben Verordnung ordnet Essen dem OLG-Bezirk Hamm zu. Übergangsregel für bereits anhängige Verfahren greift im geschilderten künftig erwogenen Verfahren nicht.

### 2. WQ_RS_SIM_3 / Recht und Steuern / 5 / b – Sondervorauszahlung fälschlich monatlich

Die Frage fordert unter anderem die Erläuterung der Dauerfristverlängerung, 8 Punkte. Gerade die bisherige Ergänzung lautet: „Die monatliche Sondervorauszahlung beträgt grundsätzlich ein Elftel der Summe der Vorauszahlungen des Vorjahres“. Monatlich werden die Voranmeldungen übermittelt; die Sondervorauszahlung ist für das jeweilige Kalenderjahr zu entrichten. Der Wortlaut kann daher zu einer um den Faktor zwölf überhöhten Belastungsvorstellung führen.

Minimale Korrektur ohne Kürzung: „Richtigstellung zur Zahlungsperiodizität: Die Sondervorauszahlung wird bei monatlicher Voranmeldung grundsätzlich einmal für das Kalenderjahr angemeldet und entrichtet, nicht jeden Monat. Ihre Höhe beträgt grundsätzlich ein Elftel der maßgeblichen Vorjahresvorauszahlungen (§§ 47, 48 UStDV).“ Bestehende Stichpunkte enthalten den Fehler nicht und brauchen keine Änderung.

Amtliche Quellen: [§ 47 UStDV](https://www.gesetze-im-internet.de/ustdv_1980/__47.html), [§ 48 UStDV](https://www.gesetze-im-internet.de/ustdv_1980/__48.html).

### 3. WQ_RS_SIM_2 / Recht und Steuern / 3 / d – Bewertungskriterium widerspricht der präzisierten Lösung

Frage: neuer Entgeltfortzahlungsanspruch bei erneuter Augenentzündung, 3 Punkte. Die vollständige Lösung stellt zutreffend klar, dass sechs Monate ohne **Arbeitsunfähigkeit wegen derselben Krankheit** maßgeblich sind und keine Krankheitsfreiheit verlangt wird. Der Stichpunkt fordert weiter `sechs Monate ohne gleiche Krankheit`. Das ist die gerade zurückgenommene strengere Voraussetzung.

Minimale Korrektur: genau diesen bestehenden Stichpunkt durch `sechs Monate ohne Arbeitsunfähigkeit wegen derselben Krankheit` ersetzen; keine neue Anforderung und keine Lösungsergänzung erforderlich.

Amtliche Quelle: [§ 3 Abs. 1 Satz 2 Nr. 1 EntgFG](https://www.gesetze-im-internet.de/entgfg/__3.html).

### 4. WQ_VWL_SIM_1 / VWL/BWL / 3 / a – ESG wird im Stichpunkt falsch aufgelöst

Die Lösung nennt zutreffend Environment, Social und Governance (Unternehmensführung). Der erste Stichpunkt lautet dagegen `ESG umfasst Umwelt soziale und Unternehmensziele`. Unternehmensziele ist nicht die Bedeutung von Governance; auch E und S können Unternehmensziele sein. Hier werden unterschiedliche Bewertungsmaßstäbe an Lösung und Stichpunkte angelegt.

Minimale Korrektur des vorhandenen Stichpunkts: `ESG umfasst Umwelt, Soziales und Unternehmensführung (Governance)`. Die eigentliche Lösung ist bereits ausreichend und bleibt unverändert. 6 Punkte bleiben unverändert.

### 5. WQ_VWL_SIM_1 / VWL/BWL / 6 / b – Selbstständigkeit der übernehmenden Gesellschaft fehlt

Gefordert ist der Umfang, in dem die **beteiligten Unternehmen** ihre wirtschaftliche und rechtliche Selbstständigkeit aufgeben, 3 Punkte. Die gesamte Lösung behandelt ausschließlich das übernommene Unternehmen; auch die Stichpunkte behandeln nur dieses und die Entscheidungsbefugnis des Mutterunternehmens. Die übernehmende Circle Harbor GmbH wird nicht ausdrücklich eingeordnet.

Minimale Ergänzung: „Die übernehmende Circle Harbor GmbH behält bei der hier beschriebenen Übernahme grundsätzlich ihre eigene rechtliche und wirtschaftliche Selbstständigkeit; sie erlangt den maßgeblichen Einfluss auf das Zielunternehmen. Ein Verlust der Selbstständigkeit auch des Erwerbers ist dem Fall nicht zu entnehmen.“ Den bestehenden Stichpunkt `Mutterunternehmen trifft wesentliche Entscheidungen` um `und bleibt selbst grundsätzlich rechtlich und wirtschaftlich selbstständig` erweitern. Keine zusätzlichen Punkte.

## Grafische Vollständigkeit – zwei weitere betroffene Aufgaben

### 6. WQ_VWL_SIM_1 / VWL/BWL / 1 / a und WQ_VWL_SIM_4 / VWL/BWL / 3 / c

Beide Fragen verlangen ausdrücklich eine Zeichnung, jeweils 6 Punkte. Beide Musterlösungen beschreiben das Diagramm ausschließlich in Worten; die zweite enthält zusätzlich die korrekte Rechnung für 7.000 Stück und 40 €. Die Ergebnisdarstellung in `js/pruefungssimulation.js` gibt `musterloesung` als escaped Text aus, eine separate grafische Musterlösung ist nicht hinterlegt. Der Skizzenbereich ermöglicht die Nutzerzeichnung, liefert aber keine Musterzeichnung. Damit fehlt im Lösungsmaterial die vom Operator verlangte konkrete grafische Ausgabe.

Bei SIM1 liegt zwar HTML mit einer vermeintlichen Musterzeichnung vor, dieses wird für `fragetyp=diagramm` nicht als Musterlösung ausgegeben. Zudem ist dessen roter Gleichgewichtspunkt rechnerisch falsch platziert: Mittelpunkt ungefähr (226,166), Schnittpunkt der Linien ungefähr (197,191). Die Linien starten bei (40,300) bzw. (40,80) mit ±35°; der Schnitt liegt bei x = 40 + 110/tan(35°), y = 190 (jeweils bis auf die Linienbreite). Auch Projektionen bzw. Bezeichnungen für Gleichgewichtspreis und -menge fehlen.

Minimaler Ergänzungsvorschlag: für beide Aufgaben eine separate korrekt beschriftete Musterzeichnung **zusätzlich** zum gesamten bestehenden Text bereitstellen. SIM1 zeigt A, N, Schnittpunkt sowie p* und q*; SIM4 zeigt die vorgegebenen Punkte, A/N, Achsen und den Schnittpunkt (7.000;40 €). Bestehende Tabellen/HTML nicht ungefragt ersetzen. Falls Änderungen an der Darstellung ausgeschlossen sind, diese Grenze offen dokumentieren; eine weitere rein sprachliche Wiederholung erfüllt den grafischen Operator nicht besser.

## Grenzen und Nichtbefunde

- Der Review betrifft den aktuellen lokalen Katalog, keine externen Originalprüfungen und keine Vollständigkeit gegenüber einem unbekannten IHK-Erwartungshorizont.
- Die tatsächliche KI-Punktevergabe wurde nicht ausgeführt. Es wurden fachliche Widersprüche zwischen übermitteltem Lösungstext und Stichpunkten geprüft; die Wirkung einzelner Stichpunkte auf eine konkrete KI-Bewertung bleibt empirisch offen.
- Die Bewertungssummen sind vollständig geprüft; eine amtlich verbindliche Unterverteilung einzelner Punkte ist mangels Erwartungshorizont nicht belegbar.
- Rechtliche neue Befunde wurden mit amtlichen aktuellen Quellen verifiziert. Nicht jede unveränderte allgemeine Rechtsaussage wurde separat neu recherchiert.
- WQ_VWL_SIM_3 / 5 / a beschreibt historische Pandemieziele allgemein. Eine natürliche Person als persönlich haftender OHG-Gesellschafter würde gegen eine Antragspflicht nach § 15a InsO sprechen; die Gesellschafterstruktur ist aber nicht angegeben und die Frage fordert keine Prüfung der konkreten Antragspflicht. Deshalb kein gesicherter neuer Fehler, sondern Grenze des Falls. Quelle: [§ 15a InsO](https://www.gesetze-im-internet.de/inso/__15a.html).
- Die vorhandenen Korrekturen etwa zu § 113 BGB, § 18 HGB, § 5b UWG, § 224 UmwG, § 4 MuSchG, Eigen-/Fremdfinanzierung, SWOT und mehrdimensionaler Führung wurden vollständig mitgelesen und nicht pauschal erneut beanstandet.

Ergebnis: fünf gezielte fachliche bzw. Frage-Lösung-Kriterien-Befunde und eine grafische Vollständigkeitslücke über zwei weitere Aufgaben; insgesamt sieben betroffene Schlüssel. Keine Katalogänderungen durch diesen Reviewer.


## Nachprüfung der gleichgewichteten Alternativenkriterien

Alle 172 Aufgaben erneut gegen die tatsächliche Semikolon-Skalierung geprüft. 57 belegte Reparaturen stehen in `tests/fixtures/audit-wq-kriterien.json`, ausschließlich Feld `stichpunkte`. Jeder Before-Wert ist der vollständige gelesene Katalogwert. Die Ersatzkriterien bilden eigenständige verlangte Antwortbestandteile; Maximalpunkte und Lösungen werden nicht geändert.

Die nachfolgenden Rechenbelege sind konservative Obergrenzen: Selbst wenn ALLE anderen alten Kriterien anerkannt werden, führen die genannten sicher nicht erforderlichen Alternativen zu Punktabzug. Es wird keine reale KI-Entscheidung behauptet. Formeln: Math.round(erfüllt / Alt-Kriterienanzahl × Maximalpunkte). Ein Beispiel ist jeweils eine inhaltlich vollständige zulässige Antwort in Kurzbeschreibung, kein wörtlicher Volltext. Die gesamte Musterlösung mit allen Alternativen zu kopieren umgeht teilweise die Kriterienprüfung durch den Exact-Match-Shortcut, repariert aber die Benachteiligung aufgabengerechter kürzerer Antworten nicht.

| Schlüssel | Aufgabengerechte Auswahl / Belegantwort | Nicht zusätzlich geforderte Alt-Kriterien | Konservative alte Obergrenze |
| --- | --- | --- | --- |
| WQ_RS_SIM_1\|Recht und Steuern\|6\|c | Geschenke an Nichtarbeitnehmer mit §4 Abs.5 Nr.1 EStG und geschäftliche Bewirtung mit §4 Abs.5 Nr.2 EStG, ohne Geldbußen/Ordnungsgelder. | Geldbußen / Ordnungsgelder / nicht abziehbar / § 4 Absatz 5 Nummer 8 EStG | höchstens 6/10 → 4/6 |
| WQ_UF_SIM_1\|Unternehmensführung\|3\|a | Flexible Zeit erhöht Zufriedenheit, freie Tage stärken Bindung, Fortbildung sichert qualifizierte Fachkräfte, Gesundheit reduziert Fehlzeiten, Lob steigert Motivation. Weitere Vorteile je Anreiz sind nicht gefordert. | Produktivität verbessern / Fluktuation reduzieren / Arbeitgeberimage verbessern / Zusammenarbeit verbessern | höchstens 13/17 → 11/15 |
| WQ_UF_SIM_1\|Unternehmensführung\|4\|a | Flexible Zeit durch Gleitzeit, leistungsorientierte Vergütung durch Bonus, Entwicklung durch Weiterbildung, Zusatzleistung durch Fahrtkostenzuschuss. Kein Homeoffice, keine Zuschläge oder Gesundheitsangebote erforderlich. | Homeoffice / Zuschläge / Gesundheitsangebote | höchstens 10/13 → 8/10 |
| WQ_UF_SIM_1\|Unternehmensführung\|4\|b | Headhunter und Stellenanzeige in einem Fachportal erläutern, für schwer zu besetzende Leitung Headhunter mit gezielter Suche begründet wählen; keine Pflicht zu Social-Media-Suche. | soziale Netzwerke / Karriereplattformen / schnelle Personalsuche / kostengünstige Methode / Qualifikationen einsehbar | höchstens 7/12 → 5/8 |
| WQ_UF_SIM_1\|Unternehmensführung\|4\|c | Vorübergehende Versetzung passend qualifizierter Kräfte aus einem ausreichend besetzten Bereich vermeidet Rekrutierung und nutzt eingearbeitetes Personal, Zeitarbeit bietet geringen Rekrutierungsaufwand und schnelle Verfügbarkeit; keine Überstunden nötig. | Überstunden | höchstens 9/10 → 7/8 |
| WQ_UF_SIM_1\|Unternehmensführung\|5\|a | Feedback, Zielrelevanz, Zeitaufwand, Qualität/Aktualität und Gesamtkosten nennen; Aufschlüsselung in Trainer, Unterlagen und Ausfallzeiten ist nicht verlangt. | Trainerkosten / Schulungsunterlagen / Arbeitsausfallzeiten | höchstens 7/10 → 4/5 |
| WQ_VWL_SIM_1\|VWL/BWL\|1\|b | Rohstoffkosten, Energiepreise und Lieferengpässe, jeweils ungünstig; Lohnkosten und Kapazitätsausfälle sind weitere Alternativen. | steigende Lohnkosten verteuern Produktion / Kapazitätsausfälle verringern Angebot | höchstens 4/6 → 4/6 |
| WQ_VWL_SIM_1\|VWL/BWL\|1\|c | Einkommen, Förderung, Umweltbewusstsein jeweils günstig; keine Werbung oder Kraftstoffpreise nötig. | Werbung steigert Nachfrage / steigende Kraftstoffpreise fördern alternative Mobilität | höchstens 4/6 → 4/6 |
| WQ_VWL_SIM_1\|VWL/BWL\|2\|a | Versorgungssicherheit/Planbarkeit als Vorteil; Abhängigkeit und verpasste Technik anderer Anbieter bei erschwertem Wechsel als zwei Nachteile. Keine besseren Preise oder späteren Preissteigerungen notwendig. | große Bestellmengen verbessern Einkaufskonditionen / spätere Preissteigerungen möglich | höchstens 4/6 → 4/6 |
| WQ_VWL_SIM_1\|VWL/BWL\|3\|b | Sichere Radwege, günstiger ÖPNV und erhöhte Parkgebühren mit Wirkung beschreiben; keine Innenstadt-Sperre nötig. | Innenstädte können für Autoverkehr eingeschränkt werden | höchstens 4/5 → 5/6 |
| WQ_VWL_SIM_1\|VWL/BWL\|3\|c | Werbekampagne für flexible Mobilität und Firmenkooperation zur Erschließung neuer Kundengruppen erläutern; weder ÖPNV-Kooperation noch Leasing erforderlich. | Kooperation mit ÖPNV erweitert Nutzungsmöglichkeiten / Leasingangebote senken Einstiegskosten | höchstens 3/5 → 4/6 |
| WQ_VWL_SIM_1\|VWL/BWL\|4\|a | Renteneintritte, schwächere Nachwuchsjahrgänge, längere Ausbildung und Vorruhestand erläutern; kein zusätzlicher Fachkräfte-/Technikaspekt verlangt. | Fachkräftemangel erschwert Stellenbesetzung / technologischer Wandel erhöht Qualifikationsbedarf | höchstens 4/6 → 5/8 |
| WQ_VWL_SIM_1\|VWL/BWL\|5\|a | Mindestkapital, Organe, Anteilsübertragung und Publizität vergleichen; Kapitalmarktfinanzierung ist fünfte Alternative. | Kapitalmarktfinanzierung | höchstens 5/6 → 10/12 |
| WQ_VWL_SIM_1\|VWL/BWL\|5\|b | Notariell beurkundete Übertragung bestehender GmbH-Anteile und Erwerb bestehender Börsenaktien erläutern; keine zusätzliche Kapitalerhöhung nötig. | Kapitalerhöhung ermöglicht neues Eigenkapital / Ausgabe neuer Aktien gewinnt Investoren | höchstens 3/5 → 4/6 |
| WQ_VWL_SIM_1\|VWL/BWL\|6\|c | Marktanteil und gemeinsame Kostenvorteile dafür; finanzielle Last und kulturelle Integration dagegen. Vier weitere Alternativen sind nicht verlangt. | neue Märkte können erschlossen werden / Know-how des übernommenen Unternehmens kann genutzt werden / Synergieeffekte können ausbleiben / Auslandsübernahmen bergen zusätzliche Risiken | höchstens 4/8 → 4/8 |
| WQ_RS_SIM_2\|Recht und Steuern\|4\|b | Beseitigung und Unterlassung nach §8 UWG mit Wiederholungsgefahr beschreiben; §9-Schadensersatz ist nicht zusätzlich verlangt. | Schadensersatz §9 Abs.1 UWG | höchstens 4/5 → 5/6 |
| WQ_RS_SIM_2\|Recht und Steuern\|6\|c | Baugenehmigungsgebühr und Berufsgenossenschaftsbeitrag als betriebliche Abgaben nennen; konkrete Musterbeispiele sind keine Pflicht. | z.B. Müllgebühr/Parkgebühr / IHK-Beitrag/Rundfunkbeitrag | höchstens 2/4 → 1/2 |
| WQ_UF_SIM_2\|Unternehmensführung\|1\|a | Schriftliche, persönliche und Online-Befragung jeweils mit Vorteil/Nachteil; keine vierte telefonische Form. | telefonisch | höchstens 6/7 → 13/15 |
| WQ_UF_SIM_2\|Unternehmensführung\|2\|a | Management-, System-, Umwelt- und Compliance-Audit je mit zwei Instrumenten; Prozess- und Produktaudit sind Alternativen. | Prozessaudit / Produktaudit | höchstens 6/8 → 12/16 |
| WQ_UF_SIM_2\|Unternehmensführung\|3\|a | Bestand, quantitativer Bedarf, qualitativer Bedarf und Beschaffung jeweils mit Handlung/Beispiel; keine zusätzlichen Kosten- und Nachfolgeplanungsbereiche. | Personalkosten / Nachfolge/Übergabe | höchstens 6/8 → 9/12 |
| WQ_UF_SIM_2\|Unternehmensführung\|4\|a | Fach-, Sozial- und Führungskompetenz beschreiben; Aufgaben und persönliche Kompetenz sind zusätzliche Optionen. | Aufgaben der Stelle / persönliche Kompetenz | höchstens 4/6 → 4/6 |
| WQ_UF_SIM_2\|Unternehmensführung\|4\|b | Team informieren, Arbeitsplatz vorbereiten, Begrüßung, Kollegen vorstellen, Rundgang und Formalitäten; drei zusätzliche Checklisteneinträge sind nicht gefordert. | Arbeitsschutz / Einweisung / Pate | höchstens 7/10 → 4/6 |
| WQ_UF_SIM_2\|Unternehmensführung\|5\|a | Wissensverlust, schwer ersetzbare Stellen und höhere Personalkosten erläutern; Ausbildungsplätze und Produktionsengpässe sind weitere Folgen. | Ausbildungsplätze unbesetzt / Produktionsengpässe | höchstens 4/6 → 6/9 |
| WQ_UF_SIM_2\|Unternehmensführung\|5\|b | Wissenstransfer, Schulkooperation und Qualifizierung beschreiben; keine weiteren drei Alternativen nötig. | altersgemischte Teams / ältere Mitarbeiter binden / regionale/internationale Rekrutierung | höchstens 4/7 → 3/6 |
| WQ_UF_SIM_2\|Unternehmensführung\|6\|a | Wettbewerbsfähigkeit, Fachkräftesicherung, Bindung, Unabhängigkeit vom Arbeitsmarkt und Demografie erläutern; drei weitere Ziele nicht nötig. | Zufriedenheit / Arbeitgeberattraktivität / neue Anforderungen | höchstens 6/9 → 7/10 |
| WQ_UF_SIM_2\|Unternehmensführung\|6\|b | Aufstiegs-, Anpassungs- und Erweiterungsfortbildung beschreiben; Erhaltungsfortbildung ist vierte Alternative. | Erhaltungsfortbildung | höchstens 4/5 → 5/6 |
| WQ_VWL_SIM_2\|VWL/BWL\|2\|a | Staatliche Nachfragestabilisierung, Fiskalpolitik, Antizyklik, kurzfristige Wirkung und Konsum-/Investitionsansatz beschreiben; Deficit Spending ist zusätzliche Option. | Deficit Spending | höchstens 5/6 → 8/10 |
| WQ_VWL_SIM_2\|VWL/BWL\|5\|b | Kosten, Liquidität, Verschuldungsgrad und Sicherheiten nennen; vier weitere Kriterien nicht gefordert. | Laufzeit / Zins-/Rückzahlungsbedingungen / Abhängigkeit / Aufwand | höchstens 4/8 → 2/4 |
| WQ_VWL_SIM_2\|VWL/BWL\|6\|a | GmbH und AG mit Gesellschaftsvermögenshaftung und grundsätzlich fehlender persönlicher Gesellschafterhaftung begründen; Organhaftung ist keine dritte Pflicht. | Organhaftung bei Pflichtverletzung bleibt | höchstens 5/6 → 7/8 |
| WQ_VWL_SIM_2\|VWL/BWL\|6\|b | Beschluss, notarielle Form, Mindestkapital, Organe und Register nennen; spätere Unterlagenanpassung ist nicht sechster Pflichtschritt. | Geschäftsunterlagen anpassen | höchstens 5/6 → 4/5 |
| WQ_VWL_SIM_2\|VWL/BWL\|6\|c | Lieferanten verlangen zusätzliche Sicherheiten wegen Wegfalls persönlicher Haftungsbasis; eine Konsequenz reicht. | kürzeres Zahlungsziel / Vorkasse / geringere Kreditlinie / Nachhaftung Altverbindlichkeiten / § 224 UmwG | höchstens 1/6 → 0/2 |
| WQ_UF_SIM_3\|Unternehmensführung\|1\|a | Informationsmangel, autoritäre Führung, fehlende Wertschätzung, schlechte Kommunikation und Work-Life-Balance erläutern; keine zusätzliche Zukunftsperspektive oder Konflikte nötig. | Zukunftsperspektive / Betriebsklima | höchstens 6/8 → 8/10 |
| WQ_UF_SIM_3\|Unternehmensführung\|1\|b | Steigende Fehlzeiten, Rückzug und sinkende Produktivität nennen; Dienst nach Vorschrift ist nicht vierte Pflicht. | Dienst nach Vorschrift | höchstens 4/5 → 2/3 |
| WQ_UF_SIM_3\|Unternehmensführung\|1\|c | Beteiligung/Identifikation, Teamarbeit und Motivation/bessere Entscheidungen beschreiben; Feedback und Fluktuation sind weitere Alternativen. | Feedback / Fluktuation | höchstens 6/8 → 5/6 |
| WQ_UF_SIM_3\|Unternehmensführung\|2\|a | Verbände, Destatis, IHK, Wirtschaftsförderung und Hochschulen nennen; Beratung und Konsumforschung nicht zusätzlich nötig. | Beratung / Konsumforschung | höchstens 6/8 → 4/5 |
| WQ_UF_SIM_3\|Unternehmensführung\|3\|a | Qualitäts-, Umwelt- und Arbeitsschutzmanagement erläutern; Energiemanagement ist vierte Alternative. | Energiemanagement | höchstens 4/5 → 7/9 |
| WQ_UF_SIM_3\|Unternehmensführung\|3\|b | Qualitäts-, Umwelt- und Arbeitsschutzstrategie mit Prozessanalyse, Zielen, Audit/KVP; ISO50001 gehört nicht zum gewählten Arbeitsschutzsystem. | ISO 50001 | höchstens 6/7 → 10/12 |
| WQ_UF_SIM_3\|Unternehmensführung\|4\|a | Weiterbildung, Laufbahn, flexible Arbeit, Vergütung und wertschätzende Führung erläutern; kein sechstes Leitbild erforderlich. | Leitbild | höchstens 6/7 → 13/15 |
| WQ_UF_SIM_3\|Unternehmensführung\|4\|b | Wissenstransfer, digitale Arbeit, Gesundheitsförderung, Ergonomie und neue Zielgruppen beschreiben; Qualifizierung und Ausbildung weitere Alternativen. | Qualifizierung / Ausbildung | höchstens 6/8 → 8/10 |
| WQ_UF_SIM_3\|Unternehmensführung\|5\|b | Fachliche Fähigkeiten und Entwicklungsbereitschaft erläutern; nicht zusätzlich Prozesskenntnisse und Eigenverantwortung verlangen. | Prozesskenntnisse / Eigenverantwortung | höchstens 3/5 → 4/6 |
| WQ_VWL_SIM_3\|VWL/BWL\|1\|c | 66 Euro beibehalten und bei Nachfragenormalisierung 60 Euro, jeweils begründet; 67,32 und 72,60 Euro sind weitere Optionen. | 67,32 € / 72,60 € | höchstens 4/6 → 4/6 |
| WQ_VWL_SIM_3\|VWL/BWL\|2\|b | Qualifizierung für Onlineverkauf und freiwillige Teilzeit erklären; kein zusätzlicher Personalabbau nötig. | sozialverträglicher Personalabbau | höchstens 3/4 → 5/6 |
| WQ_VWL_SIM_3\|VWL/BWL\|5\|b | Kreditlinie, verlängerte Lieferantenziele, Stundung und Vermögensverkauf beschreiben; Kostensenkung ist fünfte Alternative. | Kosten senken | höchstens 5/6 → 10/12 |
| WQ_UF_SIM_4\|Unternehmensführung\|1\|a | Destatis, Branchenverband und Marktforschungsinstitut mit Aktualität/Marktnähe begründen; Beratung und Wirtschaftsförderung nicht zusätzlich nötig. | Unternehmensberatung / Wirtschaftsförderung | höchstens 5/7 → 4/5 |
| WQ_UF_SIM_4\|Unternehmensführung\|2\|a | Orientierung, Integration und Entscheidungsrahmen fallbezogen erläutern; Koordinierungsfunktion vierte Alternative. | Koordinierungsfunktion | höchstens 5/6 → 8/9 |
| WQ_UF_SIM_4\|Unternehmensführung\|2\|b | Die drei Musterleitsätze zu Verantwortung, nachhaltigen wirtschaftlichen Mobilitätslösungen und fairen Kunden-/Lieferantenbeziehungen wählen; der Mitarbeiterleitsatz ist vierte Alternative. | Mitarbeitende | höchstens 5/6 → 5/6 |
| WQ_UF_SIM_4\|Unternehmensführung\|2\|c | Wiedererkennung/Markenwirkung, einheitlicher Auftritt und Positionierung/Abhebung erläutern; Kunden- und Mitarbeiterbindung weitere Ziele. | Kundenbindung / Mitarbeiterbindung | höchstens 6/8 → 7/9 |
| WQ_UF_SIM_4\|Unternehmensführung\|4\| | Urlaub, Zeitguthaben, Weiterbildung, Befristungen und Leiharbeit sachgerecht bewerten; zusätzliche Arbeitszeitreduzierung ist sechste Alternative. | Arbeitszeitreduzierung | höchstens 6/7 → 17/20 |
| WQ_UF_SIM_4\|Unternehmensführung\|5\|a | Interne Besetzung, Überhänge ausgleichen und Kurzarbeit vermeiden für Unternehmen; Arbeitsplatz, Karriere und Motivation für Beschäftigte. Arbeitgeberattraktivität ist vierte Unternehmensoption. | Arbeitgeberattraktivität | höchstens 8/9 → 11/12 |
| WQ_UF_SIM_4\|Unternehmensführung\|5\|b | Lehrgang und Coaching sowie Laufbahn- und Nachfolgeplanung beschreiben; Jobrotation, Trainee und Ausland sind weitere Alternativen. | Training-on-the-job/Job-Rotation / Traineeprogramm / Standort-/Auslandseinsatz | höchstens 6/9 → 5/8 |
| WQ_VWL_SIM_4\|VWL/BWL\|1\|c | Nachholeffekte, Lieferketten und Energiepreisschock durch Ukrainekrieg erläutern; Geldpolitik weitere Alternative. | expansive Geldpolitik | höchstens 5/6 → 5/6 |
| WQ_VWL_SIM_4\|VWL/BWL\|2\|a | Kundennähe/Marktzugang und Euro sowie Steuerverwaltung und Arbeitsrecht beschreiben; Binnenmarkt/Zollfreiheit weitere Chancen. | EU-Binnenmarkt / keine Zölle | höchstens 6/8 → 6/8 |
| WQ_VWL_SIM_4\|VWL/BWL\|2\|b | Abweichende nationale Rechtsregeln, Bewilligungspflichten und Franken-Währungsrisiko erläutern; Zollabwicklung weitere Alternative. | Zoll | höchstens 4/5 → 5/6 |
| WQ_VWL_SIM_4\|VWL/BWL\|4\|a | Demografie, Arbeitsvolumen und weniger dualer Ausbildungsnachwuchs erläutern; internationaler Wettbewerb vierte Alternative. | internationaler Wettbewerb | höchstens 4/5 → 5/6 |
| WQ_VWL_SIM_4\|VWL/BWL\|4\|b | Employer Branding, flexible Arbeit und ältere Beschäftigte binden mit jeweils eigenständiger Wirkung erläutern; Ausbildung und Auslandsgewinnung weitere Optionen. | Ausbildung/Weiterbildung / Auslandsrekrutierung | höchstens 4/6 → 6/9 |
| WQ_VWL_SIM_4\|VWL/BWL\|6\|a | Marktzugang, Ressourcenbündelung, Portfolioerweiterung und Risikoteilung erläutern; Effizienz, Innovation und Kosten nicht zusätzlich nötig. | Synergien / Innovation / Kosten | höchstens 5/8 → 5/8 |
| WQ_VWL_SIM_4\|VWL/BWL\|6\|b | Kommunikationsfehler und Interessenkonflikte beschreiben; Abhängigkeit und Komplexität weitere Alternativen. | Abhängigkeit / Komplexität | höchstens 3/5 → 2/4 |

Nicht pauschal verändert wurden feste Rechenschritte, geschlossene Zuordnungen, zwingende Definitionsteile oder allein vermutete Fehlgewichtungen. Die gruppierten Pflichtfelder bei EU-Grundfreiheiten sind keine Alternativenlisten. Keine Produktionsdatei geändert.

### Weitere eindeutig ungleich skalierte Gruppierungen

- **WQ_UF_SIM_1|Unternehmensführung|2|d**: Nur Arbeitsschutzmanagement/Sicherheit und Gesundheit bei der Arbeit erfüllt zwei synonyme von vier Alt-Kriterien: Math.round(2/4×3)=2 Punkte. Es ist aber nur eines von drei verlangten Systemen: neue unabhängige Slots ergeben Math.round(1/3×3)=1.
- **WQ_UF_SIM_3|Unternehmensführung|2|c**: Je nur ein zutreffender Aspekt pro SWOT-Feld (Kundenbindung, Modellpalette, neue Zielgruppe, Nachfragerückgang) erfüllt die vier Kategorienkriterien, aber nicht je zwei: Math.round(4/5×8)=6 statt vier von acht Slots =4.
- **WQ_UF_SIM_3|Unternehmensführung|5|a**: Nur die fünf verlangten Unternehmensvorteile vollständig genannt, keine Mitarbeitervorteile: allein das Unternehmens-Gruppenkriterium ist erfüllt, je fünf und Mitarbeitende nicht. Math.round(1/3×10)=3 statt fünf von zehn Vorteilen =5.

Finale Fixture: **60 Reparaturen bei 172 geprüften Aufgaben**, 57 Alternativen-/Zusatzpflichtfehler und drei konkrete Gruppierungs-/Doppelgewichtungsfehler.

Die 60 Fixture-Einträge enthalten zusätzlich `evidence` mit konkreter Beispielantwort, konservativer Alt-Trefferzahl `oldMatched`, daraus berechnetem `oldPoints` und fachlich erwartetem `expectedPoints`. Bei 57 vollständigen Antworten entspricht der Erwartungswert dem unveränderten Maximum; drei ausdrücklich unvollständige Antworten belegen fehlerhafte Teilpunktgewichtung. Die Zahlen sind deterministische Skalierungszeugen, keine vorgetäuschten Live-KI-Ergebnisse. Alle 60 Rechenwerte wurden erneut geprüft.
