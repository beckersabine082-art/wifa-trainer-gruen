document.getElementById('run').addEventListener('click',async event=>{
  event.target.disabled=true;
  const report=document.getElementById('report');report.textContent='';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=(ok,label)=>{report.textContent+=(ok?'PASS ':'FAIL ')+label+'\n';if(!ok)throw Error(label);};
  const api=window.WifaAnalytics;
  const collect=()=>window.analyticsTestNetwork.filter(r=>r.kind!=='resource' && /google-analytics\.com\/.?\/collect/.test(r.url));
  try {
    check(!document.querySelector('iframe'),'Kein SDK-Kontext vor Zustimmung');
    api.view('trainerView');await wait(1500);
    check(!window.analyticsTestNetwork.length,'Keine Analytics-SDK-/Netzwerkanfrage ohne Zustimmung');
    api.choose(false);await wait(1000);check(!window.analyticsTestNetwork.length,'Keine Analytics-Anfrage bei Ablehnung');
    window.analyticsTestPhase='consented';api.choose(true);
    for(let i=0;i<30 && !collect().length;i++)await wait(1000);
    check(collect().length>0,'Echtes Google-SDK sendet collect nach Zustimmung');
    api.view('trainerView');api.view('trainerView');
    api.start('trainer','Recht','Rechtssubjekte und Rechtsobjekte');api.start('trainer','Recht','Rechtssubjekte und Rechtsobjekte');api.complete('trainer');api.complete('trainer');
    const audio=document.getElementById('audio');audio.muted=true;api.audio(audio,'Recht','Rechtssubjekte und Rechtsobjekte');
    await audio.play();await wait(500);audio.pause();const pausedAt=audio.currentTime;await audio.play();await wait(500);
    check(audio.currentTime>pausedAt,'Echte MP3: Pause/Fortsetzen');
    await wait(7000);
    const hits=collect().flatMap(r=>{
      const base=new URL(r.url).searchParams;
      return (r.body?r.body.split('\n'):['']).map(line=>new URLSearchParams([...base,...new URLSearchParams(line)]));
    });
    const names=hits.map(h=>h.get('en')).filter(Boolean);
    check(names.filter(n=>n==='page_view').length===2,'Genau zwei echte page_view, keine Render-Doppelzählung');
    check(names.filter(n=>n==='training_start').length===1 && names.filter(n=>n==='training_complete').length===1,'Start/Abschluss jeweils einmal');
    check(names.filter(n=>n==='podcast_start').length===1,'Podcast-Start einmal trotz Fortsetzen');
    check(hits.every(h=>!h.has('uid') && !decodeURIComponent(h.toString()).includes('private@example.com') && !decodeURIComponent(h.toString()).includes('private_fragment')),'Keine Konto-ID oder synthetischen personenbezogenen URL-Werte');
    check(hits.every(h=>!h.get('dl')?.includes('?') && !h.get('dr')),'Bereinigte Seiten-URL und leerer Referrer');
    check(hits.every(h=>h.get('ep.test_run_id')==='acceptance_20260911'),'Alle Hits als Abnahmetest markiert');
    report.textContent+='Ereignisse: '+names.join(', ')+'\n';
    api.choose(false);window.analyticsTestPhase='revoked';const count=collect().length,at=audio.currentTime;
    const requestCount=window.analyticsTestNetwork.filter(r=>r.kind!=='resource').length;
    api.view('quizView');await wait(10000);
    check(!document.querySelector('iframe') && collect().length===count,'Keine collect-Anfrage 10 Sekunden nach Widerruf');
    check(window.analyticsTestNetwork.filter(r=>r.kind!=='resource').length===requestCount,'Keine neue SDK-Transportanfrage nach Widerruf');
    check(!audio.paused && audio.currentTime>at,'Podcast läuft beim Widerruf weiter');audio.pause();
    report.textContent+='FERTIG: SDK-/Transportprüfung bestanden. GA4-Eingang in Property 553772695 separat nachweisen.\n';
  } catch(error) {
    const frame=document.querySelector('iframe')?.contentWindow;
    if(frame) {
      report.textContent+='SDK-Diagnose: '+JSON.stringify({scripts:[...frame.document.scripts].map(s=>s.src),
        commands:(frame.dataLayer||[]).map(c=>({command:c[0],event:c[1],keys:c[2]&&typeof c[2]==='object'?Object.keys(c[2]):[]}))})+'\n';
    }
    api.choose(false);document.getElementById('audio').pause();report.textContent+='ABBRUCH: '+error.message+'\n';
  }
  const safe=window.analyticsTestNetwork.map(r=>({kind:r.kind,host:new URL(r.url).hostname,path:new URL(r.url).pathname,phase:r.phase,result:r.result}));
  report.textContent+='Netzwerkübersicht (ohne pseudonyme IDs):\n'+JSON.stringify(safe,null,2);
});
