# Pilot-Migrationsplan Recht und Steuern – Revision 2

**WIFA-TR-WQ3-20260927-v2 · Freigabeentwurf · ausschließlich Planung, nicht ausgeführt**

Diese Revision ersetzt die Gleichsetzung von interner Detailgruppe und sichtbarem Trainer-Thema aus v1. Vorgesehen sind **10 sichtbare Oberthemen: 7 in Recht und 3 in Steuern**. Die bisherigen **35 Detailgruppen**, ihre 800 Einzel-ID-Zuordnungen, Rahmenplanbezüge, Querverweise und interne Reihenfolge bleiben erhalten. Es entstehen keine neuen Frage-IDs. Die 46 Quellthema-Detailgruppen-Teilzuordnungen sind ebenfalls erhalten; 35 bezeichnet die Anzahl ihrer unterschiedlichen Zielgruppen, nicht die Anzahl sichtbarer Themen.

Die Revision verändert ausschließlich Planungsdateien. Quellsheet, Anwendungscode, IDs, Aktivstatus und Inhalte bleiben unverändert. V1-Dateien bleiben als Vorgänger erhalten und sind nicht zur Umsetzung der Benutzeroberfläche freigegeben.

## 1. Mehrstufiges Modell

Die fachliche Beziehung lautet:

**Fach → sichtbares Trainer-Oberthema → interner Rahmenplanpunkt / Detailgruppe → Trainer-ID**

Die Oberfläche zeigt nur Fach und Oberthema. Die mittlere Detailstufe ist eine interne Zuordnung, kein zusätzlicher Pflichtdialog, kein automatisch aufgeklapptes Untermenü und kein eigenständiger Startknopf. Öffentlich sichtbare Rahmenplan-Detailtexte werden nicht aus dem Referenzdokument übernommen.

| Ebene | Funktion | Beispiel |
| --- | --- | --- |
| Fach | Fachliche Obergruppe WQ Recht und Steuern; technische Quellfächer Recht und Steuern bleiben getrennt | Steuern |
| UI-Oberthema | Stabile, grobe Auswahl für Lernen, Navigation und Resume | Unternehmensbezogene Steuern |
| Interne Detailgruppe | Erhält die 35 vorhandenen fachlichen Teilungen; verweist auf genau ein UI-Oberthema | S05 / tr-wq-s05, Körperschaftsteuer |
| Rahmenplanpunkt | Interner Referenzkatalog einschließlich aller Unter- und Detailpunkte | 3.2.2.2 |
| Trainer-ID | Unveränderte Frage; genau eine primäre Detailgruppe und damit ein UI-Pool | ST-0013 |

Detailgruppen und Rahmenplanpunkte sind nicht dasselbe: Mehrere Detailgruppen können demselben Rahmenplanpunkt zugeordnet sein; eine Frage kann zusätzliche fachliche Bezüge haben. **Eine ID gehört genau einem sichtbaren Oberthema an, darf aber mehrere interne Rahmenplanbezüge besitzen.** Querverweise erzeugen weder eine zweite Frage noch einen weiteren UI-Pool-Eintrag.

Die Fachbezeichnungen Recht und Steuern bleiben technische Parameter für Autorisierung, Fragenzugriff, Statistik und historische Schlüssel. Die Fachgruppe „WQ Recht und Steuern“ darf sie in der Anzeige zusammenfassen, ersetzt aber nicht ungeprüft die bestehende globale Fachliste. HQ bleibt vollständig außerhalb dieses Piloten.

## 2. Vorgesehene sichtbare Trainer-Oberthemen

Die folgenden ID-Zahlen zählen eindeutige aktive Fragen, keine Rahmenplan-Verknüpfungen und keine Abdeckungsgrade.

| Fach | Sichtbares Trainer-Oberthema | Interner Rahmenplanbereich | Detailgruppen | IDs | Abgrenzung |
| --- | --- | --- | --- | --- | --- |
| Recht | BGB Allgemeiner Teil | 3.1.1 und sämtliche Unterpunkte | R01, R22 | 85 | R22: Methoden aus 3.1 als Einstieg, keine Umdeutung zu 3.1.1. |
| Recht | BGB Schuldrecht | 3.1.2 und sämtliche Unterpunkte | R02, R03, R04, R05, R06, R07 | 174 | 3.1.2.1–3.1.2.5 einschließlich Detailpunkten. |
| Recht | BGB Sachenrecht | 3.1.3 und sämtliche Unterpunkte | R08, R09, R10 | 84 | Besitz/Eigentum, Sicherheiten und Insolvenz intern getrennt. |
| Recht | Handelsrecht | 3.1.4 und sämtliche Unterpunkte | R11, R12, R13, R14, R15 | 75 | 3.1.4.1–3.1.4.3; Vollmachten und Handelsgeschäfte als interne Ergänzungen. |
| Recht | Arbeitsrecht | 3.1.5 und sämtliche Unterpunkte | R16, R17, R18, R19 | 116 | 3.1.5.1–3.1.5.3; Tarifrecht als interne Ergänzung. |
| Recht | Wettbewerbsrecht | 3.1.6 und sämtliche Unterpunkte | R20 | 17 | Alle Detailpunkte des Bereichs bleiben intern. |
| Recht | Gewerberecht | 3.1.7 und sämtliche Unterpunkte | R21 | 16 | Alle Detailpunkte des Bereichs bleiben intern. |
| Steuern | Grundbegriffe des Steuerrechts | 3.2.1 und sämtliche Unterpunkte | S01 | 12 | Systematik und steuerliche Grundbegriffe. |
| Steuern | Unternehmensbezogene Steuern | 3.2.2 und sämtliche Unterpunkte | S02, S03, S04, S05, S06, S07, S08, S09, S10, S11, S12 | 205 | 3.2.2.1–3.2.2.8: ESt, KSt, GewSt, KapESt, USt, GrundSt, GrESt, Erb-/SchenkSt. |
| Steuern | Abgabenordnung | 3.2.3 und sämtliche Unterpunkte | S13 | 16 | Besteuerungsverfahren und zugeordnete AO-Fragen. |

**Bilanz: Recht 567 + Steuern 233 = 800 Pilot-IDs. Dazu 1.886 außerhalb des Piloten unverändert = 2.686 aktive IDs.** Keine ID wird zwischen WQ und HQ verschoben. Zusätzlich bleiben die sieben inaktiven R-Vorläufer und 110 leeren R-Platzhalter unverändert außerhalb der aktiven Bilanz.

### Fachliche Abgrenzungen

- **BGB Allgemeiner Teil:** R01 mit 84 IDs plus R22 mit R-0566 als eine Methodenfrage ergeben 85 sichtbare Fragen. Die Methode bleibt fachlich unter 3.1 mit dem vorhandenen Anwendungsbezug 3.1.2.5. Ihre UI-Einordnung liefert **keinen zusätzlichen Abdeckungsbeleg für 3.1.1**.
- **BGB Schuldrecht:** 3.1.2.1 Grundlagen, 3.1.2.2 Produkthaftung, 3.1.2.3 Kaufvertrag, 3.1.2.4 weitere Vertragstypen und 3.1.2.5 Leistungsstörungen. Onlineverträge/Widerruf bleiben interne Vertiefung gemäß v1. Die 174 IDs werden gemeinsam gestartet.
- **BGB Sachenrecht:** 3.1.3.1 Besitz/Eigentum, 3.1.3.2 Sicherheiten und 3.1.3.3 Insolvenz bleiben getrennte interne Bezüge, werden aber als ein Thema angeboten.
- **Handelsrecht:** 3.1.4.1–3.1.4.3 und die internen Ergänzungen Vollmachten und Handelsgeschäfte. R-0576 bleibt hier; ein HQ-Logistikbezug ist nur Querverweis.
- **Arbeitsrecht:** 3.1.5.1 Individualarbeitsrecht, 3.1.5.2 Betriebsverfassung, 3.1.5.3 Schutzrecht sowie Tarifrecht als interne Ergänzung. R-0578 bleibt in der Tarifgruppe, ohne eigenen UI-Eintrag.
- **Unternehmensbezogene Steuern:** 3.2.2.1 Einkommensteuer, .2 Körperschaftsteuer, .3 Gewerbesteuer, .4 Kapitalertragsteuer, .5 Umsatzsteuer, .6 Grundsteuer, .7 Grunderwerbsteuer und .8 Erbschaft-/Schenkungsteuer. ESt- und USt-Vertiefungen bleiben ausschließlich intern. Der Oberbegriff ist eine Navigationsgruppe, keine Aussage, dass jede enthaltene Steuer ausschließlich Unternehmen betrifft.

