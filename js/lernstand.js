import {
  auth,
  db,
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  orderBy
} from './firebase-config.js';
import { countFullPointQuestions } from './lernstand-progress.mjs?v=lernstand-merge-v1';
import { mountSubjectAccordion } from './lernstand-accordion.mjs?v=lernstand-merge-v1';

const MODULE_ID = 'wifa-trainer';
const BERLIN_TIME_ZONE = 'Europe/Berlin';
const questionDetailsCache = new Map();
const repeatAttemptsByKey = new Map();
let learningProgressInteractionsBound = false;
let subjectAccordion = null;
let errorAnalysisInteractionsBound = false;

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function percentage(points, maximum) {
  return maximum > 0 ? (points / maximum) * 100 : 0;
}

function roundedPercentage(points, maximum) {
  return Math.round(percentage(points, maximum));
}

function statusForAttempt(points, maximum) {
  if (points === maximum) return 'richtig';
  if (points > 0) return 'teilweise richtig';
  return 'falsch';
}

function questionKey({ bereich, fach, thema, frageId }) {
  return [MODULE_ID, bereich, fach, thema, frageId].map(value => String(value || '').trim()).join('::');
}

function currentVerifiedUser() {
  const user = auth.currentUser;
  return user && user.emailVerified === true ? user : null;
}

function timestampMillis(timestamp) {
  return timestamp && typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : 0;
}

function berlinDay(timestamp) {
  const date = timestamp && typeof timestamp.toDate === 'function' ? timestamp.toDate() : null;
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatDate(timestamp) {
  const date = timestamp && typeof timestamp.toDate === 'function' ? timestamp.toDate() : null;
  return date ? new Intl.DateTimeFormat('de-DE', { timeZone: BERLIN_TIME_ZONE, dateStyle: 'medium' }).format(date) : 'Noch keine Lernaktivität';
}

function formatDateTime(timestamp) {
  const date = timestamp && typeof timestamp.toDate === 'function' ? timestamp.toDate() : null;
  return date ? new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date) : 'Zeitpunkt nicht verfügbar';
}

export async function speichereWifaAttempt({ bereich, fach, thema, frageId, antwort, erreichtePunkte, maximalePunkte }) {
  const user = currentVerifiedUser();
  if (!user) throw new Error('Bitte melde dich mit einem bestätigten Konto an, um den Lernstand zu speichern.');

  const points = Number(erreichtePunkte);
  const maximum = Number(maximalePunkte);
  if (!Number.isFinite(points) || !Number.isFinite(maximum) || maximum <= 0 || points < 0 || points > maximum) {
    throw new Error('Die Bewertung enthält keine speicherbaren Punktwerte.');
  }

  const attemptReference = doc(collection(db, 'users', user.uid, 'attempts'));
  const attempt = {
    attemptId: attemptReference.id,
    userId: user.uid,
    modul: MODULE_ID,
    timestamp: serverTimestamp(),
    questionKey: questionKey({ bereich, fach, thema, frageId }),
    frageId: String(frageId || ''),
    bereich: String(bereich || ''),
    fach: String(fach || ''),
    thema: String(thema || ''),
     antwort: String(antwort || '').trim(),
    erreichtePunkte: points,
    maximalPunkte: maximum,
    prozent: percentage(points, maximum),
    status: statusForAttempt(points, maximum)
  };

  await setDoc(attemptReference, attempt);
}

async function loadQuestionCatalog() {
  const subjects = Object.entries(window.faecherNachTeilbereich || {}).flatMap(([bereich, faecher]) =>
    faecher.map(fach => ({ bereich, fach }))
  );
  const results = await Promise.all(subjects.map(async subject => {
    const result = await window.apiGet('topics', { fach: subject.fach });
    if (!result.success) throw new Error(result.error || `Fragenbestand für ${subject.fach} konnte nicht geladen werden.`);
    return (result.data || []).map(item => ({
      ...subject,
      thema: typeof item === 'string' ? item : String(item.thema || ''),
      total: Math.max(0, Number(typeof item === 'object' ? item.anzahl : 0) || 0)
    }));
  }));
  return results.flat().filter(item => item.thema);
}

