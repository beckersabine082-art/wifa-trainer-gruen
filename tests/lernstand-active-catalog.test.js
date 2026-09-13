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
async function render(attempts, active, fail = false) {
  const elements = new Map(), cards = [], requests = [], logs = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',addEventListener(){}});
    return elements.get(id);
  };
  const c = {console:{log:text=>logs.push(text),warn:()=>{}},
    window:{faecherNachTeilbereich:{WQ:['Steuern','Recht']}, apiGet:async(action,params)=>{
      requests.push({action,params});
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
  assert.deepEqual(JSON.parse(JSON.stringify(r.requests.filter(x=>x.action==='questionsForTopic'))),[{action:'questionsForTopic',params:{fach:'Recht'}}]);
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
