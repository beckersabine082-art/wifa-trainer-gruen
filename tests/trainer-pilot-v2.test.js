const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('backend/apps-script/Code.gs', 'utf8');
const manifest = require('../migration/recht-steuern-v2/Migrationsmanifest_Recht-und-Steuern.json');
const VERSION = 'WIFA-TR-WQ3-20260927-v2';

function rowsForQuestions(fach) {
  return manifest.assignments.filter(item => item.sourceSheet === fach).map(item => [
    item.id, item.oldTopic, item.question, '', 'Muster', 'Kriterium', '', '', 'ja', '', 'WQ', 'TEXT', '', '', ''
  ]);
}

function metadata() {
  const detailKeyByTopicId = new Map(manifest.targets.map(item => [item.topicId, item.key]));
  const referenceRows = [];
  manifest.assignments.forEach(item => {
    referenceRows.push([VERSION,item.area,item.sourceSheet,item.id,item.targetCode,'PRIMAER','Primärzuordnung','Plan','Revision 2']);
    String(item.secondaryCodes || '').split(';').map(value => value.trim()).filter(Boolean).forEach(code => {
      referenceRows.push([VERSION,item.area,item.sourceSheet,item.id,code,'QUERVERWEIS','Querverbindung','Plan','Revision 2']);
    });
  });
  return {
    Trainer_Themen: [[
      'Version','UIThemenKey','Teilbereich','FachgruppeCode','Quellfach','Anzeigename','Sortierung','Sichtbar','Status'
    ], ...manifest.visibleTopics.map(item => [
      VERSION, item.uiTopicId, item.area, 'WQ-3', item.fach, item.label, item.sort, 'ja', 'AKTIV'
    ])],
    Trainer_Detailgruppen: [[
      'Version','DetailKey','Teilbereich','Quellfach','UIThemenKey','InterneBezeichnung','RahmenplanPunktKey','DetailSortierung','Einordnung'
    ], ...manifest.targets.map(item => [
      VERSION, item.key, 'WQ', item.fach, item.uiTopicId, item.label, item.code, item.sort, item.type
    ])],
    Trainer_Zuordnung: [[
      'Version','Teilbereich','Quellfach','TrainerID','DetailKey','DetailReihenfolge','UIReihenfolge','QuellthemaAlt','QuellzeilenSHA256'
    ], ...manifest.assignments.map(item => [
      VERSION, item.area, item.sourceSheet, item.id,
      detailKeyByTopicId.get(item.targetTopicId),
      item.sequence, item.uiSequence, item.oldTopic, item.sourceRowSha256
    ])],
    Trainer_Rahmenplanbezug: [[
      'Version','Teilbereich','Quellfach','TrainerID','PunktKey','Bezugsart','Belegstatus','Begruendung','Quelle'
    ], ...referenceRows],
    Rahmenplan_Abdeckung: [[
      'RahmenplanVersion','Teilbereich','FachgruppeCode','PunktKey','OffiziellerCode','Detailindex','ElternKey',
      'InterneBezeichnung','Abdeckungsstatus','AnalyseKandidaten','Befund','Quellenstand','Pruefstatus','FreigabeReferenz'
    ], ...manifest.frameworkCoverage.map(item => [
      'Arbeitsgrundlage',item.area,'WQ-3',item.key,item.officialCode,'',item.parent || '',item.label,item.analysisStatus,
      item.analysisCandidates,item.analysisFinding,'Revision 2',item.verification,VERSION
    ])],
    Trainer_Migrationen: [[
      'MigrationID','Version','Vorversion','PlanSHA256','SnapshotSHA256','Pruefstatus','FreigabeVon','FreigabeAm','Laufstatus','Laufzeitpunkt','Rueckfallversion','Protokollreferenz'
    ], ['mig-pilot-v2', VERSION, 'v1', manifest.planSpecSha256, manifest.snapshotSha256, 'BESTANDEN', 'Nutzerfreigabe', '2026-09-27', 'AKTIV', new Date('2026-09-27T12:00:00Z'), 'legacy', 'test']]
  };
}

