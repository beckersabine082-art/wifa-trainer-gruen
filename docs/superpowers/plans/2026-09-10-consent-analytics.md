# Freiwillige Nutzungsanalyse

Ziel: GA4 im bestehenden Firebase-Projekt, ohne Analytics-Netzwerk vor Einwilligung oder nach Widerruf. Grundlage c6f645a, sauberer Arbeitsbaum, keine AGENTS.md im Repository oder den geprüften Elternverzeichnissen. Kein Hosting-Framework: statische GitHub-Pages-Seite mit klassischen Skripten und Firebase-ES-Modulen (12.17.1). Podcast verwendet ein persistentes Audioelement, MediaSession und eigene Fortschrittsspeicherung; diese Abläufe bleiben erhalten.

Die ausdrückliche Beauftragung erlaubt selbstständige Umsetzung und Tests ohne gewöhnliche Freigaberückfragen. Ausführung im Feature-Branch.

- [x] Tests zuerst: Einwilligung, lokale Sperre, Ereignis-Allowlist, Ansichts-/Ablauf-Deduplizierung und Podcast-Meilensteine.
- [x] Analytics-Kern ohne Netzwerk/SDK implementieren. Nur feste Fach-/Themenkennungen, keine dynamischen Texte oder URLs als Nutzdaten.
- [x] Separates, nach Zustimmung erzeugtes Mess-Iframe: eine Firebase-Analytics-Instanz, kein Auth/Firestore im Frame, keine automatischen Seitenaufrufe. Bei Widerruf Disable-Flag setzen, Frame entfernen, GA-Cookies löschen; keine Reloads, keine Eingriffe in Audio.
- [x] UI mit gleichen Annehmen-/Ablehnen-Schaltflächen, ständig erreichbaren Einstellungen und persistentem Testausschluss. Zustimmung versioniert und auf 180 Tage begrenzt, ohne Speicherung keine Messung.
- [x] Hooks an erfolgreichen Anzeigen, Starts/Abschlüssen und Audioereignissen ergänzen. Keine Ereignisse pro Frage, Wort oder Sekunde.
- [x] Datenschutzhinweis und genaue GA4-Dashboard-/Aktivierungsschritte schreiben. Fehlende Mess-ID und Kontoeinstellungen sperren Aktivierung.
- [x] Bestehende Regressionstests und neue Tests ausführen; UI im Browser prüfen. Reale GA4-Messung und physische Gerätesperre getrennt dokumentieren.
- [ ] Geprüfte Änderungen committen und Branch pushen (Abschluss im Git-Protokoll).
