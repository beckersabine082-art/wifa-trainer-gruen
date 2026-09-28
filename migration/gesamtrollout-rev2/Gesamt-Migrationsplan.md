# Gesamt-Migrationsplan WiFa-Trainer

Stand: 28.09.2026 · Revisionskennung: **WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE** · Status: **fachlich revidierte Planung, nicht aktivieren**

## Ergebnis und Bilanz

Die Planung umfasst alle neun Rahmenplanfächer. Für die acht verbleibenden Fächer sind **38 sichtbare Oberthemen**, **161 interne Detailgruppen** und **1.886 IDs** vorgesehen. Zusammen mit dem unveränderten Recht/Steuern-Pilot: **48 sichtbare Oberthemen, 196 Detailgruppen und 2.686 eindeutige Primärzuordnungen**. Keine ID fehlt oder ist doppelt primär zugeordnet. Querverweise werden gesondert geführt.

| Bereich | Fach | UI-Themen | Detailgruppen | IDs | Teilabdeckung alt → Plan | Nicht abgedeckt alt → Plan | Entscheidungen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WQ | Volks- und Betriebswirtschaft | 4 | 21 | 283 | 0 → 0 | 0 → 0 | 1 |
| WQ | Rechnungswesen | 5 | 17 | 122 | 8 → 3 | 0 → 0 | 1 |
| WQ | Recht und Steuern | 10 | 35 | 800 | 4 → 4 | 0 → 0 | 0 |
| WQ | Unternehmensführung | 3 | 15 | 235 | 3 → 4 | 1 → 0 | 1 |
| HQ | Betriebliches Management | 4 | 13 | 264 | 9 → 6 | 0 → 0 | 2 |
| HQ | Investition, Finanzierung, betriebliches Rechnungswesen und Controlling | 5 | 26 | 269 | 6 → 4 | 1 → 0 | 2 |
| HQ | Logistik | 5 | 23 | 317 | 2 → 0 | 0 → 0 | 0 |
| HQ | Marketing und Vertrieb | 5 | 22 | 191 | 11 → 7 | 0 → 0 | 1 |
| HQ | Führung und Zusammenarbeit | 7 | 24 | 205 | 0 → 0 | 0 → 0 | 1 |

Teilabdeckungszahlen enthalten wie die Ausgangsanalyse auch betroffene Elternpunkte, aber nicht die Fachwurzeln. Sie sind keine Anzahl benötigter neuer Fragen. Bei den acht Fächern verbleiben sechs geprüfte Teilaspekte sowie drei separat freigegebene Inhaltsüberarbeitungen (VWL-0127, IF-0091, BR-0076). Sie werden durch die Strukturmigration ausdrücklich nicht als erledigt markiert. Pilotbefunde werden nicht neu bewertet.

## Verbindliche Architektur

Fach → sichtbares Oberthema/UI-Key → interne Detailgruppe → Rahmenplanbezug → Trainer-ID.

Die 38 vorgegebenen sichtbaren Namen werden unverändert verwendet. Doppelte Bezeichnungen wie Kosten- und Leistungsrechnung bzw. Spezielle Rechtsaspekte sind fachbezogene Einträge mit unterschiedlichen Keys. Die neuen opaken UI-/Detailkeys im Manifest werden nach Freigabe eingefroren; sie dürfen bei Umbenennung, Sortierung oder erneuter Generierung nicht neu nummeriert werden. Bestehende Pilotkeys bleiben exakt erhalten.

Die Rahmenplanformulierung bleibt interne Referenz; aus ihr werden keine zusätzlichen öffentlichen Detailthemen oder unnötigen wörtlichen Lerntexte erzeugt. Historische Themen sind Alias-/Quellinformationen, keine Optionsquelle.

## Quellenstand und Prüfgrenzen

