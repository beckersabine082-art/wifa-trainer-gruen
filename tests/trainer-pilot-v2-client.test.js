const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const approvedTopics = {
  Recht: [
    ['ui-wq-recht-at','BGB Allgemeiner Teil',85],
    ['ui-wq-recht-schuld','BGB Schuldrecht',174],
    ['ui-wq-recht-sachen','BGB Sachenrecht',84],
    ['ui-wq-recht-handel','Handelsrecht',75],
    ['ui-wq-recht-arbeit','Arbeitsrecht',116],
    ['ui-wq-recht-wettbewerb','Wettbewerbsrecht',17],
    ['ui-wq-recht-gewerbe','Gewerberecht',16]
  ],
  Steuern: [
    ['ui-wq-steuern-grundlagen','Grundbegriffe des Steuerrechts',12],
    ['ui-wq-steuern-unternehmen','Unternehmensbezogene Steuern',205],
    ['ui-wq-steuern-ao','Abgabenordnung',16]
  ]
};

Object.keys(approvedTopics).forEach(fach => {
  approvedTopics[fach] = approvedTopics[fach].map(([uiThemenKey,thema,anzahl]) => ({
    uiThemenKey,thema,anzahl,version:'WIFA-TR-WQ3-20260927-v2'
  }));
});

function harness() {
  const elements = new Map();
  const calls = [];
  const posts = [];
  const option = () => ({value:'', textContent:'', dataset:{}});
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value:'', innerHTML:'', textContent:'', style:{}, dataset:{}, disabled:false, children:[],
      appendChild(child){this.children.push(child);},
      classList:{add(){},remove(){},toggle(){}}, addEventListener(){}, querySelectorAll(){return [];}, scrollIntoView(){}
    });
    return elements.get(id);
  };
  const visible = approvedTopics.Recht;
  const questions = [
    {id:'R-0566',thema:'Rechtliche Grundlagen & Methoden',legacyThema:'Rechtliche Grundlagen & Methoden',uiThemenKey:'ui-wq-recht-at',uiThemenName:'BGB Allgemeiner Teil',frage:'Methodenfrage',fragePosition:1,frageGesamt:2},
    {id:'R-0050',thema:'BGB Allgemeiner Teil',legacyThema:'BGB Allgemeiner Teil',uiThemenKey:'ui-wq-recht-at',uiThemenName:'BGB Allgemeiner Teil',frage:'Grundlagenfrage',fragePosition:2,frageGesamt:2}
  ];
  const c = {
    console,
    document:{getElementById:element, createElement:option, querySelector(){return null;}, querySelectorAll(){return [];}, addEventListener(){}},
    auth:{currentUser:{uid:'u-1'}}, aktuellerTeilbereich:'WQ', aktuellesFach:'Recht', aktuellesThema:'',
    aktuellesTrainerThemaKey:'', aktuelleFrageQuellthema:'', aktuelleTrainerKatalogVersion:'',
    aktuelleFrageId:'', aktuelleFrage:'', aktuelleMusterloesung:'', aktuelleStichpunkte:[], ladeToken:0,
    wiederholungsKontext:null, appIstBeschaeftigt:false, faecherNachTeilbereich:{WQ:['Recht'],HQ:[]},
    setzeAppBeschaeftigt(value){c.appIstBeschaeftigt=value;}, setzeStatus(value){c.status=value;}, resetFrageAnzeige(){},
    updateStatAnzeige(){}, escapeHtml:s=>String(s), sanitizeAufgabenHtml:s=>s, loescheSkizze(){},
    aktualisiereTrainerAuswahlFallback(){}, zeigeBereich(){}, setTimeout(){return 1;}, clearTimeout(){}, alert(){}, confirm:()=>false,
    apiPost:async(action,params)=>{posts.push({action,params});return {success:true};},
    apiGet:async(action,params)=>{
      calls.push({action,params});
      if(action==='trainerCatalog') return {success:true,data:{
        active:true,version:'WIFA-TR-WQ3-20260927-v2',migrationStatus:'AKTIV',topics:approvedTopics[params.fach] || []
      }};
      if(action==='trainerQuestions') return {success:true,data:{active:true,version:'WIFA-TR-WQ3-20260927-v2',uiThemenKey:params.uiThemenKey,questions}};
      if(action==='topics') return {success:true,data:[{thema:'BGB: Personen, Rechtsgeschäfte und Vertretung',anzahl:84}]};
      if(action==='questionsForTopic') return {success:true,data:[]};
      if(action==='getProgress') return {success:true,data:null};
      throw Error('Unexpected request: '+action);
    }
  };
  c.window=c;
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/trainer.js'),'utf8'),c);
  return {c,calls,posts,element,visible,questions};
}

