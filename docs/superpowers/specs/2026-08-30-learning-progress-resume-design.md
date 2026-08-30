# Persistenter Lernfortschritt je Nutzer – Design für Trainer und Quiz

Status: Entwurf, nicht implementiert
Datum: 2026-08-30

## Ziel

Die App soll für Trainer und Quiz den zuletzt bearbeiteten Frage-Stand pro authentifiziertem Nutzer dauerhaft speichern und beim erneuten Aufruf automatisch wieder aufrufen. Dabei muss der Kursfortschritt unabhängig von der aktuellen Browser-Session und auch nach Logout erhalten bleiben. Gleichzeitig darf der bestehende Lernstand, die Auswertungsstatistiken und die Session-Statistiken nicht durch "Von vorne" oder Shuffle verändert werden.

### Nicht-Ziel / Scope

- Keine Implementierung in dieser Phase
- Keine Änderung an bestehendem Lernstand, Open-Answer-Evaluation, Quiz-Datenbank, Prüfungs-Simulation, Kilian, Podcast oder Hinweis-Bubble
- Keine neue Firestore-Architektur; nur das bereits vorhandene Apps-Script-+Google-Sheet-Modell wird erweitert

---

## 1. Aktuelle Architektur-Findings

### 1.1 Firebase-Authentifizierung und aktuelle User-Identität

Die App nutzt Firebase Auth im Browser über [js/firebase-config.js](../../js/firebase-config.js).

Erkennbar:

- `initializeApp(firebaseConfig)` initialisiert die App
- `getAuth(app)` liefert das Auth-Objekt
- `onAuthStateChanged(auth, ...)` überwacht Login/Logout
- `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut` werden verwendet
- Die Persistenz des Login-Status wird mit `setPersistence(auth, browserLocalPersistence | browserSessionPersistence)` gesteuert
- Der aktuelle Nutzer wird in der Anwendung als `auth.currentUser` und als `window.aktuellerNutzer` verwaltet, insbesondere in [js/login.js](../../js/login.js)
- Die Sicherheitslogik prüft `user.emailVerified === true` und blockiert nicht verifizierte Konten für echte Nutzung
- Beim Login wird `window.aktuellerNutzer = user.uid` gesetzt; beim Logout wird dieser Wert auf `null` zurückgesetzt

Das ist die bereits bestehende User-Identität der App und die richtige Grundlage für die Fortschritts-Speicherung.

### 1.2 Wie der Nutzer derzeit an Apps Script gesendet wird

Die Frontend-Kommunikation läuft über das API-Wrapper-Objekt in [js/api.js](../../js/api.js):

- `apiGet(action, params)` baut eine GET-URL mit `?action=...&key=value` und ruft `fetch` auf
- `apiPost(action, payload)` sendet JSON per `fetch` mit `Content-Type: text/plain;charset=utf-8`
- Apps Script antwortet in der Regel als JSON mit `{ success: true, data: ... }` oder `{ success: false, error: ... }`

Aktuell wird der Nutzer einerseits indirekt aus `auth.currentUser` abgeleitet, andererseits über `window.aktuellerNutzer` gesetzt. Für neue Persistenz-Endpoints gilt: dieselbe vorhandene Identität verwenden, nicht eine zweite Nutzer-ID erfinden.

### 1.3 Bestehender Lernstand-Flow

Der vorhandene Lernstand verwendet nach aktueller Architektur bereits per Nutzer-Identität abgespeicherte Daten in Google Sheets/Apps Script:

- In [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs) gibt es `getLernstandFrontend(nutzer)` und `speichereLernstandFrontend(...)`
- Die API-Route `getLernstand` erwartet `nutzer` als Parameter
- `doPost` verarbeitet `speichereLernstand`, das auf ein Sheet "Lernstand" schreibt
- Die Frontend-Funktionen in [js/lernstand.js](../../js/lernstand.js) und [js/pruefungslernstand.js](../../js/pruefungslernstand.js) lesen die Daten per `apiGet('getLernstand', { nutzer })` bzw. speichern sie via vorhandenen Lernstandpfad
- Der Lernstand wird also bereits als persönliche Nutzer-Datenbank behandelt; die neue Funktion soll in derselben Logik, aber mit einem eigenen compact state sheet arbeiten

### 1.4 Apps Script doGet/doPost Routing

In [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs) wird das Routing mit einem `action`-Parameter realisiert:

