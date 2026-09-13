# Qualitäts-, Konsistenz- und Funktionsaudit der Prüfungssimulation

Datum: 13.09.2026. Ausgangscommit: `bed5f9e`. Branch: `feature/aggregate-usage-statistics`.

## Umfang und Nachweise

Alle 24 auswählbaren Einheiten geprüft. 22 Einheiten enthalten zusammen 356 Teilaufgaben und jeweils 100 Punkte. HQ Simulation 4 A1/A2 sind sowohl lokal als auch im aktuell lesend abgerufenen Sheet-Endpunkt leer. Keine fehlenden Aufgaben innerhalb der 22 belegten Einheiten, keine doppelten zusammengesetzten IDs, keine unbeabsichtigten identischen Frage/Fallsituation-Paare und keine Reihenfolgelücken gefunden. Gleiche Fragen in unterschiedlichen Fällen (etwa Rechtsformen) sind beabsichtigt.

Eine Teilaufgabe wird eindeutig durch `simulationId | fach | aufgabe | teilaufgabe` identifiziert; eine Hauptaufgabe durch dieselbe Kombination ohne Teilaufgabe. Einzelne Quellnummern sind Strings, andere Zahlen; der Ablauf vergleicht sie normalisiert. Eine neue ID-Struktur wurde nicht eingeführt.

| Simulation | WQ Rechnungswesen | WQ Recht/Steuern | WQ Unternehmensführung | WQ VWL/BWL | HQ A1 | HQ A2 |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 14 / 100 | 15 / 100 | 13 / 100 | 16 / 100 | 14 / 100 | 29 / 100 |
| 2 | 15 / 100 | 17 / 100 | 11 / 100 | 14 / 100 | 18 / 100 | 28 / 100 |
| 3 | 15 / 100 | 19 / 100 | 12 / 100 | 12 / 100 | 17 / 100 | 23 / 100 |
| 4 | 11 / 100 | 15 / 100 | 11 / 100 | 17 / 100 | 0 / 0 | 0 / 0 |

Zellen: Teilaufgaben / Maximalpunkte. Hauptaufgabenpunkte ergeben sich ausschließlich aus ihren vorhandenen Teilaufgaben; es gibt kein widersprüchliches zweites Hauptaufgaben-Punktefeld. Die 100-Punkte-Beschriftung der leeren HQ4-Auswahl ist die vorgesehene Prüfungsstruktur, keine tatsächlich verfügbare Prüfung. Diese Einheiten starten jetzt keinen Timer.

Vollständige Fachprüfungen und Rechenprotokolle:

- [172 WQ-Aufgaben ohne Rechnungswesen](audit-wq-review.md)
- [55 Rechnungswesen-Aufgaben](audit-rewe-review.md)
- [129 HQ-Aufgaben und zwei leere HQ4-Einheiten](audit-hq-review.md)
- [Aktueller lesender Sheet-Abgleich aller 24 Einheiten](audit-sheet-abgleich.json)

## Fachliche Korrekturen

Nur identifizierte Felder wurden verändert; vollständige Vorher-/Nachher-Belege stehen in `tests/fixtures/pruefungssimulation-audit-korrekturen.json`.

