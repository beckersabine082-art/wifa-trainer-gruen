import {
  auth,
  db,
  collection,
  getDocs,
  query,
  orderBy
} from './firebase-config.js';

const MODULE_ID = 'quiz';

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

async function loadQuizCatalogSize() {
  const result = await window.apiGet('quizCatalog');
  if (!result.success) throw new Error(result.error || 'Quizkatalog konnte nicht geladen werden.');
  return Array.isArray(result.data) ? result.data.length : 0;
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
    const [attempts, katalogGroesse] = await Promise.all([
      loadQuizAttempts(user),
      loadQuizCatalogSize()
    ]);
    if (auth.currentUser !== user) return;

    const latest = latestPerQuizKey(attempts);
    if (!latest.length) {
      inhalt.innerHTML = '<div class="result-list-empty">Noch keine Quizfragen beantwortet.</div>';
      status.textContent = 'Noch keine Quizversuche gespeichert.';
      return;
    }

    const richtigAnzahl = latest.filter(attempt => attempt.richtig === true).length;
    const falschAnzahl = latest.length - richtigAnzahl;

    inhalt.innerHTML = '';
    inhalt.appendChild(renderDonut(richtigAnzahl, falschAnzahl));

    const text = document.createElement('p');
    text.className = 'quizlernstand-fortschritt';
    text.textContent = `${latest.length} von ${katalogGroesse} Fragen bearbeitet`;
    inhalt.appendChild(text);

    status.textContent = `${latest.length} bearbeitete Quizfrage(n) geladen.`;
  } catch (error) {
    status.textContent = `Lernstand konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
    inhalt.innerHTML = '<div class="result-list-empty">Der Quiz-Lernstand ist derzeit nicht verfügbar.</div>';
  }
}

window.ladeQuizLernstand = ladeQuizLernstand;
