import {
  auth,
  db,
  doc,
  collection,
  getDocs,
  serverTimestamp,
  query,
  orderBy
} from './firebase-config.js';
import {
  limit as firestoreLimit,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const MODULE_ID = 'pruefungssimulation';
const BERLIN_TIME_ZONE = 'Europe/Berlin';
const MAX_EXAM_ATTEMPTS = 100;
const MAX_TASKS_PER_ATTEMPT = 100;

const taskCache = new Map();
let examAttemptsInteractionsBound = false;

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function currentVerifiedUser() {
  const user = auth.currentUser;
  return user && user.emailVerified === true ? user : null;
}

function timestampMillis(timestamp) {
  return timestamp && typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : 0;
}

function formatDateTime(timestamp) {
  const date = timestamp && typeof timestamp.toDate === 'function' ? timestamp.toDate() : null;
  return date ? new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date) : 'Zeitpunkt nicht verfügbar';
}

function renderMetric(label, value, detail = '') {
  return `<div class="lernstand-metric"><div class="lernstand-metric-label">${escapeText(label)}</div><div class="lernstand-metric-value">${escapeText(value)}</div><div class="lernstand-metric-detail">${escapeText(detail)}</div></div>`;
}

export async function speicherePruefungsAttempt(payload) {
  const user = currentVerifiedUser();
  if (!user) throw new Error('Bitte melde dich mit einem bestätigten Konto an, um den Lernstand zu speichern.');
  if (!payload || typeof payload !== 'object') throw new Error('Es liegen keine speicherbaren Prüfungsdaten vor.');

  const teilbereich = String(payload.teilbereich || '');
  const simulation = String(payload.simulation || '');
  if (!['WQ', 'HQ'].includes(teilbereich)) throw new Error('Ungültiger Teilbereich.');
  if (!['1', '2', '3', '4'].includes(simulation)) throw new Error('Ungültige Simulationsnummer.');

  const einheit = String(payload.einheit || '').trim();
  if (!einheit) throw new Error('Prüfungseinheit fehlt.');
  const einheitLabel = String(payload.einheitLabel || einheit).trim().slice(0, 200);

  const gesamtMaxPunkte = Math.max(0, Number(payload.gesamtMaxPunkte || 0));
  if (gesamtMaxPunkte <= 0) throw new Error('Die Bewertung enthält keine speicherbaren Punktwerte.');
  const gesamtPunkte = Math.min(Math.max(0, Number(payload.gesamtPunkte || 0)), gesamtMaxPunkte);
  const prozent = Math.round((gesamtPunkte / gesamtMaxPunkte) * 100);
  const status = prozent >= 50 ? 'bestanden' : 'nicht_bestanden';

  const tasks = Array.isArray(payload.tasks) ? payload.tasks.slice(0, MAX_TASKS_PER_ATTEMPT) : [];
  if (!tasks.length) throw new Error('Es liegen keine bewerteten Aufgaben vor.');

  const examAttemptReference = doc(collection(db, 'users', user.uid, 'examAttempts'));
  const summary = {
    attemptId: examAttemptReference.id,
    userId: user.uid,
    modul: MODULE_ID,
    timestamp: serverTimestamp(),
    teilbereich,
    simulation,
    einheit: einheit.slice(0, 50),
    einheitLabel,
    gesamtPunkte,
    gesamtMaxPunkte,
    prozent,
    status,
    aufgabenAnzahl: tasks.length
  };

  const batch = writeBatch(db);
  batch.set(examAttemptReference, summary);

  tasks.forEach(task => {
    const taskReference = doc(collection(db, 'users', user.uid, 'examAttempts', examAttemptReference.id, 'tasks'));
    const maxPunkte = Math.max(0, Number(task?.maxPunkte || 0));
    const punkte = Math.min(Math.max(0, Number(task?.punkte || 0)), maxPunkte);
    batch.set(taskReference, {
      taskAttemptId: taskReference.id,
      examAttemptId: examAttemptReference.id,
      userId: user.uid,
      simulationId: String(task?.simulationId || '').slice(0, 100),
      aufgabe: String(task?.aufgabe || '').slice(0, 20),
      teilaufgabe: String(task?.teilaufgabe || '').slice(0, 20),
      fach: String(task?.fach || '').slice(0, 100),
      thema: String(task?.thema || '').slice(0, 200),
      fragetyp: String(task?.fragetyp || 'text').slice(0, 30),
      frage: String(task?.frage || '').slice(0, 4000),
      antwort: String(task?.antwort || '').slice(0, 20000),
      punkte,
      maxPunkte,
      // ergebnis ist beim Apps Script ein ausführlicher Feedbacktext, kein Enum-Wert
      ergebnis: String(task?.ergebnis || '').slice(0, 20000),
      erkannte: Array.isArray(task?.erkannte) ? task.erkannte.map(String).slice(0, 30) : [],
      fehlende: Array.isArray(task?.fehlende) ? task.fehlende.map(String).slice(0, 30) : [],
      musterloesung: String(task?.musterloesung || '').slice(0, 8000),
      hatSkizze: Boolean(task?.hatSkizze)
    });
  });

  await batch.commit();
  taskCache.clear();
}

