const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const catalog = JSON.parse(fs.readFileSync('data/pruefungssimulation/katalog.json', 'utf8'));
const {rubricCorrections,allCorrections} = require('./helpers/pruefung-audit.cjs');

test('each documented content correction is present without changing task points',()=>{
  const corrections=allCorrections();
  for(const change of corrections) {
    const row=catalog.einheiten.flatMap(u=>u.aufgaben).find(r=>[r.simulationId,r.fach,r.aufgabe,r.teilaufgabe].join('|')===change.key);
    assert.ok(row,change.key);
    assert.ok(row[change.field].includes(change.after),`${change.key}/${change.field}: missing correction`);
  }
});

test('catalog has exactly the expected 24 units, ordered unique tasks, complete grading data and 100 points per populated exam', () => {
  const expected = new Set();
  for (let simulation=1; simulation<=4; simulation++) {
    for (const fach of ['VWL/BWL','Rechnungswesen','Recht und Steuern','Unternehmensführung']) expected.add(`WQ|${simulation}|${fach}`);
    for (const fach of ['HQ_A1','HQ_A2']) expected.add(`HQ|${simulation}|${fach}`);
  }
  const ids = new Set();
  for (const unit of catalog.einheiten) {
    const key = `${unit.teilbereich}|${unit.simulation}|${unit.einheit}`;
    assert.ok(expected.delete(key), key);
    const empty = unit.teilbereich === 'HQ' && String(unit.simulation) === '4';
    assert.equal(unit.aufgaben.reduce((s,r) => s+r.punkte,0), empty ? 0 : 100, key);
    let previous = 0;
    const parts = new Map();
    const questions = new Set();
    for (const row of unit.aufgaben) {
      const id = `${row.simulationId}|${row.fach}|${row.aufgabe}|${row.teilaufgabe}`;
      assert.ok(!ids.has(id), id); ids.add(id);
      assert.equal(row.teilbereich,unit.teilbereich,id);
      assert.equal(row.fach,unit.einheit,id);
      assert.ok(row.simulationId.endsWith(`_${unit.simulation}`),id);
      assert.ok(Number.isInteger(row.punkte) && row.punkte>0,id);
      for (const field of ['frage','musterloesung','stichpunkte','fragetyp']) assert.ok(String(row[field] || '').trim(),`${id}/${field}`);
      const question = `${row.situation}|${row.frage}`.trim().replace(/\s+/g,' ');
      assert.ok(!questions.has(question),`${id}: duplicate question`); questions.add(question);
      assert.ok(Number(row.aufgabe) >= previous && Number(row.aufgabe) <= previous+1,id);
      previous = Number(row.aufgabe);
      const seenParts = parts.get(row.aufgabe) || [];
      if (seenParts.length) assert.ok(String(row.teilaufgabe) > seenParts.at(-1),id);
      seenParts.push(String(row.teilaufgabe)); parts.set(row.aufgabe,seenParts);
      const criteria = row.stichpunkte.split(';').map(s=>s.trim()).filter(Boolean);
      assert.equal(new Set(criteria).size,criteria.length,`${id}: duplicate criteria`);
    }
  }
  assert.equal(expected.size,0);
  assert.equal(ids.size,356);
});

function frontend() {
  const elements = new Proxy({}, {get: (target,key) => target[key] ||= {value:'',style:{},textContent:'',innerHTML:''}});
  const c = {window:{},document:{getElementById:id=>elements[id],querySelectorAll:()=>[]},clearInterval:()=>{},
    pruefungTimerInterval:42,pruefungRestzeitSekunden:60,aktuellePruefungsDaten:[],letztePruefungsAntworten:[],
    escapeHtml:String,console,alert:()=>{},confirm:()=>true};
  vm.createContext(c);vm.runInContext(fs.readFileSync('js/pruefungssimulation.js','utf8'),c);
  return {c,elements};
}

