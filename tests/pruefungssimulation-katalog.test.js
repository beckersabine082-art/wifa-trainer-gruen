const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

// Reverse only the separately tested, exact audit corrections. The immutable
// baseline continues to protect every character of all pre-audit solutions.
function catalogBeforeAudit() {
  const catalog = JSON.parse(fs.readFileSync('data/pruefungssimulation/katalog.json', 'utf8'));
  const edits = require('./helpers/pruefung-audit.cjs').allCorrections();
  for (const edit of edits.slice().reverse()) {
    const row = catalog.einheiten.flatMap(u => u.aufgaben).find(r => `${r.simulationId}|${r.fach}|${r.aufgabe}|${r.teilaufgabe}` === edit.key);
    assert.ok(row[edit.field].includes(edit.after), edit.key);
    row[edit.field] = row[edit.field].replace(edit.after, edit.before);
  }
  return catalog;
}

function frontend(fetch) {
  const elements = {
    pruefungTeilbereichSelect: { value: 'WQ' },
    pruefungSimulationSelect: { value: '1' },
    pruefungFachSelect: { value: 'Rechnungswesen', selectedIndex: 0, options: [{ dataset: { zeit: '0' } }] },
    pruefungContainer: { innerHTML: '' }
  };
  const context = {
    window: {}, fetch, API_BASE_URL: 'https://example.test/sheet',
    clearInterval: () => {}, pruefungTimerInterval: null,
    document: { getElementById: id => elements[id], querySelectorAll: () => [] },
    sanitizeAufgabenHtml: value => String(value ?? ''),
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/pruefungssimulation.js', 'utf8'), context);
  context.stoppePruefungTimer = () => {};
  return { context, elements };
}

const row = { simulationId: 'WQ_REWE_SIM_1', fach: 'Rechnungswesen', aufgabe: 1, teilaufgabe: 'a', punkte: 7,
  frage: 'Circle Harbor GmbH: Kosten erklären.', musterloesung: 'Bestehende Lösung. Ergänzende Erklärung.',
  stichpunkte: 'Kosten erklären', fragetyp: 'text', situation: 'Eine Fallsituation.' };
const fixture = { einheiten: [
  { teilbereich: 'WQ', simulation: '1', einheit: 'Rechnungswesen', aufgaben: [row] },
  { teilbereich: 'WQ', simulation: '2', einheit: 'Rechnungswesen', aufgaben: [{ ...row, frage: 'Andere Prüfung' }] },
  { teilbereich: 'HQ', simulation: '4', einheit: 'HQ_A1', aufgaben: [] }
] };

test('simulation renders its local unit and passes the complete solution and unchanged points to the answer form', async () => {
  const requests = [];
  const { context, elements } = frontend(async url => {
    requests.push(url);
    return { ok: true, json: async () => structuredClone(fixture) };
  });
  await context.ladePruefungSimulation();
  assert.deepEqual(requests, ['data/pruefungssimulation/katalog.json']);
  assert.equal(context.aktuellePruefungsDaten.length, 1);
  const html = elements.pruefungContainer.innerHTML;
  assert.ok(html.includes('Circle Harbor GmbH: Kosten erklären.'), html);
  assert.ok(html.includes('data-musterloesung="Bestehende Lösung. Ergänzende Erklärung."'));
  assert.ok(html.includes('data-punkte="7"'));
  assert.ok(!html.includes('Andere Prüfung'));
});

test('an explicitly empty HQ unit stays empty without fetching remote sheet data', async () => {
  const { context, elements } = frontend(async () => ({ ok: true, json: async () => fixture }));
  elements.pruefungTeilbereichSelect.value = 'HQ';
  elements.pruefungSimulationSelect.value = '4';
  elements.pruefungFachSelect.value = 'HQ_A1';
  await context.ladePruefungSimulation();
  assert.ok(elements.pruefungContainer.innerHTML.includes('Keine Prüfung gefunden.'));
});

test('a follow-up task displays its own changed case facts instead of only the first situation', async () => {
  const catalog = structuredClone(fixture);
  catalog.einheiten[0].aufgaben.push({ ...row, teilaufgabe: 'b', situation: 'Für Teil b gelten zusätzliche Fixkosten von 600.000 €.' });
  const { context, elements } = frontend(async () => ({ ok: true, json: async () => catalog }));
  await context.ladePruefungSimulation();
  assert.ok(elements.pruefungContainer.innerHTML.includes('Für Teil b gelten zusätzliche Fixkosten von 600.000 €.'));
});

test('failed or incomplete local catalogs show an error instead of stale remote questions', async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ einheiten: [] }) }]) {
    let requests = 0;
    const { context, elements } = frontend(async () => { requests++; return response; });
    await context.ladePruefungSimulation();
    assert.ok(elements.pruefungContainer.innerHTML.includes('Fehler:'));
    assert.equal(requests, 1);
  }
});