- `doGet(e)`: `action === "subjects"`, `"topics"`, `"quizCatalog"`, `"quizQuestion"`, `"nextQuestion"`, `"firstQuestion"`, `"questionById"`, `"getLernstand"`, usw.
- `doPost(e)`: `action === "bewerteAntwort"`, `"speichereLernstand"`, `"frageKilian"`, `"bewertePruefung"`
- Rückgabe ist immer JSON über `ContentService.createTextOutput(JSON.stringify(...))`

Das ist die passende Minimal-Strategie für neue Fortschritts-Endpoints.

### 1.5 Trainer-Fragenladen und Navigation

Der Trainer in [js/trainer.js](../../js/trainer.js) arbeitet wie folgt:

1. `waehleTeilbereich()` setzt Teilbereich/Fach/Thema und zeigt Fach-/Themen-Auswahl.
2. `waehleFach(fach)` setzt `aktuellesFach` und lädt die Themen über `apiGet("topics", { fach })` in `ladeThemen(...)`.
3. `starteThema()` setzt `aktuellesThema` und ruft `ladeFrageAusFach(aktuellesFach, aktuellesThema, "")` auf.
4. `ladeFrageAusFach(...)` ruft `apiGet("nextQuestion", { fach, thema, currentId })` auf.
5. `nextQuestion` liefert die nächste oder erste aktive Frage; der aktuelle Status wird in `aktuelleFrageId` gespeichert.
6. `naechsteFrage()` nutzt `aktuelleFrageId` als `currentId`, wodurch der nächste Fragepfad mit der aktuellen Frage weiterläuft.

Das bedeutet: Der Trainer hat bereits eine "nächste Frage"-Semantik, aber kein persistenter Benutzerfortschritt.

### 1.6 Trainer-Fach-/Themen-Auswahl und Unabhängigkeit

Im Trainer gibt es einen Themenfilter pro Fach; der aktuelle Fach-/Themenkontext wird in Variablen verwaltet:

- `aktuellerTeilbereich`
- `aktuellesFach`
- `aktuellesThema`
- `aktuelleFrageId`

So sind mehrere Fach-/Themenkontexte technisch getrennt. Genau diese Logik soll für den gespeicherten Resume-Stand verwendet werden.

### 1.7 Quiz-Katalog und Frageablauf

Der Quiz-Code in [js/quiz.js](../../js/quiz.js) arbeitet mit:

- `katalog` als gemeinsamem Fragenpool, geladen über `apiGet("quizCatalog")`
- `quizFach` als aktiver Filter
- `rundenReihenfolge` und `fragenIndex` für die aktuelle Reihenfolge
- `neueRunde()` mischt den aktuellen Pool, `zeigeAktuelleFrage()` lädt die aktuelle Frage per `apiGet("quizQuestion", { fach, frageId })`
- `naechsteFrageHandler()` geht zur nächsten Frage im aktuellen Pool

Aktuell gibt es für Quiz schon eine lokale Session-Runde, aber keine persistente Wiederaufnahme pro Nutzer.

### 1.8 Logout-Verhalten

In [js/login.js](../../js/login.js) wird beim Logout:

- `await signOut(auth)` aufgerufen
- `window.aktuellerNutzer = null`
- `setLoggedOutAuthState()` und `zeigeBereich('startView')` aufgerufen

Es gibt keine Bereinigung des Lernfortschritts; der aktuelle UX zeigt, dass Logout nicht den progress state löschen soll. Das ist konsistent mit dem Requirement.

### 1.9 Vorhandene lokale Speicherlogik

Es gibt nur wenige Browser-lokale Zustände:

- `localStorage.getItem("hinweisGelesen")` in [js/main.js](../../js/main.js)
- kein bestehender persistent progress storage für Trainer oder Quiz
- keine `sessionStorage`-Logik für Fragepositionen
- `resetSession()` in [js/bewertung.js](../../js/bewertung.js) setzt nur in-memory Session-Statistiken zurück, nicht den persistenten Lernstand

Damit ist der bisherige Zustand sauber: Kein bestehender Resume-State in Browser-Speicher, nur UI-/Hinweis-Flags.

---

## 2. Datenmodell

### 2.1 Google Sheet: NutzerFortschritt

Ein neues Sheet `NutzerFortschritt` wird als kompakte State-Tabelle geführt, nicht als Event-Log.

Tabellenspalten:

- A: Nutzer
- B: Bereich
- C: Fach
- D: Auswahl
- E: Letzte Frage-ID
- F: Aktualisiert