test('changing simulation stops the old exam timer and clears its task state',()=>{
  const {c}=frontend();
  c.aktuellePruefungsDaten=[{aufgabe:1}];
  c.pruefungSimulationWaehlen();
  assert.equal(c.pruefungTimerInterval,null);
  assert.equal(c.aktuellePruefungsDaten.length,0);
});

test('changing the exam subject removes the old answers before a different unit can be submitted',()=>{
  const {c,elements}=frontend();
  c.aktuellePruefungsDaten=[{aufgabe:1}];elements.pruefungContainer.innerHTML='old exam';
  assert.equal(typeof c.pruefungFachWaehlen,'function');
  c.pruefungFachWaehlen();
  assert.equal(c.aktuellePruefungsDaten.length,0);
  assert.equal(elements.pruefungContainer.innerHTML,'');
  assert.equal(c.pruefungTimerInterval,null);
});

test('starting a new timer clears the expired-exam status',()=>{
  const {c,elements}=frontend();c.setInterval=()=>1;
  elements.pruefungTimerStatus.textContent='Die Bearbeitungszeit ist abgelaufen. Die Prüfung wurde gesperrt.';
  c.startePruefungTimer(75);
  assert.equal(elements.pruefungTimerStatus.textContent,'Die Prüfung läuft.');
});

test('empty unit never starts a timer',async()=>{
  const {c,elements}=frontend();
  elements.pruefungTeilbereichSelect.value='HQ';elements.pruefungSimulationSelect.value='4';
  elements.pruefungFachSelect.value='HQ_A1';elements.pruefungFachSelect.options=[{dataset:{zeit:'240'}}];
  elements.pruefungFachSelect.selectedIndex=0;
  c.fetch=async()=>({ok:true,json:async()=>catalog});
  let starts=0;c.startePruefungTimer=()=>starts++;
  await c.ladePruefungSimulation();
  assert.equal(starts,0);
  assert.equal(c.pruefungTimerInterval,null);
});

test('parallel evaluation clicks submit once and cannot submit an empty result view',async()=>{
  const {c}=frontend();
  const textarea={dataset:{index:'0',aufgabe:'1',teilaufgabe:'a',punkte:'5'},value:'',closest:()=>null};
  c.document.querySelectorAll=()=>[textarea];
  let calls=0,resolve;
  c.bewertePruefungsAntworten=()=>{calls++;return new Promise(r=>resolve=r);};
  c.renderPruefungsAuswertung=()=>{};
  const first=c.startePruefungsAuswertung();
  const second=c.startePruefungsAuswertung();
  assert.equal(calls,1);
  c.zeigeBereich=()=>{};
  c.document.getElementById('pruefungTeilbereichSelect').value='WQ';
  c.oeffnePruefungMitTeilbereich('HQ');
  assert.equal(c.document.getElementById('pruefungTeilbereichSelect').value,'WQ');
  resolve({success:true,data:{aufgaben:[]}});
  await Promise.all([first,second]);
  c.document.querySelectorAll=()=>[];
  await c.startePruefungsAuswertung();
  assert.equal(calls,1);
});

test('timer expiry locks table inputs as well as free text',()=>{
  const {c}=frontend();
  const input={disabled:false,style:{}};
  c.document.querySelectorAll=selector=>selector.includes('input')?[input]:[];
  c.pruefungBeendenWegenZeitablauf();
  assert.equal(input.disabled,true);
});

test('replacing a drawing with the axis template clears user drawing evidence',()=>{
  const {c,elements}=frontend();
  const ctx=new Proxy({}, {get:()=>()=>{}});
  elements['skizze-0']={hasUserDrawing:true,width:760,height:420,getContext:()=>ctx};
  c.zeichneAchsenvorlage(0);
  assert.equal(elements['skizze-0'].hasUserDrawing,false);
});

test('a late catalog response cannot overwrite the newly selected exam',async()=>{
  const {c,elements}=frontend();
  elements.pruefungTeilbereichSelect.value='HQ';elements.pruefungSimulationSelect.value='4';
  elements.pruefungFachSelect.value='HQ_A1';
  let resolve;c.fetch=()=>new Promise(r=>resolve=r);
  const load=c.ladePruefungSimulation();
  c.verwerfeAktuellePruefung();elements.pruefungContainer.innerHTML='new selection';
  resolve({ok:true,json:async()=>catalog});await load;
  assert.equal(elements.pruefungContainer.innerHTML,'new selection');
});