test('all reviewed tasks retain their original solution prefix, points, types and criterion counts', () => {
  assert.ok(fs.existsSync('data/pruefungssimulation/katalog.json'), 'The reviewed local catalog is required');
  const catalog = catalogBeforeAudit();
  const baseline = JSON.parse(fs.readFileSync('tests/fixtures/pruefungssimulation-bestand.json', 'utf8'));
  assert.equal(catalog.einheiten.length, 24);
  const hash = value => createHash('sha256').update(value).digest('hex');
  const keys = [];
  for (const unit of catalog.einheiten) {
    const unitKey = `${unit.teilbereich}|${unit.simulation}|${unit.einheit}`;
    const original = baseline.einheiten[unitKey];
    assert.ok(original, unitKey);
    assert.equal(unit.aufgaben.length, original.anzahl, unitKey);
    assert.equal(unit.aufgaben.reduce((sum, row) => sum + row.punkte, 0), original.punkte, unitKey);
    for (const row of unit.aufgaben) {
      const key = `${row.simulationId}|${row.fach}|${row.aufgabe}|${row.teilaufgabe}`;
      keys.push(key);
      const before = baseline.aufgaben[key];
      assert.ok(before, key);
      assert.equal(row.punkte, before.punkte, key);
      assert.equal(row.fragetyp, before.fragetyp, key);
      assert.equal(row.teilbereich, unit.teilbereich, key);
      assert.equal(row.fach, unit.einheit, key);
      assert.equal(row.stichpunkte.split(';').map(x => x.trim()).filter(Boolean).length, before.kriterienAnzahl, key);
      assert.equal(hash(row.musterloesung.slice(0, before.erhaltenerTextLaenge)), before.erhaltenerTextSha256, `${key}: original solution content removed or rewritten`);
      assert.equal(before.erhaltenerTextSha256, before.urspruenglicherTextSha256, `${key}: original company/legal-form references not restored`);
      assert.equal(hash(row.aufgabenHtml), before.aufgabenHtmlSha256, `${key}: table/task data changed`);
      assert.equal(row.bilddatei, before.bilddatei, key);
    }
  }
  assert.equal(keys.length, 356);
  assert.equal(new Set(keys).size, 356);
  assert.deepEqual(keys.slice().sort(), Object.keys(baseline.aufgaben).sort());
});

test('all 164 additions and all grading criteria survive the company-name correction', () => {
  const catalog = catalogBeforeAudit();
  const baseline = JSON.parse(fs.readFileSync('tests/fixtures/pruefungssimulation-bestand.json', 'utf8'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  let additions = 0;
  for (const row of catalog.einheiten.flatMap(unit => unit.aufgaben)) {
    const key = `${row.simulationId}|${row.fach}|${row.aufgabe}|${row.teilaufgabe}`;
    const before = baseline.aufgaben[key];
    let suffix = row.musterloesung.slice(before.erhaltenerTextLaenge);
    if (suffix) additions++;
    // Reverse only the documented case-reference substitutions, then compare
    // against the immutable hash of the complete addition in commit 11f6553.
    for (const change of before.ergaenzungNamenskorrekturen || []) {
      assert.ok(suffix.includes(change.nachher), `${key}: required restored company reference missing`);
      suffix = suffix.replaceAll(change.nachher, change.vorher);
    }
    assert.equal(hash(suffix), before.ergaenzung11f6553Sha256, `${key}: addition shortened or changed beyond company references`);
    assert.equal(hash(row.stichpunkte), before.stichpunkte11f6553Sha256, `${key}: grading criteria changed`);
    for (const [field, expectedHash] of Object.entries(baseline.wiederhergestellteFallfelder?.[key] || {})) {
      assert.equal(hash(row[field]), expectedHash, `${key}/${field}: original case constellation changed`);
    }
  }
  assert.equal(additions, 164);
});

test('Circle Harbor entities retain their case-specific legal forms and external counterparties stay distinct', () => {
  assert.ok(fs.existsSync('data/pruefungssimulation/katalog.json'));
  const catalog = JSON.parse(fs.readFileSync('data/pruefungssimulation/katalog.json', 'utf8'));
  const rows = catalog.einheiten.flatMap(unit => unit.aufgaben);
  assert.ok(!/UrbanMotion|Frau Circle Harbor/.test(JSON.stringify(rows)));
  const first = (simulationId, fach) => rows.find(row => row.simulationId === simulationId && row.fach === fach);
  assert.match(first('HQ_SIM_3', 'HQ_A1').hauptsituation, /Circle Harbor Service GmbH mit Sitz in Darmstadt/);
  assert.match(first('WQ_VWL_SIM_2', 'VWL/BWL').hauptsituation, /Circle Harbor Fleet Mobility OHG/);
  assert.match(first('WQ_RS_SIM_2', 'Recht und Steuern').hauptsituation, /Circle Harbor Mobility OHG/);
  assert.match(first('WQ_VWL_SIM_3', 'VWL/BWL').hauptsituation, /Circle Harbor Mobility OHG/);
  assert.match(first('WQ_RS_SIM_3', 'Recht und Steuern').hauptsituation, /Circle Harbor Infrastruktur KG mit Sitz in Brake/);
  assert.match(first('WQ_RS_SIM_3', 'Recht und Steuern').musterloesung, /Vertrag für die KG/);
  const outsourcing = rows.find(row => row.simulationId === 'WQ_VWL_SIM_4' && row.aufgabe === 5 && row.teilaufgabe === 'b');
  assert.match(outsourcing.situation, /bei Circle Harbor Mobility/);
  const cargo = rows.find(row => row.simulationId === 'HQ_SIM_1' && row.fach === 'HQ_A2' && row.aufgabe === 6 && row.teilaufgabe === 'a');
  assert.match(cargo.situation, /Circle Harbor GmbH.*NordCargo GmbH/);
  const lawsuit = rows.find(row => row.simulationId === 'WQ_RS_SIM_4' && row.aufgabe === 4 && row.teilaufgabe === 'c');
  assert.match(lawsuit.situation, /UrbanRide AG/);
  assert.match(lawsuit.situation, /Circle Harbor/);
});