async function loadExamAttempts(user) {
  const examAttemptsQuery = query(
    collection(db, 'users', user.uid, 'examAttempts'),
    orderBy('timestamp', 'desc'),
    firestoreLimit(MAX_EXAM_ATTEMPTS)
  );
  const snapshot = await getDocs(examAttemptsQuery);
  return snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
}

async function loadExamTasks(userId, examAttemptId) {
  if (!taskCache.has(examAttemptId)) {
    const request = getDocs(collection(db, 'users', userId, 'examAttempts', examAttemptId, 'tasks'))
      .then(snapshot => snapshot.docs.map(documentSnapshot => ({ id: documentSnapshot.id, ...documentSnapshot.data() })))
      .catch(error => {
        taskCache.delete(examAttemptId);
        throw error;
      });
    taskCache.set(examAttemptId, request);
  }
  return taskCache.get(examAttemptId);
}

function aggregateStats(attempts) {
  if (!attempts.length) return { count: 0, avg: 0, best: 0, last: 0 };
  const percentages = attempts.map(attempt => Number(attempt.prozent || 0));
  const newestFirst = [...attempts].sort((first, second) => timestampMillis(second.timestamp) - timestampMillis(first.timestamp));
  return {
    count: attempts.length,
    avg: Math.round(percentages.reduce((sum, value) => sum + value, 0) / attempts.length),
    best: Math.max(...percentages),
    last: Number(newestFirst[0].prozent || 0)
  };
}

function renderTeilbereichOverview(teilbereich, attempts, einheiten) {
  const teilbereichAttempts = attempts.filter(attempt => attempt.teilbereich === teilbereich);
  const gesamt = aggregateStats(teilbereichAttempts);
  const panelId = `pruefungslernstand-einheiten-${teilbereich}`;

  const einheitenHtml = einheiten.map(einheit => {
    const einheitAttempts = teilbereichAttempts.filter(attempt => attempt.einheit === einheit.key);
    const stats = aggregateStats(einheitAttempts);
    return `<div class="pruefungslernstand-einheit">
      <strong>${escapeText(einheit.label || einheit.key)}</strong>
      <span>${stats.count} Simulationen</span>
      <span>Durchschnitt: ${stats.count ? stats.avg + '%' : '–'}</span>
      <span>Bestwert: ${stats.count ? stats.best + '%' : '–'}</span>
      <span>Letzter Wert: ${stats.count ? stats.last + '%' : '–'}</span>
    </div>`;
  }).join('') || '<div class="result-list-empty">Kein Aufgabenkatalog verfügbar.</div>';

  return `
    <div class="pruefungslernstand-teilbereich">
      <h3>${escapeText(teilbereich)}</h3>
      <div class="lernstand-metrics">
        ${renderMetric('Abgeschlossene Simulationen', gesamt.count)}
        ${renderMetric('Durchschnitt', gesamt.count ? gesamt.avg + '%' : '–')}
        ${renderMetric('Bestwert', gesamt.count ? gesamt.best + '%' : '–')}
        ${renderMetric('Letzter Wert', gesamt.count ? gesamt.last + '%' : '–')}
      </div>
      <button class="secondary-btn" type="button" data-action="toggle-panel" data-target="${panelId}" aria-expanded="false" aria-controls="${panelId}">Einheiten anzeigen</button>
      <div id="${panelId}" class="pruefungslernstand-einheiten" hidden>${einheitenHtml}</div>
    </div>
  `;
}

