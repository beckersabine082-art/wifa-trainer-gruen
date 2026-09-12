# Aggregierte Nutzungsstatistik: Architekturprüfung

**Historischer Analysestand vor Umsetzung.** Die anschließend beauftragte Implementierung und die noch erforderliche Live-Einrichtung sind in [aggregate-usage-setup.md](aggregate-usage-setup.md) beschrieben.

Stand: 12. September 2026. Untersuchte Basis: `6261498f975cb5e29b00b29c291d3405a55d101e`, nach Abruf identisch mit `origin/main`. Der vorhandene Analytics-Branch `codex/consent-analytics` zeigt ebenfalls auf diesen Commit. Eigener Arbeitsbranch: `feature/aggregate-usage-statistics`.

## Ergebnis und Umfang

**Es wurde keine neue Statistik aktiviert oder implementiert.** Dieser Branch dokumentiert die Analyse und die Sicherheitsvoraussetzungen. Die im Auftrag ausdrücklich vorgesehene Sicherheitsalternative wird genutzt: keinen ungesicherten Zähler anschließen, sondern fehlende Infrastruktur und zwei sichere Ausbauwege benennen.

Es gibt ein kostenlos nutzbares Apps-Script-Backend, aber darin derzeit **keinen vertrauenswürdig authentifizierten Schreib- oder Admin-Lesepfad für Nutzungsstatistik**. Die bestehende Browser-Anmeldung sichert diesen Dienst nicht ab. Firestore-Regeln können den fehlenden vertrauenswürdigen Aggregationsdienst nicht ersetzen.

Das bedeutet ausdrücklich **nicht**, dass eine kostenlose Umsetzung technisch unmöglich wäre. Eine Härtung von Apps Script ist ein möglicher Ausbauweg. Sie ist im vorhandenen Code aber noch nicht vorhanden; Deployment-Konfiguration, Berechtigungen, verfügbare Quoten und die tatsächlich veröffentlichte Backend-Version wurden nicht in den Betreiber-Konsolen verifiziert. Eine produktionsfähige, sicher geprüfte Lösung lässt sich deshalb nicht als bereits vorhanden oder mit nur einem Admin-Claim erledigt darstellen.

## Geprüfte Architektur

| Bereich | Befund im Repository | Bedeutung |
| --- | --- | --- |
| Website | Statische HTML-/JavaScript-Anwendung; konfigurierte Produktionsadresse auf GitHub Pages | Kein eigener vertrauenswürdiger Webserver im Frontend |
| Firebase | `js/firebase-public-config.js`, Projekt `wifa-trainer-gruen`; `js/firebase-config.js` initialisiert Auth, Firestore und Storage mit SDK 12.17.1 | Öffentliche Webkonfiguration ist kein serverseitiger Schlüssel und keine Admin-Berechtigung |
| Anmeldung | `js/login.js`, insbesondere `requireAuth` und `onAuthStateChanged`; E-Mail/Passwort und bestätigte E-Mail; `js/auth-shim.js` wartet auf echte Anmeldung | Funktionszugang im Browser; keine automatische Absicherung beliebiger HTTP-Endpunkte |
| Firestore | `users/{uid}` mit Profil; darunter `attempts`, `quizAttempts`, `examAttempts` und `examAttempts/{id}/tasks` | Bestehende personenbezogene Lerndaten, keine allgemeine Nutzungsstatistik |
| Security Rules | `firestore.rules`: eigene bestätigte Konten; erlaubte Felder; Versuchsdaten nur anlegen, nicht ändern/löschen; abschließend `allow read, write: if false` | Neue Statistikpfade sind nach diesen Quellregeln für Clients gesperrt. Das ist zu erhalten. Live-Regelstand nicht geprüft |
| Apps Script | `backend/apps-script/Code.gs`, `Quiz.gs`; `doGet` ab Zeile 304, `doPost` ab Zeile 631; Google Sheets als Datenspeicher | Serverseitige Ausführung vorhanden, aber keine Firebase-Tokenprüfung, Admin-Rollenprüfung oder belastbare Statistik-Missbrauchsbegrenzung gefunden |
| API-Anbindung | `js/api.js`: öffentliche Apps-Script-Web-App; GET-Parameter bzw. JSON in POST mit `text/plain` | Kein Firebase-ID-Token wird durch diesen API-Helfer angefügt; `nutzer` wird teilweise vom Client geliefert |
| Weitere Server | Keine Functions-Anwendung, kein Functions-Deployment, keine `firebase.json`, kein `appsscript.json`/Clasp-Deployment im untersuchten Repository gefunden | Kein zweiter vorhandener Statistikdienst nachgewiesen; externe Infrastruktur außerhalb des Repositorys damit nicht ausgeschlossen |
| Admin-Werkzeuge | `tools/podcast-sync` verwendet lokal `firebase-admin` für Audioveröffentlichung | Ein lokales Werkzeug ist kein dauerhaft erreichbarer und abgesicherter Ereignisempfänger; seine tatsächlichen IAM-Rechte sind nicht geprüft |
| Admin-Konten | Keine Custom-Claim-Prüfung für eine Statistik-Admin-Rolle im Anwendungscode oder in den Rules gefunden | Ein Menü verstecken oder eine E-Mail im Frontend vergleichen würde Daten nicht schützen |
| Google Analytics | `analytics-core.js`, `analytics-consent.js`, `analytics-frame.js`, `analytics-settings.js`, Themenkatalog und Tests | Mess-ID `G-PJ9Y1NC4SH`; getrennte, zustimmungsabhängige Messkomponente; unverändert |
| Datenschutz | `index.html#datenschutzView`, `datenschutz.html`, `docs/analytics-privacy.html` | Beschreiben bestehende Dienste und freiwilliges GA. Keine Beschreibung einer nicht implementierten Statistik hinzugefügt |

