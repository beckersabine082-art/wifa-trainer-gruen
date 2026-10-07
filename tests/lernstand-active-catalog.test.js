const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const key = (fach, thema, id) => ['wifa-trainer','WQ',fach,thema,id].join('::');
const attempt = (fach, thema, id, points = 1, maximum = 1) => ({
  id, frageId:id, questionKey:key(fach,thema,id), bereich:'WQ',fach,thema,
  modul:'wifa-trainer',userId:'test',erreichtePunkte:points,maximalPunkte:maximum,
  status:points === maximum ? 'richtig' : 'falsch'
});
async function render(attempts, active, fail = false, pilot = false, fixture = {}) {
  const elements = new Map(), cards = [], requests = [], logs = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',addEventListener(){}});
    return elements.get(id);
  };
  const c = {console:{log:text=>logs.push(text),warn:()=>{}},
    window:{faecherNachTeilbereich:fixture.subjects || {WQ:['Steuern','Recht']}, apiGet:async(action,params)=>{
      requests.push({action,params});
      if(action === 'trainerCatalog' && fixture.catalogByFach) {
        const entry = fixture.catalogByFach[params.fach];
        return {success:true,data:{active:true,version:'WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE',
          fachKey:entry.fachKey,questionIds:entry.ids,
          topics:[{uiThemenKey:`ui-${entry.fachKey}`,thema:'Pool',anzahl:entry.ids.length}]}};
      }
      if(action === 'trainerCatalog' && pilot) return {success:true,data:{active:true,version:'WIFA-TR-WQ3-20260927-v2',topics:
        params.fach === 'Recht'
          ? [{uiThemenKey:'ui-wq-recht-at',thema:'BGB Allgemeiner Teil',anzahl:85}]
          : [{uiThemenKey:'ui-wq-steuern-grundlagen',thema:'Grundbegriffe des Steuerrechts',anzahl:12}],
        questionIds:(active[params.fach] || []).map(question=>question.id)}};
      if(action === 'trainerQuestions' && pilot) { if(fail) throw Error('offline'); return {success:true,data:{active:true,questions:active[params.fach] || []}}; }
      if(action === 'topics') return {success:true,data:[{thema:'Aktuell',anzahl:params.fach === 'Steuern' ? 233 : 83},...(params.fach === 'Recht' ? [{thema:'Weiteres',anzahl:488}] : [])]};
      if(action === 'questionsForTopic') { if(fail) throw Error('offline'); return {success:true,data:active[params.fach] || []}; }
      throw Error('unexpected request');
    }},
    document:{getElementById:element,querySelector:()=>element('grid'),querySelectorAll:()=>[]},
    auth:{currentUser:{uid:'test',emailVerified:true}}, db:{},collection:()=>({}),query:()=>({}),orderBy:()=>({}),
    getDocs:async()=>({docs:attempts.map(a=>({id:a.id,data:()=>a}))}),
    mountSubjectAccordion:(_,subjects)=>{cards.push(...subjects);return {destroy(){}};}
  };
  vm.createContext(c);
  for (const file of ['js/lernstand-progress.mjs','js/lernstand.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8').replace(/^import[\s\S]*?from\s*'[^']+';/gm,'').replace(/export /g,''),c);
  await c.window.ladeWifaLernstand();
  return {cards,requests,logs,status:element('lernstandStatus').textContent,html:element('lernstandListe').innerHTML};
}
test('Steuern: historical perfect attempt outside active catalog contributes no count, points, errors or full points',async()=>{
  const r=await render([attempt('Steuern','Alt','ghost')],{Steuern:[{id:'active',thema:'Aktuell'}]});
  assert.match(r.cards[0].card,/0 \/ 233 Fragen/);
  assert.match(r.cards[0].card,/0% Aktuelle Punktleistung/);
  assert.match(r.cards[0].card,/0 offene Fehler/);
  assert.match(r.cards[0].card,/0% mit voller Punktzahl/);
});
test('deleted question in still-active topic is excluded; actual active zero-point question counts',async()=>{
  const r=await render([attempt('Steuern','Aktuell','deleted'),attempt('Steuern','Aktuell','active',0,3)],{Steuern:[{id:'active',thema:'Aktuell'}]});
  assert.match(r.cards[0].card,/1 \/ 233 Fragen/);
  assert.match(r.cards[0].card,/0% Aktuelle Punktleistung/);
  assert.match(r.cards[0].card,/1 offene Fehler/);
});
test('Recht retains other active topics and excludes ghosts from the weighted subject total',async()=>{
  const r=await render([attempt('Recht','Aktuell','a',1,1),attempt('Recht','Weiteres','b',1,3),attempt('Recht','Alt','ghost',10,10)],{Recht:[{id:'a',thema:'Aktuell'},{id:'b',thema:'Weiteres'}]});
  assert.match(r.cards[1].card,/2 \/ 571 Fragen/);
  assert.match(r.cards[1].card,/50% Aktuelle Punktleistung/);
  assert.match(r.cards[1].panel,/>100%<\/span>/);
  assert.match(r.cards[1].panel,/>33%<\/span>/);
  assert.match(r.html,/2 \/ 4 Punkte/);
  assert.deepEqual(JSON.parse(JSON.stringify(r.requests.filter(x=>x.action==='questionsForTopic'))),[
    {action:'questionsForTopic',params:{fach:'Steuern'}},
    {action:'questionsForTopic',params:{fach:'Recht'}},
    {action:'questionsForTopic',params:{fach:'Recht'}}
  ]);
});
test('catalog read failure shows unavailable instead of accepting unverified attempts',async()=>{
  const r=await render([attempt('Steuern','Aktuell','a')],{},true);
  assert.match(r.status,/konnte nicht geladen werden/);
  assert.equal(r.cards.length,0);
});

