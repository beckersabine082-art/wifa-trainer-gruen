# GA4: Einrichtung, Ereignisse und Auswertung

Stand 11.09.2026. **Noch keine Live-Messung in der GA4-Oberfläche bestätigt.** Das vorhandene Firebase-Projekt `wifa-trainer-gruen` ist laut Betreiberangabe mit GA4 verbunden: Mess-ID `G-PJ9Y1NC4SH`, Property `553772695`, Webstream `15757844020`. Die Mess-ID ist eingetragen. `enabled: true` ist nach erfolgreicher SDK-Netzwerkprüfung und bestätigten Kontoeinstellungen gesetzt.

Die Betreiberin bestätigt sechs angelegte ereignisbezogene Dimensionen sowie anhand von Screenshots ausgeschaltete Optimierte Analysen, nicht aktivierte Google Signals und ausgeschaltete detaillierte Standort-/Gerätedatenerfassung. Diese Screenshots wurden in diesem Arbeitslauf nicht selbst geöffnet; Grundlage ist die ausdrückliche Betreiberangabe. Die Betreiberin hat am 11.09.2026 ausdrücklich bestätigt, dass personalisierte Werbung in allen Regionen ausgeschaltet und Nutzer-/Ereignisaufbewahrung jeweils auf zwei Monate ohne Zurücksetzen gespeichert und nochmals kontrolliert wurden. Der Zugriff auf die Property führte auch am 11.09.2026 zur Google-Anmeldung.

## Aktivierungscheckliste und verbleibender GA4-Eingangsnachweis

