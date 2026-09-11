document.getElementById('run').addEventListener('click', async () => {
  const report = document.getElementById('report'); report.textContent = '';
  const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
  const events = () => fetch('/__events').then(r=>r.json());
  const check = (ok,label) => { report.textContent += (ok?'PASS ':'FAIL ') + label + '\n'; if (!ok) throw Error(label); };
  try {
    const api = window.WifaAnalytics;
    const before = (await events()).length;
    check(document.querySelectorAll('iframe').length === 0,'Kein Mess-Iframe vor Zustimmung');
    api.view('trainerView'); await wait(250);
    check((await events()).length === before,'Keine Messanfrage ohne Zustimmung');
    api.choose(false); await wait(250);
    check((await events()).length === before,'Keine Messanfrage nach Ablehnung');
    api.choose(true); await wait(700);
    api.view('trainerView'); api.view('trainerView');
    api.start('trainer','Recht','Rechtssubjekte und Rechtsobjekte'); api.start('trainer','Recht','Rechtssubjekte und Rechtsobjekte');
    api.complete('trainer'); api.complete('trainer');
    await wait(400);
    const measured = (await events()).slice(before);
    check(measured.filter(e=>e.name==='page_view').length===2,'Genau Startseite und Traineransicht, kein doppelter Seitenaufruf');
    check(measured.filter(e=>e.name==='training_complete').length===1,'Ein Abschluss');
    check(measured.every(e=>!JSON.stringify(e).includes('private@example.com')),'URL-Parameter verlassen den Transport nicht');
    const audio = document.getElementById('audio');
    audio.muted = true;
    api.audio(audio,'Recht','Rechtssubjekte und Rechtsobjekte');
    await audio.play(); await wait(400); audio.pause(); const pausedAt = audio.currentTime;
    await audio.play(); await wait(400);
    check(audio.currentTime > pausedAt, 'Echte lokale MP3: Pause und Fortsetzen');
    check((await events()).slice(before).filter(e=>e.name==='podcast_start').length===1,'Kein zweiter Podcast-Start beim Fortsetzen');
    api.view('glossarView'); // queued SDK call must not outlive withdrawal
    api.choose(false); const revokedAt = (await events()).length;
    check(document.querySelectorAll('iframe').length===0,'Widerruf entfernt SDK-Kontext');
    const audioAt = audio.currentTime;
    api.view('quizView'); await wait(1300);
    check((await events()).length===revokedAt,'Keine Messanfrage nach Widerruf, auch keine verzögerte Anfrage');
    check(!audio.paused && audio.currentTime>audioAt,'Podcast spielt bei Widerruf weiter');
    audio.pause(); api.exclude(true); api.choose(true); await wait(300);
    check(document.querySelectorAll('iframe').length===0,'Testausschluss sperrt Messung trotz Zustimmung');
    api.choose(false); api.exclude(false);
    report.textContent += 'FERTIG: Browserchecks bestanden; Google-SDK/Live-Eingang nicht geprüft.\n';
  } catch (error) { report.textContent += 'ABBRUCH: ' + error.message; }
});