## 3. Erhaltung der 35 internen Detailgruppen

Die bisherigen Keys tr-wq-r01 bis tr-wq-r22 sowie tr-wq-s01 bis tr-wq-s13 werden **nicht neu vergeben**. Ihre Rolle wird eindeutig als DetailKey bezeichnet. Neue UI-Keys beginnen dagegen mit ui-wq-. Sichtbarkeit ist eine Eigenschaft des UI-Katalogs; Detailgruppen werden nicht als Auswahloptionen veröffentlicht.

| Detailkey | Sichtbares Oberthema | Interner WQ-Code | Interne Detailbezeichnung | IDs |
| --- | --- | --- | --- | --- |
| R01 | BGB Allgemeiner Teil | 3.1.1 | BGB: Personen, Rechtsgeschäfte und Vertretung | 84 |
| R02 | BGB Schuldrecht | 3.1.2.1 | Schuldverhältnisse, AGB, Fristen und Gerichte | 31 |
| R03 | BGB Schuldrecht | 3.1.2.2 | Haftung für fehlerhafte Produkte | 3 |
| R04 | BGB Schuldrecht | 3.1.2.3 | Warenkauf und Rechte bei Mängeln | 54 |
| R05 | BGB Schuldrecht | 3.1.2.4 | Miete, Darlehen, Dienstleistung, Werk und Leasing | 33 |
| R06 | BGB Schuldrecht | 3.1.2.5 | Onlineverträge und Widerruf | 6 |
| R07 | BGB Schuldrecht | 3.1.2.5 | Leistung, Verzug und Schadensersatz | 47 |
| R08 | BGB Sachenrecht | 3.1.3.1 | Besitz und Eigentumsübertragung | 25 |
| R09 | BGB Sachenrecht | 3.1.3.2 | Sicherheiten für Forderungen | 40 |
| R10 | BGB Sachenrecht | 3.1.3.3 | Insolvenz und Gläubigerrechte | 19 |
| R11 | Handelsrecht | 3.1.4.1 | Kaufleute und Firma | 23 |
| R12 | Handelsrecht | 3.1.4.2 | Register und Publizität | 17 |
| R13 | Handelsrecht | 3.1.4.3 | Handelsvertreter, Makler und Absatzpartner | 13 |
| R14 | Handelsrecht | 3.1.4 | Prokura und kaufmännische Vollmachten | 13 |
| R15 | Handelsrecht | 3.1.4 | Handelsgeschäfte und Lieferklauseln | 9 |
| R16 | Arbeitsrecht | 3.1.5.1 | Arbeitsvertrag, Entgelt & Kündigung | 79 |
| R17 | Arbeitsrecht | 3.1.5.2 | Betriebsrat und Beteiligung | 11 |
| R18 | Arbeitsrecht | 3.1.5.3 | Schutzregeln im Arbeitsverhältnis | 22 |
| R19 | Arbeitsrecht | 3.1.5 | Tarifverträge und arbeitsrechtliche Normen | 4 |
| R20 | Wettbewerbsrecht | 3.1.6 | Wettbewerbsrecht | 17 |
| R21 | Gewerberecht | 3.1.7 | Gewerberecht | 16 |
| R22 | BGB Allgemeiner Teil | 3.1 | Rechtliche Grundlagen & Methoden | 1 |
| S01 | Grundbegriffe des Steuerrechts | 3.2.1 | Steuerliche Grundlagen & Systematik | 12 |
| S02 | Unternehmensbezogene Steuern | 3.2.2.1 | Einkommensteuer – Einkunftsarten & Gewinnermittlung | 30 |
| S03 | Unternehmensbezogene Steuern | 3.2.2.1 | Einkommensteuer – Abzüge, Tarif & Veranlagung | 23 |
| S04 | Unternehmensbezogene Steuern | 3.2.2.1 | Mitunternehmerschaft & Personengesellschaften | 10 |
| S05 | Unternehmensbezogene Steuern | 3.2.2.2 | Körperschaftsteuer und Beteiligungen | 25 |
| S06 | Unternehmensbezogene Steuern | 3.2.2.3 | Gewerbesteuer | 26 |
| S07 | Unternehmensbezogene Steuern | 3.2.2.4 | Kapitalertragsteuer und Steuerabzug | 6 |
| S08 | Unternehmensbezogene Steuern | 3.2.2.5 | Umsatzsteuer – Grundlagen & Vorsteuer | 34 |
| S09 | Unternehmensbezogene Steuern | 3.2.2.5 | Umsatzsteuer – EU, Drittland & Sonderfälle | 33 |
| S10 | Unternehmensbezogene Steuern | 3.2.2.6 | Grundsteuer | 3 |
| S11 | Unternehmensbezogene Steuern | 3.2.2.7 | Grunderwerbsteuer | 5 |
| S12 | Unternehmensbezogene Steuern | 3.2.2.8 | Erbschaft- & Schenkungsteuer | 10 |
| S13 | Abgabenordnung | 3.2.3 | Abgabenordnung & Besteuerungsverfahren | 16 |

Alle 800 bisherigen Zuordnungen ID → DetailKey → Rahmenplan-Code sowie Querverweise und Detail-Reihenfolge stimmen feldweise mit v1 überein. Hinzu kommen ausschließlich UI-Key, UI-Anzeigename und UI-Reihenfolge. Die UI-Reihenfolge folgt innerhalb des Oberthemas der bisherigen relativen Quellzeilenfolge. Sie ist von der internen Reihenfolge je Detailgruppe getrennt. Eine spätere didaktische Umsortierung bedarf eigener Freigabe.

### 3.1 Entscheidung zu den bestehenden Themen

Die Maßnahme in dieser Übersicht ist die **fachliche Detailmaßnahme aus v1**. Eine interne Aufteilung führt nicht automatisch zu mehreren UI-Einträgen. Für die tatsächliche Nutzeranzeige gilt ausschließlich die Tabelle in Abschnitt 2.

