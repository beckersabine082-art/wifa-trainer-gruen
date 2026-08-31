# Technische Design-Spec: Podcast-/Karaoke-Synchronisierung

Status: Entwurf, nicht implementiert
Datum: 2026-08-31

## 1. Ziel und Nicht-Ziele

### 1.1 Ziel

Die Lerntext-Ansicht wird künftig ausschließlich auf `lerntext` als Canonical-Quelle für Audio und Karaoke basieren. `podcastText` ist künftig keine Audioquelle mehr. Es wird weder als primäre Wiedergabequelle noch als Übergangsfallback verwendet. Ein Übergangs-Fallback darf nur auf den aktuellen `lerntext` verweisen; sichtbarer Lerntext und gesprochener Inhalt dürfen nicht voneinander abweichen.

Die Architektur verfolgt diese Kernziele:

- Jede Lerneinheit erhält genau eine MP3-Datei in Firebase.
- Die MP3 läuft auch bei gesperrtem Bildschirm weiter.
- Der sichtbare Lerntext bleibt in seiner aktuellen Formatierung bestehen und wird wortweise mit einer Karaoke-Markierung synchronisiert.
- Es gibt kein automatisches Scrollen während der Wiedergabe.
- Der Lernfortschritt wird pro Firebase-UID und pro einzelner Lerneinheit gespeichert, unabhängig davon, ob die Einheit einzeln, in einem Kapitel oder über "Alle Kapitel" gehört wurde.
- Die Podcast-Erzeugung und die Text-/Wort-Zeitmarken werden durch einen lokalen Admin-Sync verwaltet, nicht durch das Frontend.
- Der sichtbare Lerntext und der gesprochene Inhalt haben denselben Wortkanon und dieselbe Reihenfolge.

### 1.2 Nicht-Ziele / Scope

- Keine Implementierung in dieser Phase.
- Keine Produktivcode-Änderungen in den bestehenden Lerntext-, Quiz- oder Prüfungsflows.
- Keine OpenAI-API-Aufrufe aus dem Browser.
- Keine Audio-Erzeugung im Frontend.
- Keine Firebase-Uploads im Rahmen dieser Spezifikation.
- Keine Einführung eines neuen Auth-/User-Systems.
- Keine neue, von `lerntext` abweichende Textquelle für die Audiowiedergabe.
- Keine automatischen Scroll- oder Fokus-Mechaniken in der Karaoke-Wiedergabe.
- Keine Änderung an bestehenden Design- und Formatierungsprinzipien des sichtbaren Lerntexts.

---

## 2. Aktueller Zustand

### 2.1 Bestehende Lerntext-Architektur

Im aktuellen Repository wird in [js/lerntexte.js](../../js/lerntexte.js) die Lerntext-Ansicht als Fächer-, Kapitel- und Lerneinheiten-Sammlung aufgebaut. Die bestehende Funktion `lerntexteAudioTextFuerEintrag()` verwendet bisher `podcastText` als bevorzugte Quelle und fällt nur dann auf `lerntext` zurück, wenn kein `podcastText` vorhanden ist.

Zusätzlich gibt es in derselben Datei bereits die folgende Basislogik:

- `lerntexteAudioFirebasePfad(fach, eintrag)` erzeugt den Firebase-Storage-Pfad `podcast/<fach-slug>-<titel-slug>.mp3`.
- `lerntexteAudioHash(text)` existiert bereits, ist aber ein einfacher Legacy/Test-Hash und kein SHA-256.
- `lerntexteAudioPlaylistErstellen()` und der vorhandene Audio-Player-Flow verwenden aktuell eine lokale Audio- und Playlist-Logik.
- Die App nutzt Firebase Storage und Firebase Auth bereits über [js/firebase-config.js](../../js/firebase-config.js).
- Der Backend-Routing-Mechanismus in [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs) nutzt `action`-Parameter und bereits vorhandene `getLerntexte`- und `getProgress`-Routes.

### 2.2 Aktueller Podcast-/Audio-Status

Der bisherige Zustand zeigt einen Übergang von `speechSynthesis`-basierten Audio-Mechaniken zu einer Firebase-Audio-Strategie, aber noch nicht die finale Architektur:

- In [js/wissensdatenbank.js](../../js/wissensdatenbank.js) gibt es noch die vorhandene `speechSynthesis`-Logik für Audio, inklusive Pause-/Fortsetzen-/Stop-Steuerung im Podcast-Modus.
- In [backend/apps-script/Code.gs](../../backend/apps-script/Code.gs) existiert ein Testpfad `podcastAudioTest`, der OpenAI TTS für eine Einzel-Text-Erzeugung aufruft.
- Der Lerntext hat bereits eine globale Struktur mit Fächern, Kapiteln und Einheiten; diese Struktur bleibt die Basis für die Podcast-/Karaoke-Synchronisierung.
- Der aktuelle Legacy-Test-Hash `lerntexteAudioHash()` darf für den neuen Podcast-Sync nicht verwendet werden.

### 2.3 Relevante Baseline für die neue Architektur

Die neue Architektur verwendet die bereits vorhandenen Elemente wieder, statt neue, unabhängige Systeme zu kreieren:

- bestehende Lerntextstruktur und `getLerntexte`
- bestehender Firebase-Auth-User, insbesondere `auth.currentUser.uid`
- bestehendes Firebase-Storage-Pfad-Schema von `podcast/<fach-slug>-<titel-slug>.mp3`
- bestehender Lerntext-Render-Flow mit HTML-Formatierung und Textblöcken
- bestehende Playlist-/Audio-UI-Mechaniken, aber mit einem neuen, synchronisierten Karaoke-Flow

