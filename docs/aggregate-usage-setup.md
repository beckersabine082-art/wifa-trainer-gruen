# Interne Nutzungsstatistik – Einrichtung und Betrieb

Ausbauweg A ist im Repository implementiert. **Die private Tabelle, Serverkonfiguration, Admin-Berechtigung und das Apps-Script-Deployment sind noch nicht live eingerichtet.** Nach der Google-Anmeldung wurde das richtige Projekt anhand der bestehenden Web-App-ID bestätigt. Der neue Router wurde in den aktuellen Live-Editor-Code eingefügt und `Usage.gs` ergänzt, jeweils per Textvergleich verifiziert. Die aktive öffentliche Bereitstellung bleibt Version 93 vom 05.09.2026. Der Setup-Aufruf verlangt eine neue Google-Autorisierung; deren Abschluss steht aus. Es wurde kein Tarif geändert und keine Functions-Anwendung angelegt.

## Was umgesetzt ist

- `backend/apps-script/Usage.gs`: eigener geschützter Statistikpfad mit Firebase-Tokenprüfung über Google `accounts:lookup`, festen Ereignissen, globalen Limits und privaten Tageszählern.
- `Code.gs`: nur neue Statistik-POST-Routen plus neutrale Fehler bei ungültigem JSON. Bestehende Lern-/KI-Routen bleiben funktional unverändert. Diese Arbeit stellt **keine vollständige nachträgliche Authentifizierung aller alten Apps-Script-Routen** dar.
- Eigene Browser-Zählung, unabhängig von GA, nur bei bestätigter Firebase-Anmeldung und auf der Produktions-Startseite. Keine zusätzlichen Firestore-Zugriffe.
- `usage-statistics.html`: geschützter Datenabruf, 7/30 Tage und Gesamtzeitraum, Funktionen, Fächer, Trainer-/Quiz-/Podcast-Nutzung je Fach, WQ/HQ und Tagesverlauf.
- `tools/usage-admin.cjs`: einmalige Admin-Vergabe und Entzug. Keine Konto-ID im Quellcode, keine Frontend-Admin-E-Mail.

## Notwendige Konsoleneinrichtung

### 1. Bestehendes Apps-Script-Projekt öffnen und Backend ergänzen

Mit dem Google-Konto anmelden, dem das bestehende WiFa-Apps-Script und seine Lern-Tabelle gehören. Das Projekt der bereits in `js/api.js` eingetragenen Web-App öffnen. Vorhandene Bereitstellung und aktuelle Editor-Version vergleichen; fremde oder neuere Änderungen nicht durch einen vollständigen Repository-Upload überschreiben.

`backend/apps-script/Usage.gs` als neue Datei `Usage.gs` hinzufügen. In `Code.gs` die kleine Änderung am Anfang von `doPost` übernehmen (Diff dieses Branches): JSON-Parsefehler neutral beantworten und `usageRecord`/`usageRead` direkt an `usageHandle_` leiten. Sonstige Projektdateien bleiben bestehen, insbesondere `Quiz.gs` und eine gegebenenfalls nur im Live-Projekt vorhandene `Index.html`.

Die internen Hilfsfunktionen enden mit `_`; sie werden nicht als `google.script.run`-API angeboten. Im Editor die Funktion `setupUsageStatistics` einmal ausführen. Die dabei erforderliche Google-Freigabe für Tabellen, Drive und externe Anfragen muss der Betreiber bestätigen. **Keine kostenpflichtige API, keinen Tarifwechsel und keinen neuen Cloud-Dienst aktivieren.** Bei explizit gepflegten OAuth-Scopes sind `spreadsheets`, `drive` und `script.external_request` unter `https://www.googleapis.com/auth/` erforderlich; vorhandene benötigte Scopes erhalten, nicht das ganze Manifest ersetzen.

