import {
  auth,
  db,
  collection,
  getDocs,
  query,
  orderBy
} from './firebase-config.js';

const MODULE_ID = 'quiz';
const BERLIN_TIME_ZONE = 'Europe/Berlin';
let quizLernstandDaten = null;

function currentVerifiedUser() {
  const user = auth.currentUser;
  return user && user.emailVerified === true ? user : null;
}

async function loadQuizAttempts(user) {
  const attemptsQuery = query(collection(db, 'users', user.uid, 'quizAttempts'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(attemptsQuery);
  return snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
    .filter(attempt => attempt.modul === MODULE_ID && attempt.userId === user.uid);
}

// Versuche kommen bereits nach timestamp absteigend sortiert -> der erste Treffer je quizKey ist automatisch der neueste
function latestPerQuizKey(attempts) {
  const latest = new Map();
  attempts.forEach(attempt => {
    const key = String(attempt.quizKey || '').trim();
    if (key && !latest.has(key)) latest.set(key, attempt);
  });
  return [...latest.values()];
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

function formatDay(day) {
  const date = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatDate(timestamp) {
  const date = timestamp && typeof timestamp.toDate === 'function' ? timestamp.toDate() : null;
  return date ? new Intl.DateTimeFormat('de-DE', { timeZone: BERLIN_TIME_ZONE, dateStyle: 'medium' }).format(date) : 'Noch keine Quiz-Aktivität';
}

async function loadQuizCatalog() {
  const result = await window.apiGet('quizCatalog');
  if (!result.success) throw new Error(result.error || 'Quizkatalog konnte nicht geladen werden.');
  return Array.isArray(result.data) ? result.data : [];
}

function renderDonut(richtigAnzahl, falschAnzahl) {
  const gesamt = richtigAnzahl + falschAnzahl;
  const richtigProzent = gesamt > 0 ? Math.round((richtigAnzahl / gesamt) * 100) : 0;
  const falschProzent = gesamt > 0 ? 100 - richtigProzent : 0;
  const richtigGrad = gesamt > 0 ? (richtigAnzahl / gesamt) * 360 : 0;

  const container = document.createElement('div');
  container.className = 'quizlernstand-chart';

  const wrapper = document.createElement('div');
  wrapper.className = 'quizlernstand-donut-wrap';

  const donut = document.createElement('div');
  donut.className = 'quizlernstand-donut';
  donut.style.background = gesamt > 0
    ? `conic-gradient(#2f7d4c 0deg ${richtigGrad}deg, #dc2626 ${richtigGrad}deg 360deg)`
    : '#d8f0df';

  const hole = document.createElement('div');
  hole.className = 'quizlernstand-donut-hole';
  const holeValue = document.createElement('strong');
  holeValue.textContent = `${richtigProzent}%`;
  const holeLabel = document.createElement('span');
  holeLabel.textContent = 'richtig';
  hole.appendChild(holeValue);
  hole.appendChild(holeLabel);

  donut.appendChild(hole);
  wrapper.appendChild(donut);

  const legende = document.createElement('div');
  legende.className = 'quizlernstand-legende';

  const richtigZeile = document.createElement('div');
  const richtigDot = document.createElement('span');
  richtigDot.className = 'quizlernstand-dot quizlernstand-dot-richtig';
  richtigZeile.appendChild(richtigDot);
  richtigZeile.appendChild(document.createTextNode(`Richtig: ${richtigAnzahl} (${richtigProzent}%)`));

  const falschZeile = document.createElement('div');
  const falschDot = document.createElement('span');
  falschDot.className = 'quizlernstand-dot quizlernstand-dot-falsch';
  falschZeile.appendChild(falschDot);
  falschZeile.appendChild(document.createTextNode(`Falsch: ${falschAnzahl} (${falschProzent}%)`));

  legende.appendChild(richtigZeile);
  legende.appendChild(falschZeile);

  container.appendChild(wrapper);
  container.appendChild(legende);
  return container;
}

function renderDailyChart(title, days, valueLabel, valueMax, type) {
  const width = 620;
  const height = 220;
  const left = 42;
  const right = 12;
  const top = 18;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = valueMax || 1;
  const step = days.length > 1 ? chartWidth / (days.length - 1) : chartWidth / 2;
  const x = index => days.length > 1 ? left + index * step : left + chartWidth / 2;
  const y = value => top + chartHeight - (value / max) * chartHeight;
  const grid = [0, 0.5, 1].map(ratio => {
    const value = Math.round(max * ratio);
    const lineY = y(value);
    return `<line class="quizlernstand-chart-grid" x1="${left}" y1="${lineY}" x2="${width - right}" y2="${lineY}"></line><text class="quizlernstand-chart-y-label" x="${left - 6}" y="${lineY + 4}">${valueLabel === '%' ? value + '%' : value}</text>`;
  }).join('');
  const labels = days.map((entry, index) => `<text class="quizlernstand-chart-x-label" x="${x(index)}" y="${height - 10}">${formatDay(entry.day)}</text>`).join('');
  let marks = '';
  if (type === 'bar') {
    const barWidth = Math.max(8, Math.min(34, chartWidth / Math.max(days.length, 1) * 0.6));
    marks = days.map((entry, index) => {
      const barHeight = Math.max(0, chartHeight - (y(entry.value) - top));
      return `<rect class="quizlernstand-chart-bar" x="${x(index) - barWidth / 2}" y="${y(entry.value)}" width="${barWidth}" height="${barHeight}" rx="2"></rect>`;
    }).join('');
  } else {
    const points = days.map((entry, index) => `${x(index)},${y(entry.value)}`).join(' ');
    marks = `<polyline class="quizlernstand-chart-line" points="${points}"></polyline>${days.map((entry, index) => `<circle class="quizlernstand-chart-point" cx="${x(index)}" cy="${y(entry.value)}" r="4"></circle>`).join('')}`;
  }
  const container = document.createElement('section');
  container.className = 'quizlernstand-daily-chart';
  container.innerHTML = `<h3>${title}</h3><div class="quizlernstand-chart-scroll"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><line class="quizlernstand-chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}"></line><line class="quizlernstand-chart-axis" x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}"></line>${grid}${marks}${labels}</svg></div>`;
  return container;
}

function groupByDay(attempts, valueForAttempt) {
  const grouped = new Map();
  attempts.forEach(attempt => {
    const day = berlinDay(attempt.timestamp);
    if (!day) return;
    const entry = grouped.get(day) || { total: 0, sum: 0 };
    entry.total += 1;
    entry.sum += valueForAttempt(attempt);
    grouped.set(day, entry);
  });
  return [...grouped.entries()].sort(([first], [second]) => first.localeCompare(second));
}

function renderDailyCharts(attempts) {
  const activity = groupByDay(attempts, () => 1).map(([day, entry]) => ({ day, value: entry.total }));
  const performance = groupByDay(attempts, attempt => attempt.richtig === true ? 100 : 0)
    .map(([day, entry]) => ({ day, value: Math.round(entry.sum / entry.total) }));
  const container = document.createElement('div');
  container.className = 'quizlernstand-daily-grid';
  if (activity.length) container.appendChild(renderDailyChart('Quiz-Aktivität pro Tag', activity, '', Math.max(...activity.map(entry => entry.value)), 'bar'));
  if (performance.length) container.appendChild(renderDailyChart('Quiz-Leistung pro Tag', performance, '%', 100, 'line'));
  return container;
}

function renderSubjectSummary(attempts) {
  const subjects = new Map();
  attempts.forEach(attempt => {
    const fach = String(attempt.fach || '').trim();
    if (!fach) return;
    const entry = subjects.get(fach) || { fach, total: 0, richtig: 0 };
    entry.total += 1;
    if (attempt.richtig === true) entry.richtig += 1;
    subjects.set(fach, entry);
  });
  const eligible = [...subjects.values()]
    .filter(subject => subject.total >= 5)
    .map(subject => ({ ...subject, quote: Math.round((subject.richtig / subject.total) * 100) }));
  const strongest = [...eligible].sort((first, second) => second.quote - first.quote || second.total - first.total)[0];
  const weakest = [...eligible].sort((first, second) => first.quote - second.quote || second.total - first.total)[0];

  const container = document.createElement('section');
  container.className = 'quizlernstand-subject-summary';
  [
    ['Stärkstes Fach', strongest, 'quizlernstand-summary-strong'],
    ['Schwächstes Fach', weakest, 'quizlernstand-summary-weak']
  ].forEach(([label, subject, className]) => {
    const card = document.createElement('article');
    card.className = `lernstand-metric quizlernstand-summary-card ${className}`;
    const title = document.createElement('div');
    title.className = 'lernstand-metric-label';
    title.textContent = label;
    const subjectName = document.createElement('div');
    subjectName.className = 'lernstand-metric-value quizlernstand-summary-subject';
    subjectName.textContent = subject ? subject.fach : 'Noch nicht genug Daten';
    const detail = document.createElement('div');
    detail.className = 'lernstand-metric-detail';
    detail.textContent = subject ? `${subject.quote}% richtig · ${subject.total} ausgewertete Fragen` : 'Mindestens 5 Quizfragen je Fach erforderlich';
    card.append(title, subjectName, detail);
    container.appendChild(card);
  });
  return container;
}

function renderQuizLernstand(attempts, katalogGroesse) {
  const filter = document.getElementById('quizLernstandFach');
  const fach = filter?.value || '';
  const gefiltert = fach ? attempts.filter(attempt => attempt.fach === fach) : attempts;
  const latest = latestPerQuizKey(gefiltert);
  const richtigAnzahl = latest.filter(attempt => attempt.richtig === true).length;
  const falschAnzahl = latest.length - richtigAnzahl;
  const inhalt = document.getElementById('quizLernstandInhalt');
  inhalt.innerHTML = '';
  if (!fach) inhalt.appendChild(renderSubjectSummary(attempts));
  if (!gefiltert.length) {
    inhalt.innerHTML = '<div class="result-list-empty">Noch keine Quizfragen für dieses Fach beantwortet.</div>';
    return;
  }
  const letzteAktivitaet = [...gefiltert].sort((first, second) => timestampMillis(second.timestamp) - timestampMillis(first.timestamp))[0];
  const metrics = document.createElement('section');
  metrics.className = 'lernstand-metrics';
  metrics.innerHTML = `<div class="lernstand-metric"><div class="lernstand-metric-label">Letzte Aktivität</div><div class="lernstand-metric-value">${formatDate(letzteAktivitaet.timestamp)}</div><div class="lernstand-metric-detail">${gefiltert.length} gespeicherte Quiz-Versuche</div></div>`;
  inhalt.appendChild(metrics);
  inhalt.appendChild(renderDonut(richtigAnzahl, falschAnzahl));
  const progress = document.createElement('p');
  progress.className = 'quizlernstand-fortschritt';
  const fachKatalogGroesse = fach ? katalogGroesse.filter(item => item.fach === fach).length : katalogGroesse.length;
  progress.textContent = `${latest.length} von ${fachKatalogGroesse} Fragen bearbeitet`;
  inhalt.appendChild(progress);
  inhalt.appendChild(renderDailyCharts(gefiltert));
}

function populateSubjectFilter(attempts, katalog) {
  const filter = document.getElementById('quizLernstandFach');
  if (!filter) return;
  const faecher = [...new Set([...katalog, ...attempts].map(item => String(item.fach || '').trim()).filter(Boolean))].sort((first, second) => first.localeCompare(second, 'de'));
  filter.replaceChildren(new Option('Alle Fächer', ''), ...faecher.map(fach => new Option(fach, fach)));
  filter.onchange = () => renderQuizLernstand(quizLernstandDaten.attempts, quizLernstandDaten.katalog);
}

export async function ladeQuizLernstand() {
  const status = document.getElementById('quizLernstandStatus');
  const inhalt = document.getElementById('quizLernstandInhalt');
  if (!status || !inhalt) return;

  const user = currentVerifiedUser();
  if (!user) {
    status.textContent = 'Bitte melde dich mit einem bestätigten Konto an, um deinen Quiz-Lernstand zu sehen.';
    inhalt.innerHTML = '';
    return;
  }

  status.textContent = 'Lernstand wird geladen...';
  inhalt.innerHTML = '<div class="result-list-empty">Bitte kurz warten...</div>';

  try {
    const [attempts, katalog] = await Promise.all([
      loadQuizAttempts(user),
      loadQuizCatalog()
    ]);
    if (auth.currentUser !== user) return;

    quizLernstandDaten = { attempts, katalog };
    populateSubjectFilter(attempts, quizLernstandDaten.katalog);
    if (!attempts.length) {
      inhalt.innerHTML = '<div class="result-list-empty">Noch keine Quizfragen beantwortet.</div>';
      status.textContent = 'Noch keine Quizversuche gespeichert.';
      return;
    }
    renderQuizLernstand(attempts, quizLernstandDaten.katalog);
    status.textContent = `${attempts.length} gespeicherte Quiz-Versuche geladen.`;
  } catch (error) {
    status.textContent = `Lernstand konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
    inhalt.innerHTML = '<div class="result-list-empty">Der Quiz-Lernstand ist derzeit nicht verfügbar.</div>';
  }
}

window.ladeQuizLernstand = ladeQuizLernstand;