Die neue Spezifikation erweitert diese vorhandenen Bestandteile, ohne sie vollständig zu ersetzen.

---

## 3. Komponenten

### 3.1 Lerntext-Quelle

Die alleinige Audio- und Karaoke-Quelle wird das aktuelle `lerntext`-Feld jeder Lerneinheit. `lerntext` ist der technische primäre Canonical Source. `podcastText` ist keine Audioquelle mehr und bleibt nur als historische bzw. nicht weiterverwendete Datenquelle ohne Wiedergabelogik in der Datenbank erhalten.

### 3.2 Lokales Admin-Werkzeug für Podcast-Sync

Ein lokales Admin-Werkzeug liest alle Lerntexte read-only über `getLerntexte` und erzeugt dann die Podcast-Audios sowie die Wort-Zeitmarken. Es ist kein Frontend-Feature und kein Browser-Feature. Seine Verantwortlichkeiten sind:

- `lerntext` für jede Einheit laden
- echten SHA-256 über den kanonischen `lerntext` berechnen
- den Hash mit vorhandenem MP3-/JSON-Status vergleichen
- unveränderte Einheiten überspringen
- nur geänderte oder neue Einheiten neu erzeugen
- Laufstatus, Fehler, Wiederaufnahme und Abbruchstatus verwalten
- OpenAI-Key und Firebase-Admin-Zugang nur im lokalen Admin-Kontext, niemals im Browser oder im Repository

### 3.3 TTS-/Audio-Erzeugung

Für jede Lerneinheit wird genau eine MP3-Datei erzeugt. Die Quelle ist exakt der aktuelle `lerntext`, nicht irgendein abgeleiteter Text. Für TTS darf daraus nur eine deterministische technische Normalisierung erfolgen:

- reine Absatz-/Formatierungsmarker werden in sinnvolle Pausen bzw. Whitespace umgewandelt
- keine Wörter hinzufügen
- keine Wörter entfernen
- keine fachliche Umformulierung
- Wortreihenfolge identisch zum sichtbaren Lerntext

Damit bleibt das Karaoke-Mapping auf den sichtbaren Lerntext möglich.

### 3.4 Firebase-Storage

Die Firebase-Dateien bleiben im bereits vorhandenen Pfadschema:

- MP3: `podcast/<fach-slug>-<titel-slug>.mp3`
- Zeitmarken-/Metadaten: `podcast/<fach-slug>-<titel-slug>.json`

Die JSON-Datei enthält Informationen zur Audio-Datei, der ursprünglichen Text-Fassung und den Wort-Zeitmarken, aber keine geheimen Zugriffsdaten oder Keys.

### 3.5 Hash-Modelle und Speicherung

Der neue Podcast-Sync verwendet echten SHA-256 über den kanonischen `lerntext`.

Der Hash wird gespeichert und geprüft an drei Stellen:

- im JSON als `lerntextHash`
- als Firebase Storage Custom Metadata der MP3
- als Vergleichsbasis im lokalen Sync-Job

Der bisherige `lerntexteAudioHash()` ist ein einfacher Legacy/Test-Hash und darf nicht für den Podcast-Sync verwendet werden.

### 3.6 Wort-Zeitmarken-Transkription

Nach der TTS-Erzeugung wird die MP3 transkribiert. Dabei werden wortgenaue Start- und Endzeiten erzeugt. Die Transkriptionswörter werden anschließend gegen die Wörter des originalen `lerntext` ausgerichtet, damit das Frontend genau dieselben Wortindizes verwenden kann, die der sichtbare Lerntext bereits kennt.

### 3.7 Frontend-Karaoke-Renderer

Das Frontend rendert den sichtbaren `lerntext` mit der vorhandenen Formatierung weiter und versieht die einzelnen Wörter technisch mit einer eindeutigen Adresse, etwa per `span` inklusive `wordIndex`. Dabei bleiben Überschriften, Absätze, Listen und bestehende Hervorhebungen unverändert. Das aktuelle Wort erhält eine sichtbare Highlight-Klasse, die sich anhand von `audio.currentTime` und den Zeitmarken ausrichtet.

### 3.8 Fortschritts-Store

Der Nutzerfortschritt wird pro Firebase-UID und pro Lerneinheit separat gespeichert. Er ist unabhängig davon, ob eine Einheit im Einzel- oder im Kapitel-/Playlist-Kontext gehört wurde. Die Persistenz ist geräteübergreifend verfügbar und basiert auf derselben identifizierten Firebase-UID wie der übrigen App.

### 3.9 Podcast-Fortschritt in der bestehenden Persistenzarchitektur

Der neue Podcast-Fortschritt nutzt das bereits bestehende Apps-Script-/Google-Sheets-System, aber mit einem separaten Sheet `PodcastFortschritt`. Das ist kein neues, unabhängiges System, sondern eine Erweiterung der vorhandenen Persistenzarchitektur.

Logischer Schlüssel:

- Firebase UID + stabile Lerneinheit / Firebase-Pfad

Mindestens folgende Felder:

- Nutzer
- Fach
- Einheit
- FirebasePfad
- LerntextHash
- SekundenPosition
- WortIndex
- Completed
- Aktualisiert

