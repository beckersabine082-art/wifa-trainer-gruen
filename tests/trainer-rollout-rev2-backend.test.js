const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const manifest = require('../migration/gesamtrollout-rev2/Migrationsmanifest_Gesamtrollout.json');
const {buildAll, VERSION} = require('../tools/trainer-gesamtrollout/export-sheet-rows.cjs');

const source = fs.readFileSync('backend/apps-script/Code.gs','utf8');
const expected = {
  'WQ-1':[4,21,283], 'WQ-2':[5,17,122], 'WQ-3':[10,35,800], 'WQ-4':[3,15,235],
  'HQ-5':[4,13,264], 'HQ-6':[5,26,269], 'HQ-7':[5,23,317], 'HQ-8':[5,22,191], 'HQ-9':[7,24,205]
};

function createContext(activeGroup, progressRows) {
  const tables = buildAll(manifest);
  const activeGroups = new Set(Array.isArray(activeGroup) ? activeGroup : [activeGroup]);
  tables.Trainer_Migrationen = tables.Trainer_Migrationen.map((row,i) => i && activeGroups.has(row[12]) ? row.map((v,j) => j === 8 ? 'AKTIV' : v) : row);
  if(progressRows) tables.NutzerFortschritt=progressRows;
  const reads=new Map();
  const sheets = new Map(Object.entries(tables).map(([name,rows]) => [name,{getDataRange:()=>({getValues:()=>{reads.set(name,(reads.get(name)||0)+1);return rows;}})}]));
  const bySource = new Map();
  manifest.primaryAssignments.forEach(x => {
    if (!bySource.has(x.source)) bySource.set(x.source,[]);
    bySource.get(x.source).push({id:x.id,thema:x.oldTopic,frage:x.question,aktiv:'ja'});
  });
  const cache = new Map();
  const context = {
    console,
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({setMimeType:()=>JSON.parse(t)})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets.get(n)||null,getSheets:()=>[...sheets.values()]})}
  };
  vm.createContext(context); vm.runInContext(source,context);
  context.getSpreadsheet_=()=>({getSheetByName:n=>sheets.get(n)||null,getSheets:()=>[...sheets.values()]});
  context.getTopicsForSheet=fach=>[{thema:`legacy:${fach}`,anzahl:1}];
  context.getActiveQuestions=fach=>(bySource.get(fach)||[]);
  context.__reads=reads;context.__cache=cache;
  return context;
}

test('neun Fachverträge sind parametrisch und entsprechen der freigegebenen Bilanz', () => {
  const context=createContext('');
  const contracts=context.getTrainerRolloutContracts_();
  assert.deepEqual(Object.fromEntries(contracts.map(x=>[x.groupCode,[x.topicCount,x.detailCount,x.idCount]])),expected);
});

test('acht vorbereitete Fächer bleiben im Legacy-Pfad und liefern keine neuen Themen', () => {
  const context=createContext('');
  for (const fach of ['VWL','Rechnungswesen','Unternehmensführung','Betriebliches Management','Investition und Finanzierung','Logistik','Marketing','Führung und Zusammenarbeit']) {
    const catalog=context.getTrainerCatalogFrontend(fach);
    assert.equal(catalog.active,false,fach);
    assert.equal(catalog.version,'legacy',fach);
    assert.deepEqual(catalog.topics,[{thema:`legacy:${fach}`,anzahl:1}],fach);
  }
});

test('ein einzeln aktivierter Mehrquellen-Fachvertrag aggregiert nur seine manifestierten IDs', () => {
  const context=createContext('WQ-1');
  const catalog=context.getTrainerCatalogFrontend('VWL');
  assert.equal(catalog.active,true);
  assert.equal(catalog.version,VERSION);
  assert.equal(catalog.fachKey,'wq-volks-betriebswirtschaft');
  assert.equal(catalog.topics.length,4);
  assert.equal(catalog.topics.reduce((n,x)=>n+x.anzahl,0),283);
  const ids=catalog.topics.flatMap(t=>context.getTrainerQuestionsFrontend('VWL',t.uiThemenKey).questions.map(q=>q.id));
  assert.equal(ids.length,283);
  assert.equal(new Set(ids).size,283);
  assert.ok(ids.some(id=>id.startsWith('VWL-')) && ids.some(id=>id.startsWith('BWL-')));
});

