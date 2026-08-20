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

const MODULE_ID = 'wifa-trainer';
const BERLIN_TIME_ZONE = 'Europe/Berlin';
const questionDetailsCache = new Map();
const repeatAttemptsByKey = new Map();
let learningProgressInteractionsBound = false;
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

async function loadAttempts(user) {
  const attemptQuery = query(collection(db, 'users', user.uid, 'attempts'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(attemptQuery);
  return snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
    .filter(attempt => attempt.modul === MODULE_ID && attempt.userId === user.uid);
}

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

function aggregate(attempts) {
  const reached = attempts.reduce((sum, attempt) => sum + Number(attempt.erreichtePunkte || 0), 0);
  const maximum = attempts.reduce((sum, attempt) => sum + Number(attempt.maximalPunkte || 0), 0);
  return {
    attempts,
    reached,
    maximum,
    performance: roundedPercentage(reached, maximum),
    errors: attempts.filter(attempt => attempt.status !== 'richtig')
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
  const yPositionPercent = value => chartTop + chartAreaHeight - (value / 100) * chartAreaHeight;
  const ticks = Array.from({ length: stepCount + 1 }, (_, index) => (scaleMaximum / stepCount) * index);
  const grid = ticks.map(value => `<line x1="${chartLeft}" y1="${yPosition(value)}" x2="${chartWidth - chartRight}" y2="${yPosition(value)}" class="lernstand-chart-grid"/><text x="${chartLeft - 6}" y="${yPosition(value) + 4}" class="lernstand-chart-y-label">${value}</text>`).join('');
  const percentLabels = [0, 50, 100].map(value => `<text x="${chartWidth - chartRight + 6}" y="${yPositionPercent(value) + 4}" class="lernstand-chart-y-label lernstand-chart-y-label-percent">${value}%</text>`).join('');
  const points = entries.map(([day, value], index) => ({
    day,
    value,
    center: chartLeft + (chartAreaWidth / entries.length) * (index + 0.5),
    // Vorhandene Berechnung der Tagesleistung wird hier nur weiterverwendet, nicht neu erfunden.
    performance: roundedPercentage(value.reached, value.maximum)
  }));
  const bars = points.map(({ day, value, center, performance }) => {
    const height = (value.count / scaleMaximum) * chartAreaHeight;
    const label = `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
    return `<rect x="${center - barWidth / 2}" y="${chartTop + chartAreaHeight - height}" width="${barWidth}" height="${height}" class="lernstand-chart-bar"><title>${escapeText(label)}: ${value.count} Lernversuche · ${performance}% Tagesleistung</title></rect><text x="${center}" y="${chartHeight - 12}" class="lernstand-chart-x-label">${label}</text>`;
  }).join('');
  const linePoints = points.map(({ center, performance }) => `${center},${yPositionPercent(performance)}`).join(' ');
  const markers = points.map(({ day, value, center, performance }) => {
    const label = `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
    return `<circle cx="${center}" cy="${yPositionPercent(performance)}" r="4" class="lernstand-chart-point"><title>${escapeText(label)}: ${value.count} Lernversuche · ${performance}% Tagesleistung</title></circle>`;
  }).join('');
  return `<div class="lernstand-attempt-chart" role="img" aria-label="Meine Lernentwicklung: Lernversuche und Tagesleistung">
    <h3>Meine Lernentwicklung</h3>
    <div class="lernstand-chart-legend">
      <span class="lernstand-chart-legend-item"><span class="lernstand-chart-legend-dot lernstand-chart-legend-dot-bar"></span>Lernversuche</span>
      <span class="lernstand-chart-legend-item"><span class="lernstand-chart-legend-dot lernstand-chart-legend-dot-line"></span>Leistung</span>
    </div>
    <div class="lernstand-chart-scroll"><svg viewBox="0 0 ${chartWidth} ${chartHeight}" aria-hidden="true">${grid}<line x1="${chartLeft}" y1="${chartTop + chartAreaHeight}" x2="${chartWidth - chartRight}" y2="${chartTop + chartAreaHeight}" class="lernstand-chart-axis"/>${bars}${percentLabels}<polyline points="${linePoints}" class="lernstand-chart-line"/>${markers}</svg></div>
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
  return renderAttemptsChart(entries);
}

function renderSubject(subject, latest, catalog) {
  const subjectCatalog = catalog.filter(item => item.bereich === subject.bereich && item.fach === subject.fach);
  const subjectAttempts = latest.filter(attempt => attempt.bereich === subject.bereich && attempt.fach === subject.fach);
  const subjectStats = aggregate(subjectAttempts);
  const total = subjectCatalog.reduce((sum, item) => sum + item.total, 0);
  const progress = total ? roundedPercentage(subjectAttempts.length, total) : 0;
  const topics = subjectCatalog.map(topic => {
    const topicAttempts = subjectAttempts.filter(attempt => attempt.thema === topic.thema);
    const stats = aggregate(topicAttempts);
    return `<div class="lernstand-topic"><strong>${escapeText(topic.thema)}</strong><span>${topicAttempts.length} / ${topic.total || 0} Fragen bearbeitet</span><span>${stats.performance}% aktuelle Leistung</span><span>${stats.errors.length} offene Fehler</span></div>`;
  }).join('') || '<div class="lernstand-topic">Noch keine Themen verfügbar.</div>';
  const subjectId = `lernstand-subject-${subject.bereich}-${subject.fach}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `<article class="lernstand-subject"><div class="lernstand-subject-heading"><span><strong>${escapeText(subject.fach)}</strong><small>${escapeText(subject.bereich)}</small></span><span>${subjectAttempts.length} / ${total} Fragen · ${progress}%</span></div><div class="lernstand-subject-stats"><span>${subjectStats.performance}% aktuelle Leistung</span><span>${subjectStats.errors.length} offene Fehler</span></div><button class="secondary-btn lernstand-topic-toggle" type="button" data-action="toggle-topics" data-target="${subjectId}" aria-expanded="false" aria-controls="${subjectId}">Themen anzeigen</button><div id="${subjectId}" class="lernstand-topics" hidden>${topics}</div></article>`;
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
  container.addEventListener('click', event => {
    const button = event.target.closest('button[data-action="toggle-topics"]');
    if (!button) return;
    const panel = document.getElementById(button.dataset.target);
    if (!panel) return;
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    button.textContent = panel.hidden ? 'Themen anzeigen' : 'Themen ausblenden';
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
    const hasIncorrectAttempt = chronologicalAttempts.some(attempt => normalizedAttemptStatus(attempt) !== 'richtig');
    return {
      key,
      attempts: chronologicalAttempts,
      latestAttempt,
      repetitions: Math.max(0, chronologicalAttempts.length - 1),
      hasIncorrectAttempt,
      isOpen: hasIncorrectAttempt && normalizedAttemptStatus(latestAttempt) !== 'richtig'
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

  const attempts = await loadAttempts(user);
  const errorHistory = groupErrorHistory(attempts);
  const openErrors = errorHistory.filter(entry => entry.isOpen);
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
  const openErrors = errorHistory.filter(entry => entry.isOpen);
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

function renderLearningProgress(attempts, catalog) {
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
    <section class="lernstand-metrics">${renderMetric('Bearbeitete Fragen', `${completed} von ${totalQuestions}`, totalQuestions ? `${roundedPercentage(completed, totalQuestions)}% Fortschritt` : 'Fragenbestand noch nicht verfügbar')}${renderMetric('Aktuelle Leistung', completed ? `${current.performance}%` : '–', completed ? `${current.reached} / ${current.maximum} Punkte` : 'Noch keine Fragen bearbeitet')}${renderMetric('Offene Fehler', current.errors.length, `${partial} teilweise richtig · ${incorrect} falsch`)}${renderMetric('Letzte Aktivität', formatDate(latestActivity), attempts.length ? `${attempts.length} gespeicherte Versuche` : 'Noch keine Lernaktivität')}</section>
    <section class="lernstand-section"><h2 class="section-title">Gesamtübersicht</h2><div class="lernstand-overview"><div class="lernstand-summary-card"><h3>Bearbeitungsstand</h3>${renderBar('Bearbeitet', totalQuestions ? (completed / totalQuestions) * 100 : 0, `${completed} bearbeitet · ${open} noch offen`)}</div><div class="lernstand-summary-card"><h3>Ergebnis der bearbeiteten Fragen</h3>${renderBar('Richtig', completed ? (correct / completed) * 100 : 0, `${correct} richtig · ${partial} teilweise · ${incorrect} falsch`)}</div></div></section>
    <section class="lernstand-section lernstand-development-section"><h2 class="section-title">Meine Entwicklung</h2>${renderDevelopment(attempts)}</section>
    <div class="lernstand-analysis-group">
      <section class="lernstand-section lernstand-strength-grid"><div class="lernstand-analysis-card lernstand-strong-card"><h2 class="section-title">Meine stärksten Themen</h2>${themeLists.strongest}</div><div class="lernstand-analysis-card lernstand-repeat-card"><h2 class="section-title">Hier lohnt sich Wiederholen</h2>${themeLists.repeat}</div></section>
      <section class="lernstand-section lernstand-error-card"><h2 class="section-title">Deine offenen Fehler</h2><p>${current.errors.length} offene Fehler: ${partial} teilweise richtig · ${incorrect} falsch</p><button class="action-btn lernstand-error-button" type="button" onclick="oeffneLernstandBereich('lernstandFehlerView')">Zur Fehleranalyse</button></section>
    </div>
    <section class="lernstand-section"><h2 class="section-title">Lernstand nach Fach</h2><div class="lernstand-subject-list">${subjects.map(subject => renderSubject(subject, latest, catalog)).join('')}</div></section>
  `;
  bindLearningProgressInteractions();
}

export async function ladeWifaLernstand() {
  const status = document.getElementById('lernstandStatus');
  const list = document.getElementById('lernstandListe');
  const user = currentVerifiedUser();
  if (!status || !list || !user) return;
  status.textContent = 'Lernstand wird geladen...';
  list.innerHTML = '<div class="result-list-empty">Bitte kurz warten...</div>';
  try {
    const [attempts, catalog] = await Promise.all([loadAttempts(user), loadQuestionCatalog()]);
    if (auth.currentUser !== user) return;
    renderLearningProgress(attempts, catalog);
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
    const attempts = await loadAttempts(user);
    if (auth.currentUser !== user) return;
    await renderErrorAnalysis(attempts);
    status.textContent = 'Fehleranalyse aktuell.';
  } catch (error) {
    status.textContent = `Fehleranalyse konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
    list.innerHTML = '<div class="result-list-empty">Die Fehleranalyse ist derzeit nicht verfügbar.</div>';
  }
}

window.speichereWifaAttempt = speichereWifaAttempt;
window.ladeWifaLernstand = ladeWifaLernstand;
window.ladeLernstand = ladeWifaLernstand;
window.ladeFehleranalyse = ladeFehleranalyse;
window.ermittleNaechstenOffenenFehler = ermittleNaechstenOffenenFehler;
window.oeffneWiederholungAusAttempt = oeffneWiederholungAusAttempt;