Apps-Script-Endpunkte: konzeptionell `getPodcastProgress` und `savePodcastProgress`.

### 3.10 Playlist-/Resume-System

Das bisherige Scheduling von Kapitel-/Playlist-Wiedergaben bleibt konzeptionell bestehen. Jede Einheit wird geladen und verarbeitet. Die Auswahl selbst bleibt eine Playlist mit Fortsetzungslogik. Die jeweiligen Fortschrittsdaten sind pro Einheit gespeichert und nicht pro Playlist-Session.

---

## 4. Datenfluss Podcast-Sync

### 4.1 Grundprinzip

Der Podcast-Sync funktioniert lokal und read-only auf den Lerntextdaten. Es wird kein Lerntext im Frontend neu erzeugt, um Audio zu generieren. Das Admin-Werkzeug lädt alle Einheiten, berechnet für jede Einheit den SHA-256-Hash über das aktuelle `lerntext`, und entscheidet dann nur anhand des Hashes und der vorhandenen Firebase-Dateien, ob eine Einheit neu erzeugt werden muss.

### 4.2 Ablauf

1. Das lokale Admin-Werkzeug ruft `getLerntexte` auf, ohne die Frontend-UI zu verändern.
2. Für jede Lerneinheit wird der aktuelle `lerntext` als Canonical Text gelesen.
3. Es wird der SHA-256-Hash über genau diesem Text berechnet.
4. Der Hash wird mit dem letzten gespeicherten Hash der Einheit verglichen.
5. Wenn Hash unverändert ist und bereits eine gültige MP3-Datei vorhanden ist, wird die Einheit übersprungen.
6. Wenn der Hash neu ist oder die MP3 fehlt, wird genau diese Einheit neu erzeugt.
7. Eine neue Audiofassung wird zuerst vollständig lokal erzeugt: MP3, Wortmapping/JSON und Validierung.
8. Erst danach wird veröffentlicht.
9. Die MP3 erhält den `lerntextHash` als Firebase Storage Custom Metadata.
10. Danach wird die zugehörige JSON veröffentlicht.
11. Die JSON wird zuletzt geschrieben und fungiert als Commit-Marker der vollständigen Fassung.
12. Der Sync kann durch Abbruch oder Fehler unterbrochen werden; die Wiederaufnahme startet dort weiter, wo die letzten verarbeiteten Einheiten bereits als eindeutig abgeschlossen erkannt sind.

### 4.3 Verhalten bei unveränderten Einheiten

Bestehende unveränderte MP3s dürfen nicht unnötig neu erzeugt werden. Ein neuer Sync verwendet den SHA-256-Hash als Prüfungsbasis für die Re-Generierung. Die Entscheidung basiert ausschließlich auf dem aktuellen `lerntext` und dem zugehörigen gespeicherten Hash, nicht auf `podcastText`.

### 4.4 Wiederaufnahme nach Abbruch

Der Admin-Sync verwaltet Fortschritt als verarbeitbare Einheit, nicht als globalen Job-Status. Eine frühere Einheit gilt als abgeschlossen, sobald der Hash-Check und ggf. die Erstellung/Validierung der MP3/JSON abgeschlossen sind. Ein abgebrochener Sync kann daher später fortgesetzt werden, ohne den kompletten Job neu zu starten oder bestehende unveränderte Dateien zu überschreiben.

### 4.5 Scope der Regeneration

Nur die betroffene Einheit wird neu erzeugt. Der Podcast-Sync regt keine komplette Neu-Erzeugung des gesamten Fachs oder Kapitels an, wenn nur eine Lerneinheit im `lerntext` geändert wurde. Dies reduziert Kosten, Laufzeit und Netzlast und respektiert die vorhandene Lerntext-Struktur.

### 4.6 Publikations- und Validierungsregel

Das Frontend darf Karaoke-Audio nur als synchron ansehen, wenn die folgenden drei Werte identisch sind:

- aktueller `lerntextHash`
- JSON-`lerntextHash`
- MP3-Storage-Custom-Metadata `lerntextHash`

Bei einem Mismatch darf keine falsche Karaoke-Wiedergabe gestartet werden. Das Frontend zeigt dann einen sichtbaren Aktualisierungs-/Fehlerstatus an. Vorherige gültige Fortschrittsdaten werden dabei nicht still gelöscht.

---

## 5. Firebase-Dateien und Metadaten

### 5.1 Pfad-Schema

Das bestehende eindeutige Firebase-Pfad-Schema wird weiterverwendet:

- MP3: `podcast/<fach-slug>-<titel-slug>.mp3`
- Metadaten/Zeitmarken: `podcast/<fach-slug>-<titel-slug>.json`

Die Basis des Pfads bleibt identisch; nur die Dateiendung unterscheidet MP3 von JSON.

### 5.2 Anforderungen an die JSON-Datei

Die JSON-Datei pro Einheit enthält mindestens:

- `lerntextHash`
- `fach`
- `titel`
- `firebasePathMp3`
- `firebasePathJson`
- `wortZeitmarken[]`
- `updatedAt`

Die Wort-Zeitmarken selbst enthalten mindestens:

- `wortIndex`
- `wort`
- `start`
- `end`

Zusätzlich kann die JSON-Datei technische Metadaten enthalten, die für Debugging, Validierung und Wiederaufnahme nützlich sind, aber nicht erforderlich, um die Funktionalität herzustellen.

### 5.3 Hash-Aktualisierung