Beispiel:

- Nutzer: Firebase UID
- Bereich: `trainer` oder `quiz`
- Fach: exakter vorhandener Fachname
- Auswahl:
  - Trainer: ausgewählter Themen-/Pool-Kontext; falls "Alle Themen" existiert, technischer Schlüssel `__ALL__`
  - Quiz: `__ALL__` oder bestehender stabiler Pool-Selector, falls vorhanden
- Letzte Frage-ID: stabile Frage-ID aus dem bestehenden Datensatz
- Aktualisiert: Timestamp

### 2.2 Logischer Schlüssel

Der eindeutige Schlüssel ist:

`Nutzer + Bereich + Fach + Auswahl`

Es gibt pro Schlüssel genau eine aktuelle Zeile. Beim Speichern wird ein vorhandener Datensatz aktualisiert; neue Zeilen nur angelegt, wenn noch keine passende Kombination existiert.

### 2.3 Auswahl-Definitionen

- Trainer: Der Schwellenwert zwischen "Fach" und "Auswahl" ist der sichtbare Pool/Topic-Kontext. In der Praxis ist `Auswahl` der konkrete Themen-Auswahl, auch wenn im Frontend ein Fach allein gewählt wurde.
- Für jede vollständige Fach-/Themenpool-Auswahl, also jede "Alle Themen" / gesamte Auswahl-Ansicht, wird der feste technische Schlüssel `__ALL__` verwendet.
- Quiz: `Auswahl` verwendet denselben festen technischen Pool-Key `__ALL__` für die komplette Auswahl / Gesamt-Pool-Ansicht; sofern der Quiz später einen eigenen Pool-Selector bekommt, muss dieser ebenfalls stabil und technisch konsistent sein, aber der Standard bleibt `__ALL__`.

### 2.4 Keine persistierten Shuffled-Positionen

Der zufällige Reihenfolge-Status bleibt nur im Browser-Session-Speicher aktiv. Er darf nie wie normaler Resume-Status im Sheet gespeichert werden. Dafür wird eine separate Runtime-Variable verwendet, die nur für die derzeit laufende Session gilt.

---

## 3. User Identity Source

Als eindeutige Identität wird der bereits existierende Firebase-UID verwendet:

- `auth.currentUser.uid` wenn `emailVerified === true`
- `window.aktuellerNutzer` echoing that UID in the app
- Keine zweite Benutzer-ID, keine separate Token-Variante, keine neue persistente login identity

Die App soll bei allen neuen Fortschritts-Calls denselben Wert verwenden, den sie bereits für Auth/Profil/Session verwendet.

---

## 4. Apps Script API Design

### 4.1 Vorgeschlagene Minimal-API

Die neue Design-Entscheidung hält sich an die vorhandenen Conventions in [js/api.js](../../js/api.js) und [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs):

GET:

- `action = "getProgress"`
- Parameter: `bereich`, `fach`, `auswahl`
- Return: `{ success: true, data: { letzteFrageId, aktualisiert } }` oder `null`/leer

POST:

- `action = "saveProgress"`
- Payload: `bereich`, `fach`, `auswahl`, `frageId`
- Return: `{ success: true, data: { ... } }`

Optionaler dedizierter Reset-Pfad:

- `action = "resetProgress"` mit derselben Schlüsseln
- kann aber als Komfort-Funktion existieren; es ist nicht erforderlich, einen separaten Reset-Endpunkt zu bauen, wenn die Anwendung einfach die erste Frage-ID als Saved-State speichert

### 4.2 Backend-Logik

Das Apps Script soll im neuen Sheet `NutzerFortschritt` auf Basis des logischen Schlüssels lesen und schreiben:

- `findRowByKey(nutzer, bereich, fach, auswahl)`
- falls vorhanden: Zeile aktualisieren
- falls nicht vorhanden: neue Zeile append
- `letzteFrageId` und `Aktualisiert` überschreiben den bisherigen Wert

Dabei gilt: `Latest saved state wins` und keine Event-Logik.

### 4.3 Authentifizierung auf Backend-Seite

Da die App bereits eine stabile Firebase-User-Identität im Frontend kennt, kann das Apps Script den Nutzer-String aus dem Request mit derselben Identität verwenden. Es muss nicht zusätzlich Firestore/Custom-Auth eingeführt werden. Das entspricht der Anforderung: kein neues System, sondern bestehende User-Identity reuse.

---

## 5. Trainer Data Flow