Die vorhandenen Apps-Script-Routen verarbeiten auch personenbezogene Lernstände und lösen bestehende KI-Funktionen aus. Sie werden hier weder als neue Statistikquelle kopiert noch verändert. Insbesondere wurde keine OpenAI-Anfrage ausgelöst.

## Warum ein einfacher Zähler nicht genügt

1. Ein Client kann HTTP-Anfragen selbst erzeugen. Der Browser-Login, eine unbekannte URL, CORS oder ein mitgelieferter `nutzer`-Wert sind kein serverseitiger Berechtigungsnachweis.
2. `increment(1)` verhindert verlorene Updates, aber keine unberechtigten oder wiederholten Meldungen. Allgemeine Client-Schreibrechte würden die ausdrückliche Vorgabe verletzen.
3. Apps Script vertraut in vorhandenen Fortschrittsrouten auf übergebene Nutzerangaben. Diese Routen eignen sich nicht unverändert als Vorlage für Statistik-Berechtigungen.
4. Die Lerninhaltsrouten greifen teilweise mit dem vom Client angegebenen Fach auf Tabellenblätter zu (`getSheetByNameSafe_`, `getActiveQuestions`, `getQuestionById`). Ein zusätzliches, bloß verstecktes Statistikblatt im selben Spreadsheet wäre keine verlässliche Sicherheitsgrenze. Daraus folgt kein Nachweis, dass beliebige Statistikformate heute auslesbar wären; es spricht für einen getrennten privaten Speicher.
5. Selbst geprüfte Anmeldetokens beweisen keine echte Produktnutzung. Ein angemeldetes Konto kann erlaubte Meldungen wiederholen. Serverseitige Mengenlimits, begrenzte Ereignisverträge und ein ausdrücklich definiertes Schutzmodell bleiben erforderlich. Vollständig manipulationsfreie Client-Nutzungszahlen sind auch mit einem kostenpflichtigen Server nicht erreichbar.
6. Ein personenbezogenes dauerhaftes Deduplizierungsregister würde den Datenschutzvorgaben widersprechen. Kurzlebige Missbrauchsschutz-Kennungen wären ebenfalls zu begründen und transparent zu beschreiben; sie sind nicht automatisch anonym.

## Die zwei sichersten Ausbauwege

### A. Vorhandenes Apps Script gezielt härten — bevorzugter Weg ohne neuen Bezahldienst

Ein eigener, klar abgegrenzter Statistikpfad im vorhandenen Backend mit einer **separaten privaten Statistik-Tabelle**. Keine Nutzung der bestehenden personenbezogenen Fortschrittstabellen für Statistikprofile.