Die Funktion erzeugt eine **eigene private Tabelle** „WiFa – private aggregierte Nutzungsstatistik“ mit `usageDaily`, speichert ihre ID in den Script Properties und lässt `USAGE_ENABLED=false`. Eine erneute Ausführung verwendet dieselbe Tabelle und deaktiviert die Sammlung wieder. Die Tabelle nicht freigeben, nicht in einen geteilten Ordner oder Shared Drive verschieben und keine Mitbearbeiter hinzufügen. Bei ungeeigneter Eigentümerschaft/Freigabe sperrt das Backend den Statistikzugriff.

Unter **Projekteinstellungen → Skripteigenschaften**:

| Eigenschaft | Wert |
| --- | --- |
| `USAGE_SPREADSHEET_ID` | Von der Setup-Funktion erzeugt; niemals ID der Lern-Tabelle verwenden |
| `USAGE_FIREBASE_WEB_API_KEY` | Bestehender Web-API-Key des Firebase-Projekts `wifa-trainer-gruen` aus `js/firebase-public-config.js` |
| `USAGE_ENABLED` | Zunächst `false`; für die kontrollierte Abnahme auf `true` setzen |

Der Firebase-Web-API-Key ist kein Admin-Geheimnis. Falls seine Anwendungseinschränkungen serverseitige Anfragen verbieten, **nicht die Frontend-Key-Sicherheit pauschal abschalten**: einen separaten projektgebundenen API-Key mit Beschränkung auf Identity Toolkit für den Server konfigurieren. Der Server akzeptiert ausschließlich ID-Tokens für `wifa-trainer-gruen`. Diese Konfiguration benötigt keine kostenpflichtige Analyse-API.

Der sichtbare Einstieg `setupUsageStatistics` prüft zusätzlich den aktiven Google-Nutzer gegen den Eigentümer der gebundenen Lerntabelle und gegen den effektiven Ausführungsnutzer. Er ist dadurch auch bei einem direkten `google.script.run`-Aufruf durch fremde oder nicht erkennbare Nutzer gesperrt. Die eigentliche Einrichtung bleibt in der privaten Hilfsfunktion.

### 2. Einmalig das eigene Firebase-Konto als Statistik-Admin berechtigen

Die UID des gewünschten, E-Mail-bestätigten Firebase-Kontos in **Firebase Console → Authentication → Users** ablesen. Nur dieses bewusst ausgewählte Konto berechtigen.

Mit bereits eingerichteten lokalen Google-Admin-Anmeldedaten und installiertem `firebase-admin` aus `tools/podcast-sync` lautet der eine Vergabebefehl:

```powershell
node tools/usage-admin.cjs grant '<Firebase-UID des eigenen Kontos>'
```

Der Helfer verwendet Application Default Credentials und das fest eingestellte Projekt `wifa-trainer-gruen`; erforderlich sind dort Rechte zum Lesen und Ändern von Firebase-Auth-Konten. Falls der vorhandene Podcast-Service-Account diese Rechte nicht besitzt, ihn nicht blind zum Projekt-Owner machen. Eine bestehende geeignete Admin-Anmeldung verwenden. Ein etwaiger lokaler Credential-Dateipfad wird über `GOOGLE_APPLICATION_CREDENTIALS` übergeben; keine Schlüssel oder Tokens in Git oder Chat kopieren.

Der Helfer erhält andere Custom Claims und setzt nur `usageAdmin: true`. Anschließend im Trainer erneut anmelden. Prüfung und Entzug:

```powershell
node tools/usage-admin.cjs check '<Firebase-UID>'
node tools/usage-admin.cjs revoke '<Firebase-UID>'
```

Jeder Admin-Abruf liest die aktuelle Berechtigung aus Googles autoritativen Kontodaten. Ein im Browser gesetztes `admin=true`, eine manipulierte UID oder ein alter JWT-Admin-Claim reichen nicht. Fehlende oder nicht boolesche Admin-Claims werden abgelehnt. Das Setzen des Claims ist noch nicht ausgeführt worden.