Wenn sich `lerntext` ändert, ändert sich auch der gespeicherte `lerntextHash`. Die neue Hash-Version wird als neue gültige Canonical-Quelle behandelt. Bestehende Resume-/Fortschrittsdaten zu der alten Textfassung dürfen nicht wiederverwendet werden, da die Wortindizes und Zeitmarken der alten Fassung nicht mehr zum aktuellen `lerntext` passen.

### 5.4 Vermeidung von Datenverlust

Ein bestehender Hash darf nicht stillschweigend überschrieben oder verloren gehen. Wenn ein Fehler während der Podcast-Erzeugung auftritt, muss der Betrieb sichtbar melden, was fehlgeschlagen ist. Vorherige gültige Fortschrittsdaten dürfen nicht still gelöscht werden. Die JSON-Datei fungiert als Commit-Marker der vollständigen Fassung und bleibt erst gültig, wenn die komplette Fassung lokal validiert und publiziert wurde.

---

## 6. Wort-Zeitmarken und Text-Mapping

### 6.1 Anforderungen an die Zeitmarken

Nach der MP3-Erzeugung wird eine Transkription erstellt. Dabei entstehen für jedes Wort genaue Start-/Endzeiten. Die erzeugten Zeiten sind sekundengenau bzw. sub-sekundengenau, soweit die Transkriptions-Engine das liefert. Das Mapping legt fest, welches Wort im sichtbaren Lerntext zum jeweiligen Zeitfenster gehört.

### 6.2 Ausrichtung gegen den originalen `lerntext`

Die Transkriptionswörter werden gegen die Wörter des originalen `lerntext` ausgerichtet. Das ist so zu designen, dass nicht zwei unabhängig entwickelte Textstrukturen im Frontend zur Laufzeit zusammengeführt werden müssen. Stattdessen ist der sichtbare `lerntext` bereits die primäre Quelle; die Wort-Zeitmarken beziehen sich exakt auf dieselben Wortindizes.

### 6.3 Mindestschema der Wort-Zeitmarken

Jedes Wort in der JSON-Datei enthält mindestens:

- `lerntextHash`
- `wortIndex`
- `wort`
- `start`
- `end`

Das Frontend darf später nicht gezwungen sein, einen zweiten, vom Transkript unabhängigen Text zu erzeugen und während der Wiedergabe anzupassen. Das Wort-Mapping wird als Teil des synchronisierten Datenpakets betrachtet und kann direkt vom Frontend verwendet werden.

### 6.4 Umgang mit Formatierung und Satzzeichen

Der sichtbare Lerntext kann weiterhin durch HTML-Strukturen, Absätze, Überschriften und besondere Hervorhebungen formatiert sein. Die Wortindex-Logik greift auf die Textinhalte der sichtbaren Wörter, nicht auf die HTML-Darstellung, zurück. Satzzeichen und Sonderzeichen werden bei der Wort-Ausrichtung auf konsistente Weise behandelt, ohne die vorhandene Formatierung zu verlieren.

### 6.5 TTS-Normalisierung und Wortreihenfolge

Der TTS-Text wird aus dem aktuellen `lerntext` abgeleitet, aber nur durch eine deterministische technische Normalisierung. Reine Absatz-/Formatierungsmarker werden in sinnvolle Pausen bzw. Whitespace umgewandelt; keine Wörter werden hinzugefügt, entfernt oder fachlich umformuliert. Die Wortreihenfolge bleibt identisch zum sichtbaren Lerntext. Dadurch bleibt das Karaoke-Mapping auf den sichtbaren Lerntext möglich.

---

## 7. Frontend-Karaoke

### 7.1 Sichtbarer Lerntext bleibt erhalten

Der sichtbare Lerntext bleibt in seinem vorhandenen Zustand mit bestehender Formatierung erhalten. Es werden keine Seitenstruktur, Überschriften, Absätze oder Hervorhebungen entfernt oder umgebaut. Das Design macht nur die Wörter technisch adressierbar, etwa durch `span`-Elemente mit einem `wordIndex`.

### 7.2 Rendering-Strategie

Der vorhandene formatierte Lerntext wird zunächst normal gerendert. Danach werden ausschließlich Textnodes innerhalb der Lerntextanzeige tokenisiert und Wörter in adressierbare Spans mit Wortindex gewrappt. Bestehende Überschriften, Absätze, `strong`-Elemente, Hervorhebungen und Blockstruktur werden nicht aus Plaintext neu zusammengesetzt. Satzzeichen bleiben visuell erhalten. Wortindizes stimmen mit der Sync-JSON überein.

### 7.3 Wort-Highlight und aktive Markierung

Das aktuell gesprochene Wort erhält eine sichtbare Highlight-Klasse, die im Frontend klar unterscheidbar ist. Bei diesem Highlight bleibt das Layout stabil; es wird kein Scrollen ausgelöst und keine Betriebsmittel der Textanzeige verändert.

### 7.4 Zeitbasierte Markierung

Die Markierung verwendet das aktuelle `audio.currentTime` und die zugehörigen Wort-Zeitmarken. Für den aktuellen Zeitstempel wird das passende Wort gewählt. Dabei gilt: Das aktuelle Wort wird exakt auf Basis des Zeitfensters markiert, nicht auf Basis einer approximierten Textposition.

### 7.5 Kein automatisches Scrollen