async function loadAttempts(user, debugObserver) {
  const attemptQuery = query(collection(db, 'users', user.uid, 'attempts'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(attemptQuery);
  const documents = snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
  const attempts = documents.filter(attempt => attempt.modul === MODULE_ID && attempt.userId === user.uid);
  // BEGIN TEMP [LERNSTAND DEBUG]: observe only; no change to the returned attempts.
  if (debugObserver) debugObserver(documents);
  // END TEMP [LERNSTAND DEBUG]
  return attempts;
}

async function loadActiveAttemptBasis(attempts, catalog) {
  const configured = Object.entries(window.faecherNachTeilbereich || {})
    .flatMap(([bereich, faecher]) => faecher.map(fach => ({ bereich, fach })))
    .filter(subject => attempts.some(attempt => attempt.bereich === subject.bereich && attempt.fach === subject.fach));
  const questionsBySubject = new Map();
  // One existing active-question request per attempted subject, never per topic.
  for (const fach of new Set(configured.map(subject => subject.fach))) {
    const result = await window.apiGet('questionsForTopic', { fach });
    if (!result?.success || !Array.isArray(result.data) || result.data.some(question =>
      !question || !String(question.id || '').trim() || typeof question.thema !== 'string')) {
      throw new Error(`Aktiver Fragenkatalog für ${fach} konnte nicht geprüft werden.`);
    }
    questionsBySubject.set(fach, result.data);
  }
  const membership = new Map();
  const activeAttempts = [];
  attempts.forEach(attempt => {
    const subjectActive = configured.some(subject => subject.bereich === attempt.bereich && subject.fach === attempt.fach);
    const topicActive = catalog.some(topic => topic.bereich === attempt.bereich
      && topic.fach === attempt.fach && topic.thema === attempt.thema);
    const question = subjectActive ? questionsBySubject.get(attempt.fach)?.find(item =>
      String(item.id).trim() === String(attempt.frageId || '').trim()) : undefined;
    const catalogMatch = Boolean(topicActive && question && question.thema === attempt.thema);
    membership.set(attempt, {
      activeTopic: topicActive,
      activeQuestion: Boolean(question),
      currentQuestionTopic: question?.thema,
      activeCatalogMatch: catalogMatch,
      reason: !subjectActive ? 'Fach/Bereich nicht aktuell zugeordnet'
        : !question ? 'Frage-ID nicht im aktiven Fachkatalog'
          : !topicActive || question.thema !== attempt.thema ? 'Themenzuordnung nicht im aktuellen Katalog'
            : 'Aktiver Katalogtreffer'
    });
    // Identity comes from the confirmed current catalog, not a possibly legacy stored key.
    if (catalogMatch) activeAttempts.push({ ...attempt, questionKey: questionKey(attempt) });
  });
  return { activeAttempts, membership };
}

// BEGIN TEMP [LERNSTAND DEBUG] — remove this helper and the marked call sites after diagnosis.
function debugLearningProgress(documents, attempts, catalog, basis) {
  try {
    const latest = latestAttempts(attempts);
    const row = attempt => {
      const stats = aggregate([attempt]);
      return {
        documentId: attempt.id,
        questionKey: attempt.questionKey,
        expectedQuestionKeyFromCurrentFields: questionKey(attempt),
        bereich: attempt.bereich,
        fach: attempt.fach,
        thema: attempt.thema,
        frageId: attempt.frageId,
        modul: attempt.modul,
        erreichtePunkte: attempt.erreichtePunkte,
        punkte: attempt.punkte,
        maximalPunkte: attempt.maximalPunkte,
        maximalePunkte: attempt.maximalePunkte,
        maxPunkte: attempt.maxPunkte,
        prozent: attempt.prozent,
        timestamp: attempt.timestamp,
        timestampMillis: timestampMillis(attempt.timestamp),
        ...basis?.membership.get(attempt),
        normalizedReachedUsedByAggregate: stats.reached,
        normalizedMaximumUsedByAggregate: stats.maximum,
        passesModuleAndUserFilter: attempts.includes(attempt),
        survivesGlobalLatestSelection: latest.includes(attempt),
        selectedDocumentForQuestionKey: latest.find(item => item.questionKey === attempt.questionKey)?.id,
        exactTopicInCurrentCatalog: catalog.some(item => item.bereich === attempt.bereich
          && item.fach === attempt.fach && item.thema === attempt.thema)
      };
    };
    const scope = (fach, bereich, thema) => {
      const matches = attempt => attempt.fach === fach && attempt.bereich === bereich
        && (thema === undefined || attempt.thema === thema);
      const selected = latest.filter(matches);
      const stats = aggregate(selected);
      return {
        fach, bereich, thema,
        rawDocumentsMatchingScope: documents.filter(matches).map(row),
        attemptsBeforeLatest: attempts.filter(matches).map(row),
        attemptsAfterGlobalLatest: selected.map(row),
        answeredQuestions: selected.length,
        sumReached: stats.reached,
        sumMaximum: stats.maximum,
        percentageBeforeRounding: percentage(stats.reached, stats.maximum),
        displayedPercentage: stats.performance
      };
    };
    const configuredSubjects = Object.entries(window.faecherNachTeilbereich || {})
      .flatMap(([bereich, faecher]) => faecher.map(fach => ({ bereich, fach })));
    const targetSubjects = configuredSubjects.filter(item => ['Recht', 'Steuern'].includes(item.fach));
    const inventory = new Map();
    documents.forEach(attempt => {
      const key = JSON.stringify([attempt.modul, attempt.bereich, attempt.fach]);
      const entry = inventory.get(key) || { modul: attempt.modul, bereich: attempt.bereich, fach: attempt.fach, count: 0 };
      entry.count += 1;
      inventory.set(key, entry);
    });
    const report = {
      version: 'lernstand-attempt-chain-debug-v1',
      pageUrl: window.location?.href,
      loadedLernstandScripts: Array.from(document.querySelectorAll('script[src]'))
        .map(script => script.src).filter(src => src.includes('/lernstand.js')),
      query: 'users/<current user>/attempts, orderBy(timestamp, desc); no extra reads',
      limitations: 'Documents without a timestamp field are not returned by the existing ordered query. Active IDs are checked using the existing questionsForTopic endpoint once per attempted subject. Missing IDs cannot distinguish deletion from deactivation.',
      activeCatalogAudit: ['Steuern', 'Recht'].map(fach => ({
        fach,
        before: latest.filter(attempt => attempt.fach === fach).map(row),
        after: latestAttempts(basis?.activeAttempts || []).filter(attempt => attempt.fach === fach)
          .map(attempt => ({ ...row(attempts.find(raw => raw.id === attempt.id) || attempt), currentQuestionKey: attempt.questionKey })),
        currentTotals: (() => {
          const selected = latestAttempts(basis?.activeAttempts || []).filter(attempt => attempt.fach === fach);
          const stats = aggregate(selected);
          return { answered: selected.length, reached: stats.reached, maximum: stats.maximum, performance: stats.performance, errors: stats.errors.length };
        })(),
        excluded: latest.filter(attempt => attempt.fach === fach && !basis?.membership.get(attempt)?.activeCatalogMatch).map(row),
        otherRechtTopics: fach === 'Recht' ? latest.filter(attempt => attempt.fach === fach
          && attempt.thema !== 'Arbeitsvertrag, Entgelt & Kündigung').map(row) : []
      })),
      normalization: 'Existing aggregate: Number(erreichtePunkte || 0), Number(maximalPunkte || 0). Other field names are reported only, not substituted.',
      latestRule: 'First attempt per exact questionKey in descending timestamp query order, globally before subject/topic filtering.',
      returnedDocumentCount: documents.length,
      afterModuleAndUserFilterCount: attempts.length,
      afterGlobalLatestCount: latest.length,
      subjectNameInventory: [...inventory.values()],
      subjects: targetSubjects.map(item => scope(item.fach, item.bereich)),
      rechtTopic: targetSubjects.filter(item => item.fach === 'Recht')
        .map(item => scope(item.fach, item.bereich, 'Arbeitsvertrag, Entgelt & Kündigung')),
      targetCatalog: catalog.filter(item => ['Recht', 'Steuern'].includes(item.fach)),
      // Candidates only: fuzzy names/keys never alter production assignment.
      legacyOrUnassignedCandidates: documents.filter(attempt =>
        /recht|steuer/i.test(`${attempt.fach || ''} ${attempt.questionKey || ''}`)
        || (attempt.modul === MODULE_ID && !catalog.some(item => item.bereich === attempt.bereich
          && item.fach === attempt.fach && item.thema === attempt.thema))
      ).map(row),
      renderedSubjectCards: Array.from(document.querySelectorAll('#lernstandListe .lernstand-subject'))
        .filter(card => ['Recht', 'Steuern'].includes(card.querySelector('.lernstand-subject-heading strong')?.textContent))
        .map(card => ({
          heading: card.querySelector('.lernstand-subject-heading')?.textContent,
          status: card.querySelector('.lernstand-subject-status')?.textContent,
          stats: card.querySelector('.lernstand-subject-stats')?.textContent,
          topicsIncludingCollapsed: card.querySelector('.lernstand-topics')?.textContent
        }))
    };
    // Stable text snapshot, no answers, user IDs or credentials. Preserve undefined/NaN instead of losing them in JSON.
    console.log('[LERNSTAND DEBUG] BEGIN\n' + JSON.stringify(report, (key, value) => {
      if (value === undefined) return '[undefined]';
      if (typeof value === 'number' && !Number.isFinite(value)) return `[${String(value)}]`;
      return value;
    }, 2) + '\n[LERNSTAND DEBUG] END');
  } catch (error) {
    console.warn('[LERNSTAND DEBUG] Diagnostic output failed; learning progress is unchanged.', error);
  }
}
// END TEMP [LERNSTAND DEBUG]

function latestAttempts(attempts) {
  const latest = new Map();
  attempts.forEach(attempt => {
    if (!latest.has(attempt.questionKey)) latest.set(attempt.questionKey, attempt);
  });
  return [...latest.values()];
}

function normalizedAttemptStatus(attempt) {
  const points = Number(attempt.erreichtePunkte);
  const maximum = Number(attempt.maximalPunkte);
  if (Number.isFinite(points) && Number.isFinite(maximum) && maximum > 0) {
    return statusForAttempt(points, maximum);
  }
  return String(attempt.status || '').trim().toLowerCase();
}

function isBelowHalf(attempt) {
  const points = Number(attempt.erreichtePunkte);
  const maximum = Number(attempt.maximalPunkte);
  return Number.isFinite(points) && Number.isFinite(maximum) && maximum > 0 && points / maximum < 0.5;
}

function aggregate(attempts) {
  const reached = attempts.reduce((sum, attempt) => sum + Number(attempt.erreichtePunkte || 0), 0);
  const maximum = attempts.reduce((sum, attempt) => sum + Number(attempt.maximalPunkte || 0), 0);
  return {
    attempts,
    reached,
    maximum,
    performance: roundedPercentage(reached, maximum),
    errors: attempts.filter(isBelowHalf)
  };
}

function renderMetric(label, value, detail = '') {
  return `<div class="lernstand-metric"><div class="lernstand-metric-label">${escapeText(label)}</div><div class="lernstand-metric-value">${escapeText(value)}</div><div class="lernstand-metric-detail">${escapeText(detail)}</div></div>`;
}

function renderBar(label, value, detail) {
  const rawValue = Math.max(0, Math.min(100, Number(value) || 0));
  const displayValue = Math.round(rawValue);
  return `<div class="lernstand-bar-row"><div class="lernstand-bar-label"><span>${escapeText(label)}</span><strong>${displayValue}%</strong></div><div class="lernstand-bar"><div class="lernstand-bar-fill" style="width:${rawValue}%"></div></div><div class="lernstand-bar-detail">${escapeText(detail)}</div></div>`;
}

function renderAttemptsChart(entries) {
  const maxCount = Math.max(...entries.map(([, value]) => value.count), 1);
  const stepCount = Math.min(maxCount, 4);
  const scaleMaximum = Math.ceil(maxCount / stepCount) * stepCount;
  const chartWidth = Math.max(320, entries.length * 52 + 52);
  const chartHeight = 150;
  const chartTop = 14;
  const chartBottom = 32;
  const chartLeft = 38;
  const chartRight = 34;
  const chartAreaHeight = chartHeight - chartTop - chartBottom;
  const chartAreaWidth = chartWidth - chartLeft - chartRight;
  const barWidth = Math.min(45, Math.max(12, chartAreaWidth / entries.length - 16));
  const yPosition = value => chartTop + chartAreaHeight - (value / scaleMaximum) * chartAreaHeight;
  const ticks = Array.from({ length: stepCount + 1 }, (_, index) => (scaleMaximum / stepCount) * index);
  const grid = ticks.map(value => `<line x1="${chartLeft}" y1="${yPosition(value)}" x2="${chartWidth - chartRight}" y2="${yPosition(value)}" class="lernstand-chart-grid"/><text x="${chartLeft - 6}" y="${yPosition(value) + 4}" class="lernstand-chart-y-label">${value}</text>`).join('');
  const points = entries.map(([day, value], index) => ({
    day,
    value,
    center: chartLeft + (chartAreaWidth / entries.length) * (index + 0.5)
  }));
  const bars = points.map(({ day, value, center }) => {
    const height = (value.count / scaleMaximum) * chartAreaHeight;
    const label = `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
    return `<rect x="${center - barWidth / 2}" y="${chartTop + chartAreaHeight - height}" width="${barWidth}" height="${height}" class="lernstand-chart-bar"><title>${escapeText(label)}: ${value.count} Lernversuche</title></rect><text x="${center}" y="${chartHeight - 12}" class="lernstand-chart-x-label">${label}</text>`;
  }).join('');
  return `<div class="lernstand-attempt-chart" role="img" aria-label="Lernversuche pro Tag">
    <h3>Lernversuche pro Tag</h3>
    <div class="lernstand-chart-scroll"><svg viewBox="0 0 ${chartWidth} ${chartHeight}" aria-hidden="true">${grid}<line x1="${chartLeft}" y1="${chartTop + chartAreaHeight}" x2="${chartWidth - chartRight}" y2="${chartTop + chartAreaHeight}" class="lernstand-chart-axis"/>${bars}</svg></div>
  </div>`;
}

function renderPerformanceChart(entries) {
  const chartWidth = Math.max(320, entries.length * 52 + 52);
  const chartHeight = 150;
  const chartTop = 14;
  const chartBottom = 32;
  const chartLeft = 38;
  const chartRight = 34;
  const chartAreaHeight = chartHeight - chartTop - chartBottom;
  const chartAreaWidth = chartWidth - chartLeft - chartRight;
  const yPositionPercent = value => chartTop + chartAreaHeight - (value / 100) * chartAreaHeight;
  const ticks = [0, 25, 50, 75, 100];
  const grid = ticks.map(value => `<line x1="${chartLeft}" y1="${yPositionPercent(value)}" x2="${chartWidth - chartRight}" y2="${yPositionPercent(value)}" class="lernstand-chart-grid"/><text x="${chartLeft - 6}" y="${yPositionPercent(value) + 4}" class="lernstand-chart-y-label">${value}%</text>`).join('');
  const points = entries.map(([day, value], index) => ({
    day,
    value,
    center: chartLeft + (chartAreaWidth / entries.length) * (index + 0.5),
    performance: roundedPercentage(value.reached, value.maximum)
  }));
  const linePoints = points.map(({ center, performance }) => `${center},${yPositionPercent(performance)}`).join(' ');
  const markers = points.map(({ day, value, center, performance }) => {
    const label = `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
    return `<circle cx="${center}" cy="${yPositionPercent(performance)}" r="4" class="lernstand-chart-point"><title>${escapeText(label)}: ${performance}% Tagesleistung · ${value.reached}/${value.maximum} Punkte</title></circle>`;
  }).join('');
  return `<div class="lernstand-attempt-chart" role="img" aria-label="Leistung pro Tag">
    <h3>Leistung pro Tag</h3>
    <div class="lernstand-chart-scroll"><svg viewBox="0 0 ${chartWidth} ${chartHeight}" aria-hidden="true">${grid}<line x1="${chartLeft}" y1="${chartTop + chartAreaHeight}" x2="${chartWidth - chartRight}" y2="${chartTop + chartAreaHeight}" class="lernstand-chart-axis"/><polyline points="${linePoints}" class="lernstand-chart-line"/>${markers}${points.map(({ day, center }) => {
      const label = `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
      return `<text x="${center}" y="${chartHeight - 12}" class="lernstand-chart-x-label">${label}</text>`;
    }).join('')}</svg></div>
  </div>`;
}

function renderDevelopment(attempts) {
  const byDay = new Map();
  attempts.forEach(attempt => {
    const day = berlinDay(attempt.timestamp);
    if (!day) return;
    const value = byDay.get(day) || { reached: 0, maximum: 0, count: 0 };
    value.reached += Number(attempt.erreichtePunkte || 0);
    value.maximum += Number(attempt.maximalPunkte || 0);
    value.count += 1;
    byDay.set(day, value);
  });
  const entries = [...byDay.entries()].sort(([first], [second]) => first.localeCompare(second));
  if (!entries.length) return '<div class="result-list-empty">Noch keine Lernaktivität</div>';
  return `<div class="lernstand-development-grid">${renderAttemptsChart(entries)}${renderPerformanceChart(entries)}</div>`;
}

function countSubjectFullPoints(catalog, attempts) {
  return countFullPointQuestions(attempts.filter(attempt => catalog.some(topic => topic.bereich === attempt.bereich && topic.fach === attempt.fach && topic.thema === attempt.thema)), 0).count;
}

function renderSubject(subject, latest, catalog, attempts = latest, index = 0) {
  const subjectCatalog = catalog.filter(item => item.bereich === subject.bereich && item.fach === subject.fach);
  const subjectAttempts = latest.filter(attempt => attempt.bereich === subject.bereich && attempt.fach === subject.fach);
  const subjectStats = aggregate(subjectAttempts);
  const total = subjectCatalog.reduce((sum, item) => sum + item.total, 0);
  const subjectFullPointCount = countSubjectFullPoints(subjectCatalog, attempts);
  const subjectFullPointPercent = total ? Math.round((subjectFullPointCount / total) * 100) : 0;
  const answeredQuestions = subjectAttempts.length;
  const progressPercent = total ? roundedPercentage(answeredQuestions, total) : 0;
  const performance = subjectStats.performance;
  const openErrors = subjectStats.errors.length;
  const errorRate = answeredQuestions > 0 ? openErrors / answeredQuestions : 0;
  const statusClass = answeredQuestions === 0
    ? 'status-neutral'
    : performance >= 80
      ? 'status-good-4'
      : performance >= 65
        ? 'status-good-3'
        : performance >= 50
          ? 'status-good-2'
          : performance >= 40
            ? 'status-bad-3'
            : performance >= 20
              ? 'status-bad-2'
              : 'status-bad-1';
  const progressClass = answeredQuestions === 0
    ? 'progress-1'
    : progressPercent >= 50
      ? 'progress-4'
      : progressPercent >= 25
        ? 'progress-3'
        : progressPercent >= 10
          ? 'progress-2'
          : 'progress-1';
  const badgeState = answeredQuestions === 0
    ? 'neutral'
    : openErrors === 0
      ? (answeredQuestions < 5 ? 'good-start' : 'safe')
      : errorRate <= 0.25
        ? 'mostly-safe'
        : errorRate <= 0.5
          ? 'mixed'
          : 'unsafe';
  const statusText = answeredQuestions === 0
    ? 'nicht begonnen'
    : openErrors === 0
      ? (answeredQuestions < 5 ? 'guter Start' : 'sicher')
      : errorRate <= 0.25
        ? 'überwiegend sicher'
        : errorRate <= 0.5
          ? 'gemischt'
          : 'noch unsicher';
  const topics = subjectCatalog.map(topic => {
    const topicAttempts = attempts.filter(attempt => attempt.bereich === topic.bereich && attempt.fach === topic.fach && attempt.thema === topic.thema);
    const seenKeys = new Set(topicAttempts.map(attempt => String(attempt.questionKey || '').trim()).filter(Boolean));
    const answered = seenKeys.size;
    const unansweredCount = Math.max(0, Number(topic.total || 0) - answered);
    const topicStats = aggregate(subjectAttempts.filter(attempt => attempt.thema === topic.thema));
    const fullPointPercent = countFullPointQuestions(topicAttempts, Number(topic.total || 0)).percentage;
    const unansweredButtonText = unansweredCount > 0 ? 'Unbeantwortete üben' : 'Alle Fragen beantwortet';
    const buttonDisabled = unansweredCount === 0 ? 'disabled' : '';
    return `
      <div class="lernstand-topic">
        <div class="lernstand-topic-head">
          <strong>${escapeText(topic.thema)}</strong>
        </div>
        <div class="lernstand-topic-stats">
          <div class="lernstand-topic-stat-item"><span class="lernstand-topic-stat-label">Beantwortet:</span><span class="lernstand-topic-stat-value">${answered} / ${topic.total || 0}</span></div>
          <div class="lernstand-topic-stat-item"><span class="lernstand-topic-stat-label">Noch nie beantwortet:</span><span class="lernstand-topic-stat-value">${unansweredCount}</span></div>
          <div class="lernstand-topic-stat-item"><span class="lernstand-topic-stat-label">Aktuelle Punktleistung:</span><span class="lernstand-topic-stat-value">${topicStats.performance}%</span></div>
          <div class="lernstand-topic-stat-item lernstand-stat-open-errors ${topicStats.errors.length > 0 ? 'is-error' : 'is-clear'}"><span class="lernstand-topic-stat-label">Offene Fehler:</span><span class="lernstand-topic-stat-value">${topicStats.errors.length}</span></div>
          <div class="lernstand-topic-stat-item lernstand-stat-fullpoints"><span class="lernstand-topic-stat-label">Mit voller Punktzahl:</span><span class="lernstand-topic-stat-value">${fullPointPercent}%</span></div>
        </div>
        <button class="secondary-btn lernstand-theme-btn" type="button" data-action="start-unanswered-topic" data-bereich="${escapeText(subject.bereich)}" data-fach="${escapeText(subject.fach)}" data-thema="${escapeText(topic.thema)}" ${buttonDisabled}>${unansweredButtonText}</button>
      </div>`;
  }).join('') || '<div class="lernstand-topic">Noch keine Themen verfügbar.</div>';
  const subjectId = `lernstand-subject-${index}`;
  return { id: subjectId, card: `<article class="lernstand-subject ${statusClass} ${progressClass}" id="${subjectId}-card"><div class="lernstand-subject-heading"><span><strong>${escapeText(subject.fach)}</strong><small>${escapeText(subject.bereich)}</small></span><span>${answeredQuestions} / ${total} Fragen · ${progressPercent}%</span></div><div class="lernstand-subject-status badge-${badgeState}">${escapeText(statusText)}</div><div class="lernstand-subject-stats"><span>${performance}% Aktuelle Punktleistung</span><span>${openErrors} offene Fehler</span><span>${subjectFullPointPercent}% mit voller Punktzahl</span></div><div class="lernstand-subject-progress" aria-label="Bearbeitungsfortschritt: ${progressPercent}%"><span class="lernstand-subject-progress-fill" style="width: ${Math.max(0, Math.min(100, progressPercent))}%"></span></div><button class="secondary-btn lernstand-topic-toggle" type="button" data-action="toggle-topics" data-target="${subjectId}" aria-expanded="false" aria-controls="${subjectId}">Themen anzeigen</button></article>`, panel: `<div id="${subjectId}" class="lernstand-topics-panel" data-subject-panel="${subjectId}"><div class="lernstand-topics">${topics}</div></div>` };
}

function renderThemeLists(latest, catalog) {
  const themes = catalog.map(topic => {
    const attempts = latest.filter(attempt => attempt.bereich === topic.bereich && attempt.fach === topic.fach && attempt.thema === topic.thema);
    const qualified = topic.total > 0 && (topic.total < 3
      ? attempts.length === topic.total
      : attempts.length >= 3 && attempts.length / topic.total >= 0.3);
    return { ...topic, ...aggregate(attempts), qualified };
  }).filter(item => item.qualified && item.attempts.length > 0);
  const themeBar = item => renderBar(item.thema, item.performance, `${item.attempts.length} / ${item.total} Fragen bearbeitet`);

  // Staerkstes Thema: hoechste erreichte Leistung unter den bearbeiteten Themen.
  const strongest = themes.filter(item => item.performance > 0).sort((a, b) => b.performance - a.performance)[0];

  // Wiederholungskandidat: nur ein Thema, dessen Leistung schlechter als das staerkste Thema ist.
  const repeatCandidate = strongest
    ? themes.filter(item => item.performance < strongest.performance).sort((a, b) => a.performance - b.performance)[0]
    : undefined;

  return {
    strongest: strongest ? themeBar(strongest) : '<div class="result-list-empty">Noch keine ausreichenden Daten für ein starkes Thema.</div>',
    repeat: repeatCandidate
      ? themeBar(repeatCandidate)
      : '<div class="lernstand-repeat-empty"><p>Noch kein Wiederholungsbedarf erkennbar.</p><small>Bearbeite weitere Fragen, damit eine aussagekräftige Empfehlung möglich wird.</small></div>'
  };
}

function bindLearningProgressInteractions() {
  const container = document.getElementById('lernstandListe');
  if (!container || learningProgressInteractionsBound) return;
  learningProgressInteractionsBound = true;
  container.addEventListener('click', async event => {
    const topicTrainerButton = event.target.closest('button[data-action="start-unanswered-topic"]');
    if (topicTrainerButton) {
      const fach = String(topicTrainerButton.dataset.fach || '').trim();
      const thema = String(topicTrainerButton.dataset.thema || '').trim();
      const bereich = String(topicTrainerButton.dataset.bereich || '').trim();
      if (!fach || !thema || !bereich) return;
      // The trainer state is declared with global let in main.js, not on window.
      // Finish an existing filtered session before starting the selected topic.
      if (typeof trainerNochNieAktiv !== 'undefined' && trainerNochNieAktiv) {
        trainerNochNieAktiv = false;
        trainerNochNieResetState();
      }
      aktuellerTeilbereich = bereich;
      aktuellesFach = fach;
      aktuellesThema = thema;
      const teilbereichSelect = document.getElementById('teilbereichSelect');
      const fachSelect = document.getElementById('fachSelect');
      const themaSelect = document.getElementById('themaSelect');
      if (teilbereichSelect) teilbereichSelect.value = bereich;
      if (fachSelect) {
        fachSelect.innerHTML = '<option value="">-- Fach wählen --</option>';
        const option = document.createElement('option');
        option.value = fach;
        option.textContent = fach;
        fachSelect.appendChild(option);
        fachSelect.value = fach;
      }
      if (themaSelect) {
        themaSelect.innerHTML = '<option value="">-- Thema wählen --</option>';
        const option = document.createElement('option');
        option.value = thema;
        option.textContent = thema;
        themaSelect.appendChild(option);
        themaSelect.value = thema;
      }
      document.getElementById('fachBereich').style.display = 'block';
      document.getElementById('themaBereich').style.display = 'block';
      document.getElementById('anzeigeTeilbereich').textContent = bereich;
      document.getElementById('anzeigeFach').textContent = fach;
      if (typeof wiederholungsKontext !== 'undefined') wiederholungsKontext = null;
      if (typeof window.zeigeBereich === 'function') {
        window.zeigeBereich('trainerView');
      }
      if (typeof window.trainerNochNieBeantwortet === 'function') {
        await window.trainerNochNieBeantwortet();
      }
      return;
    }

    const toggleButton = event.target.closest('button[data-action="toggle-topics"]');
    if (toggleButton) {
      subjectAccordion?.toggle(toggleButton.dataset.target);
      return;
    }

  });
}

function errorAttemptKey(attempt) {
  const fach = String(attempt.fach || '').trim();
  const frageId = String(attempt.frageId || '').trim();
  return fach && frageId ? `${fach}::${frageId}` : String(attempt.questionKey || '').trim();
}

function groupErrorHistory(attempts) {
  const grouped = new Map();
  attempts.forEach(attempt => {
    const key = errorAttemptKey(attempt);
    const history = grouped.get(key) || [];
    history.push(attempt);
    grouped.set(key, history);
  });
  return [...grouped.entries()].map(([key, history]) => {
    const chronologicalAttempts = [...history].sort((first, second) => timestampMillis(first.timestamp) - timestampMillis(second.timestamp));
    const latestAttempt = chronologicalAttempts[chronologicalAttempts.length - 1];
    const hasIncorrectAttempt = chronologicalAttempts.some(isBelowHalf);
    return {
      key,
      attempts: chronologicalAttempts,
      latestAttempt,
      repetitions: Math.max(0, chronologicalAttempts.length - 1),
      hasIncorrectAttempt,
      isOpen: hasIncorrectAttempt && isBelowHalf(latestAttempt)
    };
  }).filter(entry => entry.hasIncorrectAttempt);
}

function questionDetailsKey(attempt) {
  return `${String(attempt.fach || '').trim()}::${String(attempt.frageId || '').trim()}`;
}

async function loadQuestionDetails(attempt) {
  const fach = String(attempt.fach || '').trim();
  const frageId = String(attempt.frageId || '').trim();
  const cacheKey = questionDetailsKey(attempt);
  if (!fach || !frageId) throw new Error('Fach oder Frage-ID fehlen.');
  if (!questionDetailsCache.has(cacheKey)) {
    const request = window.apiGet('questionById', { fach, frageId })
      .then(result => {
        if (!result.success) throw new Error(result.error || 'Die Frage konnte nicht geladen werden.');
        const question = result.data || {};
        if (!String(question.id || '').trim()) throw new Error('Die gespeicherte Frage wurde nicht gefunden.');
        return question;
      })
      .catch(error => {
        questionDetailsCache.delete(cacheKey);
        throw error;
      });
    questionDetailsCache.set(cacheKey, request);
  }
  return questionDetailsCache.get(cacheKey);
}

function repetitionText(repetitions) {
  if (repetitions === 0) return 'Noch nicht wiederholt';
  if (repetitions === 1) return '1-mal wiederholt';
  return `${repetitions}-mal wiederholt`;
}

async function oeffneWiederholungAusAttempt(attempt) {
  const fach = String(attempt.fach || '').trim();
  const frageId = String(attempt.frageId || '').trim();
  if (!fach || !frageId) {
    throw new Error('Fach oder Frage-ID fehlen.');
  }

  const question = await loadQuestionDetails(attempt);

  if (typeof window.oeffneWifaWiederholungsfrage !== 'function') {
    throw new Error('Die Wiederholungsfunktion des WiFa-Trainers ist nicht bereit.');
  }

  window.oeffneWifaWiederholungsfrage(question, {
    bereich: String(attempt.bereich || '').trim(),
    fach,
    thema: String(attempt.thema || '').trim(),
    questionKey: String(attempt.questionKey || '').trim()
  });
}

async function wiederholeFehler(attempt, button) {
  const status = document.getElementById('fehleranalyseStatus');

  button.disabled = true;
  button.textContent = 'Frage wird geladen...';
  let openedTrainer = false;

  try {
    await oeffneWiederholungAusAttempt(attempt);
    openedTrainer = true;
  } catch (error) {
    status.textContent = `Wiederholungsfrage konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
  } finally {
    if (!openedTrainer) {
      button.disabled = false;
      button.textContent = 'Jetzt wiederholen';
    }
  }
}