test('legacy keys for the same verified active question still count only the latest attempt',async()=>{
  const newest={...attempt('Steuern','Aktuell','a',0,3),id:'new',questionKey:'legacy-key'};
  const older={...attempt('Steuern','Aktuell','a',3,3),id:'old'};
  const r=await render([newest,older],{Steuern:[{id:'a',thema:'Aktuell'}]});
  assert.match(r.cards[0].card,/1 \/ 233 Fragen/);
  assert.match(r.cards[0].card,/0% Aktuelle Punktleistung/);
});
test('audit identifies a moved topic separately from an inactive question without logging answers',async()=>{
  const ghost={...attempt('Steuern','Alt','a'),antwort:'PRIVATE ANSWER'};
  const r=await render([ghost],{Steuern:[{id:'a',thema:'Aktuell'}]});
  const report=JSON.parse(r.logs[0].split('\n').slice(1,-1).join('\n'));
  const audit=report.activeCatalogAudit[0];
  assert.equal(audit.excluded[0].questionKey,key('Steuern','Alt','a'));
  assert.equal(audit.excluded[0].activeTopic,false);
  assert.equal(audit.excluded[0].activeQuestion,true);
  assert.equal(audit.excluded[0].activeCatalogMatch,false);
  assert.equal(audit.currentTotals.answered,0);
  assert.ok(!r.logs[0].includes('PRIVATE ANSWER'));
});

test('pilot lernstand projects legacy attempts by stable ID onto one visible UI topic without double counting',async()=>{
  const attempts=[
    attempt('Recht','Rechtliche Grundlagen & Methoden','R-0566',1,1),
    attempt('Recht','BGB Allgemeiner Teil','R-0050',0,1)
  ];
  const active={Recht:[
    {id:'R-0566',thema:'Rechtliche Grundlagen & Methoden',legacyThema:'Rechtliche Grundlagen & Methoden',uiThemenKey:'ui-wq-recht-at',uiThemenName:'BGB Allgemeiner Teil'},
    {id:'R-0050',thema:'BGB Allgemeiner Teil',legacyThema:'BGB Allgemeiner Teil',uiThemenKey:'ui-wq-recht-at',uiThemenName:'BGB Allgemeiner Teil'}
  ]};
  const r=await render(attempts,active,false,true);
  const recht=r.cards[1];
  assert.ok(recht, r.status + '\n' + JSON.stringify(r.requests));
  assert.match(recht.card,/2 \/ 85 Fragen/);
  assert.match(recht.panel,/BGB Allgemeiner Teil/);
  assert.equal(r.requests.filter(call=>call.action==='trainerQuestions' && call.params.fach==='Recht').length,1);
  assert.equal(r.requests.filter(call=>call.action==='questionsForTopic' && call.params.fach==='Recht').length,0);
});