### 3. Vorhandene Web-App aktualisieren und kontrolliert abnehmen

Über **Bereitstellen → Bereitstellungen verwalten → vorhandene Web-App bearbeiten → Neue Version** aktualisieren. Als Eigentümer ausführen; die Web-App muss technisch vom bestehenden Frontend erreichbar bleiben. Der Endpunkt selbst authentifiziert die neuen Statistikaktionen. Die Bereitstellungs-ID beibehalten, damit `API_BASE_URL` unverändert bleibt. Falls tatsächlich eine neue URL nötig wird, erst beide Verwendungen prüfen, nicht versehentlich Lernfunktionen auf ein anderes Backend umstellen.

`USAGE_ENABLED=true` erst zur Abnahme setzen. Das Setup lässt diese Freischaltung absichtlich aus. Die Frontend-Dateien des Feature-Branches müssen anschließend über das bestehende GitHub-Pages-Verfahren veröffentlicht werden; ein Push auf den Feature-Branch veröffentlicht nicht automatisch `main`.

Vor allgemeiner Nutzung mit dem eigenen Admin- und einem normalen bestätigten Testkonto kontrollieren:

1. `usageRead` ohne Token, mit verändertem Token oder mit normalem Konto liefert keine Daten. Normaler gültiger Zugang erhält `forbidden`, ungültige Anmeldung `unauthenticated`.
2. Der Admin erhält ein leeres Dashboard, bevor Ereignisse angenommen wurden. `usageAdmin` als Zeichenkette oder Clientparameter gewährt keinen Zugriff.
3. Eine echte Lernfunktion öffnen/starten, mindestens 60 Sekunden warten und im Dashboard aktualisieren. Eine solche Abnahme erzeugt echte Test-Nutzungen; diese bewusst dokumentieren. Das Backend bietet keinen öffentlichen Reset-/Löschendpunkt.
4. GA ablehnen: interne, angemeldete Nutzungen können weiter gezählt werden; keine Google-Analytics-Messung darf dadurch aktiviert werden. Danach GA-Zustimmung/Widerruf und laufenden Podcast prüfen.
5. Die private Tabelle darf nur `date` und JSON-Zähler enthalten; keine Tokens, UIDs, E-Mails, Antworttexte oder Ereigniszeilen. Den Apps-Script-Code nicht um Request-Logging ergänzen.
6. Negative und parallele Anfragen zunächst in einer separaten privaten Testkopie prüfen, damit Quotenprüfungen nicht das Lernbackend belasten. Globales Limit und Entzug des Adminrechts prüfen. Keine echten Tokens in URLs, Screenshots, Logs oder Testdateien schreiben.

Wenn die Firebase-Konfiguration `accounts:lookup` nicht erfolgreich zulässt oder erforderliche Kontofelder fehlen, bleibt der Endpunkt geschlossen. Nicht ersatzweise allein JWTs decodieren, eine Frontend-E-Mail vergleichen oder Firestore-Schreibrechte öffnen.

## Datenvertrag und Grenzen

`usageRecord` erhält `{action, idToken, events}`. `idToken` ist ein separater Berechtigungsnachweis im POST-Body, **kein Bestandteil eines Statistikereignisses**. Es enthält technisch Kontodaten. Im Speicher landen ausschließlich Schlüssel `event|subject|area` und ganze Anzahlen pro Kalendertag; der Server verarbeitet und verwirft den Berechtigungsnachweis. Wegen Apps Scripts HTTP-Schnittstelle wird das Token nicht in einem frei auslesbaren URL-Parameter übermittelt. Browser-Requests verwenden `referrerPolicy: no-referrer` und keine zusätzlichen Cookies.