### 5.1 Standard-Flow

Beim Laden eines Trainer-Fachs/Topics:

1. Fragenpool laden
2. Saved progress für `user + trainer + fach + auswahl` abrufen
3. Wenn `Letzte Frage-ID` im aktuellen aktiven Pool existiert: diese Frage anzeigen
4. Wenn nicht: erste Frage des Pools anzeigen

Wichtige Regel: Beim normalen Navigieren innerhalb des aktuellen Trainer-Themas muss jedes Mal die aktuelle Frage als Resume-Status gespeichert werden, sobald diese Frage im Frontend als "aktuell" dargestellt wird.

### 5.2 Save-Trigger

Der Save-Trigger muss nur für den regulären, nicht-shuffled Trainer-Status erfolgen.

- Keine Speicherung, wenn `shuffleMode === true`
- Nur bei normaler Anzeige-Änderung, z. B. wenn die Frage gewechselt wird oder beim initialen Render einer normalen Frage
- Keine Speichern-Operation bei Lernstand-/Session-Stats; nur die Frage-ID des aktuellen Fragekontexts

### 5.3 Fach-/Themen-Entkopplung

Der gespeicherte Resume-Status muss fach- und thema-/pool-spezifisch sein. Beispiel:

- `trainer + Unternehmensführung + Leitbild`
- `trainer + Unternehmensführung + Personal`
- `trainer + Rechnungswesen + ...`

Diese Zustände sind unabhängig voneinander und dürfen nicht gegenseitig überschrieben werden.

### 5.4 "Von vorne" im Trainer

"Von vorne" soll genau die aktuelle Frage-Position zurücksetzen, aber nichts anderes:

- Setzt den gespeicherten Resume-Status für `bereich + fach + auswahl` auf die erste Frage-ID des aktuellen Pools
- Zeigt die erste Frage an
- Belässt Lernstand, attempts, statistics, Ergebnis-/Session-Statistiken unverändert
- Ruft keine bestehende Session-reset-Logik auf

Das ist bewusst getrennt von `resetSession()`.

---

## 6. Quiz Data Flow

### 6.1 Standard-Flow

Der Quiz-Verlauf folgt dem gleichen Muster:

- `user + quiz + fach + auswahl`
- Wenn gespeicherter Resume-Status existiert und die Frage noch im aktuellen statischen Katalog vorhanden ist: diese Frage anzeigen
- Ohne gespeicherten State: Start mit erster Frage des aktuellen Katalogs

### 6.2 Normaler Save

Wenn die normale Quiz-Frage im Frontend sichtbar wird oder die Navigation zwischen Fragen stattfindet, wird die Frage-ID des aktuellen normalen Katalogeintrags gespeichert.

### 6.3 Shuffle im Quiz

Während `shuffleMode === true` gilt dieselbe Regel wie im Trainer:

- Nur die lokale Reihenfolge wird permutiert
- Der normal gespeicherte Resume-Status bleibt unangetastet
- Die zufällige Reihenfolge wird nicht als regulärer Fortschritt persistiert

---

## 7. Shuffle Behavior

### 7.1 Ziele

Shuffle soll nur die momentan geladene Frage-Pool-Reihenfolge im Browser ändern, ohne:

- die Google-Sheet-Reihenfolge zu ändern
- den statischen Quizfragen-Datensatz zu verändern
- den regulären gespeichert Resume-Status zu überschreiben
- die ursprüngliche Reihenfolge nach Neu-Login/Reload zu verlieren

### 7.2 Implementierungsprinzipien

- `shuffleMode` als boolescher client-seitiger Zustand
- Beim Aktivieren: neuer Array-Index für den geladenen Frage-Pool im Browser erzeugen
- Beim Deaktivieren: zurück zur normalen Reihenfolge des aktuellen Katalogs
- Repeated shuffle: neue zufällige Reihenfolge möglich
- Keine Persistenz über `localStorage`/`sessionStorage`/Google Sheet
- Nach Reload/Login: zurück auf normalisierte Reihenfolge und letzten regulär gespeicherten Fortschritt

### 7.3 Minimaler State

Der Frontend-State kann sehr klein gehalten werden:

- `shuffleMode = false` initial
- `currentPoolOrder` = normale Reihenfolge oder shuffle-Variante
- `shuffleMode` niemals als part of database progress row

Das entspricht dem Requirement "Keep implementation minimal".

---

## 8. "Von vorne" Behavior

