const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLernstand() {
  const list = { innerHTML: '', addEventListener() {} };
  const context = {
    window: { faecherNachTeilbereich: { WQ: ['Recht', 'Steuern', 'Rechnungswesen'] } },
    document: { getElementById: () => list, querySelector: () => list },
    mountSubjectAccordion: (grid, subjects) => { list.innerHTML += subjects.map(s => typeof s === 'string' ? s : s.card + s.panel).join(''); return { destroy() {} }; }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '../js/lernstand.js'), 'utf8')
    .replace(/^import[\s\S]*?from\s*'[^']+';/gm, '').replace(/export /g, '');
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/lernstand-progress.mjs'), 'utf8').replace(/export /g, ''), context);
  vm.runInContext(source, context);
  const renderSubject = context.renderSubject;
  context.renderSubject = (...args) => { const result = renderSubject(...args); return result.card + result.panel; };
  return { context, list };
}

const subject = { bereich: 'WQ', fach: 'Recht' };
const catalog = [
  { ...subject, thema: 'Arbeitsvertrag', total: 83 },
  { ...subject, thema: 'Weitere Themen', total: 488 },
  { bereich: 'WQ', fach: 'Steuern', thema: 'Steuerarten', total: 233 },
  { bereich: 'WQ', fach: 'Rechnungswesen', thema: 'Buchführung', total: 122 }
];
function attempt(id, reached, maximum, overrides = {}) {
  return {
    ...subject, thema: 'Arbeitsvertrag', frageId: id,
    questionKey: `wifa-trainer::WQ::Recht::Arbeitsvertrag::${id}`,
    modul: 'wifa-trainer', userId: 'fixture',
    erreichtePunkte: reached, maximalPunkte: maximum,
    // Deliberately stale: current performance must use the point fields.
    prozent: 100,
    status: reached === maximum ? 'richtig' : reached > 0 ? 'teilweise richtig' : 'falsch',
    ...overrides
  };
}
function subjectPerformance(html) {
  return Number(html.match(/lernstand-subject-stats"><span>(\d+)%/)[1]);
}
function topicPerformance(html) {
  return Number(html.match(/Aktuelle Punktleistung:<\/span><span class="lernstand-topic-stat-value">(\d+)%/)[1]);
}

test('empty subjects have zero performance and remain not started', () => {
  const { context } = loadLernstand();
  for (const [fach, total] of [['Steuern', 233], ['Rechnungswesen', 122]]) {
    const html = context.renderSubject({ bereich: 'WQ', fach }, [], catalog);
    assert.equal(subjectPerformance(html), 0);
    assert.ok(html.includes(`0 / ${total} Fragen`));
    assert.ok(html.includes('nicht begonnen'));
  }
});

test('empty topics and empty or zero denominators stay finite and zero', () => {
  const { context } = loadLernstand();
  assert.equal(topicPerformance(context.renderSubject(subject, [], catalog)), 0);
  for (const attempts of [[], [attempt('zero-denominator', 0, 0)]]) {
    assert.equal(context.aggregate(attempts).performance, 0);
  }
});

test('1/1 and 1/3 produce 50 percent at subject, topic and overall level', () => {
  const { context, list } = loadLernstand();
  const attempts = [attempt('a', 1, 1), attempt('b', 1, 3)];
  context.renderLearningProgress(attempts, catalog);
  assert.equal(subjectPerformance(list.innerHTML), 50);
  assert.equal(topicPerformance(list.innerHTML), 50);
  assert.equal(context.aggregate(attempts).performance, 50);
  assert.ok(list.innerHTML.includes('2 / 4 Punkte'));
});

test('only the latest attempt per question counts, including a latest zero score', () => {
  const { context, list } = loadLernstand();
  // Firestore loadAttempts supplies descending timestamp order.
  context.renderLearningProgress([
    attempt('a', 0, 1), attempt('b', 1, 3), attempt('a', 1, 1)
  ], catalog);
  assert.equal(subjectPerformance(list.innerHTML), 25);
  assert.equal(topicPerformance(list.innerHTML), 25);
  assert.ok(list.innerHTML.includes('2 / 571 Fragen'));
  assert.ok(list.innerHTML.includes('1 / 4 Punkte'));
});

test('a subject with all 28 answered questions in one topic has the same percentage', () => {
  const { context } = loadLernstand();
  const attempts = Array.from({ length: 28 }, (_, index) => attempt(String(index), 2, 5));
  const html = context.renderSubject(subject, attempts, catalog);
  assert.equal(subjectPerformance(html), 40);
  assert.equal(topicPerformance(html), 40);
  assert.ok(html.includes('28 / 571 Fragen'));
  assert.ok(html.includes('28 / 83'));
});

test('a zero-point attempt counts as answered at zero percent', () => {
  const { context } = loadLernstand();
  const html = context.renderSubject(subject, [attempt('a', 0, 3)], catalog);
  assert.equal(subjectPerformance(html), 0);
  assert.equal(topicPerformance(html), 0);
  assert.ok(html.includes('1 / 571 Fragen'));
  assert.ok(!html.includes('nicht begonnen'));
});

test('strongest and repeat topics use weighted points from the latest attempts', () => {
  const { context } = loadLernstand();
  const topics = [{ ...catalog[0], total: 2 }, { ...catalog[1], total: 1 }];
  const latest = context.latestAttempts([
    attempt('a', 1, 1), attempt('b', 1, 3),
    attempt('c', 1, 4, { thema: 'Weitere Themen' }), attempt('b', 3, 3)
  ]);
  const result = context.renderThemeLists(latest, topics);
  assert.match(result.strongest, /<strong>50%<\/strong>/);
  assert.match(result.repeat, /<strong>25%<\/strong>/);
});

test('empty overall performance displays zero with the unified label', () => {
  const { context, list } = loadLernstand();
  context.renderLearningProgress([], catalog);
  assert.match(list.innerHTML, /Aktuelle Punktleistung<\/div><div class="lernstand-metric-value">0%<\/div>/);
  assert.doesNotMatch(list.innerHTML, /NaN|Infinity|100%/);
});

test('subject and topic performance share the same visible label', () => {
  const { context } = loadLernstand();
  const html = context.renderSubject(subject, [attempt('a', 1, 1)], catalog);
  assert.equal((html.match(/Aktuelle Punktleistung/g) || []).length, 3);
});