Jedes Ereignis besteht exakt aus `event`, `subject`, `area`. Keine frei gewählte Anzahl, kein Datum, keine personenbezogenen Zusatzfelder. Höchstens zehn unterschiedliche Schlüssel pro Anfrage; jeder akzeptierte Schlüssel erhöht den serverseitigen Zähler um genau eins. Zusätzliche Felder, Duplikate und ungültige Kennungen werden abgewiesen. Ein Batch wird vollständig validiert, bevor irgendein Statistikwert geändert wird.

Die Authentifizierung prüft vorab Projekt, Aussteller und Zeiten, anschließend lässt sie Google das **vollständige signierte Token** prüfen. Verifiziertes Konto, Übereinstimmung der UID, Sperrstatus und Widerrufszeit werden geprüft. Nur die boolesche Admin-Berechtigung wird als Ergebnis weiterverwendet. Auth-Daten werden nicht protokolliert oder gecacht.

Der Browser sammelt nur im Arbeitsspeicher, frühestens eine Meldung pro Minute, maximal zehn Schlüssel. Gleiche Kombinationen innerhalb einer Meldung zählen einmal. Weitere Kombinationen bei vollem Puffer, kurze Sitzungen, Kontowechsel, Tab-Schließen und Fehler können Meldungen verlieren. Es gibt kein späteres Nachsenden und keine Retry-Schleife. Ein bereits abgesendeter Request kann beim Logout nicht zurückgeholt werden. Diese Zähler sind konservative Nutzungsindikatoren, keine vollständigen Ereignisprotokolle.

Tagesgrenzen gelten in **Europe/Berlin**, maßgeblich ist die Serververarbeitung. Eine um Mitternacht gepufferte Nutzung kann dadurch dem Folgetag zugerechnet werden. Das Dashboard zählt den aktuellen, noch laufenden Tag in den 7/30-Tage-Zeiträumen mit. Gesamtwerte werden aus Tageswerten berechnet, nicht in einem zweiten möglicherweise inkonsistenten Zähler gespeichert. Keine Kennzahl „eindeutige Nutzer“ oder „aktive Konten“.

## Sicherheit, Quoten und Kosten

Unter einer Script-Schreibsperre wird ein dauerhaftes **globales** Zulassungsbudget gepflegt: höchstens 30 Anfragen je Minute und 3000 je Berliner Kalendertag für die neuen Endpunkte gemeinsam, vor jeder Google-Tokenabfrage. Auch fehlgeschlagene Tokenprüfungen verbrauchen das Budget. `USAGE_ADMISSION` enthält nur Datum, Minutenfenster und Anzahlen, keine Konten. Ungültige Syntax/Dimensionen werden noch vorher ohne externe Anfrage verworfen.

Diese Grenzen begrenzen angenommene Meldungen und externe Tokenprüfungen, **nicht sämtliche Apps-Script-Ausführungen oder sämtliche Google-Plattformkosten**. Angreifer können weiterhin die öffentlich erreichbare Web-App belasten; gültige angemeldete Konten können künstliche erlaubte Meldungen senden und das globale Budget belegen. Ein Garantieren echter Nutzung ist ohne zusätzliche Nachweise nicht möglich. Es gibt bewusst keine gespeicherten accountbezogenen Missbrauchsschutz-Kennungen. Bei erreichtem Limit können auch Admin-Abfragen ausfallen; der Eigentümer kann die private Tabelle weiter direkt öffnen.

Pro angenommener Meldung: eine Google-Tokenabfrage, ein Property-Update für das Budget, Drive-/Tabellenprüfungen und eine Tabellenzeile als atomarer Read/Modify/Write mit Flush unter `ScriptLock`. Bei 30 Minuten durchgehender Nutzung höchstens ungefähr 30 Meldungen pro Browser, oft weniger. **Null zusätzliche Firestore-Writes**, keine Functions, kein Blaze-Wechsel, keine OpenAI- oder Analyse-API. Apps-Script-Quoten können vor den eigenen Limits erreicht werden; die Lernoberfläche behandelt Statistikfehler als nicht blockierend. Die gemeinsame Apps-Script-Plattform kann bei Überlastung dennoch betroffen sein.