Die Planung ist ein vollständiger, filterbarer Zuordnungsvorschlag, keine Aktivierungsfreigabe. Die 1.886 neuen Primärzuordnungen wurden aus bestehendem Lernthema, Frage-/Lösungsinhalt und der Soll-Ist-Kandidatenstruktur abgeleitet; gezielte Einzelentscheidungen haben Vorrang. Nicht jeder Vorschlag ist auf den tiefstmöglichen Blattpunkt festgelegt: ein fachlich passender konkreter Unterbereich ist zulässig, während weitere Blattpunkt-Kandidaten gesondert und ungeprüft bleiben. Insbesondere sind weder Routing-Zuordnung noch Kandidatenliste automatisch Abdeckungsbelege. Eine allgemeine rechtliche Aktualitätsprüfung aller Lehrinhalte war nicht Gegenstand. Bücher/Skripte wurden gezielt an Grenzfällen geprüft, nicht vollständig erneut begutachtet. Die Arbeitsgrundlage enthält keine Anwendungstaxonomie; allein eine fehlende zusätzliche Rechen-/Fallfrage begründet daher keine neue Rahmenplanlücke.

Live gelesen: 2026-09-27T20:51:47.223Z, 13 fachliche Quellblätter, A1:O650; Aktivspalten der restlichen Zeilen bis zur tatsächlichen Blattgrenze zusätzlich geprüft: keine weiteren aktiven Datensätze. Nur fachliche Felder wurden im lokalen Lesestand gespeichert; keine Nutzerantworten, Ergebnisse oder Identitäten. Die aktivierte ID-Menge stimmt mit dem vollständigen Trainer-Datenindex überein. Unterschiede der Frageauszüge beruhen auf Rand-Leerzeichen bzw. der 420-Zeichen-Kürzung des Index, nicht auf nachgewiesenen Inhaltsänderungen. Musterlösungsänderungen seit der Ausgangsanalyse sind mangels vollständigem damaligem Nicht-Pilot-Snapshot nicht ausschließbar; die Grenzfallprüfung verwendet deshalb den aktuellen Lesestand. Historische Zeilennummern werden nirgends als Identität benutzt.

Die autoritative Pilotgrundlage ist ausschließlich das Revision-2-Manifest mit zugehörigem MD/XLSX. Der Pilot bleibt in dieser Planung fachlich unverändert; auch seine vier Teilabdeckungen bleiben bestehen. R-0566 behält Primärpunkt 3.1, AT-UI-Key und die freigegebene Reihenfolge.

## Gemeinsames Tabellenkonzept

Keine acht separaten Tabellensätze. Die sechs vorhandenen Tabellen werden versions- und fachbezogen erweitert. A:O der Trainer-Quellblätter bleiben unverändert.

| Tabelle | Geplanter Umfang | Felder/Regeln | Abhängigkeit/Schutz |
| --- | --- | --- | --- |
| Trainer_Themen | 48 logische sichtbare Einträge: 38 neue + 10 Pilot; ausschließlich hieraus Optionen erzeugen | Bestehende 9 Spalten erhalten. Zusätzlich FachKey und QuellfaecherJSON für explizite Quellfach-Allowlist planen. Anzeigename ist kein Schlüssel. Bei mehreren Quellfächern Quellfach nicht mit erfundenem Listenstring befüllen; neue Runtime verwendet FachKey/Allowlist. | Pilotzeilen/Keys nicht umschreiben. Pro Fach aktivierbare Version; kein globaler Ersatz des Pilots. |
| Trainer_Detailgruppen | 196 interne Gruppen: 161 neue + 35 Pilot; UI-Elternkey Pflicht | Zusätzlich FachKey. Quellfach bleibt einzeln; für verschiedene Quellfächer getrennte Detailkeys. RahmenplanPunktKey als interner Gruppenanker, individuelle Primärpunkte in Bezugstabelle. | Kein UI-Fallback aus Detailgruppen. Gruppen nur intern; fehlende Inhalte dürfen ohne zugewiesene IDs in Abdeckung existieren. |
| Trainer_Zuordnung | 2686 eindeutige Primärzuordnungen: 1886 neue + 800 unveränderte Pilot-IDs | Zusätzlich FachKey. Bestehende ID, Quellfach, DetailKey, DetailReihenfolge und UIReihenfolge beibehalten. Vor späterem Write vollständigen A:O-Snapshot und nach stabiler ID geprüften QuellzeilenSHA256 erzeugen. | Der Plan-Lehrinhaltshash ist KEIN A:O-Schreibfreigabehash. Sortierung über UIReihenfolge, niemals physische Sheetzeile. |
| Trainer_Rahmenplanbezug | Eine PRIMAER-Verknüpfung je ID; QUERVERWEIS separat; Belegstatus je Verbindung | FachKey ergänzen. Bestehende Bezugsarten PRIMAER und QUERVERWEIS wiederverwenden, keine neue Runtime-Bezugsart BELEG. Fachlich geprüfte Belege werden über Belegstatus/Begründung an Primär- oder Querverbindung ausgedrückt. | Analyse-Kandidaten bleiben in Abdeckung und sind keine ungeprüften Referenzzeilen. Referenzbelege können mehrere Punkte betreffen, Fragen werden nicht kopiert. |
| Rahmenplan_Abdeckung | 577 Knoten = 568 Inhaltspunkte + 9 Fachwurzeln; Pilot 71 Knoten unverändert | Alle bestehenden Spalten weiterverwenden. FachKey optional ergänzen. Altstatus, neue Bewertung, Belege, Quellen und Prüfhinweis revisionssicher dokumentieren; Detailindex statt erfundener offizieller Nummer. | Elternstatus aus Kindern, nicht umgekehrt; keine Vollständigkeit aus Poolgröße. Auditdaten bleiben außerhalb des Hot-Paths. |
| Trainer_Migrationen | 8 vorbereitete Fachmigrationen; Pilot-Migration bleibt erhalten | Zusätzlich FachKey/Scope planen. MigrationID, Version, Vorversion, Hashes, Freigabe, Laufstatus und Rückfallversion pro Fach eindeutig. Globaler Release fasst freigegebene Fachmanifeste zusammen. | Jeder Request prüft aktuellen Fach-/Migrationsstatus frisch. Rollback überschreibt Cachezustand sofort. Keine Nutzerleistungen zurücksetzen. |