Erforderlich vor Aktivierung:

- Firebase-ID-Token serverseitig über einen verifizierenden Dienst prüfen, einschließlich Projektbindung, Ablauf, bestätigter E-Mail und gesperrtem Konto. Nur Base64-Decodieren eines JWT reicht nicht. Ein möglicher Baustein ist Firebase/Identity Toolkit `accounts:lookup`; Eignung und Fehlerfälle müssen im tatsächlichen Projekt getestet werden.
- Normale Konten dürfen nur fest definierte Nutzungssignale melden, keine Zählerstände, frei gewählten Tagesdaten, Datenbankpfade oder beliebigen Metadaten.
- Globales serverseitiges Quotenbudget vor teuren Prüfungen; weitere Begrenzung wiederholter gültiger Meldungen nach einem dokumentierten Schutzmodell. Ohne kontobezogenen Zustand bleiben gezielte Wiederholungen nur global begrenzbar. Das ist als Einschränkung offenzulegen, nicht als exakte Manipulationsverhinderung zu verkaufen.
- Tageszähler unter `LockService.getScriptLock()` lesen, ändern und schreiben; Schreibvorgänge vor Freigabe abschließen. Datenmodell so wählen, dass Teilausfälle zwischen Gesamt- und Tageszähler keine widersprüchlichen Summen erzeugen, etwa Gesamtwerte aus Tageswerten berechnen.
- Separater Admin-Lesepfad, serverseitig mit einer dafür vorgesehenen Berechtigung geprüft; beispielsweise Firebase Custom Claim `usageAdmin: true`. Keine Admin-E-Mail und kein Geheimnis im Browser. Die Tabelle darf nicht öffentlich oder an normale Lernkonten freigegeben sein.
- Token und durch Tokenprüfung erhaltene Kontodaten nur für Zugriffskontrolle verarbeiten, nicht als Statistik speichern oder protokollieren. Keine Payloads, Tokens, Antworten oder Kontodaten in Fehlerlogs schreiben. Technische Verarbeitung durch Google getrennt von eigenen Statistikdaten beschreiben.
- Änderungen als Apps-Script-Web-App bereitstellen und echte Negativtests ausführen: ohne Token, mit manipuliertem/fremdem/abgelaufenem Token, ohne Admin-Rolle, mit übergroßen Nutzdaten und parallelen Anfragen.

**Kosten:** Keine zusätzliche kostenpflichtige API nötig; Apps Script hat Quoten und kann bei deren Erreichen Anfragen ablehnen. Diese Grenzen und die Belastung des vorhandenen Lernbackends sind vor Betrieb zu prüfen. Statistik in Sheets erzeugt **keine zusätzlichen Firestore-Writes**. Als Entwurfsziel höchstens eine zusammengefasste Meldung pro aktivem Browser und Minute, nur wenn sinnvolle Nutzungen anfallen, und eine atomare Tagesaktualisierung pro angenommener Meldung. Bei 30 Minuten Nutzung wären das höchstens etwa 30 Updates statt eines Zugriffs pro Klick. Das sind Planungswerte, keine implementierte Begrenzung. Der Browser darf bei Statistikfehlern weiterlernen; dadurch können Nutzungen fehlen.

**Manuelle Voraussetzungen:** Zugriff auf das Apps-Script-Projekt samt Web-App-Deployment, private Statistik-Tabelle, Serverkonfiguration und einmalige Admin-Berechtigung. Ein einzelner Custom-Claim-Befehl ersetzt diese Einrichtung nicht. Keine dieser Konfigurationen wurde hier verändert.

### B. Firebase-Backend mit Admin SDK und Firestore — erst nach Kostenfreigabe

Callable/HTTP Function mit geprüfter Firebase-Authentifizierung, Admin-Claim, begrenztem Ereignisvertrag, Missbrauchsschutz und atomaren Firestore-Updates. Statistikpfade erlauben keine Client-Schreibzugriffe; Lesen nur mit geprüfter Admin-Berechtigung oder ausschließlich über das Backend. App Check kann ergänzen, ersetzt aber weder Authentifizierung noch Quoten und verhindert nicht jeden Missbrauch.