// Kategorialer Status wird nur zur Anzeige berechnet, nicht gespeichert
function kategorialerAufgabenStatus(punkte, maxPunkte) {
  const points = Number(punkte || 0);
  const maximum = Number(maxPunkte || 0);
  if (maximum > 0 && points >= maximum) return 'richtig';
  if (points > 0) return 'teilweise richtig';
  return 'falsch';
}

function renderTaskList(tasks) {
  if (!tasks.length) return '<div class="result-list-empty">Keine Einzelaufgaben gespeichert.</div>';
  return tasks.map(task => {
    const erkannte = Array.isArray(task.erkannte) ? task.erkannte : [];
    const fehlende = Array.isArray(task.fehlende) ? task.fehlende : [];
    const status = kategorialerAufgabenStatus(task.punkte, task.maxPunkte);
    return `
      <div class="pruefungslernstand-task">
        <strong>Aufgabe ${escapeText(task.aufgabe)}${escapeText(task.teilaufgabe)}</strong>
        <p>${escapeText(task.frage)}</p>
        <p><strong>Deine Antwort:</strong><br>${escapeText(task.antwort || 'keine schriftliche Ergänzung')}</p>
        <p>${escapeText(task.punkte)} / ${escapeText(task.maxPunkte)} Punkte · ${escapeText(status)}</p>
        ${task.ergebnis ? `<p><strong>Ergebnis:</strong><br>${escapeText(task.ergebnis)}</p>` : ''}
        ${erkannte.length ? `<p><strong>Erkannte Stichpunkte:</strong><br>${erkannte.map(escapeText).join(', ')}</p>` : ''}
        ${fehlende.length ? `<p><strong>Fehlende Stichpunkte:</strong><br>${fehlende.map(escapeText).join(', ')}</p>` : ''}
        <p><strong>Musterlösung:</strong><br>${escapeText(task.musterloesung || 'Keine Musterlösung hinterlegt.')}</p>
        ${task.hatSkizze ? '<p class="pruefungslernstand-skizzen-hinweis">Für diese Aufgabe wurde eine Skizze abgegeben. Die Bilddatei wird im Lernstand derzeit nicht gespeichert.</p>' : ''}
      </div>
    `;
  }).join('');
}

function renderHistoryEntry(attempt) {
  const detailId = `pruefungslernstand-detail-${attempt.id}`;
  const statusText = attempt.status === 'bestanden' ? 'Bestanden' : 'Nicht bestanden';
  return `
    <article class="pruefungslernstand-entry">
      <div class="pruefungslernstand-entry-head">
        <span>${escapeText(formatDateTime(attempt.timestamp))}</span>
        <span>${escapeText(attempt.teilbereich)}</span>
        <span>${escapeText(attempt.einheitLabel || attempt.einheit)}</span>
        <span>Simulation ${escapeText(attempt.simulation)}</span>
      </div>
      <div class="pruefungslernstand-entry-score">
        <span>${escapeText(attempt.gesamtPunkte)} / ${escapeText(attempt.gesamtMaxPunkte)} Punkte</span>
        <span>${escapeText(attempt.prozent)}%</span>
        <span class="pruefungslernstand-status pruefungslernstand-status-${escapeText(attempt.status)}">${escapeText(statusText)}</span>
      </div>
      <button class="secondary-btn" type="button" data-action="toggle-insight" data-exam-id="${escapeText(attempt.id)}" data-target="${detailId}" aria-expanded="false" aria-controls="${detailId}">Prüfungseinsicht anzeigen</button>
      <div id="${detailId}" class="pruefungslernstand-detail" hidden></div>
    </article>
  `;
}

