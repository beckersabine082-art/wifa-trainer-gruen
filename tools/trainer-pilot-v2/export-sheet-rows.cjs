#!/usr/bin/env node
'use strict';

const path = require('node:path');
const manifest = require(path.resolve(__dirname, '../../migration/recht-steuern-v2/Migrationsmanifest_Recht-und-Steuern.json'));

const VERSION = 'WIFA-TR-WQ3-20260927-v2';
const PLAN_SHA256 = 'ed63273ca7690b8c7244e8cb853fc3ed858f6ada45df579bf90a11c98069a5b1';
const MANIFEST_SHA256 = 'e5d99d048be4f2868b6a7054ecc233525f39fb31f0e85475c541060c42cc9b3e';
const BACKUP_ID = '16ytUVU2VXbqobRrd05ePNZYEtMDJILuy_FtMFYCI4SI';
const MIGRATION_ID = 'WIFA-TR-WQ3-20260927-v2-run-20260927';

function topicRows() {
  return [[
    'Version','UIThemenKey','Teilbereich','FachgruppeCode','Quellfach','Anzeigename','Sortierung','Sichtbar','Status'
  ], ...manifest.visibleTopics.map(item => [
    VERSION, item.uiTopicId, item.area, 'WQ-3', item.fach, item.label, item.sort, 'ja', 'AKTIV'
  ])];
}

function detailRows() {
  return [[
    'Version','DetailKey','Teilbereich','Quellfach','UIThemenKey','InterneBezeichnung','RahmenplanPunktKey','DetailSortierung','Einordnung'
  ], ...manifest.targets.map(item => [
    VERSION, item.key, 'WQ', item.fach, item.uiTopicId, item.label, item.code, item.sort, item.type
  ])];
}

function assignmentRows() {
  const keyByTopicId = new Map(manifest.targets.map(item => [item.topicId, item.key]));
  return [[
    'Version','Teilbereich','Quellfach','TrainerID','DetailKey','DetailReihenfolge','UIReihenfolge','QuellthemaAlt','QuellzeilenSHA256'
  ], ...manifest.assignments.map(item => [
    VERSION, item.area, item.sourceSheet, item.id, keyByTopicId.get(item.targetTopicId), item.sequence,
    item.uiSequence, item.oldTopic, item.sourceRowSha256
  ])];
}

function normalizePointKey(value) {
  return String(value || '').trim().replace(/^(.+?)\s*\[(\d+)\]$/, '$1#$2');
}

function referenceRows() {
  const rows = [[
    'Version','Teilbereich','Quellfach','TrainerID','PunktKey','Bezugsart','Belegstatus','Begruendung','Quelle'
  ]];
  manifest.assignments.forEach(item => {
    rows.push([
      VERSION, item.area, item.sourceSheet, item.id, normalizePointKey(item.targetCode), 'PRIMAER',
      'Primärzuordnung; kein alleiniger Vollständigkeitsnachweis', item.action,
      `Migrationsmanifest Revision 2 (${MANIFEST_SHA256})`
    ]);
    String(item.secondaryCodes || '').split(';').map(value => value.trim()).filter(Boolean).forEach(code => {
      rows.push([
        VERSION, item.area, item.sourceSheet, item.id, normalizePointKey(code), 'QUERVERWEIS',
        'Querverbindung; keine zusätzliche UI-/ID-Zählung', 'Fachlicher Nebenbezug gemäß Revision 2',
        `Migrationsmanifest Revision 2 (${MANIFEST_SHA256})`
      ]);
    });
  });
  return rows;
}

function coverageRows() {
  return [[
    'RahmenplanVersion','Teilbereich','FachgruppeCode','PunktKey','OffiziellerCode','Detailindex','ElternKey',
    'InterneBezeichnung','Abdeckungsstatus','AnalyseKandidaten','Befund','Quellenstand','Pruefstatus','FreigabeReferenz'
  ], ...manifest.frameworkCoverage.map(item => [
    'Arbeitsgrundlage 2026-09-27', item.area, 'WQ-3', item.key, item.officialCode,
    String(item.key).includes('#') ? String(item.key).split('#').at(-1) : '', item.parent || '', item.label,
    item.analysisStatus, item.analysisCandidates, item.analysisFinding, 'Soll-Ist-Matrix und Revision 2',
    item.verification, VERSION
  ])];
}

function migrationRows() {
  return [[
    'MigrationID','Version','Vorversion','PlanSHA256','SnapshotSHA256','Pruefstatus','FreigabeVon','FreigabeAm',
    'Laufstatus','Laufzeitpunkt','Rueckfallversion','Protokollreferenz'
  ], [
    MIGRATION_ID, VERSION, 'Revision 1 (nur Dokumentation)', PLAN_SHA256, manifest.snapshotSha256,
    'LIVE-ABGLEICH BESTANDEN; INAKTIV VORBEREITET', 'Nutzerfreigabe im Codex-Task', '2026-09-27',
    'VORBEREITET', '2026-09-27T20:30:00+02:00', 'legacy',
    `Manifest ${MANIFEST_SHA256}; Backup ${BACKUP_ID}`
  ]];
}

const builders = {
  Trainer_Themen: topicRows,
  Trainer_Detailgruppen: detailRows,
  Trainer_Zuordnung: assignmentRows,
  Trainer_Rahmenplanbezug: referenceRows,
  Rahmenplan_Abdeckung: coverageRows,
  Trainer_Migrationen: migrationRows
};

const table = process.argv[2];
const start = Math.max(0, Number(process.argv[3] || 0));
const count = Math.max(0, Number(process.argv[4] || Number.MAX_SAFE_INTEGER));
if (!builders[table]) {
  process.stderr.write(`Unknown table: ${table || '<empty>'}\n`);
  process.exit(2);
}
const rows = builders[table]();
process.stdout.write(JSON.stringify({table, totalRows: rows.length, start, rows: rows.slice(start, start + count)}));