| Quellfach | Bestehendes Thema | IDs | Maßnahme | Zielpfade |
| --- | --- | --- | --- | --- |
| Recht | Kaufrecht & Verbraucherschutz | 53 | nur umbenennen | R04 · Warenkauf und Rechte bei Mängeln |
| Recht | Arbeitsvertrag, Entgelt & Kündigung | 79 | unverändert übernehmen | R16 · Arbeitsvertrag, Entgelt & Kündigung |
| Recht | Betriebsverfassungs-, Tarif- & Arbeitsschutzrecht | 37 | in mehrere Themen aufteilen | R18 · Schutzregeln im Arbeitsverhältnis; R19 · Tarifverträge und arbeitsrechtliche Normen; R17 · Betriebsrat und Beteiligung |
| Recht | Sachenrecht, Kreditsicherheiten & Insolvenz | 84 | in mehrere Themen aufteilen | R08 · Besitz und Eigentumsübertragung; R09 · Sicherheiten für Forderungen; R10 · Insolvenz und Gläubigerrechte |
| Recht | BGB Allgemeiner Teil | 67 | in mehrere Themen aufteilen | R01 · BGB: Personen, Rechtsgeschäfte und Vertretung; R06 · Onlineverträge und Widerruf; R07 · Leistung, Verzug und Schadensersatz |
| Recht | Handelsrecht | 76 | in mehrere Themen aufteilen | R11 · Kaufleute und Firma; R12 · Register und Publizität; R14 · Prokura und kaufmännische Vollmachten; R13 · Handelsvertreter, Makler und Absatzpartner; R15 · Handelsgeschäfte und Lieferklauseln; R04 · Warenkauf und Rechte bei Mängeln |
| Recht | Schuldrecht: Grundlagen, AGB, Verjährung, Gerichte & Produkthaftung | 46 | in mehrere Themen aufteilen | R01 · BGB: Personen, Rechtsgeschäfte und Vertretung; R02 · Schuldverhältnisse, AGB, Fristen und Gerichte; R03 · Haftung für fehlerhafte Produkte |
| Recht | Weitere Vertragstypen, E-Commerce & Leistungsstörungen | 84 | in mehrere Themen aufteilen | R07 · Leistung, Verzug und Schadensersatz; R05 · Miete, Darlehen, Dienstleistung, Werk und Leasing; R06 · Onlineverträge und Widerruf |
| Recht | Wettbewerbsrecht | 17 | unverändert übernehmen | R20 · Wettbewerbsrecht |
| Recht | Gewerberecht | 16 | unverändert übernehmen | R21 · Gewerberecht |
| Recht | Rechtliche Grundlagen & Methoden | 1 | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | R22 · Rechtliche Grundlagen & Methoden |
| Recht | BGB Schuldrecht | 7 | mit einem anderen Thema zusammenführen | R02 · Schuldverhältnisse, AGB, Fristen und Gerichte |
| Steuern | Gewerbesteuer | 26 | unverändert übernehmen | S06 · Gewerbesteuer |
| Steuern | Körperschaftsteuer & Kapitalertragsteuer | 29 | in mehrere Themen aufteilen | S05 · Körperschaftsteuer und Beteiligungen; S02 · Einkommensteuer – Einkunftsarten & Gewinnermittlung; S07 · Kapitalertragsteuer und Steuerabzug |
| Steuern | Steuerliche Grundlagen & Systematik | 14 | in mehrere Themen aufteilen | S01 · Steuerliche Grundlagen & Systematik; S02 · Einkommensteuer – Einkunftsarten & Gewinnermittlung; S13 · Abgabenordnung & Besteuerungsverfahren |
| Steuern | Einkommensteuer – Einkunftsarten & Gewinnermittlung | 40 | in mehrere Themen aufteilen | S02 · Einkommensteuer – Einkunftsarten & Gewinnermittlung; S04 · Mitunternehmerschaft & Personengesellschaften; S07 · Kapitalertragsteuer und Steuerabzug |
| Steuern | Einkommensteuer – Abzüge, Tarif & Veranlagung | 18 | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | S03 · Einkommensteuer – Abzüge, Tarif & Veranlagung |
| Steuern | Umsatzsteuer – Grundlagen & Vorsteuer | 34 | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | S08 · Umsatzsteuer – Grundlagen & Vorsteuer |
| Steuern | Umsatzsteuer – EU, Drittland & Sonderfälle | 33 | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | S09 · Umsatzsteuer – EU, Drittland & Sonderfälle |
| Steuern | Grunderwerb- & Grundsteuer | 8 | in mehrere Themen aufteilen | S11 · Grunderwerbsteuer; S10 · Grundsteuer |
| Steuern | Erbschaft- & Schenkungsteuer | 10 | unverändert übernehmen | S12 · Erbschaft- & Schenkungsteuer |
| Steuern | Abgabenordnung & Besteuerungsverfahren | 15 | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | S13 · Abgabenordnung & Besteuerungsverfahren |
| Steuern | Einkommensteuer – Einkommensberechnung & Tarif | 5 | mit einem anderen Thema zusammenführen | S03 · Einkommensteuer – Abzüge, Tarif & Veranlagung |
| Steuern | Mitunternehmerschaft & Personengesellschaften | 1 | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | S04 · Mitunternehmerschaft & Personengesellschaften |

### 3.2 Vollständiger Pilotplan mit UI- und Detailziel

Die 46 disjunkten ID-Teilmengen sind unverändert. ID-Bereiche schließen beide Grenzen ein. Die XLSX enthält zusätzlich alle 800 IDs einzeln.

