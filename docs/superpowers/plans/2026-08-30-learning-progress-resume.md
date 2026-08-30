# Implementierungsplan: Persistenter Lernfortschritt je Nutzer für Trainer und Quiz

Status: Planungsentwurf, nicht implementiert
Datum: 2026-08-30

## Ziel

Diese Datei beschreibt den konkreten Umsetzungsplan für die in der Design-Spec formulierten Anforderungen. Der Plan ist auf minimale Änderungen, bestehende Architekturen und klare Arbeitsschritte ausgerichtet.

---

## 1. Projektstatus und Scope

### In Scope

- neues Google Sheet `NutzerFortschritt`
- Apps-Script GET/SAVE Fortschritt für `trainer` und `quiz`
- Auto-Resume für Trainer und Quiz pro Firebase-UID
- `Von vorne` per Bereich + Fach + Auswahl
- `Shuffle Mix` nur lokal im Browser-Session
- Tests für Resume, Fallback, Update-Logik und Shuffle-Handling
- Deployment-Checkliste

### Out of Scope

- keine Änderung am Lernstand
- keine Änderung an Open-Answer-Evaluation
- keine Änderung an Prüfungssimulation
- keine Änderung an statischem Quizfragen-Katalog
- keine neue Firestore-Architektur
- keine Änderung an existing session reset behavior

---

## 2. Implementierungsprinzipien

1. Bestehende Architektur beibehalten:
   - Firebase Auth bleibt Quelle der Nutzer-ID
   - Apps Script bleibt API-Backend
   - Google Sheet bleibt persistent storage
2. Minimaler API-/Datenfluss:
   - `apiGet`/`apiPost` bleiben der Kommunikationsstandard
3. Keine Event-Logik:
   - `NutzerFortschritt` bleibt compact state table
4. Shuffling bleibt client-only:
   - keine Persistenz der gemischten Reihenfolge
5. Resume bleibt per Benutzerkontingent:
   - `Nutzer + Bereich + Fach + Auswahl`

---

## 3. Arbeitsabschnitt A – Datenmodell und Sheet vorbereiten

### Schritt A1: neues Sheet anlegen

Im Google Spreadsheet ein neues Blatt mit dem Namen `NutzerFortschritt` anlegen.

Spalten in Reihenfolge:

- A Nutzer
- B Bereich
- C Fach
- D Auswahl
- E Letzte Frage-ID
- F Aktualisiert

### Schritt A2: Datenformat definieren

- `Nutzer`: Firebase UID (`auth.currentUser.uid`)
- `Bereich`: `trainer` oder `quiz`
- `Fach`: exakter Fachname wie im bestehenden Trainer/Quiz-Data-Model
- `Auswahl`:
  - `__ALL__` für komplette / alle Themen-Ansicht
  - für konkrete Themen-/Pool-Auswahl: stabiler Name oder stabiler technische Key, falls vorhanden
- `Letzte Frage-ID`: stabile Frage-ID, keine Array-Position
- `Aktualisiert`: Timestamp im Standard-Format des Apps Script / Google Sheets

### Schritt A3: Deduplizierung sichern

- Der logische Schlüssel ist genau `Nutzer + Bereich + Fach + Auswahl`
- Beim Speichern wird immer ein vorhandener Satz aktualisiert
- Nicht bei jeder Frage eine neue Zeile schreiben

### Schritt A4: Hilfsfunktionen im Apps Script vorbereiten

Im [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs) in einer neuen Code-Region die folgenden Hilfsfunktionen einbauen:

- `getNutzerFortschrittSheet_()`
- `normalizeProgressSelection_(value)`
- `readProgressRow_(nutzer, bereich, fach, auswahl)`
- `saveProgressRow_(nutzer, bereich, fach, auswahl, frageId)`
- `getProgressForKey_(nutzer, bereich, fach, auswahl)`
- `upsertProgressRow_(...)`

Ziel: einheitliche Logik, keine doppelte Implementierung.

---

## 4. Arbeitsabschnitt B – Apps Script API erweitern

### Schritt B1: GET-Endpoint für Fortschritt ergänzen

In [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs) im `doGet(e)`-Router einen neuen Fall ergänzen:

- `action === "getProgress"`
- Parameter:
  - `bereich`
  - `fach`
  - `auswahl`