test('sketch survives leaving the view but locks when the exam expires',()=>{
  const {c}=frontend();
  const events={};let strokes=0;
  const ctx={beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++;}};
  const canvas={width:760,height:420,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:760,height:420}),addEventListener:(name,fn)=>events[name]=fn};
  c.initialisiereSkizzenCanvas(canvas);
  // main.js clears pruefungIstAktiv on leaving the view; the timer keeps running.
  vm.runInContext('pruefungIstAktiv = false',c);
  const e={preventDefault(){},clientX:40,clientY:40};
  events.mousedown(e);events.mousemove(e);
  assert.equal(strokes,1);
  assert.equal(canvas.hasUserDrawing,true);
  c.document.querySelectorAll=selector=>selector.includes('.skizzen-canvas')?[canvas]:[];
  c.pruefungBeendenWegenZeitablauf();
  events.mousemove(e);events.mousedown(e);events.mousemove(e);
  assert.equal(strokes,1);
});

test('annuity comparison, hourly cost units and case debt ratio retain the verified values',()=>{
  const rows=catalog.einheiten.flatMap(u=>u.aufgaben);
  const row=(s,f,a,t)=>rows.find(r=>r.simulationId===s&&r.fach===f&&String(r.aufgabe)===a&&r.teilaufgabe===t);
  assert.equal(((100-35)/35).toFixed(2),'1.86');
  for(const f of ['HQ_A1','HQ_A2']) assert.match(row('HQ_SIM_1',f,'1','a').hauptsituation,/Verschuldungsgrad:? rund 1,86/);
  assert.match(row('HQ_SIM_2','HQ_A2','3','a').musterloesung,/42 €\/Std\./);
  assert.match(row('HQ_SIM_3','HQ_A2','3','a').musterloesung,/56,50 €\/Std\./);
  assert.equal((4*436710+436705.46).toFixed(2),'2183545.46');
  const annual=n=>2000000*.03/(1-1.03**(-n));
  assert.equal((5*annual(5)).toFixed(2),'2183545.71');
  assert.equal((60000+4*annual(4)).toFixed(2),'2212216.36');
  const answer=row('HQ_SIM_3','HQ_A2','2','b').musterloesung;
  for(const amount of ['2.183.545,46','2.183.545,71','2.212.216,36']) assert.ok(answer.includes(amount));
});

for (const correction of rubricCorrections()) {
  test(`rubric regression: ${correction.key}`, () => {
    const row=catalog.einheiten.flatMap(u=>u.aufgaben).find(r=>[r.simulationId,r.fach,r.aufgabe,r.teilaufgabe].join('|')===correction.key);
    assert.equal(row.stichpunkte,correction.after,'rubric must count requested independent aspects instead of mandatory alternatives');
    if (correction.evidence) {
      const {oldMatched,oldPoints,expectedPoints,answer}=correction.evidence;
      assert.ok(answer.length>10,'concrete reviewed answer required');
      const c={PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})}};
      vm.createContext(c);vm.runInContext(fs.readFileSync('backend/apps-script/Code.gs','utf8'),c);
      const oldCount=correction.before.split(';').filter(s=>s.trim()).length;
      assert.equal(c.berechnePunkteAusKriterien_(oldMatched,oldCount,row.punkte),oldPoints);
      assert.notEqual(oldPoints,expectedPoints,'repair requires a demonstrated scoring discrepancy');
      const newCount=row.stichpunkte.split(';').filter(s=>s.trim()).length;
      const newMatched=expectedPoints/row.punkte*newCount;
      assert.ok(Number.isInteger(newMatched),'answer slots must have a coherent score');
      assert.equal(c.berechnePunkteAusKriterien_(newMatched,newCount,row.punkte),expectedPoints);
    }
  });
}