// Ermittelt, ausgehend von der Fehleranalyse-Logik, den n\u00e4chsten offenen Fehler nach einem gegebenen Fach::frageId-Schl\u00fcssel
export async function ermittleNaechstenOffenenFehler(aktuellerSchluessel) {
  const user = currentVerifiedUser();
  if (!user) throw new Error('Bitte melde dich mit einem best\u00e4tigten Konto an, um offene Fehler zu laden.');

  const [history, catalog] = await Promise.all([loadAttempts(user), loadQuestionCatalog()]);
  const { activeAttempts: attempts } = await loadActiveAttemptBasis(history, catalog);
  if (auth.currentUser !== user) throw new Error('Die Anmeldung hat sich geändert.');
  const errorHistory = groupErrorHistory(attempts);
  const openErrors = errorHistory.filter(entry => entry.isOpen).sort((first, second) => first.key.localeCompare(second.key));
  const currentIndex = openErrors.findIndex(entry => entry.key === aktuellerSchluessel);
  const otherOpenErrors = openErrors.filter(entry => entry.key !== aktuellerSchluessel);

  let nextEntry = null;
  if (otherOpenErrors.length) {
    if (currentIndex === -1) {
      nextEntry = otherOpenErrors[0];
    } else {
      for (let offset = 1; offset <= openErrors.length; offset++) {
        const candidate = openErrors[(currentIndex + offset) % openErrors.length];
        if (candidate.key !== aktuellerSchluessel) {
          nextEntry = candidate;
          break;
        }
      }
    }
  }

  return {
    openErrorsCount: openErrors.length,
    currentIsOpen: currentIndex !== -1,
    hasOtherOpenError: otherOpenErrors.length > 0,
    nextEntry
  };
}