- Rückgabe:
  - `{ success: true, data: { letzteFrageId, aktualisiert } }`
  - oder `{ success: true, data: null }` bei keinem Eintrag
  - Fehlermeldungen wie bisher als `{ success: false, error: ... }`

### Schritt B2: POST-Endpoint für Fortschritt ergänzen

Im `doPost(e)`-Router einen neuen Fall ergänzen:

- `action === "saveProgress"`
- body:
  - `bereich`
  - `fach`
  - `auswahl`
  - `frageId`
- Logik:
  - nutzer aus aktuell verwendeter Auth-ID des Frontends übernehmen
  - key bilden und upserten
  - timestamp setzen

### Schritt B3: robustes Verhalten bei fehlendem Eintrag

Wenn kein Eintrag existiert:

- neuer Datensatz einfügen

Wenn `frageId` leer ist:

- nicht speichern, stattdessen `firstQuestionId` oder Fehlerfall sauber behandeln

### Schritt B4: Fallback-Logik für stale IDs

Im Backend/Frontend-Check ergänzen:

- Wenn der gespeicherte `frageId` im aktuellen Pool nicht gefunden wird, auf erste Frage umschalten
- optional: sofort erneutes speichern der ersten Frage-ID als neue Normal-Position

---

## 5. Arbeitsabschnitt C – Frontend: API-Wrapper erweitern

### Schritt C1: API-Helfer ergänzen

In [js/api.js](../../js/api.js) neue minimal-API-Utilities ergänzen, ggf. über bestehende Wrapper-Logik:

- `apiGet('getProgress', { bereich, fach, auswahl })`
- `apiPost('saveProgress', { bereich, fach, auswahl, frageId })`

### Schritt C2: keine neue Auth-Mechanik

Keine zweite User-ID einführen. Die Frontend-Implementierung muss immer `auth.currentUser.uid` bzw. `window.aktuellerNutzer` verwenden.

### Schritt C3: Cache-Busting

Bei den neuen GET/POST Calls keine veraltete Cache-Strategie aus dem alten Lernstand verwenden; statt dessen für die Fortschritts-Calls sauber mit:

- aktuelle URL-Parameter
- normaler `fetch`-Semantik
- ggf. `cache: 'no-store'` falls nötig

nur im extremen Falle verwenden, damit keine gestoppten stalen Antwort-Caches das Resume-Verhalten stören.

---

## 6. Arbeitsabschnitt D – Trainer-Fortsetzen implementieren

### Schritt D1: stable current selection key definieren

Im Trainer im gültigen Auswahl-Kontext einen stabilen Schlüssel berechnen:

- Standard: `bereich = 'trainer'`
- `fach = aktuellesFach`
- `auswahl = aktuellesThema` oder `__ALL__` falls der Pool/Viewer die komplette Auswahl anspricht

Im Code muss immer eine Funktion existieren, die diese Kombination in einen eindeutigen Resume-Key normalisiert.

### Schritt D2: Load-Sequenz beim Trainer aufbauen

Beim Laden eines Trainer-Fachs/Topics:

1. Pool laden
2. `getProgress` für `trainer + fach + auswahl` abfragen
3. wenn gespeicherte ID im aktuellen Pool existiert => zeigen
4. sonst => erste Frage aus dem aktuellen Pool zeigen

### Schritt D3: current question save trigger hinzufügen

Whenever the visible Trainer question is set to the active current question:

- `saveProgress` nur ausführen, wenn `shuffleMode === false`
- `frageId = aktuelleFrageId`
- Bereich/Fach/Auswahl aus dem aktuellen Kontext

Wichtig:

- kein Save beim Shuffle-Modus
- kein Save bei Lernstands-Statistiken

### Schritt D4: "Von vorne" im Trainer

Implementierung:

- `fragenpool = currentPoolForTrainer`
- `firstQuestionId = first active question id in pool`
- `saveProgress({ bereich:'trainer', fach, auswahl, frageId: firstQuestionId })`
- UI auf erste Frage setzen
- `resetSession()` nicht aufrufen
- Lernstand/attempts/statistics unverändert lassen

### Schritt D5: Trainer-UI-Kontrolle hinzufügen

In [index.html](../../index.html) oder der relevanten Ansicht:

