import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const endpoint = process.argv[2];
const packagePath = process.argv[3] || '';
const cardsOnly = process.argv.includes('--cards-only');
if (!endpoint || !/^https:\/\/script\.google\.com\/macros\/s\//.test(endpoint)) {
  throw new Error('Aufruf: node verify-staging.mjs <Staging-Web-App-URL>');
}

const cardSubjects = [
  'Führung und Zusammenarbeit', 'Rechnungswesen', 'Recht', 'Steuern', 'BWL', 'VWL',
  'Unternehmensführung', 'Betriebliches Management', 'Logistik', 'Marketing', 'Vertrieb',
  'Betriebliches Rechnungswesen und Controlling', 'Investition und Finanzierung'
];

const trainerSubjects = [
  'VWL', 'Rechnungswesen', 'Recht', 'Steuern', 'Unternehmensführung',
  'Betriebliches Management', 'Investition und Finanzierung', 'Logistik',
  'Marketing', 'Führung und Zusammenarbeit'
];

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function api(action, params = {}) {
  const url = new URL(endpoint);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${action}: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.success) throw new Error(`${action}: ${payload.error || 'API-Fehler'}`);
  return payload.data;
}

const cardsBySubject = {};
const cardsById = new Map();
for (const fach of cardSubjects) {
  const cards = await api('getKarteikarten', { fach, thema: '' });
  for (const card of cards) {
    if (cardsById.has(card.id)) throw new Error(`Doppelte aktive Karten-ID: ${card.id}`);
    cardsById.set(card.id, card);
  }
  cardsBySubject[fach] = {
    count: cards.length,
    hash: hash(cards.map(card => [card.id, card.fach, card.thema, card.vorderseite, card.rueckseite]))
  };
}

const trainerPools = [];
if (!cardsOnly) {
  for (const fach of trainerSubjects) {
    const catalog = await api('trainerCatalog', { fach });
    const topics = Array.isArray(catalog) ? catalog : (catalog.topics || catalog.themen || []);
    for (const topic of topics) {
      const uiKey = topic.uiThemenKey || topic.uiKey || topic.key;
      const questionsPayload = await api('trainerQuestions', { fach, uiThemenKey: uiKey });
      const questions = Array.isArray(questionsPayload) ? questionsPayload : (questionsPayload.questions || questionsPayload.fragen || []);
      trainerPools.push({
        fach,
        uiKey,
        count: questions.length,
        hash: hash(questions.map(question => [question.id, question.frage, question.musterloesung]))
      });
    }
  }
}

const quiz = cardsOnly ? null : await api('quizCatalog');
const cardTotal = Object.values(cardsBySubject).reduce((sum, entry) => sum + entry.count, 0);
const trainerTotal = trainerPools.reduce((sum, pool) => sum + pool.count, 0);
let packageCheck = null;

if (packagePath) {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  const errors = [];
  for (const change of pkg.changes || []) {
    const card = cardsById.get(change.id);
    const expected = { fach: change.source, thema: change.topic };
    if (Object.prototype.hasOwnProperty.call(change.fieldsToWrite || {}, 'front')) {
      expected.vorderseite = change.fieldsToWrite.front;
    }
    if (Object.prototype.hasOwnProperty.call(change.fieldsToWrite || {}, 'back')) {
      expected.rueckseite = change.fieldsToWrite.back;
    }
    if (!card) {
      errors.push({ id: change.id, reason: 'missing' });
      continue;
    }
    for (const [field, value] of Object.entries(expected)) {
      if (String(card[field] ?? '') !== String(value ?? '')) {
        errors.push({ id: change.id, field, expected: value, actual: card[field] });
      }
    }
  }
  packageCheck = {
    changes: (pkg.changes || []).length,
    overrides: (pkg.changes || []).filter(change => change.kind === 'update').length,
    newCards: (pkg.changes || []).filter(change => change.kind === 'create').length,
    coveredGapIds: new Set((pkg.changes || []).flatMap(change => change.gapIds || [])).size,
    errorCorrections: pkg.totals?.errorCorrections,
    errors
  };
}

console.log(JSON.stringify({
  cardTotal,
  cardsBySubject,
  cardAggregateHash: hash(cardsBySubject),
  quizTotal: quiz ? quiz.length : null,
  trainerPoolCount: trainerPools.length,
  trainerTotal,
  trainerAggregateHash: hash(trainerPools),
  trainerPools,
  packageCheck
}, null, 2));