test('topic dropdown renders only the seven approved Recht UI topics with stable keys', async () => {
  const {c,calls,element,visible} = harness();
  await c.ladeThemen('Recht');
  const rendered = element('themaSelect').children;

  assert.deepEqual(rendered.map(item => item.value), visible.map(item => item.uiThemenKey));
  assert.deepEqual(rendered.map(item => item.textContent), visible.map(item => `${item.thema} (${item.anzahl} Fragen)`));
  assert.equal(rendered.length,7);
  assert.equal(rendered.reduce((sum,item) => sum + Number(item.dataset.fragenAnzahl),0),567);
  assert.ok(!rendered.some(item => /Personen, Rechtsgeschäfte/.test(item.textContent)));
  assert.equal(calls.filter(call => call.action === 'trainerCatalog').length, 1);
  assert.equal(calls.filter(call => call.action === 'topics').length, 0);
});

test('topic dropdown renders only the three approved Steuern UI topics with exact counts', async () => {
  const {c,calls,element} = harness();
  await c.ladeThemen('Steuern');
  const rendered = element('themaSelect').children;

  assert.deepEqual(rendered.map(item => item.value), approvedTopics.Steuern.map(item => item.uiThemenKey));
  assert.deepEqual(rendered.map(item => item.textContent), approvedTopics.Steuern.map(item => `${item.thema} (${item.anzahl} Fragen)`));
  assert.equal(rendered.length,3);
  assert.equal(rendered.reduce((sum,item) => sum + Number(item.dataset.fragenAnzahl),0),233);
  assert.equal(calls.filter(call => call.action === 'topics').length,0);
});

test('pilot subjects never fall back to legacy topics when the deployed pilot API is unavailable', async () => {
  const {c,calls} = harness();
  c.apiGet = async (action,params) => {
    calls.push({action,params});
    if(action==='trainerCatalog') return {success:false,error:'Unbekannte Aktion.'};
    if(action==='topics') return {success:true,data:[
      {thema:'BGB Allgemeiner Teil',anzahl:67},
      {thema:'BGB Schuldrecht',anzahl:7},
      {thema:'Rechtliche Grundlagen & Methoden',anzahl:1}
    ]};
    throw Error('Unexpected request: '+action);
  };

  await assert.rejects(() => c.ladeTrainerThemenDaten('Recht'),/Pilot-Themen/);
  assert.equal(calls.filter(call => call.action === 'topics').length,0);
});

test('pilot subjects reject unmarked legacy catalog payloads but accept an explicit rollback', async () => {
  const legacyTopics = [{thema:'Rechtliche Grundlagen & Methoden',anzahl:1}];
  const unavailable = harness();
  unavailable.c.apiGet = async (action,params) => {
    unavailable.calls.push({action,params});
    if(action==='trainerCatalog') return {success:true,data:{active:false,version:'legacy',topics:legacyTopics}};
    throw Error('Unexpected request: '+action);
  };
  await assert.rejects(() => unavailable.c.ladeTrainerThemenDaten('Recht'),/Pilot-Themen/);

  const stale = harness();
  stale.c.apiGet = async (action,params) => {
    stale.calls.push({action,params});
    if(action==='trainerCatalog') return {success:true,data:{
      active:true,version:'WIFA-TR-WQ3-20260927-v1',migrationStatus:'AKTIV',topics:legacyTopics
    }};
    throw Error('Unexpected request: '+action);
  };
  await assert.rejects(() => stale.c.ladeTrainerThemenDaten('Recht'),/Pilot-Themen/);

  const rollback = harness();
  rollback.c.apiGet = async (action,params) => {
    rollback.calls.push({action,params});
    if(action==='trainerCatalog') return {success:true,data:{
      active:false,version:'legacy',migrationStatus:'ZURUECKGEROLLT',topics:legacyTopics
    }};
    throw Error('Unexpected request: '+action);
  };
  const rollbackTopics = await rollback.c.ladeTrainerThemenDaten('Recht');
  assert.deepEqual(rollbackTopics.map(item => item.thema),['Rechtliche Grundlagen & Methoden']);
});