| Bestehendes Thema | Vorhandene IDs | Sichtbares Oberthema | Interner Rahmenplanbereich | Interne Detailgruppe | Interne Fachmaßnahme aus v1 | Begründung | Risiko/Abhängigkeit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Recht · Kaufrecht & Verbraucherschutz | R-0001–R-0020; R-0129–R-0141; R-0223–R-0236; R-0240–R-0245 | BGB Schuldrecht | WQ 3.1.2.3 | Warenkauf und Rechte bei Mängeln | nur umbenennen | Kaufrechtlicher Zusammenhang bleibt als zusammenhängender Lernpfad erhalten; Rechte bei Mängeln werden nicht wegen Querverweisen zerrissen. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Arbeitsvertrag, Entgelt & Kündigung | R-0021–R-0025; R-0028–R-0029; R-0144; R-0410–R-0442; R-0445; R-0448–R-0484 | Arbeitsrecht | WQ 3.1.5.1 | Arbeitsvertrag, Entgelt & Kündigung | unverändert übernehmen | Label und Bestand bleiben zusammen; ergänzende Bezüge zu Schutzrecht und Betriebsrat werden als Querverweise erfasst. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Betriebsverfassungs-, Tarif- & Arbeitsschutzrecht | R-0026; R-0030; R-0409; R-0496–R-0501; R-0532–R-0544 | Arbeitsrecht | WQ 3.1.5.3 | Schutzregeln im Arbeitsverhältnis | in mehrere Themen aufteilen | Betriebsrat, Schutzrecht und Tarifnormen sind drei eigenständige Lernpfade unter Arbeitsrecht. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Betriebsverfassungs-, Tarif- & Arbeitsschutzrecht | R-0027; R-0407–R-0408; R-0578 | Arbeitsrecht | WQ 3.1.5 | Tarifverträge und arbeitsrechtliche Normen | in mehrere Themen aufteilen | Betriebsrat, Schutzrecht und Tarifnormen sind drei eigenständige Lernpfade unter Arbeitsrecht. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. Einzelfallentscheidung: R-0578. |
| Recht · Betriebsverfassungs-, Tarif- & Arbeitsschutzrecht | R-0485–R-0495 | Arbeitsrecht | WQ 3.1.5.2 | Betriebsrat und Beteiligung | in mehrere Themen aufteilen | Betriebsrat, Schutzrecht und Tarifnormen sind drei eigenständige Lernpfade unter Arbeitsrecht. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Sachenrecht, Kreditsicherheiten & Insolvenz | R-0031–R-0038; R-0041–R-0042; R-0309–R-0313; R-0315; R-0318–R-0320; R-0322–R-0326; R-0372 | BGB Sachenrecht | WQ 3.1.3.1 | Besitz und Eigentumsübertragung | in mehrere Themen aufteilen | Eigentumsfragen, Sicherheiten und Insolvenz werden gemäß den drei Rahmenplan-Unterbereichen getrennt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Sachenrecht, Kreditsicherheiten & Insolvenz | R-0039–R-0040; R-0097; R-0314; R-0316–R-0317; R-0321; R-0327–R-0356; R-0521–R-0523 | BGB Sachenrecht | WQ 3.1.3.2 | Sicherheiten für Forderungen | in mehrere Themen aufteilen | Eigentumsfragen, Sicherheiten und Insolvenz werden gemäß den drei Rahmenplan-Unterbereichen getrennt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Sachenrecht, Kreditsicherheiten & Insolvenz | R-0357–R-0371; R-0524–R-0527 | BGB Sachenrecht | WQ 3.1.3.3 | Insolvenz und Gläubigerrechte | in mehrere Themen aufteilen | Eigentumsfragen, Sicherheiten und Insolvenz werden gemäß den drei Rahmenplan-Unterbereichen getrennt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · BGB Allgemeiner Teil | R-0050–R-0069; R-0083–R-0087; R-0089–R-0096; R-0105–R-0118; R-0171–R-0185; R-0515–R-0516; R-0567 | BGB Allgemeiner Teil | WQ 3.1.1 | BGB: Personen, Rechtsgeschäfte und Vertretung | in mehrere Themen aufteilen | Kern bleibt bei BGB-Grundlagen; unbestellte Waren und Deliktsfähigkeit erhalten sachnähere Primärzuordnungen. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. Einzelfallentscheidung: R-0087. |
| Recht · BGB Allgemeiner Teil | R-0088 | BGB Schuldrecht | WQ 3.1.2.5 | Onlineverträge und Widerruf | in mehrere Themen aufteilen | Kern bleibt bei BGB-Grundlagen; unbestellte Waren und Deliktsfähigkeit erhalten sachnähere Primärzuordnungen. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · BGB Allgemeiner Teil | R-0514 | BGB Schuldrecht | WQ 3.1.2.5 | Leistung, Verzug und Schadensersatz | in mehrere Themen aufteilen | Kern bleibt bei BGB-Grundlagen; unbestellte Waren und Deliktsfähigkeit erhalten sachnähere Primärzuordnungen. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Handelsrecht | R-0070–R-0077; R-0151–R-0152; R-0161–R-0165; R-0373–R-0379; R-0528 | Handelsrecht | WQ 3.1.4.1 | Kaufleute und Firma | in mehrere Themen aufteilen | Kaufleute, Register und Vermittler erhalten eigene Pfade; Vollmachten und Handelsgeschäfte bleiben als sinnvolle Vertiefungen erhalten. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Handelsrecht | R-0078–R-0082; R-0153–R-0156; R-0392–R-0399 | Handelsrecht | WQ 3.1.4.2 | Register und Publizität | in mehrere Themen aufteilen | Kaufleute, Register und Vermittler erhalten eigene Pfade; Vollmachten und Handelsgeschäfte bleiben als sinnvolle Vertiefungen erhalten. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Handelsrecht | R-0157–R-0160; R-0386–R-0391; R-0529–R-0531 | Handelsrecht | WQ 3.1.4 | Prokura und kaufmännische Vollmachten | in mehrere Themen aufteilen | Kaufleute, Register und Vermittler erhalten eigene Pfade; Vollmachten und Handelsgeschäfte bleiben als sinnvolle Vertiefungen erhalten. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Handelsrecht | R-0166–R-0170; R-0400–R-0406; R-0577 | Handelsrecht | WQ 3.1.4.3 | Handelsvertreter, Makler und Absatzpartner | in mehrere Themen aufteilen | Kaufleute, Register und Vermittler erhalten eigene Pfade; Vollmachten und Handelsgeschäfte bleiben als sinnvolle Vertiefungen erhalten. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Handelsrecht | R-0237–R-0239; R-0381–R-0385; R-0576 | Handelsrecht | WQ 3.1.4 | Handelsgeschäfte und Lieferklauseln | in mehrere Themen aufteilen | Kaufleute, Register und Vermittler erhalten eigene Pfade; Vollmachten und Handelsgeschäfte bleiben als sinnvolle Vertiefungen erhalten. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. Einzelfallentscheidung: R-0576. |
| Recht · Handelsrecht | R-0380 | BGB Schuldrecht | WQ 3.1.2.3 | Warenkauf und Rechte bei Mängeln | in mehrere Themen aufteilen | Kaufleute, Register und Vermittler erhalten eigene Pfade; Vollmachten und Handelsgeschäfte bleiben als sinnvolle Vertiefungen erhalten. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Schuldrecht: Grundlagen, AGB, Verjährung, Gerichte & Produkthaftung | R-0098–R-0101; R-0190–R-0195; R-0201–R-0209 | BGB Allgemeiner Teil | WQ 3.1.1 | BGB: Personen, Rechtsgeschäfte und Vertretung | in mehrere Themen aufteilen | Allgemeiner Vertragsschluss gehört zu BGB-Grundlagen, Produkthaftung erhält einen eigenen Pfad; übrige Grundlagen bleiben gebündelt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Schuldrecht: Grundlagen, AGB, Verjährung, Gerichte & Produkthaftung | R-0102–R-0104; R-0186–R-0189; R-0196–R-0200; R-0210–R-0219; R-0517–R-0518 | BGB Schuldrecht | WQ 3.1.2.1 | Schuldverhältnisse, AGB, Fristen und Gerichte | in mehrere Themen aufteilen | Allgemeiner Vertragsschluss gehört zu BGB-Grundlagen, Produkthaftung erhält einen eigenen Pfad; übrige Grundlagen bleiben gebündelt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Schuldrecht: Grundlagen, AGB, Verjährung, Gerichte & Produkthaftung | R-0220–R-0222 | BGB Schuldrecht | WQ 3.1.2.2 | Haftung für fehlerhafte Produkte | in mehrere Themen aufteilen | Allgemeiner Vertragsschluss gehört zu BGB-Grundlagen, Produkthaftung erhält einen eigenen Pfad; übrige Grundlagen bleiben gebündelt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Weitere Vertragstypen, E-Commerce & Leistungsstörungen | R-0119–R-0128; R-0274–R-0308; R-0568 | BGB Schuldrecht | WQ 3.1.2.5 | Leistung, Verzug und Schadensersatz | in mehrere Themen aufteilen | Vertragsarten, Online-Widerruf und allgemeine Leistungsstörungen werden getrennt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Weitere Vertragstypen, E-Commerce & Leistungsstörungen | R-0142–R-0143; R-0145–R-0150; R-0246–R-0268; R-0519–R-0520 | BGB Schuldrecht | WQ 3.1.2.4 | Miete, Darlehen, Dienstleistung, Werk und Leasing | in mehrere Themen aufteilen | Vertragsarten, Online-Widerruf und allgemeine Leistungsstörungen werden getrennt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Weitere Vertragstypen, E-Commerce & Leistungsstörungen | R-0269–R-0273 | BGB Schuldrecht | WQ 3.1.2.5 | Onlineverträge und Widerruf | in mehrere Themen aufteilen | Vertragsarten, Online-Widerruf und allgemeine Leistungsstörungen werden getrennt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Wettbewerbsrecht | R-0502–R-0507; R-0545–R-0555 | Wettbewerbsrecht | WQ 3.1.6 | Wettbewerbsrecht | unverändert übernehmen | Lernfreundliches bestehendes Thema entspricht dem fachlichen Unterbereich. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Gewerberecht | R-0508–R-0513; R-0556–R-0565 | Gewerberecht | WQ 3.1.7 | Gewerberecht | unverändert übernehmen | Lernfreundliches bestehendes Thema entspricht dem fachlichen Unterbereich. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Recht · Rechtliche Grundlagen & Methoden | R-0566 | BGB Allgemeiner Teil | WQ 3.1 | Rechtliche Grundlagen & Methoden | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | R-0566 prüft ausdrücklich methodische Fallbearbeitung; der Verzugsfall begründet einen Querverweis, keinen Umzug. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. Einzelfallentscheidung: R-0566. |
| Recht · BGB Schuldrecht | R-0569–R-0575 | BGB Schuldrecht | WQ 3.1.2.1 | Schuldverhältnisse, AGB, Fristen und Gerichte | mit einem anderen Thema zusammenführen | Die sieben Vertiefungsfragen ergänzen den Grundlagenpfad; Detailwissen zu Schuldnerwechsel und Factoring bleibt erhalten. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Gewerbesteuer | ST-0001–ST-0008; ST-0088–ST-0103; ST-0208–ST-0209 | Unternehmensbezogene Steuern | WQ 3.2.2.3 | Gewerbesteuer | unverändert übernehmen | Steuerart bildet bereits einen klaren Lernbereich. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Körperschaftsteuer & Kapitalertragsteuer | ST-0009–ST-0013; ST-0052–ST-0056; ST-0070–ST-0079; ST-0106; ST-0206–ST-0207; ST-0231–ST-0232 | Unternehmensbezogene Steuern | WQ 3.2.2.2 | Körperschaftsteuer und Beteiligungen | in mehrere Themen aufteilen | Körperschaftsteuer und Steuerabzug werden getrennt; ST-0014/ST-0105 gehören primär zur Einkommensteuer. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Körperschaftsteuer & Kapitalertragsteuer | ST-0014; ST-0105 | Unternehmensbezogene Steuern | WQ 3.2.2.1 | Einkommensteuer – Einkunftsarten & Gewinnermittlung | in mehrere Themen aufteilen | Körperschaftsteuer und Steuerabzug werden getrennt; ST-0014/ST-0105 gehören primär zur Einkommensteuer. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. Einzelfallentscheidung: ST-0014, ST-0105. |
| Steuern · Körperschaftsteuer & Kapitalertragsteuer | ST-0015; ST-0104 | Unternehmensbezogene Steuern | WQ 3.2.2.4 | Kapitalertragsteuer und Steuerabzug | in mehrere Themen aufteilen | Körperschaftsteuer und Steuerabzug werden getrennt; ST-0014/ST-0105 gehören primär zur Einkommensteuer. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Steuerliche Grundlagen & Systematik | ST-0016–ST-0020; ST-0022–ST-0023; ST-0201–ST-0203; ST-0223–ST-0224 | Grundbegriffe des Steuerrechts | WQ 3.2.1 | Steuerliche Grundlagen & Systematik | in mehrere Themen aufteilen | Grundlagenthema bleibt; ST-0021 ist Einkommensermittlung, ST-0204 gehört zur Abgabenordnung. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Steuerliche Grundlagen & Systematik | ST-0021 | Unternehmensbezogene Steuern | WQ 3.2.2.1 | Einkommensteuer – Einkunftsarten & Gewinnermittlung | in mehrere Themen aufteilen | Grundlagenthema bleibt; ST-0021 ist Einkommensermittlung, ST-0204 gehört zur Abgabenordnung. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Steuerliche Grundlagen & Systematik | ST-0204 | Abgabenordnung | WQ 3.2.3 | Abgabenordnung & Besteuerungsverfahren | in mehrere Themen aufteilen | Grundlagenthema bleibt; ST-0021 ist Einkommensermittlung, ST-0204 gehört zur Abgabenordnung. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Einkommensteuer – Einkunftsarten & Gewinnermittlung | ST-0024–ST-0027; ST-0029–ST-0037; ST-0040; ST-0058; ST-0063; ST-0065; ST-0080–ST-0087; ST-0198; ST-0225 | Unternehmensbezogene Steuern | WQ 3.2.2.1 | Einkommensteuer – Einkunftsarten & Gewinnermittlung | in mehrere Themen aufteilen | Mitunternehmerfälle werden mit dem vorhandenen Vertiefungsthema zusammengeführt, Fragen zum Steuerabzug dem Kapitalertragsteuerpfad zugeordnet. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Einkommensteuer – Einkunftsarten & Gewinnermittlung | ST-0028; ST-0057; ST-0064; ST-0194–ST-0197; ST-0199–ST-0200 | Unternehmensbezogene Steuern | WQ 3.2.2.1 | Mitunternehmerschaft & Personengesellschaften | in mehrere Themen aufteilen | Mitunternehmerfälle werden mit dem vorhandenen Vertiefungsthema zusammengeführt, Fragen zum Steuerabzug dem Kapitalertragsteuerpfad zugeordnet. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Einkommensteuer – Einkunftsarten & Gewinnermittlung | ST-0038–ST-0039; ST-0059; ST-0066 | Unternehmensbezogene Steuern | WQ 3.2.2.4 | Kapitalertragsteuer und Steuerabzug | in mehrere Themen aufteilen | Mitunternehmerfälle werden mit dem vorhandenen Vertiefungsthema zusammengeführt, Fragen zum Steuerabzug dem Kapitalertragsteuerpfad zugeordnet. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Einkommensteuer – Abzüge, Tarif & Veranlagung | ST-0041–ST-0051; ST-0060–ST-0062; ST-0067–ST-0069; ST-0205 | Unternehmensbezogene Steuern | WQ 3.2.2.1 | Einkommensteuer – Abzüge, Tarif & Veranlagung | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | Bestehende Unterteilung bleibt unter Einkommensteuer und nimmt den überlappenden Tarif-Kleinstbereich auf. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Umsatzsteuer – Grundlagen & Vorsteuer | ST-0107–ST-0127; ST-0155–ST-0163; ST-0210–ST-0213 | Unternehmensbezogene Steuern | WQ 3.2.2.5 | Umsatzsteuer – Grundlagen & Vorsteuer | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | Grundlagenpfad unter Umsatzsteuer bleibt; internationale Einführungsbeispiele behalten ihren didaktischen Kontext. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Umsatzsteuer – EU, Drittland & Sonderfälle | ST-0128–ST-0154; ST-0164–ST-0168; ST-0214 | Unternehmensbezogene Steuern | WQ 3.2.2.5 | Umsatzsteuer – EU, Drittland & Sonderfälle | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | Vertiefung bleibt; ST-0214 wird als enthaltene Sonderregel ausdrücklich beibehalten, nicht wegen fehlendem Auslandsbezug gelöscht. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Grunderwerb- & Grundsteuer | ST-0169–ST-0171; ST-0215–ST-0216 | Unternehmensbezogene Steuern | WQ 3.2.2.7 | Grunderwerbsteuer | in mehrere Themen aufteilen | Zwei unterschiedliche Rahmenplan-Unterbereiche und Steuerarten werden getrennt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Grunderwerb- & Grundsteuer | ST-0172; ST-0217–ST-0218 | Unternehmensbezogene Steuern | WQ 3.2.2.6 | Grundsteuer | in mehrere Themen aufteilen | Zwei unterschiedliche Rahmenplan-Unterbereiche und Steuerarten werden getrennt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Erbschaft- & Schenkungsteuer | ST-0173–ST-0179; ST-0219–ST-0221 | Unternehmensbezogene Steuern | WQ 3.2.2.8 | Erbschaft- & Schenkungsteuer | unverändert übernehmen | Zusammengehörige Steuerarten bleiben in einem Lernpfad. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Abgabenordnung & Besteuerungsverfahren | ST-0180–ST-0193; ST-0222 | Abgabenordnung | WQ 3.2.3 | Abgabenordnung & Besteuerungsverfahren | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | Bestehender Lernpfad bleibt und übernimmt die AO-Buchführungspflicht aus den Grundlagen. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Einkommensteuer – Einkommensberechnung & Tarif | ST-0226–ST-0230 | Unternehmensbezogene Steuern | WQ 3.2.2.1 | Einkommensteuer – Abzüge, Tarif & Veranlagung | mit einem anderen Thema zusammenführen | ST-0226 bis ST-0230 ergänzen den vorhandenen Pfad Abzüge, Tarif und Veranlagung. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |
| Steuern · Mitunternehmerschaft & Personengesellschaften | ST-0233 | Unternehmensbezogene Steuern | WQ 3.2.2.1 | Mitunternehmerschaft & Personengesellschaften | als zusätzliche sinnvolle Untergliederung unter einem Rahmenplanthema behalten | ST-0233 bleibt als Vertiefungsfall und wird mit den zugehörigen Einkunftsermittlungsfragen gebündelt. | Interne Fachaufteilung ist keine UI-Aufteilung. Resume und Navigation beziehen sich auf das gemeinsame UI-Oberthema. |