- `Von vorne` Button ergänzen
- `Shuffle Mix` Button ergänzen
- sichtbaren Active-State für Shuffle ergänzen
- Mobile-Usability prüfen

---

## 7. Arbeitsabschnitt E – Quiz-Fortsetzen implementieren

### Schritt E1: Resume-Key für Quiz definieren

- `bereich = 'quiz'`
- `fach = aktueller Katalog- oder Fachfilter`
- `auswahl = __ALL__` für kompletten Quiz-Pool oder stabiler Pool-Key, falls im Quiz-Kontext schon ein eigener Pool-Selector existiert

### Schritt E2: Quiz-Load-Sequenz

Beim Initialisieren des Quiz:

1. Katalog laden
2. `getProgress` für Quiz-Key abrufen
3. falls `frageId` im aktuellen statischen Katalog verfügbar => diese Frage zeigen
4. falls nicht => erste Frage des aktuellen Katalogs zeigen

### Schritt E3: Save beim normalen Quiz-Lauf

Beim Wechsel der normalen Frage im Quiz:

- `saveProgress` nur wenn `shuffleMode === false`
- `frageId = current quiz question id`
- reguläre Savestate nicht überschreiben, wenn shuffle aktiv ist

### Schritt E4: "Von vorne" im Quiz

- setze Progress auf erste Frage-ID des aktuellen Quiz-Pools
- UI zurück auf erste Frage
- keine Lernstand-/Session-Reset-Operation

### Schritt E5: Shuffle Mix im Quiz

- nur lokale Reihenfolge des aktiven Quiz-Pools permutieren
- `shuffleMode` toggled local
- `saveProgress` automatisch überspringen, wenn shuffle aktiv
- beim Ausschalten zurück zur normalen Reihenfolge des Katalogs

---

## 8. Arbeitsabschnitt F – Shuffle Mix sauber trennen

### Schritt F1: client-side state einführen

In [js/trainer.js](../../js/trainer.js) und [js/quiz.js](../../js/quiz.js) ein lokaler Zustand wie folgt einführen:

- `shuffleMode = false`
- `currentPoolOrder = normal | shuffled`
- `shuffleSeed` oder `shuffledPool` nur im JS-Objekt

### Schritt F2: Shuffle nur im aktuellen Browser/Session

- aktueller Pool wird lokal gemischt
- gemischte Reihenfolge nicht in Sheet-Progress gespeichert
- gemischte Reihenfolge nicht in `localStorage`/`sessionStorage` persistiert
- bei Reload/Login: normale Reihenfolge wieder einsetzen

### Schritt F3: disable-Flow

Wenn `Shuffle Mix` deaktiviert wird:

- normaler Pool zurücksetzen
- letzte reguläre Resume-Position im System bleibt erhalten
- keine globale Lernstand-Änderung

---

## 9. Arbeitsabschnitt G – Resets und UI-Aktionen

### Schritt G1: neue Buttons einbauen

In [index.html](../../index.html):

- `Von vorne` Button in Trainer- und Quiz-Ansicht
- `Shuffle Mix` Button in Trainer- und Quiz-Ansicht
- kleine sekundäre Stilklasse verwenden, damit keine primären CTA-Hierarchie entsteht

### Schritt G2: Event-Handler verbinden

- `vonVorneClickHandler()`
- `shuffleToggleHandler()`

### Schritt G3: UI State rules

- `Shuffle Mix` aktiviert => aktive Visualisierung
- `shuffleMode === true` => Save-Funktion deaktivieren
- `shuffleMode === false` => normale Resume-Save aktiv

---

## 10. Arbeitsabschnitt H – Error/Fallback- und Robustheitslogik

### Schritt H1: Progress-Load-Fehler

Wenn `getProgress` fehlschlägt:

- erste Frage anzeigen
- keine blockierende Fehlermeldung

### Schritt H2: Save-Fehler

Wenn `saveProgress` fehlschlägt:

- aktuelle Frage bleibt nutzbar
- UI-Status / console.warn verwendet
- keine komplette Navigation blockieren

### Schritt H3: stale question id

Wenn gespeicherte Frage nicht mehr im aktuellen Pool liegt:

- erste Frage anzeigen
- wenn möglich, im nächsten erfolgreichen Save die erste Frage als neuen normal progress speichern

### Schritt H4: Logout