test('pilot question pools reject a stale or mismatched API contract', async () => {
  const {c} = harness();
  c.apiGet = async action => {
    if(action==='trainerQuestions') return {success:true,data:{
      active:true,version:'WIFA-TR-WQ3-20260927-v1',uiThemenKey:'ui-wq-recht-at',questions:[]
    }};
    throw Error('Unexpected request: '+action);
  };

  await assert.rejects(
    () => c.trainerThemenpoolLaden('Recht','ui-wq-recht-at'),
    /Themenpool/
  );
});

test('pilot question pools are cached once per version, subject, and UI key', async () => {
  const {c,calls,questions} = harness();
  c.aktuelleTrainerKatalogVersion = 'WIFA-TR-WQ3-20260927-v2';

  const cacheKeys = [
    c.trainerPilotPoolCacheKey('Recht','ui-wq-recht-at'),
    c.trainerPilotPoolCacheKey('Recht','ui-wq-recht-schuld'),
    c.trainerPilotPoolCacheKey('Steuern','ui-wq-recht-at')
  ];
  c.aktuelleTrainerKatalogVersion = 'WIFA-TR-WQ3-20260927-v3';
  cacheKeys.push(c.trainerPilotPoolCacheKey('Recht','ui-wq-recht-at'));
  assert.equal(new Set(cacheKeys).size, 4);
  c.aktuelleTrainerKatalogVersion = 'WIFA-TR-WQ3-20260927-v2';

  const first = await c.trainerThemenpoolLaden('Recht','ui-wq-recht-at');
  const second = await c.trainerThemenpoolLaden('Recht','ui-wq-recht-at');

  assert.deepEqual(first.map(item => item.id), questions.map(item => item.id));
  assert.deepEqual(second.map(item => item.id), questions.map(item => item.id));
  assert.equal(calls.filter(call => call.action === 'trainerQuestions').length, 1);
});

test('resume and initial pilot pool load issue only one trainerQuestions request', async () => {
  const {c,calls,element,questions} = harness();
  let resolveProgress;
  let resolveQuestions;
  const progressResponse = new Promise(resolve => { resolveProgress = resolve; });
  const questionsResponse = new Promise(resolve => { resolveQuestions = resolve; });
  c.apiGet = async (action,params) => {
    calls.push({action,params});
    if(action==='trainerCatalog') return {success:true,data:{
      active:true,version:'WIFA-TR-WQ3-20260927-v2',migrationStatus:'AKTIV',topics:approvedTopics.Recht
    }};
    if(action==='getProgress') return progressResponse;
    if(action==='trainerQuestions') return questionsResponse;
    throw Error('Unexpected request: '+action);
  };

  await c.ladeThemen('Recht');
  element('themaSelect').value='ui-wq-recht-at';
  const startPromise = c.starteThema();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.filter(call => call.action === 'getProgress').length, 1);
  assert.equal(calls.filter(call => call.action === 'trainerQuestions').length, 1);

  resolveProgress({success:true,data:{letzteFrageId:'R-0566'}});
  resolveQuestions({success:true,data:{
    active:true,
    version:'WIFA-TR-WQ3-20260927-v2',
    uiThemenKey:'ui-wq-recht-at',
    questions
  }});
  await startPromise;
  await new Promise(resolve=>setImmediate(resolve));

  assert.equal(calls.filter(call => call.action === 'trainerQuestions').length, 1);
  assert.equal(c.aktuelleFrageId, 'R-0050');
});