"Von vorne" ist ein reiner Position-Reset, nicht ein Session-/Lernstand-Reset.

### 8.1 Verhalten

Für den aktuellen Bereich + Fach + Auswahl:

- setze den gespeicherten Resume-Status auf die erste Frage-ID des aktuellen Pools
- zeige die erste Frage an
- lasse Lernstand, attempts, Bewertung, Statistik und übrige Session-Ergebnisse unverändert

### 8.2 Separate von Session zurücksetzen

`resetSession()` und verwandte totale Session-Resets bleiben unverändert und dürfen nicht in dieser Funktion aufgerufen werden.

### 8.3 Backend-Implementierung

Die einfachste Variante ist: `saveProgress` mit `frageId = firstQuestionId` aufrufen; damit wird der Stored-State auf erste Frage gesetzt, ohne den Lernstand in anderer Weise zu ändern.

---

## 9. UI Placement

### 9.1 Buttons

Trainer und Quiz erhalten zwei kleine sekundäre Buttons:

- `Von vorne`
- `Shuffle Mix`

Diese Buttons:

- sollen nicht wie primäre Antwort-/Auswertungs-Aktionen wirken
- sollen auf Mobilgeräten gut nutzbar bleiben
- sollen die aktuelle Reihe / Auswahl desaktualisieren, ohne das gesamte Layout zu verändern

### 9.2 Active State

Beim `Shuffle Mix` Button muss ein sichtbarer aktiver Zustand gesetzt werden, z. B. `active`-CSS-Klasse oder visuelle Hervorhebung.

### 9.3 Platzierung

Die beste Platzierung ist in der Nähe der Frage-/Quiz-Navigation, aber außerhalb der Haupt-Auswertungs- oder Antwortaktionen. Die genaue Position kann technisch in der bestehenden Bereichs-Toolbar erfolgen, damit die bestehende Seiten-Struktur unverändert bleibt.

---

## 10. Error / Fallback Behavior

### 10.1 Progress-Load-Fehler

Wenn der Progress-Load fehlschlägt:

- Startet das System mit der ersten Frage
- Es werden keine blockierenden Fehler erzeugt

### 10.2 Save-Fehler

Wenn das Speichern fehlschlägt:

- bleibt das Frontend weiterhin nutzbar
- der aktuelle Frage-Flow setzt sich nicht selbst aus dem UI heraus auf null
- ein Fehler wird gemäß den vorhandenen Projekt-Konventionen geloggt / im Statusbereich gemeldet

### 10.3 Stale oder fehlende Frage-ID

Wenn die gespeicherte `Letzte Frage-ID` nicht mehr im aktuellen Pool vorhanden ist:

- Fallback auf die erste Frage
- Falls sinnvoll, der stale saved state automatisch durch die erste Frage-ID ersetzt

### 10.4 No-Blocking Behavior

Die Fortschritts-Persistenz darf das Lernen nicht unbrauchbar machen; sie ist additiv und resilient.

---

## 11. Dateien, die voraussichtlich geändert werden

Es wird erwartet, dass die Umsetzung in folgenden Dateien erfolgen wird:

- [js/trainer.js](../../js/trainer.js)
- [js/quiz.js](../../js/quiz.js)
- [js/api.js](../../js/api.js)
- [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs)
- [js/login.js](../../js/login.js)
- [js/firebase-config.js](../../js/firebase-config.js)
- [index.html](../../index.html)

Optional, je nach Abstraktion:

- [js/main.js](../../js/main.js)
- [js/bewertung.js](../../js/bewertung.js)

---

## 12. Test Strategy

Die folgenden Tests sollten im Implementierungs- und QA-Plan abgedeckt werden:

1. neuer User -> erste Frage
2. zurückkehrender Trainer-User -> gespeicherte Frage
3. getrennte Fortschritte für zwei Trainer-Fächer
4. getrennte Fortschritte für zwei Trainer-Themen
5. Quiz-Fortschritt getrennt von Trainer-Fortschritt
6. Logout löscht gespeicherten Fortschritt nicht
7. anderer Device-/Account-Session lädt den Fortschritt wieder
8. fehlende oder veraltete Frage-ID -> erste Frage
9. "Von vorne" verändert nur die Position
10. "Von vorne" lässt Lernstand/Statistiken unangetastet
11. Shuffle randomisiert den aktuellen Pool
12. Shuffle persistiert die Reihenfolge nicht
13. Shuffle überschreibt regulären Resume-Status nicht
14. Deaktivieren von Shuffle führt zurück zur normalen Reihenfolge
15. Backend aktualisiert bestehende Zeile statt bei jeder Navigation neue Zeilen anzulegen

