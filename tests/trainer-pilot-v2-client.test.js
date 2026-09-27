const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

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
  const visible = [
    ['ui-wq-recht-at','BGB Allgemeiner Teil',85],
    ['ui-wq-recht-schuld','BGB Schuldrecht',174],
    ['ui-wq-recht-sachen','BGB Sachenrecht',84],
    ['ui-wq-recht-handel','Handelsrecht',75],
    ['ui-wq-recht-arbeit','Arbeitsrecht',116],
    ['ui-wq-recht-wettbewerb','Wettbewerbsrecht',17],
    ['ui-wq-recht-gewerbe','Gewerberecht',16]
  ].map(([uiThemenKey,thema,anzahl]) => ({uiThemenKey,thema,anzahl,version:'WIFA-TR-WQ3-20260927-v2'}));
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
      if(action==='trainerCatalog') return {success:true,data:{active:true,version:'WIFA-TR-WQ3-20260927-v2',topics:visible}};
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
  assert.ok(!rendered.some(item => /Personen, Rechtsgeschäfte/.test(item.textContent)));
  assert.equal(calls.filter(call => call.action === 'trainerCatalog').length, 1);
  assert.equal(calls.filter(call => call.action === 'topics').length, 0);
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