test('an in-flight pilot start cannot render after the trainer context changed', async () => {
  const {c,element,questions} = harness();
  let resolveProgress;
  let resolveQuestions;
  const progressResponse = new Promise(resolve => { resolveProgress = resolve; });
  const questionsResponse = new Promise(resolve => { resolveQuestions = resolve; });
  c.apiGet = async (action,params) => {
    if(action==='trainerCatalog') return {success:true,data:{
      active:true,version:'WIFA-TR-WQ3-20260927-v2',migrationStatus:'AKTIV',topics:approvedTopics.Recht
    }};
    if(action==='getProgress') return progressResponse;
    if(action==='trainerQuestions') return questionsResponse;
    throw Error('Unexpected request: '+action);
  };

  await c.ladeThemen('Recht');
  element('themaSelect').value='ui-wq-recht-at';
  const startPromise = c.starteThema();
  await Promise.resolve();
  await Promise.resolve();

  element('teilbereichSelect').value='HQ';
  c.waehleTeilbereich();
  resolveProgress({success:true,data:{letzteFrageId:'R-0566'}});
  resolveQuestions({success:true,data:{
    active:true,
    version:'WIFA-TR-WQ3-20260927-v2',
    uiThemenKey:'ui-wq-recht-at',
    questions
  }});
  await startPromise;
  await new Promise(resolve=>setImmediate(resolve));

  assert.equal(c.aktuellerTeilbereich, 'HQ');
  assert.equal(c.aktuellesFach, '');
  assert.equal(c.aktuellesTrainerThemaKey, '');
  assert.equal(c.aktuelleFrageId, '');
});

test('explicit pilot cache invalidation cancels an in-flight topic start', async () => {
  const {c,element,questions} = harness();
  let resolveProgress;
  let resolveQuestions;
  c.apiGet = async (action,params) => {
    if(action==='trainerCatalog') return {success:true,data:{
      active:true,version:'WIFA-TR-WQ3-20260927-v2',migrationStatus:'AKTIV',topics:approvedTopics.Recht
    }};
    if(action==='getProgress') return new Promise(resolve => { resolveProgress = resolve; });
    if(action==='trainerQuestions') return new Promise(resolve => { resolveQuestions = resolve; });
    throw Error('Unexpected request: '+action);
  };

  await c.ladeThemen('Recht');
  element('themaSelect').value='ui-wq-recht-at';
  const startPromise = c.starteThema();
  await Promise.resolve();
  await Promise.resolve();

  c.trainerPilotPoolCacheLeeren();
  resolveProgress({success:true,data:{letzteFrageId:'R-0566'}});
  resolveQuestions({success:true,data:{
    active:true,
    version:'WIFA-TR-WQ3-20260927-v2',
    uiThemenKey:'ui-wq-recht-at',
    questions
  }});
  await startPromise;
  await new Promise(resolve=>setImmediate(resolve));

  assert.equal(c.aktuelleFrageId, '');
});

test('next and previous navigation reuse an already loaded pilot pool', async () => {
  const {c,calls,element} = harness();
  await c.ladeThemen('Recht');
  element('themaSelect').value='ui-wq-recht-at';
  await c.starteThema();
  await new Promise(resolve=>setImmediate(resolve));

  await c.naechsteFrage();
  await c.vorherigeFrage();

  assert.equal(calls.filter(call => call.action === 'trainerQuestions').length, 1);
});

test('pilot pool cache is cleared explicitly and on trainer context changes', async () => {
  const {c,calls,element} = harness();
  c.aktuelleTrainerKatalogVersion = 'WIFA-TR-WQ3-20260927-v2';
  await c.trainerThemenpoolLaden('Recht','ui-wq-recht-at');
  await c.trainerThemenpoolLaden('Recht','ui-wq-recht-at');
  assert.equal(calls.filter(call => call.action === 'trainerQuestions').length, 1);

  c.trainerPilotPoolCacheLeeren();
  await c.trainerThemenpoolLaden('Recht','ui-wq-recht-at');
  assert.equal(calls.filter(call => call.action === 'trainerQuestions').length, 2);

  element('teilbereichSelect').value = 'HQ';
  c.waehleTeilbereich();
  c.aktuelleTrainerKatalogVersion = 'WIFA-TR-WQ3-20260927-v2';
  await c.trainerThemenpoolLaden('Recht','ui-wq-recht-at');
  assert.equal(calls.filter(call => call.action === 'trainerQuestions').length, 3);
});

