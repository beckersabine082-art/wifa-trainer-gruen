const { test } = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../migration/gesamtrollout-rev2/Migrationsmanifest_Gesamtrollout.json');
const exporter = require('../tools/trainer-gesamtrollout/export-sheet-rows.cjs');

test('freigegebene Gesamtplanung ist vollständig und eindeutig', () => {
  assert.equal(manifest.version, 'WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE');
  assert.deepEqual(manifest.totals, { primaryIds: 2686, pilotIds: 800, remainingIds: 1886, visibleTopics: 48, detailGroups: 196, coverageNodes: 577 });
  assert.equal(new Set(manifest.primaryAssignments.map(x => x.id)).size, 2686);
  assert.equal(new Set(manifest.uiTopics.map(x => x.key)).size, 48);
  assert.equal(new Set(manifest.detailGroups.map(x => x.key)).size, 196);
  assert.equal(manifest.contentActions.length, 9);
  assert.ok(manifest.contentActions.every(x => x.status.includes('NICHT DURCH STRUKTURMIGRATION ERLEDIGT')));
});

test('Exporter bereitet ausschließlich die acht neuen Fächer inaktiv vor', () => {
  const rows = exporter.buildAll(manifest);
  assert.equal(rows.Trainer_Themen.length - 1, 38);
  assert.equal(rows.Trainer_Detailgruppen.length - 1, 161);
  assert.equal(rows.Trainer_Zuordnung.length - 1, 1886);
  assert.equal(rows.Rahmenplan_Abdeckung.length - 1, 506);
  assert.equal(rows.Trainer_Migrationen.length - 1, 8);
  assert.ok(rows.Trainer_Themen.slice(1).every(row => row[0] === manifest.version && row[8] === 'VORBEREITET'));
  assert.ok(rows.Trainer_Migrationen.slice(1).every(row => row[8] === 'VORBEREITET'));
  assert.ok(rows.Trainer_Zuordnung.slice(1).every(row => row[3] && row[4]));
});

test('Pilot bleibt aus dem Import ausgeschlossen und Grenzfallverschiebungen stimmen', () => {
  const rows = exporter.buildAll(manifest);
  const assignments = rows.Trainer_Zuordnung.slice(1);
  assert.equal(assignments.some(row => /^R-|^S-/.test(row[3])), false);
  const byId = new Map(assignments.map(row => [row[3], row]));
  assert.equal(byId.get('PF-0202')[9], 'HQ-5');
  assert.equal(byId.get('PF-0203')[9], 'HQ-5');
  assert.equal(byId.get('VWL-0127')[10], '1.3.3.2');
  assert.equal(byId.get('IF-0091')[10], '6.4.1.2');
  assert.equal(byId.get('BR-0076')[10], '2.3.4.1');
});