### Fach versus Quellfach

Volks-/Betriebswirtschaft verwendet BWL und VWL; Investition/Finanzierung/Controlling verwendet zwei bisherige Quellfächer; Marketing/Vertrieb verwendet Marketing und Vertrieb. FachKey steuert den gemeinsamen Katalog. Quellfach bleibt für das Lesen der Frage, historische Leistungsschlüssel und Analytics erhalten. Insbesondere IF-0091 wird im gemeinsamen HQ-Fach im KLR-Pool vorgeschlagen, ohne seine Quelle zu verschieben. Detailgruppen bleiben jeweils einem Quellfach zugeordnet; UI-Pools dürfen nach expliziter Allowlist mehrere Quellen aggregieren.

## Fachliche Neubewertung der offenen Punkte

Die vollständige Alt-/Neu-Bewertung sämtlicher 41 bislang teilweise/nicht abgedeckter Inhaltspunkte steht in Gesamtplanung.xlsx (Befundprüfung), einschließlich vererbter Elternbefunde. Die 19 einzeln geprüften Sachfragen sind in luecken-pruefung.json und den Fachübersichten belegt. Wichtigste Änderungen:

- KLR-Aufgaben BR-0037 und Auswertungsadressaten BR-0112 sind bereits ausdrücklich vorhanden.
- BR-0076 enthält Kostenträgerzeitrechnung; verbleibender Bedarf ist fachliche Präzisierung, kein leerer Bestand.
- BM-Kennzahlen/Vergleiche entsprechen dem Skriptabschnitt Betriebsstatistik. Planung/OE/PE ist verteilt vorhanden; zwei spezielle PE-Verknüpfungen bleiben offen.
- Private Darlehen sind durch IF-0152 als Gesellschafterdarlehen teilweise vertreten. Förderdarlehen, Bankdarlehen und Kontokorrent dürfen nicht wegen dieses Geschwisterpunkts ebenfalls unvollständig sein.
- L-0248 und L-0286 decken die vermeintlich fehlenden Vertragsformen verteilt ab.
- Produktlebenszyklus, Portfolio, Branchenstruktur und Erfahrungskurve haben eigenständige Belege; die Lücke Konkurrenzanalyse darf diese vier Unterpunkte nicht herabstufen.

### Offene Inhaltsmaßnahmen