- WQ Recht SIM4 4c: Bei der erst erwogenen UWG-Klage gegen UrbanRide AG in Essen ist aufgrund der Zuständigkeitskonzentration das LG Bochum zuständig. Lösung additiv richtiggestellt und Kriterium angepasst. [§ 24 JuZuVO NRW](https://recht.nrw.de/lrgv/rechtsverordnung/01032026-justizzustaendigkeitsverordnung-juzuvo/).
- WQ Recht SIM3 5b: Die Umsatzsteuer-Sondervorauszahlung ist bei monatlicher Voranmeldung grundsätzlich jährlich, nicht monatlich zu entrichten. [§ 47 UStDV](https://www.gesetze-im-internet.de/ustdv_1980/__47.html), [§ 48 UStDV](https://www.gesetze-im-internet.de/ustdv_1980/__48.html).
- WQ Recht SIM2 3d: Das Kriterium verlangt jetzt sechs Monate ohne Arbeitsunfähigkeit wegen derselben Krankheit statt Krankheitsfreiheit. [§ 3 EntgFG](https://www.gesetze-im-internet.de/entgfg/__3.html).
- WQ VWL SIM1 3a: Governance ist Unternehmensführung, nicht pauschal Unternehmensziele. SIM1 6b: Selbstständigkeit des Erwerbers ergänzt und in der Bewertung berücksichtigt.
- HQ SIM1: 35 % Eigenkapitalquote implizieren FK/EK = 65/35 = rund 1,86, nicht 1,7. Beide Hauptsituationen berichtigt. Der gesonderte Rechendatensatz in A2 Aufgabe 2 ist ausdrücklich abgegrenzt.
- HQ SIM2 A2 3c und SIM3 A2 3b: Die verlangte Vorzeichenkonvention ist jetzt schon in der Frage verfügbar, nicht erst in der Lösung.
- HQ SIM2 A2 6a: Geforderte tabellarische Nutzwert-Herleitung additiv vervollständigt. SIM2/SIM3 A2 3a: variable Koeffizienten dimensionsrichtig in €/Std. ergänzt.
- HQ SIM3 A2 2b: Vergleichssumme führt die in 2a bereits korrigierte Schlussrate fort: 2.183.545,46 € bei der dort verwendeten gerundeten Ratenvariante; alternative Rechnung ohne vorzeitige Rundung ausdrücklich erklärt. Finanzierungsentscheidung unverändert.
- WQ Rechnungswesen SIM4: Mengen-/Bestandsannahmen für Aufgaben 3 und 4 offengelegt, damit die vorhandenen Lösungen aus den Aufgabenangaben herleitbar sind.
- Weitere einzelne Kriterien übernehmen bereits vorhandene fachliche Einschränkungen: keine pauschal bewiesene Überliquidität, fallabhängige Kennzahlenurteile, Voraussetzungen der Spediteurhaftung/Schadensanzeige, zulässige Rundung und 50-/52-Wochen-Alternative.

Keine neue falsche WQ-Rechen-Endsumme gefunden. Rechenwege, Rundung und Einheiten wurden nachgerechnet; bereits früher richtiggestellte Altfehler werden nicht als neue Fehler gezählt. Wegen des ausdrücklich verlangten Texterhalts stehen falsche Ursprungssätze teils weiterhin vor einer expliziten Richtigstellung. Keine bestehende Musterlösung und keine frühere Ergänzung wurde gekürzt.

## Punkte und Bewertungskriterien

Keine Änderung an den 356 Maximalpunktwerten oder an den Gesamtsummen. Dagegen wurden **112 Rubrikfehler** nachgewiesen: 49 HQ, 60 WQ ohne Rechnungswesen, 3 Rechnungswesen. Die bisherige Formel zählt semikolongetrennte Kriterien gleichgewichtet und rundet. Alternative Beispiele, doppelte Inhalte oder zusammengefasste Pflichtgruppen führten damit zu falschen Punkten.

Beispiele: Vier zulässige erläuterte Auswahlkriterien in HQ1 A1 1c ergaben nur `round(4/7 × 4) = 2` statt 4 Punkten. Zwei Kritikpunkte in HQ2 A2 1b ergaben `round(3/5 × 2) = 1` statt 2. Umgekehrt konnten drei überlappende Stichpunkte zu nur einem Kritikpunkt in HQ1 A2 5c bereits volle 2 Punkte auslösen.

Die betroffenen Rubriken zählen jetzt die von der jeweiligen Aufgabe verlangten unabhängigen Antwortbestandteile. Dadurch ändern sich gezielt Kriterienzahlen, **nicht** die bestehende Punkteformel. Die Diagrammkriterien und ihre bisherige Teilpunkteverteilung sind unverändert. Die Originalbeispiele bleiben vollständig in den Musterlösungen stehen.

Alle 112 Fälle besitzen einen konkreten fachlich geprüften Antwortzeugen, Alt-Trefferzahl, Alt-Punktzahl und Soll-Punktzahl in `audit-hq-kriterien.json`, `audit-wq-kriterien.json`, `audit-rewe-kriterien.json`. Diese Belege prüfen die deterministische Rechnung unter der dokumentierten semantischen Kriterienbelegung; sie sind **keine protokollierten Live-KI-Urteile**. Zwölf besonders komplexe neue Rubriken wurden zusätzlich unabhängig gegengelesen.

Zusammen mit 14 gezielten fachlichen Kriterienpräzisierungen wurden 126 Rubriken korrigiert. Insgesamt betreffen die dokumentierten Feldkorrekturen 134 unterschiedliche Teilaufgaben. Das ist keine stilistische Überarbeitung: Jede Änderung gehört zu einem einzeln belegten Fehler; Fragen und Lösungen wurden nur punktuell ergänzt.

## Technischer Ablauf und Skizzen

Behobene Fehler:

1. Leere/unvollständige Diagrammaufgaben blockierten die gesamte Abgabe. Sie werden nun abgegeben und entsprechend bewertet; unbeantwortet zuverlässig 0 Punkte.
2. Beide vorhandenen Diagrammfragen verlangen nur die Zeichnung. Die Bewertung erzwang trotzdem eine zusätzliche Beschreibung. Diese wird nun nur bei entsprechendem Operator verlangt. Das Bild wird weiterhin an die fachliche Bewertung übergeben; Pixelpräsenz, Mustertext und textlicher Fallback ersetzen keine korrekte Skizze.
3. Leere Prüfungen starteten einen Timer. Auswahlwechsel ließen alte Timer/Aufgabendaten stehen. Der Zustand wird jetzt beim Wechsel verworfen; verspätete Ladeantworten überschreiben keine neue Auswahl.
4. Mehrfachklicks konnten parallele Auswertungen starten. Ein laufender Versuch wird nun nur einmal ausgewertet. Eine leere Ergebnisansicht wird nicht erneut abgegeben.
5. Die Prüfungsauswahl konnte während der Auswertung die spätere Speicherzuordnung verändern. Selects und der WQ/HQ-Menü-Einstieg sind während der Auswertung gesperrt.
6. Nach Zeitablauf waren Tabellenfelder und Skizzen weiter bearbeitbar. Tabellenfelder und Zeichenflächen werden jetzt gesperrt. Die Zeichenflächensperre bleibt unabhängig von bloßer Hin-/Zurücknavigation.
7. Ersetzen einer Zeichnung durch die Achsenvorlage behielt fälschlich das Merkmal „eigene Zeichnung“. Es wird jetzt zurückgesetzt; erst tatsächliches Zeichnen setzt es wieder.
8. Auch der Fachwechsel verwirft nun alte Aufgaben, bevor sie unter einer abweichenden Auswahl abgegeben werden könnten. Ein neu gestarteter Timer entfernt außerdem die alte Ablaufmeldung.

Der Browsertest nutzt echtes Edge/Chromium, die reale HTML-Seite, echte Select-/Button-Bedienung und den lokalen Apps-Script-Bewertungscode. Alle 24 Einheiten werden angewählt und geladen. Alle 22 belegten Prüfungen werden jeweils zweimal vollständig abgegeben: leer sowie mit allen Text-Musterantworten (Diagramme dabei leer). Ergebnisse sind 22-mal 0/100 und im zweiten Lauf 100/100 bzw. bei den zwei Diagrammprüfungen 94/100. Alle 356 Antwortschlüssel, vollständigen Musterlösungen und Speicherpayloads werden zugeordnet. Tatsächliche externe Speicherung ist im Test abgefangen; keine Nutzer-Lernstände wurden geschrieben.

## Lokaler Katalog, Sheet und Synchronisation

Der Wechsel auf den lokalen Katalog stammt aus Commit `11f6553`: Die redaktionell ergänzten Prüfungslösungen sollten nutzbar werden, ohne das Google Sheet umzuschreiben. `bed5f9e` stellte danach fallbezogene Gesellschaften/Rechtsformen wieder her. Die Simulation lädt ausschließlich `data/pruefungssimulation/katalog.json` und fällt bei Fehlern nicht auf ältere Sheet-Fragen zurück. Trainer und Lerntexte behalten ihre eigenen Quellen; Bewertung/Speicherung laufen weiterhin über die bestehenden Schnittstellen.

Im jetzigen read-only GET-Abgleich stimmen in allen 24 Einheiten IDs, Reihenfolge und Punkte mit der Quelle überein. Alle 356 ursprünglichen Sheet-Musterlösungen stimmen weiterhin mit den gespeicherten ursprünglichen Hashes überein. Die lokalen Ergänzungen und aktuellen Korrekturen stehen damit nicht automatisch im Sheet. Der Abgleich hat keine Quellfelder geschrieben.

Risiko: Sheet-Änderungen erreichen die Simulation nicht automatisch. Ein blindes Überschreiben des Katalogs würde umgekehrt seine Korrekturen verlieren. Die bestehenden Hash-Tests sichern Erhalt, sind aber kein laufender Drift-Monitor.

Nur dokumentierte Strategie, **nicht implementiert**: Quellrevision/Datum festhalten; regelmäßig einen ausschließlich lesenden Export mit denselben zusammengesetzten IDs vergleichen; neue/gelöschte Aufgaben, Punkte, Fallangaben und Lösungstexte als Diff prüfen; redaktionelle lokale Korrekturen bewusst zusammenführen; Katalogrevision erst nach Fachreview und Tests veröffentlichen. Eine verbindliche redaktionelle Hauptquelle und Zuständigkeit sollten vor einer automatischen Synchronisation festgelegt werden.

## Grenzen und ausdrücklich offene Punkte

- HQ4 A1/A2 bleiben leer. Es wurden keine neuen Prüfungen erfunden.
- Die beiden Diagramm-Musterlösungen beschreiben fachlich die Zeichnung, bieten aber keine separate grafische Musterabbildung. Das ungenutzte Alt-HTML von VWL1 1a enthält zudem eine geometrisch falsche Gleichgewichtsmarkierung. Es wird nicht angezeigt und nicht zur Bewertung herangezogen. Eine neue grafische Lösungsdarstellung wurde entsprechend „keine neuen Features“ nicht eingebaut; der Befund ist im WQ-Review dokumentiert.
- Die Live-Bildinterpretation eines externen KI-Modells wurde nicht als deterministisch richtig zertifiziert. Tests prüfen Bildübergabe, Pflichtbestandteile, Ablehnungspfad und unveränderte Punkteverteilung mit kontrollierten Modellantworten.
- Kein verbindlicher externer Original-Erwartungshorizont liegt vor, anhand dessen andere ursprünglich beabsichtigte Teilpunktgewichte behauptet werden könnten.
- Änderungen an `backend/apps-script/Code.gs` werden committet/gepusht, aber nicht automatisch in der aktiven Apps-Script-Web-App veröffentlicht. Ein Git-Push ist kein Apps-Script-Deployment; dieses war nicht beauftragt.

## Verifikation

Regressionen wurden zuerst im fehlschlagenden Zustand ausgeführt, danach behoben. Die unveränderte Bestandsfixture wird nicht neu gehasht: Nur exakt dokumentierte Auditänderungen werden für den historischen Vergleich rückgängig gemacht. Damit bleibt jedes Zeichen sämtlicher ursprünglicher Lösungen und aller 164 früheren Ergänzungen geschützt.

Reproduzierbarer Gesamtlauf (PowerShell, mit gebündeltem Playwright im `NODE_PATH`):

```powershell
node --test 'tests/*.test.js' 'tests/*.test.cjs' 'tests/*.test.mjs'
git diff --check
```

Abschließender Gesamtlauf: **458 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen**, einschließlich aller Browser-, Backend-, Katalog- und neuen Rubrikregressionen. Laufzeit rund 19,3 Sekunden. `git diff --check` ohne Beanstandungen. Commit-/Push-Nachweis steht in der Abschlussmeldung und der Git-Historie.