function bindErrorAnalysisInteractions() {
  const container = document.getElementById('fehleranalyseListe');
  if (!container || errorAnalysisInteractionsBound) return;
  errorAnalysisInteractionsBound = true;
  container.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    if (button.dataset.action === 'repeat-error') {
      const attempt = repeatAttemptsByKey.get(button.dataset.errorKey);
      if (attempt) wiederholeFehler(attempt, button);
      return;
    }

    const panel = document.getElementById(button.dataset.target);
    if (!panel) return;
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    if (button.dataset.action === 'toggle-errors') {
      button.textContent = panel.hidden ? 'Fehler anzeigen' : 'Fehler ausblenden';
    }
    if (button.dataset.action === 'toggle-resolved-errors') {
      button.textContent = panel.hidden
        ? `Behobene Fehler anzeigen (${button.dataset.count})`
        : 'Behobene Fehler ausblenden';
    }
  });
}

async function renderErrorAnalysis(attempts) {
  const errorHistory = groupErrorHistory(attempts);
  const openErrors = errorHistory.filter(entry => entry.isOpen).sort((first, second) => first.key.localeCompare(second.key));
  const resolvedErrors = errorHistory.filter(entry => !entry.isOpen);
  const partial = openErrors.filter(entry => normalizedAttemptStatus(entry.latestAttempt) === 'teilweise richtig').length;
  const incorrect = openErrors.filter(entry => normalizedAttemptStatus(entry.latestAttempt) === 'falsch').length;
  const subjects = new Map();

  openErrors.forEach(entry => {
    const attempt = entry.latestAttempt;
    const subjectKey = `${attempt.bereich}::${attempt.fach}`;
    const subject = subjects.get(subjectKey) || { bereich: attempt.bereich, fach: attempt.fach, topics: new Map() };
    const topicKey = String(attempt.thema || '').trim();
    const topic = subject.topics.get(topicKey) || { thema: attempt.thema, entries: [] };
    topic.entries.push(entry);
    subject.topics.set(topicKey, topic);
    subjects.set(subjectKey, subject);
  });

  const questions = await Promise.all(errorHistory.map(async entry => {
    try {
      return [entry.key, await loadQuestionDetails(entry.latestAttempt)];
    } catch {
      return [entry.key, null];
    }
  }));
  const questionByKey = new Map(questions);
  repeatAttemptsByKey.clear();
  openErrors.forEach(entry => repeatAttemptsByKey.set(entry.key, entry.latestAttempt));

  const groupedErrors = [...subjects.values()].map((subject, index) => {
    const topicRows = [...subject.topics.values()].map((topic, topicIndex) => {
      const topicId = `fehler-${index}-${topicIndex}`;
      const questionRows = topic.entries.map(entry => {
        const attempt = entry.latestAttempt;
        const question = questionByKey.get(entry.key);
        return `
          <article class="fehleranalyse-question">
            <strong>${escapeText(question?.frage || 'Fragetext konnte nicht geladen werden.')}</strong>
            <span>Frage-ID: ${escapeText(attempt.frageId)}</span>
            <span>Letzte eigene Antwort: ${escapeText(attempt.antwort ? attempt.antwort : 'Für diesen älteren Lernversuch ist keine eigene Antwort gespeichert.')}</span>
            <span>${escapeText(attempt.erreichtePunkte)} / ${escapeText(attempt.maximalPunkte)} Punkte · ${escapeText(normalizedAttemptStatus(attempt) || attempt.status)}</span>
            <span>Letzter Versuch: ${escapeText(formatDateTime(attempt.timestamp))}</span>
            <span>${escapeText(repetitionText(entry.repetitions))} · ${entry.attempts.length} Versuche insgesamt</span>
            <button class="secondary-btn fehleranalyse-repeat" type="button" data-action="repeat-error" data-error-key="${escapeText(entry.key)}">Jetzt wiederholen</button>
          </article>
        `;
      }).join('');
      return `<div class="fehleranalyse-topic"><div><strong>${escapeText(topic.thema || 'Thema nicht hinterlegt')}</strong><span>${topic.entries.length} offene Fehler</span></div><button class="secondary-btn fehleranalyse-toggle" type="button" data-action="toggle-errors" data-target="${topicId}" data-count="${topic.entries.length}" aria-expanded="false" aria-controls="${topicId}">Fehler anzeigen</button><div id="${topicId}" class="fehleranalyse-questions" hidden>${questionRows}</div></div>`;
    }).join('');
    return `<article class="fehleranalyse-subject"><div class="fehleranalyse-subject-heading"><strong>${escapeText(subject.fach)}</strong><span>${escapeText(subject.bereich)}</span></div>${topicRows}</article>`;
  }).join('');

  const resolvedId = 'behobene-fehler';
  const resolvedRows = resolvedErrors.map(entry => {
    const attempt = entry.latestAttempt;
    const question = questionByKey.get(entry.key);
    const successText = entry.repetitions === 1
      ? 'Nach 1 Wiederholung richtig'
      : `Nach insgesamt ${entry.attempts.length} Versuchen richtig`;
    return `
      <article class="fehleranalyse-question fehleranalyse-resolved-question">
        <strong>${escapeText(question?.frage || 'Fragetext nicht verfügbar.')}</strong>
        <span>${escapeText(attempt.fach)} · ${escapeText(attempt.thema)}</span>
        <span>${escapeText(successText)}</span>
        <span>Gelöst am: ${escapeText(formatDateTime(attempt.timestamp))}</span>
        <span>Wird nicht mehr als offener Fehler gezählt.</span>
      </article>
    `;
  }).join('');

  document.getElementById('fehleranalyseListe').innerHTML = `
    <section class="lernstand-metrics">${renderMetric('Offene Fehler', openErrors.length, `${partial} teilweise richtig · ${incorrect} falsch`)}${renderMetric('Behobene Fehler', resolvedErrors.length)}</section>
    <section class="lernstand-section"><h2 class="section-title">Offene Fehler nach Fach und Thema</h2>${groupedErrors || '<div class="result-list-empty">Keine offenen Fehler. Gut gemacht.</div>'}</section>
    <section class="lernstand-section"><button class="secondary-btn fehleranalyse-resolved-toggle" type="button" data-action="toggle-resolved-errors" data-target="${resolvedId}" data-count="${resolvedErrors.length}" aria-expanded="false" aria-controls="${resolvedId}">Behobene Fehler anzeigen (${resolvedErrors.length})</button><div id="${resolvedId}" class="fehleranalyse-questions" hidden>${resolvedRows || '<div class="result-list-empty">Noch keine Fehler behoben.</div>'}</div></section>
  `;
}