1. **Erledigt laut Betreiberin:** Firebase ist mit der bestehenden GA4-Property verbunden. Keine neue App/Property anlegen, kein Analytics 360 und kein BigQuery aktivieren.
2. **Erledigt im Code:** `G-PJ9Y1NC4SH` in `js/analytics-settings.js`; vorhandene Firebase-Web-App `1:561836344573:web:23c2cc88c74a9e8f11aa94`, Produktions-Origin und GitHub-Pages-Pfad unverändert.
3. **Erledigt laut Betreiberin; Konfiguration beibehalten:** In [Google Analytics](https://analytics.google.com/) die verknüpfte Property wählen. Verwaltung → Datenstreams → Webstream → **Optimierte Analysen komplett ausschalten**, einschließlich Seitenänderungen, Formularen, Suche, Downloads, Video und ausgehenden Links. Keine verbundenen zusätzlichen Tags, Google-Ads-Verknüpfungen, User-ID-, User-provided-data- oder Werbekonfiguration ergänzen. Verwaltung → Datenerhebung → **Google Signals ausschalten**; Nutzer-/Werbedatenfreigaben prüfen. Der Code setzt zusätzlich `allow_google_signals: false`, `allow_ad_personalization_signals: false`, verweigert alle Werbe-Consent-Kategorien und setzt `send_page_view: false`.
4. **Gespeichert und kontrolliert laut Betreiberin:** Verwaltung → Datenaufbewahrung: Ereignisdaten auf **2 Monate** stellen, Verlängerung bei neuer Aktivität ausschalten. Die tatsächliche Einstellung und die abweichende Behandlung aggregierter Berichte im Datenschutztext bestätigen. Keine BigQuery-Verknüpfung anlegen.
5. **Erledigt laut Betreiberin:** Alle sechs ereignisbezogenen Dimensionen sind angelegt. Der Anzeigename für `progress_percent` lautet `Podcast_Fortschritt`. Keine Duplikate anlegen. Berichte/Explorationen können anhand der nachfolgenden Rezepte eingerichtet werden.
6. **Vervollständigt:** Der identische Datenschutzabschnitt verwendet die Betreiberangaben aus dem Impressum, bestätigte Kontoeinstellungen und verlinkte Google-Primärquellen zu Empfänger, Übermittlungen und Aufbewahrung. Eine abschließende rechtliche Prüfung wird dadurch nicht ersetzt; es wird keine garantierte Rechtskonformität behauptet.
7. **Vor eigenen Tests** auf jedem verwendeten Browser „Datenschutz-Einstellungen“ öffnen und „Diesen Browser dauerhaft … ausschließen“ setzen. Lokale Entwicklung, andere Hosts und andere Projektpfade sind grundsätzlich ausgeschlossen. Inkognito oder ein anderes Gerät benötigt einen eigenen Ausschluss. Es wird keine Nutzeridentität zur Erkennung der Betreiberin verwendet. Ein reiner `debug_mode` wäre ohne aktiven GA4-Datenfilter kein verlässlicher Ausschluss; deshalb nutzt diese Implementierung eine vollständige Netzwerksperre.
8. **Durchgeführt:** Siehe [echte SDK-Abnahme](analytics-live-acceptance-2026-09-11.md). Für eine erneute reale SDK-/Netzwerk-Abnahme eine **separate kostenlose Test-Property/Web-App** nutzen, falls eine vollständig getrennte Testmessung gewünscht ist; die Produktionskonfiguration nicht unbemerkt dafür überschreiben. Alternativ einen bewusst markierten einmaligen Abnahmetest in der Produktions-Property durchführen und diesen als Testdaten dokumentieren. Ohne diese Prüfung keinen Live-Erfolg behaupten. Besonders auch ein direktes Laden einer URL mit synthetischen personenbezogenen Parametern prüfen: diese dürfen nicht in `collect`-Nutzdaten oder Referrer-Headern erscheinen.
9. Nach Konsole/Datenschutz/Netzwerk-Abnahme `enabled: true` setzen, Feature-Branch unter Erhalt des frisch abgerufenen `origin/main` integrieren und über das bestehende GitHub-Pages-Verfahren veröffentlichen. Dies ist durch den Folgeauftrag autorisiert, jedoch an die erfolgreiche Abnahme und geklärte Angaben gebunden. Anschließend den Eingang in [Property 553772695](https://analytics.google.com/analytics/web/#/p553772695/reports/intelligenthome) prüfen. Ein versendeter HTTP-Hit allein ist kein Nachweis, dass der Bericht ihn verarbeitet hat.

## Ereignisvertrag

Die Messung beginnt erst ab Zustimmung. Keine Historie wird nachgesendet. Ein Wechsel zurück zu einer Ansicht ist ein neuer Aufruf; identisches erneutes Rendern ist keiner. Unbekannte Inhalte werden `unknown`. Es gibt keine Antworttexte, Ergebnisse, Scores oder IDs von Fragen/Nutzern im Transport.

| Ereignis | Auslöser und Zählweise |
| --- | --- |
| `page_view` | Initial tatsächlich angezeigte Seite nach Zustimmung und Wechsel der aktiven Ansicht. Nur feste virtuelle URL, fester Titel und `view_id`, leerer Referrer. Keine automatische zweite Seitenmessung. |
| `feature_use` | Öffnen von Trainer, Quiz, Prüfung, Lerntexten/Podcast-Bereich, Glossar oder Formelsammlung; `feature_id`. Podcast selbst wird erst mit `podcast_start` gezählt. |
| `content_view` | Erfolgreich angezeigte Trainer-/Quiz-Themen bzw. Lerntextauswahl; `feature_id`, `subject_id`, `topic_id`. Wiederholung derselben Auswahl wird unterdrückt. Wechselnde Themen im Quiz dürfen neue Inhaltsereignisse erzeugen; es gibt kein Ereignis für jede Antwort. |
| `training_start` | Erste erfolgreich geladene Frage des gestarteten/fortgesetzten Themenlaufs. „Thema starten“ und „Von vorne“ setzen einen neuen Lauf. |
| `training_complete` | Backend meldet `themaAbgeschlossen` für einen zuvor gemessenen Lauf, einmalig. Bedeutet alle Fragen durchgeklickt, **nicht** richtig beantwortet/bestanden. |
| `quiz_start` | Erste erfolgreich angezeigte Frage einer Runde, ggf. nach Wiederaufnahme. Fach bezieht sich auf die gewählte Fachrunde; gemischte Runden verwenden `unknown`, einzelne Themen stehen in `content_view`. |
| `quiz_complete` | Letzte Frage der Runde erfolgreich beantwortet/gespeichert, einmalig; bei Wiederaufnahme ggf. nur der Rest der Runde bearbeitet. Kein Bestehensereignis. |
| `exam_start` | Aufgaben einer Simulation erfolgreich angezeigt. Bei mehreren Fächern `unknown`. |
| `exam_complete` | Erfolgreiche Auswertung liegt vor. Abbruch, Zeitablauf ohne erfolgreiche Auswertung und fehlgeschlagene Auswertung sind keine Abschlüsse. Erneutes Speichern zählt nicht erneut. |
| `podcast_start` | Tatsächliches `playing`, einmal pro geladenem Podcast-Durchlauf. Pause/Fortsetzen und Listener-Neubindung zählen nicht erneut. Neues Laden oder explizites „Von vorne“ setzt einen neuen Durchlauf. |
| `podcast_progress` | Erstmaliges Erreichen von 25/50/75 Prozent der **Wiedergabeposition**; 100 nur bei `ended`. Vorwärtsspringen kann übersprungene Schwellen gemeinsam auslösen, Rückwärtsspringen zählt keine erneut. **Keine gehörte Dauer und kein Beleg, dass alle Passagen angehört wurden.** |
| `podcast_error` | HTMLMediaElement-Fehler, abgelehnter Start oder Asset-Lade-/Validierungsfehler. Nur `aborted`, `network`, `decode`, `unsupported`, `not_allowed`, `asset_invalid`, `unknown`; niemals Message, Stack oder Storage-URL. Native Fehler je Code und Durchlauf dedupliziert. |

GA4 kann nach Zustimmung zusätzlich `first_visit`, `session_start` und `user_engagement` erzeugen. Die isolierte Messseite enthält keine Formulare, persönlichen Inhalte, Suchfelder, Audioelemente oder Navigation. Globale Default-Parameter bereinigen auch automatische Ereignisse; ihre tatsächlich gesendeten Parameter sind bei der echten SDK-Abnahme zu kontrollieren. Technische Browser-/Geräte-/Sprachangaben sowie pseudonyme Client-/Session-IDs bleiben Teil von GA4. Keine Firebase-Auth-UID wird an Analytics angebunden. Die normale Firebase-Installation-ID des Analytics-SDK ist technisch von der Nutzerkonto-UID zu unterscheiden.

## Dimensionen und Berichte

| Anzeigename | Ereignisparameter | Zweck |
| --- | --- | --- |
| Funktion | `feature_id` | trainer, quiz, exam, learning_text, glossary, formulas, podcast |
| Ansicht | `view_id` | feste Ansichten |
| Fach | `subject_id` | 13 feste Fachkennungen plus unknown |
| Thema | `topic_id` | feste Zuordnung in `js/analytics-topics.js` |
| Podcast_Fortschritt | `progress_percent` | 25, 50, 75, 100 |
| Audiofehler | `error_code` | bereinigte Fehlerklasse |

Die Themenüberschriften bleiben nur in der lokalen Zuordnungstabelle; an GA4 gehen stabile Kennungen. `node tools/analytics/build-catalog.cjs` aktualisiert die eingecheckte Allowlist aus dem öffentlichen Lehrkatalog. Änderungen vor Veröffentlichung prüfen. Keine Katalogabfragen zur Laufzeit von Analytics.

In der vorhandenen GA4-Oberfläche:

- **Besucher und Wiederkehr:** Berichte → Nutzer-/Interaktionsübersicht bzw. Bindung; Nutzer gesamt, neue Nutzer, wiederkehrende Nutzer, Sitzungen. Nur zustimmende Browser werden gemessen; mehrere Geräte, gelöschte Cookies und Widerruf verfälschen eine Interpretation als eindeutige Menschen. Keine geräteübergreifende Identifikation. Referrer werden absichtlich nicht gemessen; Akquisitionsberichte sind entsprechend eingeschränkt.
- **Funktionsnutzung:** Exploration „WiFa Funktionen“, Zeilen Funktion, Werte Ereignisanzahl und Nutzer gesamt, Filter `feature_use` bzw. separat `podcast_start`. Nicht sämtliche Ereignisse aufsummieren, sonst zählt ein Start samt Fortschritten mehrfach.
- **Fächer/Themen:** Exploration „WiFa Inhalte“, Zeilen Fach und Thema, Werte Nutzer gesamt und Ereignisanzahl, Filter `content_view`; Podcast separat über `podcast_start`. Kennungen anhand der eingecheckten Tabelle zuordnen.
- **Abschlüsse:** Exploration „WiFa Abschlüsse“, Ereignisname, Funktion und Fach; Start-/Abschlussanzahlen getrennt pro Ereignispaar vergleichen. Optional Trichter pro Sitzungsablauf. Quoten sind aggregierte Hinweise, keine personenbezogenen Lernstands- oder Erfolgsnachweise; Wiederaufnahme, Widerruf und Abbruch beachten.
- **Podcast:** Exploration „WiFa Podcast“, Fach/Thema und Fortschritt, Ereignisfilter `podcast_start`/`podcast_progress`; separate Fehlertabelle `podcast_error` mit Fehlerklasse. 100-Prozent-Ereignisse als natürliche Enden auswerten, nicht als vollständig gehörte Minuten.

## Technik und Prüfbefehle

Statische Seiten laden nur eigene lokale Analytics-Skripte. Erst nach gespeicherter Zustimmung auf der freigegebenen Produktionsadresse entsteht `analytics-frame.html`. Darin läuft genau ein Firebase-Analytics-SDK derselben Version wie die bestehende App, ohne Auth/Firestore. Die bestehende Firebase-Konfiguration wird aus einer gemeinsamen reinen Konfigurationsdatei importiert. Kein direkt eingebautes zweites gtag/GTM-SDK.

Widerruf setzt synchron das GA-Disable-Flag im Frame, entfernt den Frame mit seinen SDK-Timern/Listenern und verwirft noch ausstehende eigene Ereignisse. Kein Seitenreload, keine Audio-Pause. Vor dem Widerruf bereits abgesendete Anfragen können nicht rückgängig gemacht werden. Andere offene Tabs reagieren auf das Storage-Ereignis; gesperrte/suspendierte Browserkontexte werden bei Wiederaufnahme erneut geprüft.

```powershell
npm ci --ignore-scripts --prefix tools/podcast-sync
node --test tests/*.test.js
node tools/analytics/serve.cjs --analytics-test
```

Im Browser `http://127.0.0.1:8080/tests/analytics-browser.html` öffnen, ggf. Banner ablehnen, „Prüfungen starten“ klicken. Dieser Server ersetzt ausschließlich Analytics durch ein lokales SDK-Testdouble. Er liefert **keinen Nachweis für Googles echte SDK-Payloads oder GA4-Eingang**. Ohne `--analytics-test` bleibt lokale Messung durch die reguläre Konfiguration gesperrt. Testserver nur auf Loopback; nie veröffentlichen.

Die Browserregression prüft reale Iframe-Lebenszyklen und lokale HTTP-Anfragen, doppelte Seiten/Abschlüsse, Widerruf einschließlich verzögerter SDK-Anfragen sowie eine echte lokale MP3 mit Pause/Fortsetzen und Weiterlaufen beim Widerruf. Unit-/Regressionstests decken zusätzlich Podcast-Meilensteine, Seeking, mehrfaches Listener-Binden, Replay, Fehlerbereinigung, lokale Sperre, verweigerte Speicherung, Einwilligungsablauf und tabübergreifenden Widerruf ab.

**Noch offen:** Live-Dashboard-Eingang und physische Smartphone-Screen-Lock-Prüfung auf iOS/Android. Die echte Google-Netzwerkprüfung wurde durchgeführt; die Dimensionen sind laut Betreiberin angelegt. Bestehende MediaSession-/Visibility-Tests ersetzen keinen physischen Gerätesperrentest.

## Quellen für Einstellungen und rechtliche Prüfung

- [Firebase Analytics API](https://firebase.google.com/docs/reference/js/analytics)
- [GA4-Konfigurationsparameter](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [Manuelle Seitenaufrufe](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google Signals](https://support.google.com/analytics/answer/9445345?hl=de)
- [Benutzerdefinierte Dimensionen](https://support.google.com/analytics/answer/14240153?hl=de)
- [Orientierungshilfen der Datenschutzkonferenz](https://www.datenschutzkonferenz-online.de/orientierungshilfen.html)
- [§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [GA4-Cookies](https://support.google.com/analytics/answer/11397207?hl=de)
- [Google: internationale Übermittlungen und IP-Verarbeitung](https://services.google.com/fh/files/misc/safeguards_for_international_data_transfers.pdf)