## 4. Vollständige interne Auswertbarkeit des Rahmenplans

Der interne Katalog enthält **71 Knoten: die Fachwurzel plus 70 Themen-/Unterthemen-/Detailpunkte** des bereitgestellten Dokuments für WQ Recht und Steuern. Alle bleiben im Tab „Rahmenplan-Abdeckung“ erhalten, einschließlich bisherigem Status, ursprünglichen ID-Kandidaten, Auffälligkeit, Elternbeziehung und zugehörigem UI-Bereich. Kein leerer oder nur teilweise belegter Punkt wird durch Zusammenfassung ausgeblendet.

Nummerierte Codes und unnummerierte Detailpunkte müssen unterscheidbar bleiben. Beispiel: 3.1.2.1#2 ist der interne PunktKey für den zweiten Aufzählungspunkt unter 3.1.2.1. Das ist **keine erfundene offizielle Rahmenplannummer**. Der offizielle Code und die interne Punkt-ID sind getrennte Felder.

Verbindliche Auswertungsregeln:

1. Ausgangspunkt ist immer der vollständige Rahmenplankatalog, nicht die Menge vorhandener Fragen. Auch Punkte ohne ID-Zuordnung werden ausgegeben.
2. Primärbezug, fachlicher Nebenbezug und bloßer Querverweis sind unterscheidbar. Die 800 primären Zuordnungen aus v1 bleiben mindestens vorhanden; zusätzliche Bezüge vervielfachen keine ID.
3. Die bisherigen ID-Listen der Soll-Ist-Matrix werden als **Analyse-Kandidaten** bewahrt. Ihre Mehrfachnennungen dürfen nicht automatisch zu bestätigten Detailbelegen werden. Eine Zuordnung zu einem Elternpunkt bestätigt nicht automatisch alle Kinder.
4. „Direkte Primär-IDs“ bezeichnet nur den exakten Punkt der vorhandenen Hauptzuordnung. Ein leeres Feld bedeutet nicht automatisch „nicht abgedeckt“: Ein Punkt kann Nebenbelege, Kandidaten oder eine aggregierte Bewertung haben.
5. Der bisherige fachliche Abdeckungsstatus wird mit Quellenstand übernommen, nicht aus ID-Zahlen neu berechnet. Belegqualität und Freigabestand werden getrennt geführt. Neue oder veränderte Vollständigkeitsbehauptungen erfordern weiterhin eine inhaltliche Prüfung der konkreten Frage/Lösung.
6. Elternauswertungen aggregieren den fachlichen Status ihrer Kinder und führen eindeutige ID-Mengen. „Vollständig“ entsteht nicht aus einem gefüllten UI-Pool. UI-Vollständigkeit und Rahmenplan-Abdeckung sind getrennte Kennzahlen.