test('Gesamtnenner dedupliziert aktive Mehrquellen- und Aliaspools nach stabiler Trainer-ID',async()=>{
  const ids=(prefix,count)=>Array.from({length:count},(_,index)=>`${prefix}-${String(index+1).padStart(4,'0')}`);
  const pools={
    vw_bwl:ids('VB',283), rewe:ids('BR',122), recht:ids('R',567), steuern:ids('S',233), uf:ids('UF',235),
    fz:ids('PF',205), bm:ids('BM',264), logistik:ids('L',317), marketing_vertrieb:ids('MV',191), if_brc:ids('IFBRC',269)
  };
  const subjects={WQ:['Recht','Steuern','Rechnungswesen','BWL','VWL','Unternehmensführung'],HQ:[
    'Führung und Zusammenarbeit','Betriebliches Management','Logistik','Marketing','Vertrieb',
    'Investition und Finanzierung','Betriebliches Rechnungswesen und Controlling']};
  const catalogByFach={
    Recht:{fachKey:'wq-recht',ids:pools.recht}, Steuern:{fachKey:'wq-steuern',ids:pools.steuern},
    Rechnungswesen:{fachKey:'wq-rechnungswesen',ids:pools.rewe}, BWL:{fachKey:'wq-volks-betriebswirtschaft',ids:pools.vw_bwl},
    VWL:{fachKey:'wq-volks-betriebswirtschaft',ids:pools.vw_bwl}, Unternehmensführung:{fachKey:'wq-unternehmensfuehrung',ids:pools.uf},
    'Führung und Zusammenarbeit':{fachKey:'hq-fuehrung-zusammenarbeit',ids:pools.fz},
    'Betriebliches Management':{fachKey:'hq-betriebliches-management',ids:pools.bm}, Logistik:{fachKey:'hq-logistik',ids:pools.logistik},
    Marketing:{fachKey:'hq-marketing-vertrieb',ids:pools.marketing_vertrieb}, Vertrieb:{fachKey:'hq-marketing-vertrieb',ids:pools.marketing_vertrieb},
    'Investition und Finanzierung':{fachKey:'hq-investition-finanzierung-controlling',ids:pools.if_brc},
    'Betriebliches Rechnungswesen und Controlling':{fachKey:'hq-investition-finanzierung-controlling',ids:pools.if_brc}
  };
  const r=await render([],{},false,true,{subjects,catalogByFach});
  assert.match(r.html,/0 von 2686/);
  assert.doesNotMatch(r.html,/3429/);
});

test('historische Aliasversuche derselben Trainer-ID zählen global einmal und fachbezogen weiterhin korrekt',async()=>{
  const shared='VB-0001';
  const subjects={WQ:['BWL','VWL']};
  const catalogByFach={
    BWL:{fachKey:'wq-volks-betriebswirtschaft',ids:[shared]},
    VWL:{fachKey:'wq-volks-betriebswirtschaft',ids:[shared]}
  };
  const active={
    BWL:[{id:shared,thema:'Alt',uiThemenKey:'ui-wq-vb',uiThemenName:'Pool'}],
    VWL:[{id:shared,thema:'Alt',uiThemenKey:'ui-wq-vb',uiThemenName:'Pool'}]
  };
  const r=await render([attempt('BWL','Alt',shared),attempt('VWL','Alt',shared)],active,false,true,{subjects,catalogByFach});
  assert.match(r.html,/1 von 1/);
  assert.equal(r.cards.filter(card=>/1 \/ 1 Fragen/.test(card.card)).length,2);
});