Cloud Functions für Firebase erfordert laut aktueller Dokumentation zum produktiven Deployment den **Blaze-Tarif**. Freikontingente sind keine Garantie gegen Kosten. Der tatsächlich bestehende Tarif wurde nicht in der Konsole geprüft; es wurde **kein Tarifwechsel vorgenommen**.

Bei einem Modell mit einem Gesamt- und einem Tagesdokument entstehen ungefähr zwei Firestore-Dokumentwrites pro angenommener Sammelmeldung, zuzüglich etwaiger Schutzmechanismen und Dashboard-Reads. Dienstkosten und Budgets müssen vor Freigabe geklärt werden. Ein Budgetalarm allein ist keine harte Kostensperre.

## Konkrete Zählpunkte für eine spätere Umsetzung

Die Bezeichnungen in dieser Tabelle sind ein Entwurf für interne Zähler, **keine bereits aktiven neuen Events**. GA-Ereignisnamen und GA-Einwilligung bleiben unabhängig.

| Gewünschte Kennzahl | Vorhandener sinnvoller Auslöser |
| --- | --- |
| Trainer-Starts | `js/trainer.js`: erste erfolgreich geladene Frage des Laufs bei bestehendem GA-Start um Zeile 802; Neustart/„Von vorne“ setzt Lauf zurück |
| Quiz-Starts | `js/quiz.js`: erste angezeigte Frage der Runde um Zeile 362; Wiederaufnahme und bewusste neue Runde unterscheiden |
| Prüfungssimulations-Starts | `js/pruefungssimulation.js`: Aufgaben erfolgreich gerendert, um Zeile 289; WQ/HQ aus `pruefungTeilbereichSelect` strikt auf diese beiden Werte begrenzen |
| Podcast-Starts | `js/lerntexte.js`: tatsächliches `playing` des Audioelements; je geladenem Durchlauf einmal, Pause/Fortsetzen nicht erneut; bestehende Bindung um Zeile 239 |
| Lerntext-Aufrufe | `js/lerntexte.js`: erfolgreich angezeigte Auswahl um Zeile 1272; getrennt von Audio-Starts |
| Karteikarten-Starts | `js/wissensdatenbank.js`: `ladeKarteikarten`, erst nach erfolgreichem Laden einer nicht leeren Kartenliste und Anzeige |
| Glossar-Aufrufe | `js/main.js`: tatsächlicher Wechsel zu `glossarView` in `zeigeBereich` |
| Formelsammlung-Aufrufe | Entsprechend `formelView` |
| Lernstand-Aufrufe | `lernstandView`, `lernstandPruefungView`, `lernstandQuizView`, `lernstandFehlerView`; doppelte Darstellung derselben Ansicht nicht erneut zählen |
| Frag-Kilian-Aufrufe | `kilianView` sowie tatsächliches Öffnen in `toggleKilianBubble`; Öffnen und Verwenden getrennt darstellen |
| Frag-Kilian-Verwendungen | Erfolgreiche Antwort in `frageKilian` und `frageKilianBubble`; niemals Frage oder Antwort in Statistik übernehmen |

Fächer nur anhand fester Kennungen zählen. Die bestehende Zuordnung in `js/analytics-core.js` und die Backend-Fachliste sind nicht deckungsgleich: Backend nennt unter anderem `Finance Controlling`. Vor Integration ist eine eigene geprüfte Zuordnung erforderlich. Freitext nicht als Ersatz übernehmen; gemischte oder unbekannte Fächer explizit kennzeichnen. Themen, Fragen-IDs und Antwortdetails sind für den Auftrag nicht nötig.

Ein Dashboard würde Rangliste und Hauptfunktionen, Fächer und Tagesverlauf für letzte 7/30 Tage und Gesamtzeitraum darstellen. Tage einschließlich heute in einer festgelegten Zeitzone, etwa Europe/Berlin; Tageslücken als null und die noch laufende Tagesperiode kenntlich machen. Es ist hier noch nicht gebaut und hat noch keine URL.

## Daten und Datenschutz

**Tatsächlich neu gespeichert:** keine Nutzungsdaten; nur dieser Analysebericht im Repository.