Das Frontend darf insbesondere auf Mobilgeräten kein automatisches Scrollen auslösen, wenn ein neuer Wortindex relevant wird. Die Wiedergabe des Audio-Streams und die Markierung des Worts sind unabhängig vom Scrollzustand. Der Nutzer bleibt auf seinem aktuellen Lesefenster.

### 7.6 Entsperren / Zurückkehren

Beim Entsperren oder Zurückkehren in die App muss die korrekte Wortmarkierung anhand der aktuellen Audiozeit sofort wieder hergestellt werden. Die UI liest die aktuelle Zeit aus dem Audio-Element und ermittelt den passenden Wortindex direkt aus den vorhandenen Zeitmarken. Dabei kann keine manuelle Rekonstruktion des Text-Fortschritts stattfinden.

### 7.7 Pause, Stop und Fortsetzen

Die UI- und Audio-Logik muss diesen verhaltensbezogenen Ablauf sauber trennen:

- Pause: Audio pausiert; die Markierung bleibt exakt am aktuellen Wort stehen.
- Stop: Audio stoppt; `currentTime` bleibt logisch an der aktuellen Stelle; die Markierung bleibt am letzten gesprochenen Wort stehen; der Fortschritt wird gespeichert.
- Fortsetzen: Audio startet an der gespeicherten Position und setzt die Markierung exakt an der gespeicherten Wortposition fort.
- Von vorne abspielen: Audio startet bewusst von Anfang der aktuellen Einheit, Kapitel- bzw. Auswahl-Position. Ein Stop danach wird dann zum neuen Resume-Stand.

Das Verhalten gilt sowohl für Einzelwiedergabe als auch für Playlist-/Kapitelwiedergabe.

### 7.8 Legacy-Stop-Verhalten

Der aktuelle Legacy-Test-Stop in [js/lerntexte.js](../../js/lerntexte.js) setzt `currentTime = 0`. Dieses Verhalten wird für die neue Podcast-Wiedergabe nicht übernommen. Der neue Stop hält die aktuelle Zeitlogik und markiert das aktuelle Wort weiter, ohne auf Sekunde 0 zurückzustellen.

### 7.9 Fortschrittsanzeige

Der zukünftige primäre sichtbare Audiofortschritt ist die Karaoke-Markierung direkt im Lerntext. Die bisherige externe Zeit-/Prozent-Leiste ist nach erfolgreicher Migration nicht mehr die primäre Fortschrittsanzeige. Kein Auto-Scroll.

---

## 8. Nutzerfortschritt

### 8.1 Fortschritt pro Einheit und User

Der Nutzerfortschritt wird pro Firebase-UID und pro einzelner Lerneinheit gespeichert. Dabei ist die Einheit durch einen stabilen Identifier gekennzeichnet, der dem Firebase-Storage-Pfad oder einer entsprechenden stabilen Lerneinheits-ID entspricht. Der Fortschritt bleibt unabhängig davon, ob die Einheit einzeln, in einem Kapitel oder über "Alle Kapitel" gehört wurde.

### 8.2 Mindestfelder

Für jede gespeicherte Lerneinheit im Podcast-Fortschritt werden mindestens folgende Felder gespeichert:

- `Nutzer`
- `Fach`
- `Einheit`
- `FirebasePfad`
- `LerntextHash`
- `SekundenPosition`
- `WortIndex`
- `Completed`
- `Aktualisiert`

Zusätzlich kann der Fortschritt noch Kontextdaten wie `Kapitel` oder `Playlist-Selection` enthalten, sofern sie bereits als stabil und konsistent vorhanden sind. Der Pflichtteil besteht aber in den oben genannten Feldern.

### 8.3 Persistenzprinzip

Der Fortschritt muss geräteübergreifend verfügbar sein. Dasselbe Auth-User-Modell, das die App bereits nutzt, ist die Grundlage. Dabei gilt: Es gibt keinen zweiten, von der Browser-Session unabhängigen Benutzerkontext; der vorhandene Firebase-UID bleibt der technische Schlüssel.

### 8.4 Explizite Speicherung bei Pause/Stop/Ende

Pause, Stop und Ende müssen den Fortschritt explizit sichern. Für längere Audio-Streams werden zusätzlich gelegentliche Checkpoints angelegt, damit der Fortschritt auch bei einem unvorhergesehenen Abbruch oder bei einem Browser-Neustart noch rechtzeitig gespeichert wird.

### 8.5 Completed-Logik

Eine komplett gehörte Lerneinheit gilt als `completed = true`. Beim Fortsetzen wird eine bereits `completed`-Einheit übersprungen; die App geht zur nächsten offenen Einheit. Ist eine Einheit nur teilweise gehört, wird sie an der gespeicherten Sekunden-/Wortposition fortgesetzt.

### 8.6 Hash-Änderung invalidiert alten Resume-Stand

Wenn sich der `lerntext` ändert, ist der bisherige `lerntextHash` nicht mehr gültig. Dadurch darf eine alte Resume-Position dieser veralteten Textfassung nicht wiederverwendet werden. Das System erkennt die Diskrepanz unmittelbar und verweist auf den aktuellen Stand der Lerneinheit, der beim nächsten Podcast-Sync neu erzeugt werden kann.

### 8.7 Apps-Script-Endpunkte und Sammelzugriff

Das vorhandene `getProgress`-Trainer/Quiz-Schema wird nicht erweitert. Für Podcast-Fortschritt werden zusätzliche Apps-Script-Endpunkte konzeptionell vorgesehen:

- `getPodcastProgress`
- `savePodcastProgress`

Diese Endpunkte lesen möglichst gesammelt pro Nutzer/Fach, nicht einen HTTP-Request pro Lerneinheit. Schreiben erfolgt als Upsert für die einzelne Einheit.

---

## 9. Playlist-/Resume-Logik

### 9.1 Bestehende Playlist bleibt konzeptionell erhalten

Die vorhandene Firebase-Playlist für mehrere Lerneinheiten bleibt als Konzept im System erhalten. Jede Einheit wird geladen und verarbeitet, aber die Auswahl selbst bleibt eine Playlist, die je nach weiterer Auswahl einen Sequenzfluss bildet.

### 9.2 Automatische Fortsetzung

Nach dem Ende einer Einheit geht die App automatisch zur nächsten offenen Einheit in der Auswahl. Dabei betrifft der Status immer nur die einzelne Lerneinheit, nicht die gesamte Playlist als ein einziger Fortschrittspunkt.

### 9.3 Resume-Verhalten

- `Fortsetzen` setzt bei einer teilweise gehörten Einheit an der gespeicherten Sekunden-/Wortposition fort.
- `Fortsetzen` überspringt `completed`-Einheiten und wählt die nächste offene Einheit.
- `Von vorne abspielen` startet die aktuelle Auswahl bewusst wieder am Anfang der ausgewählten Einheiten-Scope.
- Vorhandene Completed-/Resume-Stände werden für diesen bewussten Wiedergabelauf zunächst ignoriert.
- Sobald danach wieder gestoppt wird, wird diese neue Position zum aktuellen Resume-Stand.
- Wird eine Einheit erneut vollständig gehört, bleibt bzw. ist sie `completed`.

### 9.4 "Von vorne abspielen" – exakte Auswahllogik

- Einzelne Einheit ausgewählt: Start bei dieser Einheit bei 0.
- Ein Kapitel ausgewählt: Start bei der ersten Einheit dieses Kapitels bei 0.
- "Alle Kapitel" ausgewählt: Start bei der ersten Einheit der aktuellen Fach-Auswahl bei 0.

Der Start bei 0 gilt bewusst für die aktuelle Auswahl, auch wenn vorherige Resume-/Completed-Stände bestehen.

### 9.5 Unterschied zwischen Resume und Session

Der Playlist-/Auswahl-Kontext bleibt im UI-Flow erhalten, aber der eigentliche Resume-Status gehört zur einzelnen Lerneinheit. Dieser Ansatz verhindert, dass ein zufälliger oder unvollständiger Playlist-Status als echter Fortschritt behandelt wird.

---

## 10. Fehlerbehandlung

### 10.1 Kontrollierter Fallback während der Übergangsphase

Fehlende MP3-Dateien sind in der Übergangsphase zulässig, sofern ein kontrollierter Fallback anzeigt, dass die Audio-Datei noch nicht verfügbar ist. Der Fallback muss sichtbar, explizit und nachvollziehbar sein; er darf keine sparsame oder stumme Fehlermeldung sein. Ein solcher Fallback darf den aktuellen `lerntext` nicht als abweichende Sprache ausgeben; er darf nur klar anzeigen, dass Audio noch nicht verfügbar ist.

### 10.2 Sichtbare Meldungen für Firebase- und Netzwerkfehler

Andere Firebase- oder Netzwerkfehler müssen dem Nutzer sichtbar gemeldet werden. Das betrifft insbesondere:

- fehlende oder beschädigte MP3-Dateien
- fehlende oder veraltete JSON-Zeitmarken
- Network-Timeouts
- Storage-Fehler
- unvollständige Sync-Ergebnisse

### 10.3 Kein stilles Überschreiben oder Datenverlust

Der Fortschritt darf nicht stillschweigend überschrieben werden. Wenn ein Fehler auftritt, muss der letzte gültige Stand erhalten bleiben, und der Anwender muss diejenige Stelle erkennen können, die noch zuverlässig gespeichert wurde.

### 10.4 Fortsetzbare Wiederaufnahme

Ein abgebrochener Podcast-Sync darf nicht als verloren gelten. Der Prozess bleibt fortsetzbar; bereits verarbeitete und validierte Einheiten bleiben bestehen, und nur die noch offenen Einheiten werden erneut verarbeitet.

### 10.5 Teilweise fehlgeschlagener Upload

Eine teilweise fehlgeschlagene Veröffentlichung darf keine scheinbar gültige neue Fassung freigeben. Nur die vollständige Fassung mit gültigem Hash und validierter JSON-Freigabe gilt als publiziert. Wenn ein Upload fehlschlägt, bleibt die bisherige gültige Fassung aktiv und das Frontend zeigt den Fehlerstatus an.

---

## 11. Sicherheit

### 11.1 Keine Keys im Browser

OpenAI-Keys dürfen niemals im Browser, in front-endseitigem JavaScript, im GitHub-Repository oder in öffentlich sichtbaren Konfigurationsdateien landen. Die Synthese und die Audio-Erzeugung erfolgen ausschließlich in einem sicheren, lokalen Admin-Kontext, der nicht im Browser läuft.

### 11.2 Keine Firebase-Admin-Credentials im Browser oder Repository

Firebase-Admin-Credentials dürfen weder im Browser noch im Repository gespeichert werden. Die Admin-Pipeline darf nur auf einer abgesicherten Umgebung laufen, die die notwendigen Rechte für den Firebase-Storage-Upload und die intern verwendete Erzeugung besitzt.

