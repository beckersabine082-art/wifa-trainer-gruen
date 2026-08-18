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
  const chartRight = 14;
  const chartAreaHeight = chartHeight - chartTop - chartBottom;
  const chartAreaWidth = chartWidth - chartLeft - chartRight;
  const barWidth = Math.min(45, Math.max(12, chartAreaWidth / entries.length - 16));
  const yPosition = value => chartTop + chartAreaHeight - (value / scaleMaximum) * chartAreaHeight;
  const ticks = Array.from({ length: stepCount + 1 }, (_, index) => (scaleMaximum / stepCount) * index);
  const grid = ticks.map(value => `<line x1="${chartLeft}" y1="${yPosition(value)}" x2="${chartWidth - chartRight}" y2="${yPosition(value)}" class="lernstand-chart-grid"/><text x="${chartLeft - 6}" y="${yPosition(value) + 4}" class="lernstand-chart-y-label">${value}</text>`).join('');
  const bars = entries.map(([day, value], index) => {
    const center = chartLeft + (chartAreaWidth / entries.length) * (index + 0.5);
    const height = (value.count / scaleMaximum) * chartAreaHeight;
    const label = `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
    return `<rect x="${center - barWidth / 2}" y="${chartTop + chartAreaHeight - height}" width="${barWidth}" height="${height}" class="lernstand-chart-bar"><title>${escapeText(label)}: ${value.count} Lernversuche</title></rect><text x="${center}" y="${chartHeight - 12}" class="lernstand-chart-x-label">${label}</text>`;
  }).join('');
  return `<div class="lernstand-attempt-chart" role="img" aria-label="Lernversuche pro Tag"><h3>Lernversuche pro Tag</h3><div class="lernstand-chart-scroll"><svg viewBox="0 0 ${chartWidth} ${chartHeight}" aria-hidden="true">${grid}<line x1="${chartLeft}" y1="${chartTop + chartAreaHeight}" x2="${chartWidth - chartRight}" y2="${chartTop + chartAreaHeight}" class="lernstand-chart-axis"/>${bars}</svg></div></div>`;
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
  return `${renderAttemptsChart(entries)}${entries.map(([day, value]) => `
    <div class="lernstand-development-row">
      <strong>${escapeText(day)}</strong>
      ${renderBar('Leistung', roundedPercentage(value.reached, value.maximum), `${value.reached} / ${value.maximum} Punkte`)}
    </div>
  `).join('')}`;
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
  return `<article class="lernstand-subject"><div class="lernstand-subject-heading"><span><strong>${escapeText(subject.fach)}</strong><small>${escapeText(subject.bereich)}</small></span><span>${subjectAttempts.length} / ${total} Fragen · ${progress}%</span></div><div class="lernstand-subject-stats"><span>${subjectStats.performance}% aktuelle Leistung</span><span>${subjectStats.errors.length} offene Fehler</span></div><button class="secondary-btn lernstand-topic-toggle" type="button" aria-expanded="false" aria-controls="${subjectId}">Themen anzeigen</button><div id="${subjectId}" class="lernstand-topics" hidden>${topics}</div></article>`;
}

function renderThemeLists(latest, catalog) {
  const themes = catalog.map(topic => {
    const attempts = latest.filter(attempt => attempt.bereich === topic.bereich && attempt.fach === topic.fach && attempt.thema === topic.thema);
    const qualified = topic.total > 0 && (topic.total < 3
      ? attempts.length === topic.total
      : attempts.length >= 3 && attempts.length / topic.total >= 0.3);
    return { ...topic, ...aggregate(attempts), qualified };
  }).filter(item => item.qualified);
  const list = (items, emptyText) => items.length
    ? items.slice(0, 5).map(item => renderBar(item.thema, item.performance, `${item.attempts.length} / ${item.total} Fragen bearbeitet`)).join('')
    : `<div class="result-list-empty">${escapeText(emptyText)}</div>`;
  return {
    strongest: list(themes.filter(item => item.attempts.length > 0 && item.performance > 0).sort((a, b) => b.performance - a.performance), 'Noch keine ausreichenden Daten für ein starkes Thema.'),
    repeat: list(themes.filter(item => item.attempts.length > 0).sort((a, b) => a.performance - b.performance), 'Noch nicht genügend Daten für eine Auswertung')
  };
}

function bindLearningProgressInteractions() {
  document.querySelectorAll('.lernstand-topic-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      button.textContent = panel.hidden ? 'Themen anzeigen' : 'Themen ausblenden';
    });
  });
}

function errorAttemptKey(attempt) {
  const storedQuestionKey = String(attempt.questionKey || '').trim();
  return storedQuestionKey || `${String(attempt.fach || '').trim()}::${String(attempt.frageId || '').trim()}`;
}

function latestErrorAttempts(attempts) {
  const latest = new Map();
  attempts.forEach(attempt => {
    const key = errorAttemptKey(attempt);
    const previous = latest.get(key);
    if (!previous || timestampMillis(attempt.timestamp) > timestampMillis(previous.timestamp)) {
      latest.set(key, attempt);
    }
  });
  return [...latest.values()].filter(attempt => attempt.status !== 'richtig');
}

function renderErrorAnalysis(attempts) {
  const latestErrors = latestErrorAttempts(attempts);
  const partial = latestErrors.filter(attempt => attempt.status === 'teilweise richtig').length;
  const incorrect = latestErrors.filter(attempt => attempt.status === 'falsch').length;
  const subjects = new Map();

  latestErrors.forEach(attempt => {
    const subjectKey = `${attempt.bereich}::${attempt.fach}`;
    const subject = subjects.get(subjectKey) || { bereich: attempt.bereich, fach: attempt.fach, attempts: [] };
    subject.attempts.push(attempt);
    subjects.set(subjectKey, subject);
  });

  const groupedErrors = [...subjects.values()].map((subject, index) => {
    const subjectId = `fehler-${subject.bereich}-${subject.fach}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const stats = aggregate(subject.attempts);
    const questions = subject.attempts.map(attempt => `
        <article class="fehleranalyse-question">
          <strong>${escapeText(attempt.fach)} · ${escapeText(attempt.thema)}</strong>
          <span>Frage-ID: ${escapeText(attempt.frageId)}</span>
          <span>Letzte eigene Antwort: ${escapeText(attempt.antwort ? attempt.antwort : 'Für diesen älteren Lernversuch ist keine eigene Antwort gespeichert.')}</span>
          <span>${escapeText(attempt.erreichtePunkte)} / ${escapeText(attempt.maximalPunkte)} Punkte · ${escapeText(attempt.status)}</span>
          <span>Letzter Versuch: ${escapeText(formatDateTime(attempt.timestamp))}</span>
          <button class="secondary-btn fehleranalyse-repeat" type="button" disabled title="Für das sichere direkte Wiederholen fehlt ein vorhandener Fragenabruf nach Frage-ID.">Jetzt wiederholen</button>
        </article>
      `).join('');
    return `<article class="fehleranalyse-subject"><div class="fehleranalyse-topic"><div><strong>${escapeText(subject.fach)}</strong><span>${escapeText(subject.bereich)} · ${stats.performance}% aktuelle Leistung · ${subject.attempts.length} offene Fehler</span></div><button class="secondary-btn fehleranalyse-toggle" type="button" aria-expanded="false" aria-controls="${subjectId}">Offene Fehler anzeigen (${subject.attempts.length})</button></div><div id="${subjectId}" class="fehleranalyse-questions" hidden>${questions}</div></article>`;
  }).join('');

  document.getElementById('fehleranalyseListe').innerHTML = `
    <section class="lernstand-metrics">${renderMetric('Offene Fehler', latestErrors.length, `${partial} teilweise richtig · ${incorrect} falsch`)}${renderMetric('Teilweise richtig', partial)}${renderMetric('Falsch', incorrect)}</section>
    <section class="lernstand-section"><h2 class="section-title">Offene Fehler nach Fach und Thema</h2>${groupedErrors || '<div class="result-list-empty">Keine offenen Fehler. Gut gemacht.</div>'}</section>
  `;

  document.querySelectorAll('.fehleranalyse-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      button.textContent = panel.hidden ? `Offene Fehler anzeigen (${panel.children.length})` : 'Offene Fehler ausblenden';
    });
  });
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
    <section class="lernstand-section"><h2 class="section-title">Lernstand nach Fach</h2><div class="lernstand-subject-list">${subjects.map(subject => renderSubject(subject, latest, catalog)).join('')}</div></section>
    <section class="lernstand-section"><h2 class="section-title">Meine Entwicklung</h2>${renderDevelopment(attempts)}</section>
    <section class="lernstand-section lernstand-strength-grid"><div><h2 class="section-title">Meine stärksten Themen</h2>${themeLists.strongest}</div><div><h2 class="section-title">Hier lohnt sich Wiederholen</h2>${themeLists.repeat}</div></section>
    <section class="lernstand-section"><h2 class="section-title">Deine offenen Fehler</h2><p>${current.errors.length} offene Fehler: ${partial} teilweise richtig · ${incorrect} falsch</p><button class="secondary-btn lernstand-error-button" type="button" onclick="oeffneLernstandBereich('lernstandFehlerView')">Zur Fehleranalyse</button></section>
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
  status.textContent = 'Fehleranalyse wird geladen...';
  list.innerHTML = '<div class="result-list-empty">Bitte kurz warten...</div>';
  try {
    const attempts = await loadAttempts(user);
    if (auth.currentUser !== user) return;
    renderErrorAnalysis(attempts);
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