**Vorgesehenes Statistikmodell:** Kalendertag, feste Funktionskennung, gegebenenfalls feste Fachkennung bzw. WQ/HQ, ganzzahliger Zähler. Keine einzelnen Ereignislisten und keine Nutzerprofile. Keine Namen, E-Mails, Firebase-UIDs, Konto-IDs, Antworten, Punktestände, Chats, IP-Adressen, User-Agents, Geräte-IDs, Fingerprints oder URLs mit Parametern in den Statistikdatensätzen.

Authentifizierung würde dennoch personenbezogene Daten vorübergehend verarbeiten. Netzbetreiber und Plattform empfangen technische Verbindungsdaten; eigene aggregierte Speicherung macht die gesamte Verarbeitung nicht „vollständig anonym“. Vor tatsächlicher Aktivierung müssen die Datenschutztexte den konkreten Betrieb beschreiben. Dieser Bericht trifft keine Aussage über eine rechtliche Zulässigkeit ohne Einwilligung.

**GA bleibt freiwillig:** Zustimmung, Widerruf, Browser-Testausschluss, Mess-ID, `allow_google_signals: false` und deaktivierte Werbesignale bleiben unverändert. Im aktuellen Ergebnis werden GA-Ablehner **nicht durch eine neue interne Statistik gezählt**. Nach einem sicheren Ausbau könnten deren freigegebene Nutzungssignale unabhängig von GA aggregiert werden; personenbezogene Inhalte dürften deshalb nicht zusätzlich erfasst werden.

**Eindeutige Menschen:** Aus Zählern nicht berechenbar. Dashboard-Beschriftung „Nutzungen“, „Starts“, „Aufrufe“, nicht „Nutzer“. Bestehende Auth-Konten sind keine aktiven Menschen. Eine separate Zahl aktiver Konten würde eine definierte Aktivität und zumindest vorübergehende Deduplizierung nach Konto benötigen; das ist weder umgesetzt noch durch den bloßen Verzicht auf UID-Speicherung automatisch datensparsam. Bestehende Lerndaten werden dafür nicht nachträglich ausgewertet.

## Verifikation und offene Abnahme

- `node --test tests/*.test.js`: **221 bestanden, 0 fehlgeschlagen**, einschließlich GA-Consent, Frame-Isolation, Ereignisbereinigung, Listener-Deduplizierung sowie bestehender Lern- und Podcast-Regressionsprüfungen.
- Python: `python` ist nicht im PATH; erneuter Lauf mit dem gebündelten Python und `-B -m unittest discover -s tests -p '*_test.py'` scheitert beim Import von `imageio_ffmpeg`. Die lokale Podcast-Python-Umgebung ist nicht vorhanden. **Die drei Python-Testfälle wurden daher nicht ausgeführt**; kein fachlicher Testfehler nachgewiesen. Für die reine Dokumentationsänderung wurden keine umfangreichen Audioabhängigkeiten installiert.
- Keine Funktionsdatei oder Security Rule geändert. Der Diff muss ausschließlich diesen Bericht enthalten.
- Keine neuen Feature-Tests vorgetäuscht: Admin-Zugriff, neue Payloads, Parallelität und neue Schreibpfade existieren noch nicht und können deshalb auch nicht als bestanden gelten.
- Keine Firestore-Emulator-, Live-Regel-, Apps-Script-Deployment- oder neue Browserabnahme durchgeführt. Die erfolgreichen lokalen Tests ersetzen diese nicht.
- Keine neue API abgerufen, um Test-Nutzung zu erzeugen; keine Tarifänderung, keine Statistik-Writes und keine temporären Debug-Dateien als Deliverable.

## Primärquellen

Die Architektur- und Kostenprüfung stützt sich zusätzlich zum oben genannten Quellcode auf diese am 12. September 2026 abgerufenen Dokumentationen:

- [Firebase: Functions bereitstellen, Blaze-Voraussetzung](https://firebase.google.com/docs/functions/get-started)
- [Firebase: Custom Claims und Zugriffskontrolle](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Identity Toolkit: accounts.lookup](https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/lookup)
- [Apps Script: Web-App-Berechtigungen und Deployment](https://developers.google.com/apps-script/guides/web)
- [Apps Script: Lock Service](https://developers.google.com/apps-script/reference/lock/)
- [Apps Script: Quoten](https://developers.google.com/apps-script/guides/services/quotas)