### 11.3 Storage-Regeln respektieren

Die bestehende Firebase-Storage-Regel für verifizierte Nutzer bleibt gültig. Die neue Podcast-/Karaoke-Architektur erweitert diese Sicherheitslogik nicht, sondern verwendet sie als durchgehende Voraussetzung. Keine Audio-Datei oder Zeitmarken-Datei darf die bestehenden Read-Regeln für verifizierte Nutzer umgehen.

---

## 12. Migration

### 12.1 Pilot-Migration mit bereits funktionierender Recht-Einheit

Die Migration erfolgt in kontrollierten Schritten. Zuerst wird bereits eine funktionierende Recht-Einheit vollständig migriert, konkret die Einheit "Rechtssubjekte und Rechtsobjekte" aus dem Fach Recht.

### 12.2 Stufenweise Erweiterung

Danach werden wenige weitere Einheiten getestet, bevor ein größerer Migrationsschritt erfolgt. Erst danach wird die volle Synchronisierung aller 521 Lerntexte gestartet.

### 12.3 Abbau von Legacy-Mechaniken

`speechSynthesis` darf erst dann entfernt werden, wenn die Firebase-Audio vollständig verfügbar und verlässlich nutzbar ist. Alte Recht-Testlogik und `podcastText`-Audio-Reste dürfen erst nach erfolgreicher Migration und Validierung entfernt werden.

### 12.4 Geringes Risiko und hohe Kontrolle

Die Migration setzt auf die bereits existente Lerntextarchitektur und den bereits vorhandenen Firebase-Storage-Pfad. Dadurch bleibt die Systemgrenze klar: Neue Audio- und Karaoke-Features werden auf der vorhandenen Datenbasis aufgebaut und nicht als alternative, parallele Datenquelle eingeführt.

---

## 13. Teststrategie

### 13.1 Legacy `lerntexteAudioHash` darf nicht als Sync-SHA verwendet werden

Test: Es wird der vorhandene Legacy-Test-Hash `lerntexteAudioHash()` auf eine Einheit angewendet. Erwartung: Er ist nur ein Legacy-Testwert und wird in der neuen Podcast-Synchronisierung nicht als SHA-256-Hash für die Erzeugung oder Validierung verwendet.

### 13.2 Hash unverändert => kein Regenerate

Test: Der Sync wird für eine Einheit mit unverändertem `lerntext` und vorhandener MP3/JSON ausgeführt. Erwartung: Kein Neu-Generate, kein Schreibvorgang für dieselbe Einheit, keine Verdrängung der vorhandenen Dateien.

### 13.3 Hash geändert => genau eine Einheit neu

Test: Ein einzelner Lerntext wird manuell geändert, während alle anderen Einheiten unverändert bleiben. Erwartung: Der Sync erzeugt genau eine neue MP3-Datei und genau eine zugehörige JSON-Datei für die geänderte Einheit; alle übrigen Einheiten bleiben unverändert.

### 13.4 MP3-Pfad und JSON-Pfad

Test: Für eine Einheit mit bekanntem Fach und Titel wird der Pfad der MP3 und der JSON-Datei überprüft. Erwartung: Die Struktur entspricht exakt `podcast/<fach-slug>-<titel-slug>.mp3` und `podcast/<fach-slug>-<titel-slug>.json`.

### 13.5 MP3-Metadatenhash + JSON-Hash + aktueller LerntextHash stimmen überein

Test: Nach einer veröffentlichten Audiofassung werden die drei Hash-Werte verglichen: aktueller `lerntextHash`, JSON-`lerntextHash` und MP3-Storage-Custom-Metadata-Hash. Erwartung: Alle drei Werte sind identisch.

### 13.6 Hash-Mismatch blockiert Karaoke-Wiedergabe

Test: Ein bewusst fehlerhafter Hash-Zustand wird in der JSON oder MP3-Metadaten gesetzt. Erwartung: Das Frontend blockiert die Karaoke-Wiedergabe und zeigt einen sichtbaren Aktualisierungs-/Fehlerstatus an, statt mit fehlerhafter Audiosynchronisierung zu starten.

### 13.7 Wort-Zeitmarken-Mapping

Test: Für ein bekanntes Lerntext-Beispiel wird das Transkript mit den Zeitmarken verglichen. Erwartung: Jedes Wort hat einen eindeutigen `wortIndex`, der identisch mit der Wortreihenfolge im sichtbaren `lerntext` ist; die Zeitgrenzen sind konsistent und nicht überlappend.

### 13.8 Karaoke-Wort bei bestimmter `audio.currentTime`

Test: Bei einem bekannten Zeitstempel im Audio-Element wird das passende Wort im Lerntext ausgewählt. Erwartung: Das korrekte Wort erhält die Highlight-Klasse, und die Klasse verschiebt sich nicht auf das nächste oder vorherige Wort.

### 13.9 Pause

Test: Während der Wiedergabe wird Pause ausgelöst. Erwartung: Die Audio-Wiedergabe pausiert, und die Markierung bleibt exakt am aktuellen Wort stehen; beim Fortsetzen beginnt die Wiedergabe an derselben Stelle.

### 13.10 Stop

Test: Während der Wiedergabe wird Stop ausgelöst. Erwartung: Die Audio-Wiedergabe stoppt, `currentTime` bleibt an der aktuellen Stelle, die Markierung bleibt am letzten gesprochenen Wort stehen, und der Fortschritt wird gespeichert.

