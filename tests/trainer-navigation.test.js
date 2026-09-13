const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness(count = 6) {
  const elements = new Map();
  const questions = Array.from({length: count}, (_, i) => ({id:`Q${i+1}`, frage:`Frage ${i+1}`, thema:'Vertrag', fragePosition:i+1, frageGesamt:count}));
  const calls = [], attempts = [], alerts = [], posts = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'', innerHTML:'', textContent:'', style:{}, dataset:{}, disabled:false,
      classList:{add(){},remove(){},toggle(){}}, addEventListener(){}, querySelectorAll(){return [];}});
    return elements.get(id);
  };
  const c = {console, document:{getElementById:element, querySelector(){return null;}, querySelectorAll(){return [];}},
    auth:{currentUser:{uid:'test'}}, aktuellerTeilbereich:'WQ', aktuellesFach:'Recht', aktuellesThema:'Vertrag',
    aktuelleFrageId:'', aktuelleFrage:'', aktuelleMusterloesung:'', aktuelleStichpunkte:[], ladeToken:0,
    wiederholungsKontext:null, appIstBeschaeftigt:false, faecherNachTeilbereich:{WQ:['Recht'],HQ:[]},
    setzeAppBeschaeftigt(value){c.appIstBeschaeftigt=value; for (const e of elements.values()) e.disabled=value;},
    setzeStatus(value){c.status=value;}, resetFrageAnzeige(){}, escapeHtml:s=>String(s), sanitizeAufgabenHtml:s=>s,
    loescheSkizze(){}, setTimeout(){return 1;}, clearTimeout(){}, alert:s=>alerts.push(s), confirm:()=>false,
    loadAttemptsForCurrentUser:async()=>attempts,
    apiPost:async(action,params)=>{posts.push({action,params});return {success:true};},
    apiGet:async(action,params)=>{
      calls.push({action,params});
      if(action==='questionsForTopic') return {success:true,data:questions};
      if(action==='nextQuestion') {
        const index=questions.findIndex(q=>q.id===params.currentId)+1;
        return {success:true,data:questions[index] || {themaAbgeschlossen:true,frageGesamt:count}};
      }
      throw Error('Unexpected request: '+action);
    }};
  c.window=c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/trainer.js'),'utf8'),c);
  // Existing click handlers may start asynchronous work without returning it.
  for (const name of ['naechsteFrage', 'vorherigeFrage']) {
    if (typeof c[name] !== 'function') continue;
    const handler=c[name];
    c[name]=async()=>{await handler(); await new Promise(resolve=>setImmediate(resolve));};
  }
  return {c, questions, calls, attempts, alerts, posts, element, state:()=>vm.runInContext('({shuffle:trainerShuffleAktiv, unanswered:trainerNochNieAktiv})',c)};
}

test('normal navigation wraps in both directions without a previousQuestion backend', async()=>{
  const {c,questions,calls}=harness();
  c.zeigeGeladeneFrage(questions[5],'Vertrag');
  await c.naechsteFrage();
  assert.equal(c.aktuelleFrageId,'Q1');
  assert.equal(typeof c.vorherigeFrage,'function');
  await c.vorherigeFrage();
  assert.equal(c.aktuelleFrageId,'Q6');
  await c.vorherigeFrage();
  assert.equal(c.aktuelleFrageId,'Q5');
  await c.naechsteFrage();
  assert.equal(c.aktuelleFrageId,'Q6');
  assert.ok(!calls.some(x=>x.action==='previousQuestion'));
});

test('shuffle uses the complete topic pool, preserves numbering and never replays a forward branch', async()=>{
  const {c,calls,posts,element}=harness(83);
  await c.trainerShuffleMix();
  assert.ok(c.aktuelleFrageId, 'activation must display a random question');
  const first=c.aktuelleFrageId;
  await c.naechsteFrage(); const second=c.aktuelleFrageId;
  await c.naechsteFrage(); const third=c.aktuelleFrageId;
  await c.vorherigeFrage(); assert.equal(c.aktuelleFrageId,second);
  await c.naechsteFrage(); const fourth=c.aktuelleFrageId;
  assert.ok(![first,second,third].includes(fourth));
  await c.vorherigeFrage(); assert.equal(c.aktuelleFrageId,second);
  await c.vorherigeFrage(); assert.equal(c.aktuelleFrageId,first);
  assert.equal(element('btnVorherigeFrage').disabled,true);
  const seen=new Set([first,second,third,fourth]);
  while(seen.size<83) {await c.naechsteFrage(); assert.ok(!seen.has(c.aktuelleFrageId)); seen.add(c.aktuelleFrageId);}
  assert.match(element('frageText').innerHTML,new RegExp(`Frage ${c.aktuelleFrageId.slice(1)} von 83`));
  assert.equal(calls.filter(x=>x.action==='questionsForTopic').length,1);
  assert.equal(posts.length,0,'shuffle does not persist resume progress');
  const last=c.aktuelleFrageId;
  await c.naechsteFrage(); assert.equal(c.aktuelleFrageId,last);
  assert.match(c.status,/abgeschlossen/i);
  c.confirm=()=>true;
  await c.naechsteFrage();
  assert.equal(element('btnVorherigeFrage').disabled,true);
  assert.equal(vm.runInContext('trainerShuffleSeenIds.size',c),1);
});