test('jede der acht neuen Fachmigrationen ist isoliert mit ihrer exakten Bilanz aktivierbar', () => {
  const cases=[
    ['WQ-1','VWL','wq-volks-betriebswirtschaft',4,283],['WQ-2','Rechnungswesen','wq-rechnungswesen',5,122],['WQ-4','Unternehmensführung','wq-unternehmensfuehrung',3,235],
    ['HQ-5','Betriebliches Management','hq-betriebliches-management',4,264],['HQ-6','Investition und Finanzierung','hq-investition-finanzierung-controlling',5,269],
    ['HQ-7','Logistik','hq-logistik',5,317],['HQ-8','Marketing','hq-marketing-vertrieb',5,191],['HQ-9','Führung und Zusammenarbeit','hq-fuehrung-zusammenarbeit',7,205]
  ];
  for(const [group,fach,fachKey,topicCount,idCount] of cases){
    const context=createContext(group);const catalog=context.getTrainerCatalogFrontend(fach);
    assert.equal(catalog.active,true,group);assert.equal(catalog.fachKey,fachKey);assert.equal(catalog.topics.length,topicCount,group);
    const ids=catalog.topics.flatMap(t=>context.getTrainerQuestionsFrontend(fach,t.uiThemenKey).questions.map(q=>q.id));
    assert.equal(ids.length,idCount,group);assert.equal(new Set(ids).size,idCount,group);
  }
});

test('aktive Fachmigration endet bei inkonsistenten Metadaten fail-closed', () => {
  const context=createContext('HQ-7');
  const original=context.getTableObjects_;
  context.getTableObjects_=name => name === 'Trainer_Zuordnung' ? original(name).filter(x=>x.TrainerID!=='L-0001') : original(name);
  const catalog=context.getTrainerCatalogFrontend('Logistik');
  assert.equal(catalog.active,false);
  assert.equal(catalog.fallbackReason,'invalid_metadata');
  assert.equal(catalog.topics.length,0);
});

test('fachweiser Runtime-Cache bleibt unter 90 KB und Migration wird bei jedem Request frisch gelesen',()=>{
  const context=createContext('HQ-7');
  assert.equal(context.getTrainerCatalogFrontend('Logistik').active,true);
  const firstStatic=context.__reads.get('Trainer_Themen');
  assert.equal(context.getTrainerCatalogFrontend('Logistik').active,true);
  assert.equal(context.__reads.get('Trainer_Themen'),firstStatic);
  assert.equal(context.__reads.get('Trainer_Migrationen'),2);
  assert.ok([...context.__cache.values()].every(value=>Buffer.byteLength(value,'utf8')<90000));
});

test('Resume löst historische Quellfachzustände eines Mehrquellenfachs über stabile ID auf',()=>{
  const rows=[['Nutzer','Bereich','Fach','Auswahl','Letzte Frage-ID','Aktualisiert'],
    ['u-1','trainer','BWL','Zusammenwirken, Führung, Ziele & Nachhaltigkeit','BWL-0001',new Date('2026-09-28T08:00:00Z')]];
  const context=createContext('WQ-1',rows);
  context.ensureNutzerFortschrittSheet_=()=>context.getSpreadsheet_().getSheetByName('NutzerFortschritt');
  const progress=context.getTrainerCompatibleProgress_('u-1','trainer','VWL','tr-v2:ui-wq-0002');
  assert.equal(progress.letzteFrageId,'BWL-0001');
  assert.equal(progress.auswahl,'tr-v2:ui-wq-0002');
});

test('aktive Kataloge liefern 2686 globale IDs und weisen die 743 Aliaszugriffe explizit als Duplikate aus',()=>{
  const context=createContext(Object.keys(expected));
  const subjects=[
    ['Rechnungswesen',122],['BWL',283],['VWL',283],['Unternehmensführung',235],
    ['Führung und Zusammenarbeit',205],['Betriebliches Management',264],['Logistik',317],['Marketing',191],['Vertrieb',191],
    ['Investition und Finanzierung',269],['Betriebliches Rechnungswesen und Controlling',269]
  ];
  const catalogs=subjects.map(([fach,count])=>{
    const catalog=context.getTrainerCatalogFrontend(fach);
    assert.equal(catalog.active,true,fach);
    assert.equal(catalog.questionIds.length,count,fach);
    assert.equal(new Set(catalog.questionIds).size,count,fach);
    return catalog;
  });
  const pilotBySource=Object.groupBy(manifest.primaryAssignments.filter(item=>item.pilot),item=>item.source);
  assert.equal(pilotBySource.Recht.length,567);
  assert.equal(pilotBySource.Steuern.length,233);
  const reachable=[...pilotBySource.Recht.map(item=>item.id),...pilotBySource.Steuern.map(item=>item.id),
    ...catalogs.flatMap(catalog=>catalog.questionIds)];
  assert.equal(reachable.length,3429);
  assert.equal(new Set(reachable).size,2686);
  assert.equal(reachable.length-new Set(reachable).size,743);
});