Die Oberknoten 3, 3.1 und 3.2 aggregieren mehrere UI-Oberthemen. Zusätzliche methodische oder fachübergreifende Bezüge bleiben erhalten, selbst wenn sie außerhalb des normalen Code-Zweigs eines sichtbaren Themas liegen. Das UI-Elternfeld darf niemals den fachlichen Code überschreiben.

Die vier teilabgedeckten Analysezeilen 3.1, 3.1.2, 3.1.2.1 und 3.1.2.1 [2] bilden weiterhin eine Lückenkette zu Treu und Glauben. R-0087 bleibt unter BGB Allgemeiner Teil sichtbar; sein interner Querbezug auf Treu und Glauben bleibt erhalten. Die neue Oberfläche schließt diese Lücke nicht.

Die bisherigen Prüfentscheidungen einschließlich der drei Zuordnungshinweise und Dubletten bleiben gültig:

| Nr. | Bezug | Einordnung | Befund | Entscheidung | Risiko |
| --- | --- | --- | --- | --- | --- |
| P01 | 3.1 | teilweise abgedeckt | Übergeordneter Status aus 3.1.2; keine zusätzliche Inhaltslücke. | Keine eigene neue Frage; Parentstatus erst nach fachlicher Prüfung des Blatts neu bewerten. | Kein Freigabehindernis für Struktur; Abdeckung bleibt teilweise. |
| P02 | 3.1.2 | teilweise abgedeckt | Übergeordneter Status aus 3.1.2.1; kein zweiter Ergänzungsbedarf. | Wie P01. | Keine künstliche Vervierfachung der Lücke. |
| P03 | 3.1.2.1 | teilweise abgedeckt | Grundlagen enthalten den eingeschränkt belegten Einzelpunkt Treu und Glauben. | Wie P01; R-0087 ist Querbeleg, kein Beleg vollständiger Abdeckung. | Fachliche Freigabe des späteren Lernziels erforderlich. |
| P04 | 3.1.2.1 [2] | neue Abdeckung erforderlich | R-0087 nennt Treu und Glauben nur in der Lösung zum Schweigen. | Eigene Anwendung des Grundsatzes als getrenntes Inhaltsvorhaben planen. Noch keine neue ID vergeben, keine bestehende Frage ersetzen. | Fachprüfung, eigener Inhalt und spätere Freigabe. |
| P05 | R-0566 / 3.1.2.5 | Zuordnungshinweis präzisiert | Die Frage verlangt Fallmethodik und Gutachtenstil; der Verzugsfall ist das Anwendungsbeispiel. | R22 unter WQ 3.1 als Methodenvertiefung erhalten; Querverweis 3.1.2.5. | Keine erzwungene Verschiebung nur anhand des Beispiels. |
| P06 | R-0576 / 3.1.4.3 | Zuordnungshinweis präzisiert | Handelsbräuche und Lieferklauseln sind ausdrücklich gefragt; Vermittlergewerbe ist kein geeigneter Primärpunkt. | R15 unter WQ 3.1.4 behalten; Bezüge 3.1.2.3, 3.1.2.5 und HQ 7 dokumentieren. | Kein Datensatztransfer nach HQ, keine Kopie. |
| P07 | R-0578 / 3.1.5.3 | Zuordnungshinweis präzisiert | Tarifbindung, Günstigkeitsprinzip und Nachwirkung sind Kern der Aufgabe. | R19 unter WQ 3.1.5; Tarifunterthema behalten, Urlaubsschutz als Querverweis. | Keine Inhaltskürzung wegen zusätzlicher Untergliederung. |
| P08 | R-0043–R-0049 ↔ ST-0194–ST-0200 | Dubletten-/Herkunftshinweis | Sieben inaktive Recht-Vorläufer und sieben aktive Steuer-Nachfolger; keine 14 aktiven Duplikate. | Alle IDs/Aktivwerte erhalten; Paare dokumentieren; weder reaktivieren noch neu duplizieren. | Historische R-Attempts nicht automatisch mit ST-Attempts verschmelzen. |
| P09 | ST-0014, ST-0105 | einem anderen Rahmenplanbereich zuordnen | Frage/Lösung behandeln das Teileinkünfteverfahren natürlicher Personen. | S02 (3.2.2.1), Verweis auf 3.2.2.4. ST-0013/ST-0106 bleiben S05 nach Lösungskontext. | Grenzfallentscheidung vor Freigabe anhand der vollständigen Lösungen nachvollziehen. |
| P10 | R-0205, R-0206, R-0209 | fachlich prüfen/überarbeiten | R-0205 verwendet Cargo-Bike, Folgefragen sprechen von Möbelhaus/Schrank; Kontextbezug ist fraglich. | Zusammen in R01 und Reihenfolge erhalten. Separates fachliches Redaktionsvorhaben, kein Umschreiben in der Strukturmigration. | Kein neuer Befund zur Gesetzeslage; Strukturentscheidung ändert den Text nicht. |
| P11 | ST-0145, ST-0191 | fachlich prüfen/überarbeiten | Fragen nennen historische Jahre bzw. eine Jahresabkürzung. | Zeitbezug bei späterer Inhaltsprüfung bewusst kennzeichnen; Inhalte jetzt erhalten. | Nicht pauschal auf aktuellen Rechtsstand umdatieren. |
| P12 | gesamte Ursprungsmatrix | keine Ausführungs-ID-Liste | Mehrfachnennungen in Eltern-/Detailzeilen belegen Querverbindungen, nicht mehrere Zielkopien. | ID-Plan: genau eine primäre Zielzuordnung je aktiver ID; Verbindungen in secondaryCodes. | Keine automatischen Kopien aus der alten Matrix erzeugen. |
| P13 | Trainer-Datenindex · Sheet-Zeile | Zeilenreferenzen nicht belastbar | 889 von 2.686 Index-Zeilenreferenzen weichen vom gesicherten Rohbestand ab, davon 525 im Pilot. Beispiel R-0050: Index 45, tatsächlich 52. Der Index zählt nach Aktivfilterung; inaktive Zeilen fehlen in der Positionszählung. | Ursprungsanalyse nicht verändern. Dieser Plan verwendet die Originalposition aus dem vollständigen Rohbestand; Ausführung sucht ausschließlich per Quellfach + ID und prüft Hash. | Index-Zeilennummern niemals als Schreibadresse verwenden. Live-Abgleich vor Ausführung verbindlich. |