| Punkt | Vorhandene Teilbelege | Fehlender Inhalt | Spätere Maßnahme |
| --- | --- | --- | --- |
| 5.2.3.3#2 | BM-0146; BM-0147; BM-0260 | Explizite Ableitung veränderter Positionsanforderungen aus einer konkret gewählten OE-Strategie fehlt weiterhin. | BM-0260 später um Strategieänderung und Ableitung künftiger Anforderungen erweitern; alternativ eigener Fall nach Freigabe. |
| 5.2.3.4#4 | BM-0140; BM-0141; BM-0152; BM-0154 | Interne Auslegung freigegeben: „strategischer Kompetenzaufbau und künftige Rollenbesetzung“. Der strategische Zweck bleibt gegenüber Laufbahn-/Nachfolgeförderung nur indirekt erkennbar. | BM-0154 später um strategische Zielrolle, Kompetenz-/Potenzialabgleich und begründeten Entwicklungsweg ergänzen. Die interne Auslegung ist keine wörtliche DIHK-Definition. |
| 6.2.2.1#3 | IF-0152 | Die Abgrenzung zu privaten Geldgebern außerhalb des Gesellschafterkreises fehlt ausdrücklich; deshalb Teilbeleg, kein Leerbefund. | IF-0152 später unter derselben ID um allgemeine private Darlehensgeber und die Abgrenzung zum Gesellschafterdarlehen erweitern. Keine zusätzliche ID erzeugen. |
| 8.1.3.2#4 | M-0020; M-0021; M-0027 | Ein systematisches Einzelwettbewerberprofil einschließlich Zielen, Strategien, Stärken/Schwächen, Instrumenteneinsatz und Reaktionsprofil fehlt als vollständiger Zusammenhang. | M-0021 später unter derselben ID um ein vollständiges Wettbewerberprofil ergänzen; nicht lediglich einen neuen Titel vergeben und keine neue ID automatisch erzeugen. |
| 8.5.3.1 | V-0040; V-0077 | Der Vertragstyp und der Zusammenhang von Mängelrechten und Nacherfüllung bleiben im HQ-Bestand nicht vollständig ausdrücklich. WQ-Recht-Belege dürfen den HQ-Bestand nicht als eigene Abdeckung ersetzen. | V-0077 später unter derselben ID um Vertragstyp sowie Mängelrechte/Nacherfüllung ergänzen; Rechtsstand vor Veröffentlichung prüfen. Keine Kopie von R-IDs und keine zusätzliche ID automatisch erzeugen. |

Zusätzliche, separat offene Überarbeitungen:

| Trainer-ID / Punkt | Status | Verbleibende fachliche Inhaltsmaßnahme |
| --- | --- | --- |
| VWL-0127 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | Haftungs- und Verwaltungsaufwandsaussagen später fachlich präzisieren. |
| BR-0076 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | Zeitrechnung nicht pauschal vergangenheitsorientiert und Stückrechnung nicht als alleinige Gewinnermittlung darstellen. |
| IF-0091 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | Entscheidungsrelevante bzw. vermeidbare Fixkosten später ausdrücklich klarstellen. |
| UF-0058; UF-0198 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | UF-0058 später unter derselben ID um eine Darstellungs-/Interpretationskomponente mit Rollen, Übergaben und Rückschleife ergänzen. Keine neue ID automatisch erzeugen. |
| BM-0146; BM-0147; BM-0260 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | BM-0260 später um Strategieänderung und Ableitung künftiger Anforderungen erweitern; alternativ eigener Fall nach Freigabe. |
| BM-0140; BM-0141; BM-0152; BM-0154 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | BM-0154 später um strategische Zielrolle, Kompetenz-/Potenzialabgleich und begründeten Entwicklungsweg ergänzen. Die interne Auslegung ist keine wörtliche DIHK-Definition. |
| IF-0152 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | IF-0152 später unter derselben ID um allgemeine private Darlehensgeber und die Abgrenzung zum Gesellschafterdarlehen erweitern. Keine zusätzliche ID erzeugen. |
| M-0020; M-0021; M-0027 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | M-0021 später unter derselben ID um ein vollständiges Wettbewerberprofil ergänzen; nicht lediglich einen neuen Titel vergeben und keine neue ID automatisch erzeugen. |
| V-0040; V-0077 | SPÄTERE INHALTSMASSNAHME – NICHT DURCH STRUKTURMIGRATION ERLEDIGT | V-0077 später unter derselben ID um Vertragstyp sowie Mängelrechte/Nacherfüllung ergänzen; Rechtsstand vor Veröffentlichung prüfen. Keine Kopie von R-IDs und keine zusätzliche ID automatisch erzeugen. |