function renderLearningProgress(attempts, catalog, history = attempts) {
  const latest = latestAttempts(attempts);
  const current = aggregate(latest);
  const totalQuestions = catalog.reduce((sum, item) => sum + item.total, 0);
  const completed = latest.length;
  const open = Math.max(0, totalQuestions - completed);
  const correct = latest.filter(attempt => attempt.status === 'richtig').length;
  const partial = latest.filter(attempt => attempt.status === 'teilweise richtig').length;
  const incorrect = latest.filter(attempt => attempt.status === 'falsch').length;
  const latestActivity = attempts[0]?.timestamp;
  const subjects = Object.entries(window.faecherNachTeilbereich || {}).flatMap(([bereich, faecher]) => faecher.map(fach => ({ bereich, fach })));
  const themeLists = renderThemeLists(latest, catalog);

  document.getElementById('lernstandListe').innerHTML = `
    <section class="lernstand-metrics">${renderMetric('Bearbeitete Fragen', `${completed} von ${totalQuestions}`, totalQuestions ? `${roundedPercentage(completed, totalQuestions)}% Fortschritt` : 'Fragenbestand noch nicht verfügbar')}${renderMetric('Aktuelle Punktleistung', `${current.performance}%`, completed ? `${current.reached} / ${current.maximum} Punkte` : 'Noch keine Fragen bearbeitet')}${renderMetric('Offene Fehler', current.errors.length, `${partial} teilweise richtig · ${incorrect} falsch`)}${renderMetric('Letzte Aktivität', formatDate(latestActivity), attempts.length ? `${attempts.length} gespeicherte Versuche` : 'Noch keine Lernaktivität')}</section>
    <section class="lernstand-section"><h2 class="section-title">Gesamtübersicht</h2><div class="lernstand-overview"><div class="lernstand-summary-card"><h3>Bearbeitungsstand</h3>${renderBar('Bearbeitet', totalQuestions ? (completed / totalQuestions) * 100 : 0, `${completed} bearbeitet · ${open} noch offen`)}</div><div class="lernstand-summary-card"><h3>Ergebnis der bearbeiteten Fragen</h3>${renderBar('Richtig', completed ? (correct / completed) * 100 : 0, `${correct} richtig · ${partial} teilweise · ${incorrect} falsch`)}</div></div></section>
    <section class="lernstand-section lernstand-development-section"><h2 class="section-title">Meine Entwicklung</h2>${renderDevelopment(history)}</section>
    <div class="lernstand-analysis-group">
      <section class="lernstand-section lernstand-strength-grid"><div class="lernstand-analysis-card lernstand-strong-card"><h2 class="section-title">Meine stärksten Themen</h2>${themeLists.strongest}</div><div class="lernstand-analysis-card lernstand-repeat-card"><h2 class="section-title">Hier lohnt sich Wiederholen</h2>${themeLists.repeat}</div></section>
      <section class="lernstand-section lernstand-error-card"><h2 class="section-title">Deine offenen Fehler</h2><p>${current.errors.length} offene Fehler: ${partial} teilweise richtig · ${incorrect} falsch</p><button class="action-btn lernstand-error-button" type="button" onclick="oeffneLernstandBereich('lernstandFehlerView')">Zur Fehleranalyse</button></section>
    </div>
    <section class="lernstand-section"><h2 class="section-title">Lernstand nach Fach</h2><div class="lernstand-subject-list"></div></section>
  `;
  subjectAccordion?.destroy();
  subjectAccordion = mountSubjectAccordion(document.querySelector('#lernstandListe .lernstand-subject-list'),
    subjects.map((subject, index) => renderSubject(subject, latest, catalog, attempts, index)));
  bindLearningProgressInteractions();
}