function bindExamAttemptsInteractions(user) {
  const container = document.getElementById('pruefungslernstandListe');
  if (!container || examAttemptsInteractionsBound) return;
  examAttemptsInteractionsBound = true;

  container.addEventListener('click', async event => {
    const panelToggle = event.target.closest('button[data-action="toggle-panel"]');
    if (panelToggle) {
      const panel = document.getElementById(panelToggle.dataset.target);
      if (!panel) return;
      panel.hidden = !panel.hidden;
      panelToggle.setAttribute('aria-expanded', String(!panel.hidden));
      panelToggle.textContent = panel.hidden ? 'Einheiten anzeigen' : 'Einheiten ausblenden';
      return;
    }

    const insightToggle = event.target.closest('button[data-action="toggle-insight"]');
    if (!insightToggle) return;

    const panel = document.getElementById(insightToggle.dataset.target);
    if (!panel) return;

    if (!panel.hidden) {
      panel.hidden = true;
      insightToggle.setAttribute('aria-expanded', 'false');
      insightToggle.textContent = 'Prüfungseinsicht anzeigen';
      return;
    }

    panel.hidden = false;
    insightToggle.setAttribute('aria-expanded', 'true');

    if (panel.dataset.loaded === 'true') return;

    insightToggle.disabled = true;
    insightToggle.textContent = 'Wird geladen...';
    try {
      const tasks = await loadExamTasks(user.uid, insightToggle.dataset.examId);
      panel.innerHTML = renderTaskList(tasks);
      panel.dataset.loaded = 'true';
      insightToggle.textContent = 'Prüfungseinsicht ausblenden';
    } catch (error) {
      panel.innerHTML = `<div class="result-list-empty">Prüfungseinsicht konnte nicht geladen werden: ${escapeText(error.message || 'Unbekannter Fehler.')}</div>`;
      panel.hidden = true;
      insightToggle.setAttribute('aria-expanded', 'false');
      insightToggle.textContent = 'Prüfungseinsicht anzeigen';
    } finally {
      insightToggle.disabled = false;
    }
  });
}

export async function ladePruefungsLernstand() {
  const status = document.getElementById('pruefungslernstandStatus');
  const list = document.getElementById('pruefungslernstandListe');
  const user = currentVerifiedUser();
  if (!status || !list || !user) return;

  status.textContent = 'Lernstand wird geladen...';
  list.innerHTML = '<div class="result-list-empty">Bitte kurz warten...</div>';

  try {
    const attempts = await loadExamAttempts(user);
    if (auth.currentUser !== user) return;

    const katalog = typeof window.getPruefungsEinheitenNachTeilbereich === 'function'
      ? window.getPruefungsEinheitenNachTeilbereich() || {}
      : {};

    const overviewHtml = `
      ${renderTeilbereichOverview('WQ', attempts, katalog.WQ || [])}
      ${renderTeilbereichOverview('HQ', attempts, katalog.HQ || [])}
    `;

    const historyHtml = attempts.length
      ? attempts.map(renderHistoryEntry).join('')
      : '<div class="result-list-empty">Noch keine abgeschlossene Prüfungssimulation gespeichert.</div>';

    list.innerHTML = `
      <section class="lernstand-section pruefungslernstand-overview">${overviewHtml}</section>
      <section class="lernstand-section"><h2 class="section-title">Historie</h2>${historyHtml}</section>
    `;

    bindExamAttemptsInteractions(user);
    status.textContent = attempts.length
      ? `${attempts.length} Prüfungssimulation(en) geladen.`
      : 'Noch keine abgeschlossene Prüfungssimulation gespeichert.';
  } catch (error) {
    status.textContent = `Lernstand konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
    list.innerHTML = '<div class="result-list-empty">Der Lernstand ist derzeit nicht verfügbar.</div>';
  }
}

window.speicherePruefungsAttempt = speicherePruefungsAttempt;
window.ladePruefungsLernstand = ladePruefungsLernstand;