function sheet(name, rows) {
  return {
    getName: () => name,
    getLastRow: () => rows.length + (name === 'Recht' || name === 'Steuern' ? 2 : 0),
    getLastColumn: () => Math.max(1, ...rows.map(row => row.length)),
    getDataRange: () => ({getValues: () => rows}),
    getRange: (startRow, startColumn, numRows) => ({
      getValues: () => rows.slice(startRow - (name === 'Recht' || name === 'Steuern' ? 3 : 1), startRow - (name === 'Recht' || name === 'Steuern' ? 3 : 1) + numRows)
    })
  };
}

function backend(extraSheets = {}) {
  const tables = metadata();
  const all = {
    Recht: rowsForQuestions('Recht'),
    Steuern: rowsForQuestions('Steuern'),
    ...tables,
    ...extraSheets
  };
  const sheets = new Map(Object.entries(all).map(([name, rows]) => [name, sheet(name, rows)]));
  const context = {
    console,
    PropertiesService: {getScriptProperties: () => ({getProperty: () => ''})},
    ContentService: {MimeType: {JSON: 'application/json'}, createTextOutput: text => ({setMimeType: () => JSON.parse(text)})},
    SpreadsheetApp: {getActiveSpreadsheet: () => ({getSheets: () => [...sheets.values()], getSheetByName: name => sheets.get(name) || null})}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.getFrontendSheetNames = () => ['Recht', 'Steuern'];
  context.getSpreadsheet_ = () => ({getSheets: () => [...sheets.values()], getSheetByName: name => sheets.get(name) || null});
  return context;
}

test('pilot catalog exposes exactly ten stable UI topics and never an internal detail group', () => {
  const context = backend();
  const recht = context.getTrainerCatalogFrontend('Recht');
  const steuern = context.getTrainerCatalogFrontend('Steuern');
  const topics = [...recht.topics, ...steuern.topics];

  assert.equal(recht.active, true);
  assert.equal(steuern.active, true);
  assert.equal(topics.length, 10);
  assert.deepEqual(topics.map(item => item.uiThemenKey), manifest.visibleTopics.map(item => item.uiTopicId));
  assert.deepEqual(topics.map(item => item.thema), manifest.visibleTopics.map(item => item.label));
  assert.deepEqual(topics.map(item => item.anzahl), [85,174,84,75,116,17,16,12,205,16]);
  assert.ok(topics.every(item => !Object.hasOwn(item, 'detailKey')));
  assert.ok(topics.every(item => !Object.hasOwn(item, 'rahmenplanPunktKey')));
});

test('pilot pools contain every ID exactly once and R-0566 stays a method question outside 3.1.1 evidence', () => {
  const context = backend();
  const pools = manifest.visibleTopics.map(topic => context.getTrainerQuestionsFrontend(topic.fach, topic.uiTopicId));
  const questions = pools.flatMap(pool => pool.questions);

  assert.equal(questions.length, 800);
  assert.equal(new Set(questions.map(item => item.id)).size, 800);
  assert.equal(pools.find(pool => pool.uiThemenKey === 'ui-wq-recht-schuld').questions.length, 174);
  assert.equal(pools.find(pool => pool.uiThemenKey === 'ui-wq-steuern-unternehmen').questions.length, 205);
  const method = questions.find(item => item.id === 'R-0566');
  assert.equal(method.uiThemenKey, 'ui-wq-recht-at');
  assert.equal(method.rahmenplanPunktKey, '3.1');
  assert.notEqual(method.rahmenplanPunktKey, '3.1.1');
  assert.equal(method.legacyThema, 'Rechtliche Grundlagen & Methoden');
});

test('resume bridges legacy and UI cursors by stable ID and keeps the newest valid state', () => {
  const progressRows = [
    ['Nutzer','Bereich','Fach','Auswahl','Letzte Frage-ID','Aktualisiert'],
    ['u-1','trainer','Recht','Kaufrecht & Verbraucherschutz','R-0001',new Date('2026-09-27T10:00:00Z')],
    ['u-1','trainer','Recht','tr-v2:ui-wq-recht-schuld','R-0002',new Date('2026-09-27T11:00:00Z')]
  ];
  const context = backend({NutzerFortschritt: progressRows});
  const active = context.getTrainerCompatibleProgress_('u-1','trainer','Recht','tr-v2:ui-wq-recht-schuld');
  const rollback = context.getTrainerCompatibleProgress_('u-1','trainer','Recht','Kaufrecht & Verbraucherschutz');

  assert.equal(active.letzteFrageId, 'R-0002');
  assert.equal(active.auswahl, 'tr-v2:ui-wq-recht-schuld');
  assert.equal(rollback.letzteFrageId, 'R-0002');
  assert.equal(rollback.aufgeloestAus, 'tr-v2:ui-wq-recht-schuld');
});

test('rollback switch immediately restores the untouched legacy topic catalog', () => {
  const tables = metadata();
  tables.Trainer_Migrationen.push([
    'mig-pilot-v2', VERSION, 'v1', manifest.planSpecSha256, manifest.snapshotSha256,
    'ROLLBACK-TEST BESTANDEN', 'Nutzerfreigabe', '2026-09-27', 'ZURUECKGEROLLT',
    new Date('2026-09-27T12:05:00Z'), 'legacy', 'test'
  ]);
  const context = backend({Trainer_Migrationen: tables.Trainer_Migrationen});
  const catalog = context.getTrainerCatalogFrontend('Recht');

  assert.equal(catalog.active, false);
  assert.ok(catalog.topics.some(item => item.thema === 'Kaufrecht & Verbraucherschutz'));
  assert.ok(catalog.topics.every(item => !Object.hasOwn(item, 'uiThemenKey')));
});

test('active switch fails closed when assignments are duplicated or required metadata is incomplete', () => {
  const duplicateTables = metadata();
  duplicateTables.Trainer_Zuordnung.push([...duplicateTables.Trainer_Zuordnung[1]]);
  const duplicate = backend({Trainer_Zuordnung: duplicateTables.Trainer_Zuordnung});
  const duplicateCatalog = duplicate.getTrainerCatalogFrontend('Recht');
  assert.equal(duplicateCatalog.active, false);
  assert.equal(duplicateCatalog.fallbackReason, 'invalid_metadata');
  assert.ok(duplicateCatalog.topics.every(item => !Object.hasOwn(item, 'uiThemenKey')));

  const incomplete = backend({Trainer_Detailgruppen: [metadata().Trainer_Detailgruppen[0]]});
  const incompleteCatalog = incomplete.getTrainerCatalogFrontend('Recht');
  assert.equal(incompleteCatalog.active, false);
  assert.equal(incompleteCatalog.fallbackReason, 'invalid_metadata');
});

test('resume ignores a newer cursor whose ID is no longer active in the source sheet', () => {
  const progressRows = [
    ['Nutzer','Bereich','Fach','Auswahl','Letzte Frage-ID','Aktualisiert'],
    ['u-1','trainer','Recht','tr-v2:ui-wq-recht-schuld','R-0001',new Date('2026-09-27T10:00:00Z')],
    ['u-1','trainer','Recht','tr-v2:ui-wq-recht-schuld','R-0002',new Date('2026-09-27T11:00:00Z')]
  ];
  const rechtRows = rowsForQuestions('Recht');
  rechtRows.find(row => row[0] === 'R-0002')[8] = 'nein';
  const context = backend({NutzerFortschritt: progressRows, Recht: rechtRows});
  const progress = context.getTrainerCompatibleProgress_('u-1','trainer','Recht','tr-v2:ui-wq-recht-schuld');
  assert.equal(progress.letzteFrageId, 'R-0001');
});
