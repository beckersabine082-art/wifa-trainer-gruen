const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function harness(){
 const calls=[];const element={addEventListener(){},classList:{add(){},remove(){},toggle(){}},style:{},dataset:{},appendChild(){},querySelectorAll(){return[];}};const c={console,window:null,document:{getElementById:()=>element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
  aktuellesTrainerThemaKey:'',aktuellesThema:'',aktuelleTrainerKatalogVersion:'',aktuellesFach:'Logistik',aktuellerTeilbereich:'HQ',aktuelleFrageId:'',aktuelleFrage:'',aktuelleMusterloesung:'',aktuelleStichpunkte:[],aktuelleFrageQuellthema:'',ladeToken:0,appIstBeschaeftigt:false,wiederholungsKontext:null,
  faecherNachTeilbereich:{WQ:[],HQ:['Logistik']},setTimeout:()=>1,clearTimeout(){},alert(){},confirm:()=>false,setzeStatus(){},setzeAppBeschaeftigt(){},resetFrageAnzeige(){},updateStatAnzeige(){},aktualisiereTrainerAuswahlFallback(){},
  apiGet:async(action,p)=>{calls.push({action,p});if(action==='trainerCatalog')return{success:true,data:{active:true,version:'WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE',fachKey:'HQ-7',migrationStatus:'AKTIV',topics:[{uiThemenKey:'ui-hq-0022',thema:'Einkauf und Beschaffung',anzahl:190}]}};if(action==='trainerQuestions')return{success:true,data:{active:true,version:'WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE',fachKey:'HQ-7',uiThemenKey:p.uiThemenKey,questions:[{id:'L-0001'}]}};throw Error(action);}
 };c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/trainer.js','utf8'),c);return{c,calls};
}

test('WQ- und HQ-UI-Keys werden fachneutral als strukturierte Auswahl behandelt',()=>{
 const {c}=harness();
 assert.equal(c.trainerIstUiKey('ui-wq-0001'),true);
 assert.equal(c.trainerIstUiKey('ui-hq-0022'),true);
 assert.equal(c.trainerResumeAuswahlFuer('ui-hq-0022'),'tr-v2:ui-hq-0022');
});

test('Poolvertrag nutzt die servergelieferte Katalogversion statt der Pilotkonstante',async()=>{
 const {c,calls}=harness();
 const topics=await c.ladeTrainerThemenDaten('Logistik');
 assert.equal(topics[0].value,'ui-hq-0022');
 const pool=await c.trainerThemenpoolLaden('Logistik','ui-hq-0022');
 assert.equal(pool.length,1);
 assert.equal(pool[0].id,'L-0001');
 assert.equal(calls.filter(x=>x.action==='trainerQuestions').length,1);
});