### 12.1 Backend-Teststrategie

- Test der `NutzerFortschritt`- Tabelle mit Duplikat-Schlüssel-Fällen
- Stressfall: save same key twice -> updates only one row
- stale value test -> first question fallback

### 12.2 Frontend-Teststrategie

- Check normal flow for Trainer
- Check normal flow for Quiz
- Check `shuffleMode` toggling and no persistence
- Check `Von vorne` leaves attempts intact

---

## 13. Deployment Considerations

- Das neue Sheet `NutzerFortschritt` muss im Google Spreadsheet manuell vorhanden sein oder durch Apps-Script-Setup erzeugt werden.
- Die Spaltennamen müssen exakt der Annahme entsprechen, damit die Sheet-Logik stabil ist.
- Die Google Apps Script-Ausführung muss über die bereits vorhandene Script-Verknüpfung laufen; keine neue App-Umgebung, kein neues Projekt.
- Die Frontend-Aufrufe müssen mit derselben API-Struktur wie `apiGet` und `apiPost` arbeiten, damit bestehende Deployment-Mechanik unverändert bleibt.
- Die App darf keine zusätzliche Firestore-Entscheidung verlangen.

---

## 14. Risks / Compatibility Notes

- Der größte Architektur-Konsistenzpunkt ist die Identität: Die App muss die vorhandene Firebase-UId verwenden und nicht eine neue UID-Lösung einführen.
- Trainer- und Quiz-"Auswahl" muss eine feste technische Darstellung haben; `__ALL__` ist der robusteste Default für den "Alle Fälle"-Fall.
- Wenn es im Trainer mehrere Levels der Auswahl gibt, muss definiert sein, was `Auswahl` genau bedeutet: Thema, Pool, Fach oder kombinierte Auswahl. Ohne diese Klarheit kann der Resume-Key unzuverlässig sein.
- Shuffling darf nur im Frontend laufen; falls eine bisherige Browser-Session die gemischte Reihenfolge zwischen Ansichten weitergibt, muss die Logik klar definieren, ob derselbe Session-State benutzt wird oder nur die aktuelle Frage-Variante.
- Der System-Reset (`resetSession`) und der Resume-Reset (`Von vorne`) müssen bewusst getrennt bleiben, sonst werden Lern-/Statistik-Daten versehentlich gelöscht.

---

## 15. Festgelegte technische Entscheidung

Diese Architekturentscheidung ist jetzt verbindlich festgelegt:

- Für jede komplette "Alle Themen" / gesamte Auswahl-Ansicht gilt `Auswahl = "__ALL__"`.
- Trainer und Quiz verwenden denselben festen technischen Wert für den vollständigen Pool, um die Resume-Keys konsistent und cross-device stabil zu halten.
- `saveProgress` speichert den normalen Resume-Status als `frageId`; das "Von vorne"-Reset nutzt denselben Save-Pfad mit der ersten Frage-ID des aktuellen Pools.

---

## Abschluss-Statement

Dieses Design hält sich an die bestehende Architektur: Firebase Auth als User-Identity, Google Apps Script als API-Backend, Sheets als persistent storage, und `apiGet`/`apiPost` als bestehende Kommunikationsmuster. Es erweitert die App minimal um eine kompakte User-Progress-Tabelle ohne bestehende Lernstand- oder Session-Logik zu verändern.

---

## Spec-Pfad

[docs/superpowers/specs/2026-08-30-learning-progress-resume-design.md](2026-08-30-learning-progress-resume-design.md)

## Ergebnis der Architekturprüfung

- User identity source: Firebase `auth.currentUser.uid` / `window.aktuellerNutzer`, validated through `emailVerified === true`
- Existing persistence mechanism: Google Apps Script + Sheet-based `Lernstand` flow, plus Firestore profile storage for user metadata when present, but no current user-progress state for Trainer/Quiz
- Expected code files: [js/trainer.js](../../js/trainer.js), [js/quiz.js](../../js/quiz.js), [js/api.js](../../js/api.js), [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs), [js/login.js](../../js/login.js), [js/firebase-config.js](../../js/firebase-config.js), [index.html](../../index.html)
- Architecture decisions resolved: `Auswahl = "__ALL__"` is fixed for full-pool / all-topics views, and the resume key remains stable across login and re-entry