Formulierungen zu „Zielpfad“ in übernommenen fachlichen Prüfentscheidungen bezeichnen in v2 ausschließlich die interne Detailgruppe. Für Resume und Navigation gilt stattdessen das UI-Oberthema.

| Inaktive ID | Aktiver Nachfolger | Frage exakt gleich | Entscheidung |
| --- | --- | --- | --- |
| R-0043 | ST-0194 | ja | Beide vorhandenen IDs samt Aktivstatus erhalten; kein automatischer Fortschrittstransfer. |
| R-0044 | ST-0195 | nein; fachliche Entsprechung | Beide vorhandenen IDs samt Aktivstatus erhalten; kein automatischer Fortschrittstransfer. |
| R-0045 | ST-0196 | nein; fachliche Entsprechung | Beide vorhandenen IDs samt Aktivstatus erhalten; kein automatischer Fortschrittstransfer. |
| R-0046 | ST-0197 | nein; fachliche Entsprechung | Beide vorhandenen IDs samt Aktivstatus erhalten; kein automatischer Fortschrittstransfer. |
| R-0047 | ST-0198 | nein; fachliche Entsprechung | Beide vorhandenen IDs samt Aktivstatus erhalten; kein automatischer Fortschrittstransfer. |
| R-0048 | ST-0199 | nein; fachliche Entsprechung | Beide vorhandenen IDs samt Aktivstatus erhalten; kein automatischer Fortschrittstransfer. |
| R-0049 | ST-0200 | ja | Beide vorhandenen IDs samt Aktivstatus erhalten; kein automatischer Fortschrittstransfer. |

## 5. Erforderliche Korrektur des Sheet-Konzepts

### 5.1 Bestehende produktive Daten

Alle bestehenden Fach-Tabs, Spalten A:O, IDs in A, Legacy-Themen in B, Aktivwerte in I und Bereichswerte in K bleiben unverändert. Es werden keine Datensätze verschoben, kopiert oder gelöscht. Die weiterhin gemeinsam genutzte Quelle für Karteikarten bleibt erhalten.

### 5.2 Geplante Metadaten – erst nach späterer Freigabe anzulegen

| Tabelle | Verbindliche Felder | Schlüssel / Änderung gegenüber v1 |
| --- | --- | --- |
| Trainer_Themen | Version, UIThemenKey, Teilbereich, FachgruppeCode, Quellfach, Anzeigename, Sortierung, Sichtbar, Status | Version + UIThemenKey; **10 sichtbare Oberthemen statt 35 Detailthemen**. Kein einzelner Rahmenplan-Code als UI-Identität. |
| Trainer_Detailgruppen | Version, DetailKey, Teilbereich, Quellfach, UIThemenKey, InterneBezeichnung, RahmenplanPunktKey, DetailSortierung, Einordnung | Version + DetailKey; **neu als separate interne Ebene**. 35 Gruppen aus v1 unverändert, jeweils ein UI-Elternkey. |
| Trainer_Zuordnung | Version, Teilbereich, Quellfach, TrainerID, DetailKey, DetailReihenfolge, UIReihenfolge, QuellthemaAlt, QuellzeilenSHA256 | Version + Teilbereich + Quellfach + TrainerID; 800 Primärzeilen. Das bisher mehrdeutige ThemenKey-Feld heißt DetailKey. UI-Key wird über Detailgruppen abgeleitet, nicht als zweiter editierbarer Master gepflegt. |
| Trainer_Rahmenplanbezug | Version, Teilbereich, Quellfach, TrainerID, PunktKey, Bezugsart, Belegstatus, Begründung, Quelle | Version + Teilbereich + Quellfach + TrainerID + PunktKey + Bezugsart; mindestens die bestehenden 800 Primärbezüge, zusätzliche bekannte Neben-/Querverweise separat. N:m-Tabelle, keine kopierten Fragen. Kandidaten werden als Kandidaten gekennzeichnet. |
| Rahmenplan_Abdeckung | RahmenplanVersion, Teilbereich, FachgruppeCode, PunktKey, OffiziellerCode, Detailindex, ElternKey, InterneBezeichnung, Abdeckungsstatus, AnalyseKandidaten, Befund, Quellenstand, Prüfstatus, FreigabeReferenz | RahmenplanVersion + Teilbereich + PunktKey; 71 Knoten einschließlich aller 70 Inhaltspunkte. Katalog und fachlicher Prüfstatus bleiben auch ohne Fragen vollständig vorhanden. |
| Trainer_Migrationen | MigrationID, Version, Vorversion, PlanSHA256, SnapshotSHA256, Prüfstatus, FreigabeVon, FreigabeAm, Laufstatus, Laufzeitpunkt, Rückfallversion, Protokollreferenz | Unverändert append-only, jetzt v2 und Vorgängerhash dokumentieren. Die fachliche Revision darf nicht still unter v1 aktiviert werden. |

Die Metadatentabellen sind ein späteres Zielmodell, **keine bereits angelegten produktiven Tabs**. Die Planungs-XLSX stellt UI-Key und UI-Name zur Prüfung zusätzlich neben jeder ID dar; das sind abgeleitete Ansichten, keine konkurrierenden Pflegequellen. Exakte interne Referenztexte bleiben intern und werden nicht an die öffentliche Katalog-API ausgegeben.

Die 35 bisherigen Themenobjekte werden also nicht gelöscht, sondern in Trainer_Detailgruppen überführt. Der UI-Katalog erhält zehn neue stabile Schlüssel. Im bisherigen Konzept müssen Anzeige-/Resume-Felder von DetailKey auf UIThemenKey wechseln; rein fachliche Felder bleiben detailgenau.

## 6. Auswirkungen auf den technischen Plan

