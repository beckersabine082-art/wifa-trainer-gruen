# Aggregierte Nutzung – Umsetzung Ausbauweg A

Freigegebene Spezifikation: `docs/aggregate-usage-statistics-analysis.md`, Ausbauweg A, und Folgeauftrag zur vollständigen Umsetzung. Ausführung im vorhandenen separaten Branch `feature/aggregate-usage-statistics`.

## Vertrag und Entscheidungen

- Apps Script, keine Functions, kein Tarifwechsel, keine kostenpflichtige API. GA unverändert.
- Neue POST-Aktionen `usageRecord` und `usageRead`. Hülle `{action, idToken, events}` bzw. `{action, idToken, period}`. Unbekannte Felder werden abgelehnt. Ereignis `{event, subject, area}`; keine Anzahl, kein Datum. Höchstens 10 unterschiedliche Ereignisse pro Meldung. Dimensionen nur feste Kennungen.
- Serverfunktion `usageHandle_(body)` liefert `{success:true}` für Schreiben oder `{success:true,data:{today,period,days:[{date,counts}],totals}}` für Lesen. `counts`/`totals` sind Objekte mit Schlüsseln `event|subject|area`. Fehler liefern nur feste Codes, keine Exception oder Token.
- Ereignisse: `trainer_start`, `quiz_start`, `simulation_start`, `podcast_start`, `learning_text_open`, `flashcards_start`, `glossary_open`, `formulas_open`, `progress_open`, `kilian_open`, `kilian_use`.
- Fächer: `unknown`, `recht`, `steuern`, `rechnungswesen`, `bwl`, `vwl`, `unternehmensfuehrung`, `fuehrung_zusammenarbeit`, `betriebliches_management`, `logistik`, `marketing`, `vertrieb`, `investition_finanzierung`, `rechnungswesen_controlling`, `finance_controlling`. Bereich: `none`, `WQ`, `HQ`; Bereich nur Simulation, Fach bei Öffnungsereignissen `unknown`.
- Firebase-Projektbindung fest `wifa-trainer-gruen`. JWT-Struktur/Projekt/Zeit vorprüfen; die Vertrauensentscheidung erfolgt erst nach erfolgreicher Google-Tokenprüfung mittels `accounts:lookup`. Kontostatus, E-Mail-Bestätigung, UID-Abgleich und Token-Widerruf berücksichtigen. Admin nur anhand autoritativ zurückgelieferter `customAttributes.usageAdmin === true`; fehlende Claims sperren.
- Keine Identifikatoren dauerhaft oder in Missbrauchsschutz-Caches speichern. Globales, unter Lock persistiertes Limit vor Tokenprüfung: 30 Anfragen/Minute, 3000/Tag. Keine Behauptung, gültige künstliche Meldungen ließen sich vollständig verhindern. Limits gelten auch bei Fehlern.
- Private separate Tabelle, eine Zeile pro Tag (Europe/Berlin) mit JSON-Zählern; atomarer Read/Modify/Write unter ScriptLock und Flush. Gesamtwerte aus Tageszeilen, keine doppelten Total-Writes.
- Browser: keine GA-Abhängigkeit, keine Speicherung von Events, keine Retry-Schleife, nur echte bestätigte Anmeldung, 60-Sekunden-Bündelung, maximal 10 unterschiedliche Schlüssel, gleiche Schlüssel pro Bündel einmal. Logout verwirft Warteschlange. Keine Nachsendung fremder Kontoereignisse. Statistikfehler dürfen Lernen nicht behindern.
- Admin-Seite `usage-statistics.html`, Auth aus vorhandener Firebase-Initialisierung, kein eigener Login. 7/30/all, Funktionsrangliste, Fachwerte und Tageswerte. HTML ist öffentlich, Daten sind serverseitig geschützt. Kein Firebase-Lese-/Schreibzugriff für Statistik.
- Aktivierung erst nach privater Backend-Einrichtung und Deployment; Konfiguration bleibt bis dahin geschlossen. Manuelle Konsolenschritte werden im Setup dokumentiert.

## Arbeitspakete

- [x] Backend mit Tests: `backend/apps-script/Usage.gs`, minimale Route in `Code.gs`, `tests/usage-backend.test.js`. Fehlertests zuerst, dann Auth/Quoten/Privatspeicher/atomare Updates implementieren und testen.
- [x] Browser mit Tests: `js/usage-core.js`, `js/usage-client.js`, Zählpunkte, `usage-statistics.html` und Dashboard. Tests für Bereinigung, Deduplizierung, Konto-/Fehlerzustand, Perioden und fachbezogene Summen.
- [x] Einrichtung und Transparenz: Admin-Claim-Helfer, Setup-Dokumentation, Datenschutztexte; keine Änderung der GA-Texte oder Regeln.
- [x] Gesamtprüfung: volle Tests, unabhängiges Security-Review, Diff-Prüfung, Commit und Push; Live-Abnahme getrennt von lokalen Tests kennzeichnen.

## Fortschritt

Plan vor Implementierung geprüft: Backend und Browser teilen ausschließlich obigen Vertrag. Der Server ist maßgeblich für Validierung und Berechtigung. Bestehende GA-Dateien und Firestore-Regeln sind nicht Teil der Schreibmenge. Die rein lokale Deduplizierung ist Komfort, keine Sicherheitsgrenze. Der autorisierte Ausbau wird ohne erneute Designfreigabe ausgeführt.

Lokaler Abschluss: 256 Node-Tests grün; Review-Randfälle durch Tests behoben. Live-Editor anhand Web-App-ID zugeordnet, Router und Modul übernommen. Google-Autorisierung und private Einrichtung abgeschlossen, Backend-Version 94 bereitgestellt, öffentliche deaktivierte Route geprüft. Sammlung bleibt aus; Admin-UID/Berechtigung, echte Live-Token-Abnahme und Frontend-Veröffentlichung stehen aus. Automatische Sicherheitsprüfung blockierte die allgemeine Firebase-Nutzerliste; gezielte Kontowahl durch Betreiber erforderlich.
