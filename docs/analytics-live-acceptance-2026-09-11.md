# Echte SDK-Abnahme am 11.09.2026

Ziel-Property `553772695`, Webstream `15757844020`, Mess-ID `G-PJ9Y1NC4SH`. Testkennung `acceptance_20260911`. Dies ist ein dokumentierter einmaliger Abnahmevorgang mit einem erfolglosen Vorversuch ohne Collect-Aufruf und einem erfolgreichen Transportlauf. Kein Nachweis eines verarbeiteten GA4-Berichtseingangs.

## Bestätigt

Unveränderte Firebase-App-/Analytics-SDKs **12.17.1 von www.gstatic.com**, echtes gtag.js von **www.googletagmanager.com**. Keine SDK-Mocks und kein Proxy für Google-Anfragen. Nur der lokale Testserver erlaubte die Loopback-Origin und ergänzte Testkennzeichnungen; die Produktionskonfiguration war während dieses Tests noch ausgeschaltet und wurde anschließend nach Bestätigung der Kontoeinstellungen aktiviert.

Die Browserprüfung unter dem produktionsgleichen Unterpfad `/wifa-trainer-gruen/` hat nach Zustimmung zwei tatsächliche Fetch-Aufrufe an `https://region1.google-analytics.com/g/collect` beobachtet. Darin befanden sich genau diese sechs Ereignisse:

| Ereignis | Anzahl |
| --- | ---: |
| page_view | 2 |
| feature_use | 1 |
| training_start | 1 |
| training_complete | 1 |
| podcast_start | 1 |

Alle sechs waren mit `test_run_id=acceptance_20260911`, `debug_mode=true` und `traffic_type=internal` gekennzeichnet. `debug_mode` und `traffic_type` allein garantieren ohne passend gespeicherte aktive GA4-Filter keinen Ausschluss aus normalen Berichten; daher sind diese sechs Ereignisse ausdrücklich als Testdaten zu behandeln. Es wurde kein kostenpflichtiger Dienst eingerichtet und keine Konto-/Lernstandsdatenbank beschrieben. Der erste Versuch erreichte Firebase-Webkonfiguration und Installationsdienst (HTTP 200), sandte aber noch keinen Collect-Aufruf.

Beobachteter Zeitraum des Vorgangs: 11.09.2026 in dieser Sitzung, mit der vorstehenden eindeutigen Ereignisparameter-Kennung. Pseudonyme Client-/Sitzungs-/Installationskennungen wurden nicht in dieses Repository-Protokoll übernommen. Die Browser-Resource-Timing-API gab für Google-Collect `responseStatus=0` zurück (Cross-Origin-Einschränkung), deshalb wird hier **keine HTTP-204-Bestätigung** behauptet.

## Bestanden im echten Browser

- Vor Zustimmung und nach Ablehnung: kein Analytics-Iframe, keine SDK-/Analytics-Netzwerkaktivität.
- Nach Zustimmung: echte Google-SDKs und tatsächliche Collect-Transportaufrufe.
- Zweimaliger Aufruf derselben Traineransicht: kein zweiter Aufruf dafür; insgesamt Startseite und Trainerseite.
- Wiederholte Start-/Abschlussaufrufe: jeweils nur ein entsprechendes Ereignis.
- Echte lokale MP3: Pause/Fortsetzen, genau ein Podcast-Start, Weiterlaufen beim Widerruf.
- Gesamte beobachtete Collect-Nutzdaten: keine `uid`, keine synthetische E-Mail aus dem Seitenparameter und kein synthetischer URL-Fragmentwert; `dl` ohne Query und `dr` leer. Die übermittelten Testmarker wurden in jedem Hit geprüft.
- Nach Widerruf: Iframe sofort entfernt; zehn Sekunden Beobachtung ohne weiteren Collect-Aufruf. Die vollständige Transportübersicht enthält ausschließlich Anfragen aus der Zustimmungsphase, auch für die Firebase-Webkonfiguration.

Der Vorversuch verwendete einen lokalen Pfad außerhalb des konfigurierten Cookie-Pfads und erzeugte keinen Collect-Aufruf. Die Korrektur betrifft ausschließlich den lokalen Testserver: Er bildet jetzt den tatsächlichen GitHub-Pages-Unterpfad ab. Produktions-SDK und Podcastcode wurden für diese Korrektur nicht geändert.

## Verbleibende Konto-/Veröffentlichungsabnahme

Der verfügbare Browser wurde beim Öffnen von Property `553772695` zur Google-Anmeldung umgeleitet. Daher bleibt **GA4-Eingang unbestätigt**. Im angemeldeten Konto unter Verwaltung → DebugView die Ereignisse des Testgeräts öffnen und `test_run_id=acceptance_20260911` prüfen. Wenn der DebugView-Zeitraum bereits abgelaufen ist, nicht einen historischen Echtzeitnachweis behaupten: nach Abschluss der Kontoeinstellungen einen weiteren ausdrücklich dokumentierten Kontrollhit mit neuer Testkennung auslösen und zeitgleich nachweisen. Keine Zugangsdaten im Chat erforderlich.

Die Betreiberin bestätigte anschließend ausdrücklich „Beides gespeichert und kontrolliert“: personalisierte Werbung in allen Regionen aus; Nutzer- und Ereignisdaten jeweils zwei Monate; Zurücksetzen bei Aktivität aus. Die Betreiberin hat die sechs Dimensionen sowie Optimierte Analysen/Signals/detaillierte Standort- und Gerätedaten bereits als eingerichtet bestätigt. Vollständige Produktionsprüfung auf einem Smartphone einschließlich Screen-Lock steht weiterhin aus.

Reproduktionswerkzeug (sendet echte Testdaten, daher nicht routinemäßig ausführen): `node tools/analytics/live-serve.cjs`, dann `http://127.0.0.1:8091/wifa-trainer-gruen/tests/analytics-live.html`. Der Testserver ist ausschließlich an Loopback gebunden. Auf regulärem Hosting bleibt die Testseite von der Produktions-Allowlist ausgeschlossen.
