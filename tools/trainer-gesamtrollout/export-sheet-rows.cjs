#!/usr/bin/env node
'use strict';
const path = require('node:path');
const DEFAULT_MANIFEST = path.resolve(__dirname, '../../migration/gesamtrollout-rev2/Migrationsmanifest_Gesamtrollout.json');
const VERSION = 'WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE';
const FRAMEWORK_VERSION = 'Arbeitsgrundlage 2026-09-27';
const PLAN_SHA256 = '192dd16162e78a3b796d4815c5d7ed526011cc301d32fa90c140270d485e187b';
const MANIFEST_SHA256 = '313d916808c73c15a8db7334879755b2dc9044b681d372dbd6c49e225cfbdc10';
const BACKUP_ID = '16CGqtZ_kDmjm1z7mVQtJ7SxIMjQx0FAaJuZwG8B6cQ4';
const subjectCodeOf = item => String(item.subjectCode ?? item.code);
const groupCode = item => `${item.area}-${subjectCodeOf(item)}`;
const isNewSubject = item => subjectCodeOf(item) !== '3';

function buildAll(manifest) {
  if (!manifest || manifest.version !== VERSION) throw new Error('Unerwartete oder fehlende Planungsrevision');
  const topics = manifest.uiTopics.filter(isNewSubject);
  const details = manifest.detailGroups.filter(isNewSubject);
  const assignments = manifest.primaryAssignments.filter(isNewSubject);
  const coverage = manifest.coverage.filter(isNewSubject);
  const result = {};
  result.Trainer_Themen = [['Version','UIThemenKey','Teilbereich','FachgruppeCode','Quellfach','Anzeigename','Sortierung','Sichtbar','Status'],
    ...topics.map(x => [VERSION,x.key,x.area,groupCode(x),x.sources.join('|'),x.label,x.sort,'ja','VORBEREITET'])];
  result.Trainer_Detailgruppen = [['Version','DetailKey','Teilbereich','Quellfach','UIThemenKey','InterneBezeichnung','RahmenplanPunktKey','DetailSortierung','Einordnung'],
    ...details.map((x,index) => [VERSION,x.key,x.area,x.source,x.uiKey,x.label,x.code,(index + 1) * 10,'INTERNE DETAILGRUPPE'])];
  result.Trainer_Zuordnung = [['Version','Teilbereich','Quellfach','TrainerID','DetailKey','DetailReihenfolge','UIReihenfolge','QuellthemaAlt','QuellzeilenSHA256','FachgruppeCode','PrimaerPunktKey'],
    ...assignments.map(x => [VERSION,x.area,x.source,x.id,x.detailKey,x.detailSequence,x.uiSequence,x.oldTopic,x.sourceContentHash,groupCode(x),x.primaryCode])];
  const references = [['Version','Teilbereich','Quellfach','TrainerID','PunktKey','Bezugsart','Belegstatus','Begruendung','Quelle']];
  assignments.forEach(x => {
    references.push([VERSION,x.area,x.source,x.id,x.primaryCode,'PRIMAER','Primärzuordnung; kein alleiniger Vollständigkeitsnachweis',x.reason,`Gesamtrollout ${VERSION}`]);
    (x.cross || []).forEach(code => references.push([VERSION,x.area,x.source,x.id,code,'QUERVERWEIS','Keine zusätzliche UI-/ID-Zählung','Fachlicher Nebenbezug',`Gesamtrollout ${VERSION}`]));
  });
  result.Trainer_Rahmenplanbezug = references;
  result.Rahmenplan_Abdeckung = [['RahmenplanVersion','Teilbereich','FachgruppeCode','PunktKey','OffiziellerCode','Detailindex','ElternKey','InterneBezeichnung','Abdeckungsstatus','AnalyseKandidaten','Befund','Quellenstand','Pruefstatus','FreigabeReferenz'],
    ...coverage.map(x => [FRAMEWORK_VERSION,x.area,groupCode(x),x.key,x.officialCode,String(x.key).includes('#') ? String(x.key).split('#').at(-1) : '',x.parent || '',x.label,x.status,x.candidates,x.oldFinding,x.sources,x.evidenceStatus,VERSION])];
  result.Trainer_Migrationen = [['MigrationID','Version','Vorversion','PlanSHA256','SnapshotSHA256','Pruefstatus','FreigabeVon','FreigabeAm','Laufstatus','Laufzeitpunkt','Rueckfallversion','Protokollreferenz','FachgruppeCode'],
    ...manifest.subjectTotals.filter(isNewSubject).map(x => [`WIFA-TR-GESAMT-20260927-REV2-${groupCode(x)}`,VERSION,'legacy',PLAN_SHA256,manifest.integrity.activeIdSha256,'LIVE-ABGLEICH BESTANDEN; INAKTIV VORBEREITET','Nutzerfreigabe im Codex-Task','2026-09-28','VORBEREITET','','legacy',`Manifest ${MANIFEST_SHA256}; Backup ${BACKUP_ID}`,groupCode(x)])];
  return result;
}
module.exports = { VERSION, buildAll };
if (require.main === module) {
  const manifest = require(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_MANIFEST);
  const rows = buildAll(manifest); const table = process.argv[3];
  if (!rows[table]) throw new Error(`Unknown table: ${table || '<empty>'}`);
  const start = Math.max(0, Number(process.argv[4] || 0));
  const count = Math.max(0, Number(process.argv[5] || Number.MAX_SAFE_INTEGER));
  process.stdout.write(JSON.stringify({table,totalRows:rows[table].length,start,rows:rows[table].slice(start,start+count)}));
}