export async function ladeWifaLernstand() {
  const status = document.getElementById('lernstandStatus');
  const list = document.getElementById('lernstandListe');
  const user = currentVerifiedUser();
  if (!status || !list || !user) return;
  subjectAccordion?.destroy();
  subjectAccordion = null;
  status.textContent = 'Lernstand wird geladen...';
  list.innerHTML = '<div class="result-list-empty">Bitte kurz warten...</div>';
  try {
    // BEGIN TEMP [LERNSTAND DEBUG]: retain raw query documents for this load only.
    let debugDocuments = [];
    const [attempts, catalog] = await Promise.all([
      loadAttempts(user, documents => { debugDocuments = documents; }), loadQuestionCatalog()
    ]);
    // END TEMP [LERNSTAND DEBUG]
    if (auth.currentUser !== user) return;
    const basis = await loadActiveAttemptBasis(attempts, catalog);
    if (auth.currentUser !== user) return;
    renderLearningProgress(basis.activeAttempts, catalog, attempts);
    const latest = latestAttempts(basis.activeAttempts);
    const current = aggregate(latest);
    window.meldeErfolgsFortschritt?.('trainer', current.performance, user.uid);
    // BEGIN TEMP [LERNSTAND DEBUG]
    debugLearningProgress(debugDocuments, attempts, catalog, basis);
    // END TEMP [LERNSTAND DEBUG]
    status.textContent = attempts.length ? `${attempts.length} Lernversuche geladen.` : 'Noch keine Fragen bearbeitet';
  } catch (error) {
    status.textContent = `Lernstand konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
    list.innerHTML = '<div class="result-list-empty">Der Lernstand ist derzeit nicht verfügbar.</div>';
  }
}

export async function ladeFehleranalyse() {
  const status = document.getElementById('fehleranalyseStatus');
  const list = document.getElementById('fehleranalyseListe');
  const user = currentVerifiedUser();
  if (!status || !list || !user) return;
  bindErrorAnalysisInteractions();
  status.textContent = 'Fehleranalyse wird geladen...';
  list.innerHTML = '<div class="result-list-empty">Bitte kurz warten...</div>';
  try {
    const [history, catalog] = await Promise.all([loadAttempts(user), loadQuestionCatalog()]);
    if (auth.currentUser !== user) return;
    const { activeAttempts: attempts } = await loadActiveAttemptBasis(history, catalog);
    if (auth.currentUser !== user) return;
    await renderErrorAnalysis(attempts);
    status.textContent = 'Fehleranalyse aktuell.';
  } catch (error) {
    status.textContent = `Fehleranalyse konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
    list.innerHTML = '<div class="result-list-empty">Die Fehleranalyse ist derzeit nicht verfügbar.</div>';
  }
}

// Reuse the verified current-user read for the topic's unanswered trainer mode.
window.loadAttemptsForCurrentUser = async () => {
  const user = currentVerifiedUser();
  if (!user) throw new Error('Bitte melde dich mit einem bestätigten Konto an.');
  const attempts = await loadAttempts(user);
  if (auth.currentUser !== user) throw new Error('Die Anmeldung hat sich geändert.');
  return attempts;
};
window.speichereWifaAttempt = speichereWifaAttempt;
window.ladeWifaLernstand = ladeWifaLernstand;
window.ladeLernstand = ladeWifaLernstand;
window.ladeFehleranalyse = ladeFehleranalyse;
window.ermittleNaechstenOffenenFehler = ermittleNaechstenOffenenFehler;
window.oeffneWiederholungAusAttempt = oeffneWiederholungAusAttempt;
