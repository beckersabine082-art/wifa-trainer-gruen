# Podcast-/Karaoke-Rollout auf alle Lerntexte

Datum: 2026-09-06

## A. Sync-Tool von Einzelpilot auf alle Lerntexte erweitern

Den bestehenden Hash-, Normalisierungs-, TTS-, Whisper-, Alignment-, Manifest- und Firebase-Code über einen testbaren Gesamt-Orchestrator für alle read-only geladenen Lerntexte verbinden. Dry-Run prüft Tokenlimit, Pfade, Hashes und vorhandene Firebase-Dateien; gültige Einheiten werden übersprungen.

## B. Alle fehlenden/geänderten Firebase-Audios erzeugen

Nach bestandenem Dry-Run nur fehlende oder hash-geänderte Einheiten erzeugen. MP3 mit Hash-Metadata zuerst und Manifest-JSON zuletzt veröffentlichen; temporäre Dateien pro Einheit entfernen und Fehler sammeln.

## C. Frontend von festem Recht-Pilot auf beliebige synchronisierte Einheit erweitern

Die vorhandene Manifest-, Triple-Hash-, Karaoke-, Pause/Fortsetzen-, Fortschritts- und Visibility-Logik für dynamische Fach-/Titel-/Pfadwerte verwenden, ohne Auto-Scroll oder Speech-Synthesis-Rückfall für synchronisierte Einheiten.
