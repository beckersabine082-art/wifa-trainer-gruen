# Prüfprotokoll – 11.09.2026

Grundlage: `c6f645a` (funktionierender Podcast-Merge). Feature-Branch: `codex/consent-analytics`. Arbeitsbaum zu Beginn sauber. Keine vorhandenen uncommitteten Änderungen überschrieben.

## Tatsächlich durchgeführt

- `node --test tests/*.test.js`: **221 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen** im abschließenden Lauf am 11.09.2026. Enthält bisherige Podcast-, Karaoke-, Fortschritts- und Bewertungsregressionen sowie 19 neue Analytics-Tests.
- Alle Frontend-JavaScript-Dateien mit `node --check` geprüft; `git diff --check` ohne Fehler. Git meldet nur die vorhandene Windows-Zeilenenden-Konvertierung.
- Fehlende, bereits im vorhandenen Lockfile deklarierte Podcast-Testabhängigkeiten mit `npm ci --ignore-scripts --prefix tools/podcast-sync` installiert. Der Ausgangslauf hatte dadurch drei fehlgeschlagene Testdateien; nach Installation bestanden diese. Kein Lockfile-/Produktionsabhängigkeits-Update. npm meldete sechs moderate Befunde im bestehenden Tool-Abhängigkeitsbaum; kein ungeprüftes `audit fix` ausgeführt.
- Unabhängiges Code-Review: Timerüberlauf bei 180 Tagen und nicht gezähltes erneutes Laden desselben Podcasts gefunden, mit zunächst fehlgeschlagenen Regressionstests reproduziert und korrigiert.
- Browserabnahme im Codex-In-App-Browser mit `node tools/analytics/serve.cjs --analytics-test`, definierter abgelehnter Einwilligung und nur einem Prüftab: **alle 12 angezeigten Prüfungen bestanden**. Der Google-SDK-Transport war ein lokales Testdouble. Reale Iframe-Lebenszyklen, echte lokale HTTP-Messanfragen, verzögerte SDK-Anfragen und eine echte MP3 wurden dabei verwendet.
- Im Browser bestätigt: kein Iframe/keine Messanfrage vor Zustimmung, keine Anfrage nach Ablehnung, korrekte Seiten-/Start-/Abschlussereignisse nach Zustimmung, keine doppelte Ansicht/kein doppelter Abschluss, bereinigte synthetische URL-Parameter, MP3-Pause/Fortsetzen ohne zweiten Start, sofortige Entfernung des SDK-Kontexts bei Widerruf, keine nachträgliche verzögerte Anfrage, weiterlaufendes Audio beim Widerruf, wirksamer Browser-Testausschluss.
- Gleichwertige Schaltflächen und lesbarer Einwilligungsdialog per Screenshot visuell geprüft.
- Reguläre Startseite und Navigation bis zur bestehenden Anmeldeschranke bei abgelehnter Analyse im Browser geprüft. Ohne Nutzeranmeldung konnten die geschützten echten Lernabläufe nicht vollständig manuell durchgespielt werden; deren vorhandene automatisierte Tests bestehen.
- Die neuen isolierten Tests prüfen zusätzlich Ablauf der Einwilligung, Tab-Widerruf, verweigerte Speicherung auch beim Widerruf, ausgeschlossene lokale/öffentliche Testpfade, SDK-Import-Rennen, sichere automatische Default-Parameter, Themen-Allowlist, Seeking/Schwellen, Listener-Deduplizierung, erneuten Podcast-Durchlauf und bereinigte/deduplizierte Audiofehler.

Für wiederholte Browserläufe vorher in „Datenschutz-Einstellungen“ ablehnen und neu laden; weitere Tabs derselben Test-Origin schließen. Andernfalls sind deren legitime Seitenereignisse bzw. eine gespeicherte Testzustimmung Teil des Ausgangszustands. Genau diese Ausgangszustände führten bei zwischenzeitlichen Wiederholungsläufen zu erwarteten Testabbrüchen; der abschließende isolierte Lauf bestand.

## Noch nicht durchgeführt / keine Live-Bestätigung

- Kein angemeldeter Firebase-/GA4-Kontozugriff verfügbar; keine Mess-ID gefunden. Keine Property-Einstellungen, Dimensionen oder Berichte im Konto verändert.
- Kein Netzwerknachweis mit dem echten Google-SDK, keine Kontrolle realer automatisch erzeugter GA4-Payloads, kein bestätigter Echtzeit-/Standardbericht-Eingang. Die reale SDK-Abnahme ist vor Aktivierung erforderlich.
- Kein physischer Smartphone-Screen-Lock-Test auf iOS/Android. Bestehende Visibility-/MediaSession-Regressionsprüfungen und Desktop-MP3-Wiedergabe sind kein Ersatz dafür.
- Keine Veröffentlichung auf `main`/GitHub Pages. Die Aktivierung bleibt absichtlich gesperrt (`enabled: false`, leere Mess-ID).
- Die Datenschutzerweiterung ist ein gekennzeichneter Entwurf mit offenen Betreiber-/Vertrags-/Übermittlungs-/Aufbewahrungsprüfpunkten, keine zugesicherte Rechtskonformität.

Die gebündelten verbleibenden Schritte und GA4-Berichtsrezepte stehen in [analytics-setup.md](analytics-setup.md).