Kein neuer Datensatz wird allein durch diese Maßnahmen erzeugt. Neue Inhalte werden erst in separater Inhaltsfreigabe ergänzt. Für die reine Strukturmigration bleibt die ID-Sollsumme 2.686.

## Freigegebene Entscheidungen

| ID | Status | Fachcode | Trainer-IDs | Grenzfall | Freigegebene Entscheidung | Verbleibende Abhängigkeit |
| --- | --- | --- | --- | --- | --- | --- |
| E01 | FREIGEGEBEN | 1 | VWL-0127 | Auslandsgesellschaft versus Zweigniederlassung | Primär 1.3.3.2; Rechtsformvergleich und Außenwirtschaft bleiben Querverweise. Haftungs- und Verwaltungsaufwandsaussagen später fachlich präzisieren. | Separate Inhaltsmaßnahme; kein Strukturblocker |
| E02 | FREIGEGEBEN | 2 | BR-0076 | Kostenträgerzeit- und Stückrechnung | Primär 2.3.4.1 beibehalten; Zeitrechnung nicht pauschal vergangenheitsorientiert und Stückrechnung nicht als alleinige Gewinnermittlung darstellen. | Separate Inhaltsmaßnahme; kein Strukturblocker |
| E03 | FREIGEGEBEN | 6 | IF-0091 | Make-or-Buy im Quellfach Investition und Finanzierung | Primär 6.4.1.2; Originalquelle bleibt erhalten. Entscheidungsrelevante Fixkosten später ausdrücklich klarstellen. | Separate Inhaltsmaßnahme; Mehrquellenadapter technisch testen |
| E04 | FREIGEGEBEN | 9 | PF-0194; PF-0195; PF-0196; PF-0197 | Personalmarketing und Potenzialdiagnostik | PF-0194 ergänzend 9.4.1 ohne direkten Abdeckungsbeleg; PF-0195/0196 9.4.2.1; PF-0197 9.4.3. | Kein Strukturblocker; Belegrollen technisch getrennt führen |
| E04b | FREIGEGEBEN | 5 | PF-0202; PF-0203 | Personalbedarfs- und Projektkapazitätsplanung | PF-0202 primär 5.1.4; PF-0203 primär 5.4.3.2. Quellblatt, ID und historische Leistungen unverändert. | Kein Strukturblocker; Quellfachadapter technisch testen |
| E05 | FREIGEGEBEN | 4 | UF-0058; UF-0198 | Arbeitsablaufdiagramm | Teilabdeckung statt Leerbefund; Darstellungs-/Interpretationskomponente später in UF-0058 ergänzen. | Separate Inhaltsmaßnahme; keine neue ID automatisch |
| E06 | FREIGEGEBEN | 5 | BM-0260; BM-0154 | OE-Strategie und strategische Positionierung | BM-0260 später mit strategischer Herleitung ergänzen; interne Auslegung für BM-0154: strategischer Kompetenzaufbau und künftige Rollenbesetzung. | Separate Inhaltsmaßnahmen; keine wörtliche DIHK-Definition behaupten |
| E07 | FREIGEGEBEN | 8 | M-0021; V-0077 | Konkurrenzanalyse und Verbrauchsgüterkauf | M-0021 um Einzelwettbewerberprofil, V-0077 um Vertragstyp sowie Mängelrechte/Nacherfüllung erweitern. | Separate Inhaltsmaßnahmen; Rechtsstand vor Veröffentlichung prüfen |
| E08 | FREIGEGEBEN | 6 | IF-0152 | Private Darlehen | Allgemeine private Geldgeber und Abgrenzung zum Gesellschafterdarlehen später in IF-0152 ergänzen. | Separate Inhaltsmaßnahme; keine neue ID automatisch |

Die alten Dublettenhinweise bleiben als Prüfhinweise bestehen (Workbook: Altfunde). Kein Löschen, Zusammenlegen von IDs oder inhaltliches Umschreiben. Themen dürfen zusammengeführt werden, ohne Datensätze zusammenzuführen. Querverbindungen zwischen WQ und HQ ersetzen niemals die Abdeckung des jeweils anderen Bereichs.

## Technische Wiederverwendung – festgestellte Grenzen

Read-only geprüft am Pilot-Worktree, Commit 35a4e23f03674f916558956baa2467c3938dca33. Die Performance-/Kompatibilitätsarchitektur ist wiederverwendbar, aber noch nicht generisch:

- backend/apps-script/Code.gs: ab Zeile 254 feste Pilotversion und nur Recht/Steuern-Cacheteile; ab Zeile 487 Validator mit 10/35/800, nur WQ und identischem Quellfach entlang der Hierarchie. Diese Verträge künftig pro freigegebenem Fachmanifest validieren, nicht ersatzlos entfernen.
- js/trainer.js: um Zeile 164 ausschließlich Recht/Steuern als Pilotfächer; erwartete UI-/Count-Verträge. FachKey-basierter Aktivierungs-/Katalogvertrag muss ergänzt werden. Keine gemeinsame Fachliste anderer Lernmodule ändern.
- Poolquelle künftig Trainer_Zuordnung + Detail→UI-Elternkey; gesamte erlaubte Quellfachmenge des Oberthemas laden/indexieren. Nicht über alte Themennamen filtern.
- CacheService bleibt Performance-Schicht. Versionierte, validierte, begrenzte Metadaten-Chunks pro Fach; Cachemiss/-korruption rekonstruiert aus Tabellen. Migrationstatus bei jedem Request frisch. Keine Lernstands-/Resume-/Firebase-/Analytics-Daten in gemeinsamem Cache.
- Frontend-Poolcache mindestens Version + FachKey + UI-Key. Verwerfen bei Versions-/Kontextwechsel, Rollback und Logout. Vor/Zurück innerhalb des geladenen Pools ohne erneutes Laden statischer Zuordnung.
- Alte Fach-/Themenkombinationen können mehrere neue UI-Keys haben: ID löst eindeutig auf; ohne ID keine automatische Erstwahl. Inaktives Fach darf Legacy nutzen; aktives fehlerhaftes Fach muss fail-closed bleiben.
- Lernstand und Analytics behalten Original-ID/Quellfach. Das Anzeigen eines gemeinsamen Faches darf weder Leistungen verlieren noch doppelt zählen.

## Umsetzung nach gesonderter Freigabe

1. Revidiertes Zuordnungsmanifest als technische Grundlage freigeben; alle separaten Inhaltsbaustellen ausdrücklich offen und außerhalb des Strukturrollouts behalten.
2. Frischen Live-Stand aller Quellen und sechs Metadatentabellen lesen; Snapshot geschützt speichern, ID-Mengen/Quellfach/Lehrinhaltshashes vergleichen. Vollständige A:O-Prüfsummen erst im geschützten Migrationslauf berechnen. Bei unerwarteter Abweichung abbrechen.
3. Generischen Fachadapter, scopebezogene Gates und Legacyauflösung im isolierten Branch implementieren; keine Fremdmodule ändern.
4. Neue Tabellenzeilen zunächst INAKTIV schreiben, alte Pilotzeilen unverändert lassen. Schemaänderungen append-only, Legacyspalten erhalten.
5. Alle Gates sowie Integrations-, Sicherheits- und Performancetests im Staging bestehen.
6. Fachweise Aktivierung innerhalb eines gemeinsamen technischen Releases: zuerst eindeutige Quellen (Logistik), dann bestätigte WQ-Fächer, danach BM/HQ-Mehrquellen und Führung nach Entscheidung. Reihenfolge ist Vorschlag, keine Freigabe.
7. Pro Fach Katalog/Poolzahlen, Resume, Lernstand, Analytics und Rollback prüfen; erst anschließend nächste Aktivierung. Keine ungeprüfte atomare Vollaktivierung aller acht Fächer.