Die in v1 festgestellten Abhängigkeiten von exakten Themenbezeichnungen bleiben bestehen (Code.gs:703/904; js/trainer.js:443/473/915/1017; js/lernstand.js:142/160). Diese Revision ändert die Zielverträge, nicht den Code.

- **Themenauswahl:** TrainerCatalog liefert nur die zehn aktiven UI-Einträge mit UI-Key, eigenem Anzeigenamen, Sortierung und eindeutiger ID-Anzahl. Die 35 Detailgruppen und 71 Rahmenplanknoten werden nicht automatisch als Optionen ausgegeben. Außerhalb des Piloten bleibt die bisherige Auswahl bestehen.
- **Fragenpool:** TrainerQuestions erhält Version + UIThemenKey. Der Pool ist die deduplizierte Vereinigung aller zugehörigen Detailgruppen. Navigation, Zufallsauswahl und „Noch nie beantwortet“ nutzen denselben Pool mit UIReihenfolge, nicht 35 getrennte Pools.
- **Resume:** Ein Cursor je Nutzer, Modul, technischem Fach und UI-Key, z. B. Auswahl = tr-v2:ui-wq-recht-schuld. Beim Einstieg wird der neueste gültige alte Cursor übernommen, dessen letzte ID zum UI-Pool gehört. Die rein interne Aufteilung eines alten Themas erzeugt keine zusätzlichen Resume-Zustände. V1 wurde nicht ausgerollt; es werden daher keine fiktiven v1-Nutzerzustände migriert.
- **Lernstand:** Attempts werden weiterhin mit Legacy-Quellthema und bisherigem Schlüssel gespeichert. Die Anzeige projiziert IDs auf ihr aktuelles UI-Oberthema. Interne Detailberichte sind davon getrennt; Querverweise erhöhen keine Zähler und keine „beantwortet“-Summen. Historische Daten werden nicht massenhaft umgeschrieben.
- **Analytics:** UIThemenKey für die sichtbare Nutzung; DetailKey nur optional als separate interne Auswertungsdimension. Ein fachlicher Unterpunkt ist kein zusätzlicher Start eines Themas. Alte Aliases bleiben erhalten.
- **Andere Module:** Bestehende topics-/Karteikarten-Endpunkte und die globalen Fachlisten bleiben kompatibel. Keine Änderungen an Quiz, Karteikarten, Lerntexten oder Podcast.
- **Konsistenz:** Katalogversion, Detailgruppen und ID-Zuordnung werden zusammen geprüft und versioniert aktiviert. Eine fehlende UI-Elternzuordnung, ein fachfremder Link oder ein doppelter Pool-Eintrag verhindert die Aktivierung.

Beispiel: Das bisherige Handelsrecht mit R-0576 setzt den Cursor im gesamten sichtbaren Handelsrecht fort. Die interne Detailgruppe R15 ist kein getrenntes Resume-Ziel mehr. Ein fachlicher Querverweis nach HQ ändert weder diesen Pool noch den WQ-Bereich.

## 7. Umsetzung und Rollback bleiben freigabepflichtig

1. Diese Revision mit zehn UI-Themen, 35 internen Gruppen und 800 unveränderten Primärzuordnungen fachlich freigeben. Neue Plan-/Manifesthashes archivieren; keine Freigabe aus v1 unterstellen.
2. Aktuellen Live-Snapshot und Deployment-Abgleich durchführen. Die bisher identifizierten fehlerhaften Index-Zeilenreferenzen bleiben dokumentiert; Schreibziele ausschließlich per Fach + ID und Vorzustandshash bestimmen.
3. In einer isolierten Kopie die getrennten UI-/Detailverträge und den Kompatibilitätsadapter implementieren. Keine Produktivfreigabe allein aufgrund der Prüfungen dieser Planungsdatei.
4. Zehn UI-Einträge, 35 Detailgruppen, 800 Primärzuordnungen und vollständigen Rahmenplankatalog inaktiv vorbereiten. IDs, Inhaltshashes und Altbestände prüfen.
5. Pools, Reihenfolge, Resume, Lernstand und Rückfall testen. BGB Schuldrecht muss genau 174 eindeutige IDs liefern; Unternehmensbezogene Steuern genau 205. Ein Detailbezug darf keine zusätzliche Menüoption erzeugen.
6. Erst nach gesonderter Ausführungsfreigabe die vollständige Version über einen Trainer-Schalter aktivieren. Fachweiser Rollout bleibt empfohlen; nur freigegebene Mappings automatisch importieren.

**Rollback:** Schalter auf die bisherige Ansicht zurückstellen und die kompatible Adapterversion zunächst beibehalten. Quellthemen und Inhalte wurden nicht geändert. Neue Attempts bleiben im Legacy-Schema lesbar. Neue UI-Cursor werden beim Lesen anhand der letzten ID auf das passende alte Quellthema abgebildet, nicht durch pauschales Zurückspielen alter Nutzerstände gelöscht. Metadatenversion als zurückgezogen protokollieren, nicht entfernen. Fachliche Detailkorrekturen führen zu einer neuen Version und verändern nicht automatisch UI-Keys.

## 8. Nachweise und Grenzen dieser Revision

Quellen sind die gespeicherte v1-Planung, deren vollständiger Pilot-Quellenstand, die Analyse-XLSX (Soll-Ist-Matrix, Auffälligkeiten, Trainer-Datenindex) und die zuvor eingelesene [Rahmenplan-Arbeitsgrundlage](https://docs.google.com/document/d/12fJglfNlGTnQ43VqXjepVjR3CwZbT6jEEsJaTwjVRm8/edit). Es erfolgte kein neuer Live-Abruf und keine neue materielle Prüfung der Rechts- oder Steuerinhalte.

| Prüfnachweis | Ergebnis |
| --- | --- |
| Sichtbare Themen | 10, davon Recht 7 / Steuern 3 |
| Interne Detailgruppen | Alle 35 erhalten; keine als UI-Thema sichtbar |
| Bestehende Quellthemen / interne Teilzuordnungen | 24 / 46 |
| Pilot-IDs | 800, davon Recht 567 / Steuern 233 |
| V1-Einzelzuordnungen | Alle bisherigen Felder unverändert; ausschließlich UI-Felder ergänzt |
| Gesamte aktive ID-Menge | 2.686 unverändert, 1.886 außerhalb des Piloten |
| Rahmenplankatalog | 71 Knoten, darunter 70 Inhaltspunkte, kein entfallener Detailpunkt |
| Zusätzliche inaktive / reservierte Pilot-IDs | 117 erhalten |
| Produktive Schreibzugriffe / Commits | 0 / 0 |

Die 38 in v1 dokumentierten Anwendungstests sind historische Evidenz des unveränderten Ausgangscodes, kein Test einer implementierten v2. Die Prüfungen dieser Revision betreffen Plan, Mengenidentität, Zuordnungen, Formelzählungen und Dateiexport. Produktionsverhalten und echte Nutzerhistorien bleiben vor Ausführung zu testen.

| Prüfsumme | SHA-256 |
| --- | --- |
| Unveränderte Analyse-XLSX | d3d779ba41a87452a5e3a11aaa4b831ab79f0372a5141522f2a89114c3707ffa |
| Sortierte Menge aller 2.686 aktiven IDs | 4db3fdeb7b8925c9dfba8dff60ada2c51644a5fbc47a2e737f9e50f4783ea1e6 |
| Revidiertes Planmanifest | e5d99d048be4f2868b6a7054ecc233525f39fb31f0e85475c541060c42cc9b3e |

Das Manifest verweist zusätzlich auf die Hashes der unveränderten v1-Dateien. Die Dateien sind ein nachvollziehbarer Freigabeentwurf; revisionssicherer Betrieb benötigt weiterhin eine geschützte versionierte Ablage sowie dokumentierte fachliche und technische Freigaben.