- Logout darf gespeicherten Fortschritt nicht löschen
- keine zusätzliche Clear-Logik für `NutzerFortschritt`

---

## 11. Arbeitsabschnitt I – Tests (TDD / QA)

### Phase I.1: Unit/Test-Case-Liste

Mindest-Tests laut Design-Spec:

1. new user -> question 1
2. returning Trainer user -> saved question
3. separate progress for two Trainer subjects
4. separate progress for two Trainer topics
5. Quiz progress separate from Trainer progress
6. logout does not clear persisted progress
7. another device/account session restores progress
8. missing/stale question ID -> first question
9. "Von vorne" changes only position
10. Lernstand remains untouched by "Von vorne"
11. Shuffle randomizes current pool
12. Shuffle does not persist order
13. Shuffle does not overwrite regular resume position
14. turning Shuffle off returns to ordered pool
15. backend updates existing progress row instead of continuously appending rows

### Phase I.2: Backend-Tests

- Deduplizierungstest: same key twice -> one row only
- stale row test -> first question fallback
- `__ALL__` key test -> normal pool selection remains stable

### Phase I.3: Frontend-Tests

- trainer resume from saved state
- quiz resume from saved state
- shuffle mode toggling without persist
- Von-vorne resets only question position

### Phase I.4: Regressionchecks

- keine Änderung an Lernstand-Berechnung
- keine Änderung an `resetSession()`
- keine Änderung an `open-answer` Bewertung
- keine Änderung am Quiz-Katalog selbst

---

## 12. Arbeitsabschnitt J – Deployment und Release-Checks

### Schritt J1: Sheet vorbereiten

- `NutzerFortschritt` im Sheet anlegen
- Spaltennamen prüfen
- erste Beispieldaten in Test-Umgebung eintragen

### Schritt J2: App Script deployen

- vorhandene Apps-Script-Deployment verwenden
- geändertes Code.gs hochladen
- `doGet`/`doPost` mit Neuem action routing validieren

### Schritt J3: Frontend deployment check

- Browser-Reload mit Test-User
- gespeicherten Progress prüfen
- `Von vorne` und `Shuffle Mix` prüfen
- Logout nach Login prüfen
- cross-device check mit derselben Firebase UID

### Schritt J4: Cache-Busting / stale check

- nach Deployment sicherstellen, dass neue Frontend-Versionen nicht mit veralteten Browser-Caches auf alte API-Logik laufen
- z. B. über neue Script-Revision oder definierte Cache-Policy, falls erforderlich

---

## 13. Reihenfolge der Umsetzung (empfohlen)

1. Sheet + Apps Script read/write helpers
2. API-GET/POST endpoints
3. Trainer resume load + save + von vorne
4. Quiz resume load + save + von vorne
5. Shuffle Mix in Trainer und Quiz
6. UI controls and active state
7. Error/fallback handling
8. tests
9. deployment verification

---

## 14. Risiko- und Abweichungs-Checkliste

- `__ALL__` als fixed technical key darf nicht mit aktuellen Fach-/Themennamen vermischt werden
- Dedicated key must be the same across browser, app reload, and login sessions
- `shuffleMode` must never be stored as normal progress
- `Von vorne` must not accidentally call `resetSession()` or Lernstand reset flows
- Save must be idempotent for the same logical key and not append duplicates

---

## 15. Später zu ändernde Produktionsdateien

Die tatsächliche Implementierung wird später in folgenden Dateien erfolgen:

- [js/trainer.js](../../js/trainer.js)
- [js/quiz.js](../../js/quiz.js)
- [js/api.js](../../js/api.js)
- [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs)
- [js/login.js](../../js/login.js)
- [js/firebase-config.js](../../js/firebase-config.js)
- [index.html](../../index.html)

Optional je nach Code-Organisation:

- [js/main.js](../../js/main.js)
- [js/bewertung.js](../../js/bewertung.js)

---

## Abschluss

Der Plan hält sich an die bestehende Projektstruktur, verwendet die vorhandenen API- und Sheet-Konventionen und trennt sauber zwischen normalem Resume-Status, shuffle-only client state und Lernstand-/Session-Statistiken.

Die entscheidende Architektur-Entscheidung ist jetzt fest: Für vollständige Pool-/All-Themen-Ansichten gilt `Auswahl = "__ALL__"`.