| Gate | Bereich | Nachweis |
| --- | --- | --- |
| G01 | ID-Menge | Live-IDs, Plan-Primär-IDs und freigegebene Sollmenge identisch; genau 2686 / 800 / 1886. |
| G02 | UI-Vertrag | Genau 48 sichtbare Optionen, je Fach 4/5/10/3/4/5/5/5/7; nur aktive Trainer_Themen. |
| G03 | Poolpartition | Je Fach Summe Poolgrößen = eindeutige Fach-IDs; jedes Paar sichtbarer Pools disjunkt; Sollzahlen aus Oberthemen-Tabelle. |
| G04 | Interne Gruppen | Alle Detailkeys haben gültigen Elternkey; kein Detail-/Legacyname taucht als zusätzliche Option auf. |
| G05 | Pilotisolierung | 800 Pilot-Primärpunkte, 35 Detailgruppen, 10 UI-Keys und beide Reihenfolgen gleich Rev2. R-0566 nur unter AT erreichbar, kein 3.1.1-Abdeckungsbeleg. |
| G06 | Quellenidentität | Datensatz über Teilbereich + Quellfach + ID laden; Quellfach nicht durch neues Fachlabel ersetzen. A:O byte-/zellwertgleich vor/nach Migration. |
| G07 | Historischer Resume | Alter Fach-/Themenname + aktuelle ID löst den neuen UI-Key auf. Bei aufgeteilten Themen ohne ID keine willkürliche erste Zuordnung: geführte Neuauswahl. |
| G08 | Lernstand/Analytics | Bestandsleistungen über kanonische ID erhalten; historische Aliase lesbar; Events enthalten UI-Key, Original-ID und Quellfach. Kein doppeltes Zählen bei Querverweisen. |
| G09 | Cache | Version + FachKey + UI-Key im Poolcache; gemeinsamer Servercache nur statische Zuordnung, validiert, begrenzt/chunkweise, keine Nutzeridentität. Cachemiss/-korruption baut kontrolliert neu auf. |
| G10 | Rollback | Frische Trainer_Migrationen-Prüfung vor Cachezugriff; Fachweise Legacyansicht reaktivieren und Version wechseln. Neu entstandene Leistungen bleiben per ID lesbar. |
| G11 | Sicherheit/Scope | Keine zusätzlichen generischen Schreib-APIs; Quiz, Karteikarten, Lerntexte, Podcast und Produktion 114 außerhalb dieses Plans. |
| G12 | Performance | Cold-like + wiederholt Median für Katalog, größten/kleinsten Pool, Resume und Vor/Zurück messen. Auditblätter nicht im Standard-Request lesen. |

## Rollback

Migrationstatus des betroffenen Fachs auf freigegebene Rückfallversion/Legacy setzen; niemals A:O oder Leistungstabellen aus einem alten Backup überschreiben. Der Server liest den Status frisch, Client verwirft versionsgebundene Pools. Alte Themen bleiben in A:O sowie QuellthemaAlt vorhanden. Neue Nutzerleistungen werden über Original-ID/Quellfach und Aliasauflösung weiter sichtbar. Wiederaktivierung nutzt das unveränderte freigegebene Manifest. Test: nach neuer Leistung und Resume einen Fachrollback auslösen und denselben Leistungsdatensatz über Legacy lesen; danach wieder aktivieren und Zähler/ID unverändert bestätigen. Pilotrollbacks dürfen andere Fachscopes nicht umschalten.

## Rollout-Empfehlung

**Ein gemeinsamer technischer Rollout ist sinnvoll, eine blinde automatische Aktivierung aller acht Fächer nicht.** Die fachlichen Primärentscheidungen sind übernommen; vor Aktivierung sind weiterhin der Mehrquellenadapter und die Fachgates technisch zu testen. Die übrigen Inhaltslücken können im Strukturrollout offen gekennzeichnet bleiben; sie dürfen weder durch erfundene Fragen noch durch Querverweis-Kopien kaschiert werden. Jede Aktivierung braucht ein eigenes Fachgate.

## Lieferumfang und Nachweis

- Gesamtplanung.xlsx: filterbare Übersichten, alle Einzel-IDs, Gruppen, 577 Abdeckungsknoten, 41 Altbefunde, Lücken, Entscheidungen, Altfunde, Querverweise, ID-Bilanz und Tabellenkonzept.
- Fachuebersichten/: neun MD-Dateien mit beiden geforderten Fachtabellen (Pilot nur Referenz).
- Einzel-ID-Zuordnung.csv, Interne-Detailgruppen.csv, Rahmenplan-Abdeckung.csv sowie Gesamtplanung.json zur revisionssicheren Weiterverarbeitung.
- Pruefprotokoll.json und Quellenregister/Hashes; keine Aktivierungsdatei und keine ausführbare produktive Migration.

Keine produktiven Sheet-/Anwendungscodeänderungen, kein Commit, Deployment, Merge oder Push in dieser Phase. Die Revisionsartefakte sind eine technische Rolloutgrundlage, keine Inhaltsfreigabe für die offenen Maßnahmen.