test('unanswered uses persisted zero-point attempts, scoped filters and the actual repeated path',async()=>{
  const {c,attempts,alerts,element}=harness(3);
  const attempt=id=>({modul:'wifa-trainer',bereich:'WQ',fach:'Recht',thema:'Vertrag',frageId:id,erreichtePunkte:0,maximalPunkte:10});
  attempts.push(attempt('Q2'),{...attempt('Q1'),thema:'Anderes Thema'},{...attempt('Q3'),fach:'Steuern'});
  assert.equal(await c.trainerNochNieBeantwortet(),true);
  assert.equal(c.aktuelleFrageId,'Q1');
  await c.naechsteFrage(); assert.equal(c.aktuelleFrageId,'Q3');
  await c.naechsteFrage(); assert.equal(c.aktuelleFrageId,'Q1','viewing does not answer');
  assert.equal(typeof c.vorherigeFrage,'function');
  await c.vorherigeFrage(); assert.equal(c.aktuelleFrageId,'Q3');
  await c.vorherigeFrage(); assert.equal(c.aktuelleFrageId,'Q1');
  assert.equal(element('btnVorherigeFrage').disabled,true);
  attempts.push(attempt('Q1'));
  await c.naechsteFrage(); assert.equal(c.aktuelleFrageId,'Q3');
  attempts.push(attempt('Q3'));
  await c.naechsteFrage();
  assert.match(alerts.at(-1),/alle Fragen dieses Themas/);
  assert.equal(element('trainerUnansweredBtn').disabled,true);
});

test('mode switches are exclusive and busy controls cannot switch modes',async()=>{
  const {c,state}=harness();
  await c.trainerShuffleMix(); assert.equal(state().shuffle,true);
  await c.trainerNochNieBeantwortet();
  assert.equal(state().shuffle,false); assert.equal(state().unanswered,true);
  await c.trainerShuffleMix();
  assert.equal(state().shuffle,true); assert.equal(state().unanswered,false);
  c.appIstBeschaeftigt=true;
  await c.trainerShuffleMix(); assert.equal(state().shuffle,true);
});

test('unanswered completion on activation and login guard are distinct',async()=>{
  const {c,attempts,alerts}=harness(1);
  attempts.push({modul:'wifa-trainer',fach:'Recht',thema:'Vertrag',frageId:'Q1',erreichtePunkte:0});
  assert.equal(await c.trainerNochNieBeantwortet(),false);
  assert.match(alerts.at(-1),/alle Fragen/);
  c.auth.currentUser=null;
  assert.equal(await c.trainerNochNieBeantwortet(),false);
  assert.match(alerts.at(-1),/melde dich an/);
});

test('trainer markup provides an actual previous button',()=>{
  assert.ok(/id="btnVorherigeFrage"[^>]*onclick="vorherigeFrage\(\)"/.test(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8')));
});

test('unanswered advances after the current question even when its new attempt removes it',async()=>{
  const {c,attempts}=harness(4);
  await c.trainerNochNieBeantwortet();
  await c.naechsteFrage();
  attempts.push({fach:'Recht',thema:'Vertrag',frageId:'Q2',erreichtePunkte:0});
  await c.naechsteFrage();
  assert.equal(c.aktuelleFrageId,'Q3');
});

test('starting another topic clears shuffle state',async()=>{
  const {c,state,element}=harness();
  await c.trainerShuffleMix();
  element('themaSelect').value='Neues Thema';
  c.ladeTrainerFortschritt=async()=>null;
  await c.starteThema();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(state().shuffle,false);
  assert.equal(vm.runInContext('trainerShuffleSeenIds.size',c),0);
});

test('shuffle pool failure preserves the displayed question and releases busy state',async()=>{
  const {c,questions,state}=harness();
  c.zeigeGeladeneFrage(questions[2],'Vertrag');
  c.apiGet=async()=>{throw Error('offline');};
  await c.trainerShuffleMix();
  assert.equal(c.aktuelleFrageId,'Q3');
  assert.equal(state().shuffle,false);
  assert.equal(c.appIstBeschaeftigt,false);
  assert.match(c.status,/offline/);
});

test('deactivating unanswered immediately restores circular previous navigation',async()=>{
  const {c,element}=harness();
  await c.trainerNochNieBeantwortet();
  assert.equal(element('btnVorherigeFrage').disabled,true);
  await c.trainerNochNieBeantwortet();
  assert.equal(element('btnVorherigeFrage').disabled,false);
});