test('rollback or legacy catalog invalidates cached pilot pools', async () => {
  const {c,calls} = harness();
  c.aktuelleTrainerKatalogVersion = 'WIFA-TR-WQ3-20260927-v2';
  await c.trainerThemenpoolLaden('Recht','ui-wq-recht-at');
  c.apiGet = async (action,params) => {
    calls.push({action,params});
    if(action==='trainerCatalog') return {success:true,data:{
      active:false,version:'legacy',migrationStatus:'ZURUECKGEROLLT',topics:[{thema:'Legacy',anzahl:1}]
    }};
    if(action==='trainerQuestions') return {success:true,data:{
      active:true,version:'WIFA-TR-WQ3-20260927-v2',uiThemenKey:params.uiThemenKey,questions:[]
    }};
    throw Error('Unexpected request: '+action);
  };

  await c.ladeTrainerThemenDaten('Recht');
  c.aktuelleTrainerKatalogVersion = 'WIFA-TR-WQ3-20260927-v2';
  await c.trainerThemenpoolLaden('Recht','ui-wq-recht-at');

  assert.equal(calls.filter(call => call.action === 'trainerQuestions').length, 2);
});

test('pilot navigation and resume use the UI key while the displayed and persisted question keep their proper levels', async () => {
  const {c,calls,posts,element,questions} = harness();
  await c.ladeThemen('Recht');
  element('themaSelect').value='ui-wq-recht-at';
  await c.starteThema();
  await new Promise(resolve=>setImmediate(resolve));

  assert.equal(c.aktuellesTrainerThemaKey,'ui-wq-recht-at');
  assert.equal(c.aktuellesThema,'BGB Allgemeiner Teil');
  assert.equal(c.aktuelleFrageQuellthema,'Rechtliche Grundlagen & Methoden');
  assert.equal(c.aktuelleFrageId,questions[0].id);
  assert.ok(calls.some(call => call.action === 'trainerQuestions' && call.params.uiThemenKey === 'ui-wq-recht-at'));
  assert.ok(posts.some(call => call.action === 'saveProgress' && call.params.auswahl === 'tr-v2:ui-wq-recht-at'));
});

test('never-answered mode recognizes historical legacy-topic attempts by stable question ID in a pilot pool', () => {
  const {c,questions} = harness();
  c.aktuellesThema='BGB Allgemeiner Teil';
  c.aktuellesTrainerThemaKey='ui-wq-recht-at';
  const open = c.filtereNochNieBeantworteteFragen(questions, [{
    modul:'wifa-trainer', bereich:'WQ', fach:'Recht', thema:'Rechtliche Grundlagen & Methoden', frageId:'R-0566'
  }]);
  assert.deepEqual(open.map(item => item.id), ['R-0050']);
});

test('error-review restore keeps R-0566 inside the visible BGB AT pool and preserves its legacy source topic', () => {
  const {c,element} = harness();
  c.oeffneWifaWiederholungsfrage({
    id:'R-0566', thema:'Rechtliche Grundlagen & Methoden', frage:'Methodenfrage'
  }, {
    bereich:'WQ', fach:'Recht', thema:'BGB Allgemeiner Teil', uiThemenKey:'ui-wq-recht-at'
  });

  assert.equal(c.aktuellesTrainerThemaKey,'ui-wq-recht-at');
  assert.equal(c.aktuellesThema,'BGB Allgemeiner Teil');
  assert.equal(c.aktuelleFrageQuellthema,'Rechtliche Grundlagen & Methoden');
  assert.equal(element('themaSelect').value,'ui-wq-recht-at');
});

test('retrying the same unresolved error preserves the visible UI topic key', async () => {
  const {c} = harness();
  let retriedAttempt = null;
  c.oeffneWifaWiederholungsfrage({
    id:'R-0566', thema:'Rechtliche Grundlagen & Methoden', frage:'Methodenfrage'
  }, {
    bereich:'WQ', fach:'Recht', thema:'BGB Allgemeiner Teil', uiThemenKey:'ui-wq-recht-at'
  });
  c.ermittleNaechstenOffenenFehler = async () => ({currentIsOpen:true, nextEntry:null});
  c.oeffneWiederholungAusAttempt = async attempt => { retriedAttempt = attempt; };

  await c.naechsterOffenerFehler();

  assert.equal(retriedAttempt.uiThemenKey,'ui-wq-recht-at');
  assert.equal(retriedAttempt.thema,'BGB Allgemeiner Teil');
  assert.equal(retriedAttempt.frageId,'R-0566');
});