### 13.11 Resume

Test: Nach Pause oder Stop wird "Fortsetzen" gewählt. Erwartung: Die Wiedergabe setzt an der gespeicherten Sekunden- und Wortposition fort, nicht am Anfang der Einheit.

### 13.12 Von vorne

Test: Eine teilweise gehörte Einheit wird mit "Von vorne abspielen" gestartet. Erwartung: Die Wiedergabe beginnt bewusst bei 0 der aktuellen Einheit bzw. der aktuellen Auswahl. Vorhandene Completed-/Resume-Stände werden zunächst ignoriert. Nach einem neuen Stop wird die neue Position zum aktuellen Resume-Stand.

### 13.13 Von vorne für Einzel / Kapitel / Alle Kapitel

Test: Für die drei Auswahltypen wird der Startpunkt geprüft: Einzelne Einheit, Kapitel, "Alle Kapitel". Erwartung: Der Wiedergabestart setzt in jedem Fall auf 0 der jeweils aktuellen Auswahl und nicht auf einen alten Resume-Stand.

### 13.14 completed

Test: Eine Einheit wird vollständig gehört. Erwartung: `completed` wird auf `true` gesetzt, und danach wird bei "Fortsetzen" diese Einheit übersprungen und zur nächsten offenen Einheit gewechselt.

### 13.15 Gerätewechsel / gleicher Nutzer

Test: Ein Nutzer hört eine Einheit auf Gerät A und setzt sie auf Gerät B fort. Erwartung: Der Fortschritt ist mit derselben Firebase-UID verfügbar und verwendet die gleiche Lerneinheits-Identität, ohne zusätzliche falsche Nutzer-Identitäten zu erzeugen.

### 13.16 Geänderter `lerntext` invalidiert alten Resume-Stand

Test: Der `lerntext` wird geändert, aber die alte MP3/JSON bleibt technisch vorhanden. Erwartung: Der alte Resume-Stand wird nicht erneut verwendet, weil der Hash nicht mehr mit der aktuellen Fassung übereinstimmt und der neue Sync die neue Audio-Fassung erzeugt.

### 13.17 Playlist mit completed + teilweise + neuen Einheiten

Test: Eine Playlist enthält eine `completed`-Einheit, eine teilweise gehörte Einheit und eine noch nie gehörte Einheit. Erwartung: Beim Fortsetzen wird nur die nächste offene Einheit gewählt; die `completed`-Einheit wird übersprungen, die teilweise gehörte Einheit startet an der gespeicherten Position.

### 13.18 Partielle Upload-Fehlschläge veröffentlichen keine gültige neue Fassung

Test: Während der Veröffentlichung scheitert ein Upload oder eine Validierung. Erwartung: Es wird keine scheinbar gültige neue Fassung veröffentlicht; die bisherige gültige Fassung bleibt aktiv, und der Fehlerstatus bleibt sichtbar.

### 13.19 `podcastText`-Änderung löst KEINE Audio-Regeneration aus

Test: Nur `podcastText` wird geändert, während `lerntext` unverändert bleibt. Erwartung: Keine neue Audio-Regeneration, da der Sync ausschließlich auf dem kanonischen `lerntext` basiert.

### 13.20 `lerntext`-Änderung löst Regeneration aus

Test: `lerntext` wird geändert. Erwartung: Der neue SHA-256-Hash ändert sich, die Einheit wird neu erzeugt, und die neue Audio-/JSON-Fassung veröffentlicht.

### 13.21 Sperrbildschirm / Entsperren als manueller Mobiltest

Test: Auf einem Mobilgerät wird eine MP3 im Hintergrund weiterlaufen gelassen, dann wird der Bildschirm gesperrt und später wieder entsperrt. Erwartung: Die erwartete Audio-Wiedergabe läuft weiter und die Karaoke-Markierung wird nach dem Entsperren anhand der aktuellen Audiozeit sofort am richtigen Wort neu gesetzt.

### 13.22 Regression der bestehenden Lerntext-Formatierung

Test: Ein Lerntext mit Überschriften, Absätzen, Hervorhebungen und HTML-Struktur wird gerendert. Erwartung: Die visuelle Struktur bleibt unverändert; nur die Wort-Elemente werden technisch adressierbar gemacht, ohne das vorhandene Layout zu zerstören.

### 13.23 DOM-Wort-Wrapping erhält bestehende Lerntextformatierung

Test: Die Lerntextanzeige wird im DOM tokenisiert und als Wort-Spans gewrappt. Erwartung: Überschriften, Absätze, `strong`-Elemente, Hervorhebungen und vorhandene Struktur bleiben erhalten; nur die Worttoken werden ergänzt.

---

## Abschlussprüfung

Die Spezifikation wurde geprüft auf:

- keine offenen Architekturentscheidungen, die nicht bereits durch die Anforderungen abgesichert sind
- keine TODOs oder TBDs
- keine Implementierung oder Laufzeitcode-Änderung
- keine Einführungen neuer Systeme, die die bestehende Architektur unnötig erweitern
- keine Widersprüche zu den beschriebenen Firebase-, Auth-, Lerntext-, Podcast- und Playlist-Anforderungen

Datei: docs/superpowers/specs/2026-08-31-podcast-karaoke-sync-design.md

Der Scope bleibt bewusst auf Design und Architektur begrenzt, nicht auf Implementierung.