Der Speicher ist auf 10.000 Tageszeilen plus Kopfzeile begrenzt, keine unbegrenzten Ereignislisten. Nach etwa 27 Jahren wäre eine bewusste Archivierungsentscheidung nötig. Private Tagesaggregate werden aktuell nicht automatisch gelöscht; dies ist auch im Datenschutzhinweis beschrieben.

Firestore-Regeln bleiben unverändert: unbekannte Pfade sind gesperrt. Die Statistik verwendet keinen Firestore-Pfad; daher sind weder neue Regeln noch neue Client-Rechte erforderlich. Die private Tabelle muss ausschließlich dem ausführenden Eigentümer gehören, ohne zusätzliche Betrachter/Bearbeiter oder Linkfreigabe.

## Abschalten und Rücknahme

`USAGE_ENABLED=false` in den Script Properties stoppt neue Speicherung und Admin-API-Abrufe sofort, ohne eine Website-Änderung. Bereits vorhandene Tagesaggregate bleiben privat erhalten. `setupUsageStatistics` deaktiviert ebenfalls, löscht jedoch keine Daten. Für eine vollständige Unterbindung der Browserübermittlung die neue `usage-client.js`-Einbindung aus der Website zurücknehmen; die optionalen Hooks bleiben ohne aktiven Client wirkungslos. GA separat unverändert lassen.

## Tests und Abnahmestand

Automatisierte Tests liegen in `tests/usage-backend.test.js`, `tests/usage-admin.test.js` und `tests/usage-client.test.js`. Sie prüfen die echte neue Anwendungslogik mit lokalen Doubles für Google, Drive, Sheets und Browserdienste. Die Backend-Tests wurden zuerst ohne Modul ausgeführt (rot), dann mit Implementierung (grün); ebenso Admin-Helfer und Browser.

Die Mock-Tests beweisen keine echte Google-Tokenprüfung und kein reales Apps-Script-Deployment. Genau dafür sind die obigen kontrollierten Live-Prüfungen notwendig. Live-Datenfluss, Google-Freigaben und private Tabelle sind bis zur Konsoleneinrichtung ausdrücklich **offen**. Der historische Analysebericht bleibt als Ausgangslage erhalten; diese Datei beschreibt die nachfolgende Implementierung.

Abschluss der lokalen Prüfung: **256 JavaScript-Tests bestanden, 0 fehlgeschlagen**. Die unabhängige Prüfung fand zwei anschließend behobene Fälle: E-Mail-Bestätigung bei gleicher UID und verspätete Feature-Antworten nach Kontowechsel. Tokenwechsel-Abonnement und flüchtige Generationstickets verhindern diese Fehlzuordnung, ohne Kennungen zu speichern. Der sichtbare Setup-Einstieg ist zusätzlich gegen fremde Google-Konten getestet. GA-Dateien und Firestore-Regeln sind im Diff unverändert.

Im echten Browser mit ausschließlich lokalen Fixtures geprüft: gefülltes Dashboard, 7 Tage mit 105 Test-Nutzungen, Wechsel auf 30 Tage mit 147, Fachmatrix, lesbares Layout und serverseitige Zugriffsverweigerung mit Entfernen vorheriger Daten. Die Preview läuft reproduzierbar mit `node tests/usage-preview-server.cjs` auf `127.0.0.1:8794`, ohne Firebase oder GA. Die unveränderten Python-Audiotests bleiben wegen fehlender lokaler Audioabhängigkeiten nicht ausführbar; das ist kein erfolgreicher Python-Testlauf.

Quellen: [Google accounts.lookup](https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/lookup), [Kontostatus und Custom Claims](https://cloud.google.com/identity-platform/docs/reference/rest/v1/UserInfo), [Apps-Script-Locks](https://developers.google.com/apps-script/reference/lock/), [Apps-Script-Quoten](https://developers.google.com/apps-script/guides/services/quotas).
