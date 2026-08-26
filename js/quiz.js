import {
  auth,
  db,
  collection,
  doc,
  setDoc,
  serverTimestamp
} from './firebase-config.js';

const MODULE_ID = 'quiz';
const OPTION_IDS = ['A', 'B', 'C', 'D'];

let katalog = null;
let katalogLadung = null;
let rundenReihenfolge = [];
let rundenNummer = 0;
let fragenIndex = 0;
let letzteFrageAlterRunde = null;
let aktuellerKatalogEintrag = null;
let aktuelleFrage = null;
let antwortGespeichert = false;
let letzteAuswahl = null;
let ladeToken = 0;
let quizInteraktionenGebunden = false;
let quizFach = '';

const sitzungsStatistik = { richtig: 0, falsch: 0 };

function currentVerifiedUser() {
  const user = auth.currentUser;
  return user && user.emailVerified === true ? user : null;
}

function mischen(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function ladeKatalog() {
  if (katalog) return katalog;
  if (!katalogLadung) {
    katalogLadung = window.apiGet('quizCatalog').then(result => {
      if (!result.success) throw new Error(result.error || 'Quizkatalog konnte nicht geladen werden.');
      const data = Array.isArray(result.data) ? result.data : [];
      katalog = data.filter(item => item && item.quizKey && item.fach && item.frageId);
      return katalog;
    }).catch(error => {
      katalogLadung = null;
      throw error;
    });
  }
  return katalogLadung;
}

function neuerFragenpool() {
  const gefiltert = quizFach ? katalog.filter(item => item.fach === quizFach) : katalog;
  return [...new Map(gefiltert.map(item => [item.quizKey, item])).values()];
}

function neueRunde() {
  let neu = mischen(neuerFragenpool());
  if (neu.length > 1 && letzteFrageAlterRunde && neu[0].quizKey === letzteFrageAlterRunde) {
    const swapIndex = 1 + Math.floor(Math.random() * (neu.length - 1));
    [neu[0], neu[swapIndex]] = [neu[swapIndex], neu[0]];
  }
  rundenReihenfolge = neu;
  rundenNummer += 1;
  fragenIndex = 0;
}

function befuelleQuizModus() {
  const modus = document.getElementById('quizModus');
  if (!modus || !katalog) return;

  const faecher = [...new Set(katalog.map(item => String(item.fach || '').trim()).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, 'de'));
  modus.replaceChildren(
    new Option('🎲 Alle Fächer – Zufallsmix', ''),
    ...faecher.map(fach => new Option(fach, fach))
  );
  modus.value = quizFach;
}

async function wechsleQuizmodus(event) {
  quizFach = event.target.value;
  ladeToken += 1;
  aktuelleFrage = null;
  aktuellerKatalogEintrag = null;
  antwortGespeichert = false;
  letzteAuswahl = null;
  letzteFrageAlterRunde = null;
  rundenNummer = 0;
  neueRunde();

  const status = document.getElementById('quizStatus');
  const karte = document.getElementById('quizKarte');
  if (karte) karte.hidden = true;
  if (status) status.textContent = '';
  await zeigeAktuelleFrage();
}

function setQuizButtonsDisabled(disabled) {
  const pruefenBtn = document.getElementById('quizPruefenBtn');
  if (pruefenBtn) pruefenBtn.disabled = disabled;
}

function setNaechsteSichtbar(sichtbar) {
  const naechsteBtn = document.getElementById('quizNaechsteBtn');
  if (naechsteBtn) naechsteBtn.hidden = !sichtbar;
}

function hideErgebnis() {
  const ergebnisBereich = document.getElementById('quizErgebnisBereich');
  if (!ergebnisBereich) return;
  ergebnisBereich.hidden = true;
  ergebnisBereich.textContent = '';
  ergebnisBereich.classList.remove('quiz-ergebnis-richtig', 'quiz-ergebnis-falsch');
}

function zeigeErgebnis(richtig, richtigeOption) {
  const ergebnisBereich = document.getElementById('quizErgebnisBereich');
  if (!ergebnisBereich) return;
  ergebnisBereich.textContent = richtig ? 'Richtig!' : `Falsch. Die richtige Antwort ist Option ${richtigeOption}.`;
  ergebnisBereich.classList.toggle('quiz-ergebnis-richtig', richtig);
  ergebnisBereich.classList.toggle('quiz-ergebnis-falsch', !richtig);
  ergebnisBereich.hidden = false;
}

function markiereOptionen(ausgewaehlteOption, richtigeOption) {
  document.querySelectorAll('#quizOptionen .quiz-option').forEach(label => {
    const optionId = label.dataset.optionId;
    label.classList.remove('quiz-option-richtig', 'quiz-option-falsch');
    if (optionId === richtigeOption) {
      label.classList.add('quiz-option-richtig');
    } else if (optionId === ausgewaehlteOption) {
      label.classList.add('quiz-option-falsch');
    }
  });
}

function aktualisiereSitzungsStatistik(richtig) {
  if (richtig) sitzungsStatistik.richtig += 1;
  else sitzungsStatistik.falsch += 1;
  const richtigEl = document.getElementById('quizAnzahlRichtig');
  const falschEl = document.getElementById('quizAnzahlFalsch');
  if (richtigEl) richtigEl.textContent = String(sitzungsStatistik.richtig);
  if (falschEl) falschEl.textContent = String(sitzungsStatistik.falsch);
}

function renderFrage() {
  const q = aktuelleFrage;
  const runde = document.getElementById('quizRunde');
  const nummer = document.getElementById('quizFragenNummer');
  const groesse = document.getElementById('quizRundenGroesse');
  if (runde) runde.textContent = String(rundenNummer);
  if (nummer) nummer.textContent = String(fragenIndex + 1);
  if (groesse) groesse.textContent = String(rundenReihenfolge.length);

  const badgeTeilbereich = document.getElementById('quizBadgeTeilbereich');
  const badgeFach = document.getElementById('quizBadgeFach');
  const badgeThema = document.getElementById('quizBadgeThema');
  if (badgeTeilbereich) badgeTeilbereich.textContent = String(q.teilbereich || '');
  if (badgeFach) badgeFach.textContent = String(q.fach || '');
  if (badgeThema) badgeThema.textContent = String(q.thema || '');

  const frageText = document.getElementById('quizFrageText');
  if (frageText) frageText.textContent = String(q.frage || '');

  const container = document.getElementById('quizOptionen');
  if (container) {
    container.innerHTML = '';
    const antworten = Array.isArray(q.antworten) ? q.antworten : [];
    antworten.forEach(option => {
      const optionId = String(option?.id || '').trim();
      if (!OPTION_IDS.includes(optionId)) return;

      const label = document.createElement('label');
      label.className = 'quiz-option';
      label.dataset.optionId = optionId;

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'quizOption';
      input.value = optionId;
      input.id = `quizOption${optionId}`;

      const letter = document.createElement('span');
      letter.className = 'quiz-option-letter';
      letter.textContent = optionId;

      const text = document.createElement('span');
      text.className = 'quiz-option-text';
      text.textContent = String(option?.text || '');

      label.appendChild(input);
      label.appendChild(letter);
      label.appendChild(text);
      container.appendChild(label);
    });
  }

  const pruefenBtn = document.getElementById('quizPruefenBtn');
  if (pruefenBtn) {
    pruefenBtn.disabled = false;
    pruefenBtn.textContent = 'Antwort prüfen';
    delete pruefenBtn.dataset.retry;
  }
}

async function zeigeAktuelleFrage() {
  const status = document.getElementById('quizStatus');
  const karte = document.getElementById('quizKarte');
  const eintrag = rundenReihenfolge[fragenIndex];
  aktuellerKatalogEintrag = eintrag;
  aktuelleFrage = null;
  antwortGespeichert = false;
  letzteAuswahl = null;
  const token = ++ladeToken;

  setQuizButtonsDisabled(true);
  setNaechsteSichtbar(false);
  hideErgebnis();
  if (karte) karte.hidden = true;
  if (status) status.textContent = 'Frage wird geladen. Beim ersten Aufruf einer Frage kann dies einige Sekunden dauern...';

  try {
    const result = await window.apiGet('quizQuestion', { fach: eintrag.fach, frageId: eintrag.frageId });
    if (token !== ladeToken) return;
    if (!result.success) throw new Error(result.error || 'Die Quizfrage konnte nicht geladen werden.');
    aktuelleFrage = result.data || {};
    renderFrage();
    if (status) status.textContent = '';
    if (karte) karte.hidden = false;
  } catch (error) {
    if (token !== ladeToken) return;
    if (status) status.textContent = `Frage konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
  }
}

async function speichereQuizAttempt({ quizKey, frageId, teilbereich, fach, thema, ausgewaehlteOption, richtigeOption, richtig }) {
  const user = currentVerifiedUser();
  if (!user) throw new Error('Bitte melde dich mit einem bestätigten Konto an, um den Lernstand zu speichern.');
  if (!OPTION_IDS.includes(ausgewaehlteOption) || !OPTION_IDS.includes(richtigeOption)) {
    throw new Error('Ungültige Antwortoption.');
  }

  const attemptReference = doc(collection(db, 'users', user.uid, 'quizAttempts'));
  const attempt = {
    attemptId: attemptReference.id,
    userId: user.uid,
    modul: MODULE_ID,
    timestamp: serverTimestamp(),
    quizKey: String(quizKey || '').trim().slice(0, 200),
    frageId: String(frageId || '').trim().slice(0, 50),
    teilbereich: String(teilbereich || '').trim().slice(0, 10),
    fach: String(fach || '').trim().slice(0, 100),
    thema: String(thema || '').trim().slice(0, 200),
    ausgewaehlteOption,
    richtigeOption,
    richtig: Boolean(richtig)
  };

  await setDoc(attemptReference, attempt);
}

async function fuehreSpeicherungAus(ausgewaehlteOption, richtigeOption, richtig) {
  const status = document.getElementById('quizStatus');
  const pruefenBtn = document.getElementById('quizPruefenBtn');

  try {
    await speichereQuizAttempt({
      quizKey: aktuellerKatalogEintrag.quizKey,
      frageId: aktuellerKatalogEintrag.frageId,
      teilbereich: aktuellerKatalogEintrag.teilbereich,
      fach: aktuellerKatalogEintrag.fach,
      thema: aktuellerKatalogEintrag.thema,
      ausgewaehlteOption,
      richtigeOption,
      richtig
    });
    antwortGespeichert = true;
    aktualisiereSitzungsStatistik(richtig);
    zeigeErgebnis(richtig, richtigeOption);
    if (status) status.textContent = '';
    if (pruefenBtn) pruefenBtn.textContent = 'Antwort geprüft';
    setNaechsteSichtbar(true);
  } catch (error) {
    if (status) status.textContent = `Antwort konnte nicht gespeichert werden: ${error.message || 'Unbekannter Fehler.'}`;
    if (pruefenBtn) {
      pruefenBtn.disabled = false;
      pruefenBtn.textContent = 'Speicherung erneut versuchen';
      pruefenBtn.dataset.retry = 'true';
    }
  }
}

function pruefeAntwort() {
  if (antwortGespeichert) return;
  const pruefenBtn = document.getElementById('quizPruefenBtn');
  const status = document.getElementById('quizStatus');

  if (pruefenBtn && pruefenBtn.dataset.retry === 'true' && letzteAuswahl) {
    pruefenBtn.disabled = true;
    pruefenBtn.textContent = 'Wird gespeichert...';
    if (status) status.textContent = 'Antwort wird gespeichert...';
    fuehreSpeicherungAus(letzteAuswahl.ausgewaehlteOption, letzteAuswahl.richtigeOption, letzteAuswahl.richtig);
    return;
  }

  const selected = document.querySelector('input[name="quizOption"]:checked');
  if (!selected) {
    if (status) status.textContent = 'Bitte wähle zuerst eine Antwortmöglichkeit aus.';
    return;
  }
  if (!aktuelleFrage) return;

  const ausgewaehlteOption = selected.value;
  const richtigeOption = String(aktuelleFrage.richtigeOption || '').trim();
  const richtig = ausgewaehlteOption === richtigeOption;
  letzteAuswahl = { ausgewaehlteOption, richtigeOption, richtig };

  document.querySelectorAll('input[name="quizOption"]').forEach(input => { input.disabled = true; });
  if (pruefenBtn) {
    pruefenBtn.disabled = true;
    pruefenBtn.textContent = 'Wird gespeichert...';
  }
  if (status) status.textContent = 'Antwort wird gespeichert...';

  markiereOptionen(ausgewaehlteOption, richtigeOption);
  fuehreSpeicherungAus(ausgewaehlteOption, richtigeOption, richtig);
}

function naechsteFrageHandler() {
  if (!antwortGespeichert) return;
  const vorherigeFrage = aktuellerKatalogEintrag;
  fragenIndex += 1;
  if (fragenIndex >= rundenReihenfolge.length) {
    letzteFrageAlterRunde = vorherigeFrage ? vorherigeFrage.quizKey : null;
    neueRunde();
  }
  zeigeAktuelleFrage();
}

function bindeQuizInteraktionen() {
  const pruefenBtn = document.getElementById('quizPruefenBtn');
  const naechsteBtn = document.getElementById('quizNaechsteBtn');
  const optionenContainer = document.getElementById('quizOptionen');
  const modus = document.getElementById('quizModus');

  if (pruefenBtn) pruefenBtn.addEventListener('click', pruefeAntwort);
  if (naechsteBtn) naechsteBtn.addEventListener('click', naechsteFrageHandler);
  if (modus) modus.addEventListener('change', wechsleQuizmodus);
  if (optionenContainer) {
    optionenContainer.addEventListener('change', event => {
      if (!event.target || event.target.name !== 'quizOption') return;
      document.querySelectorAll('#quizOptionen .quiz-option').forEach(label => label.classList.remove('quiz-option-selected'));
      const label = event.target.closest('.quiz-option');
      if (label) label.classList.add('quiz-option-selected');
    });
  }
}

export async function initialisiereQuiz() {
  const status = document.getElementById('quizStatus');
  const karte = document.getElementById('quizKarte');
  if (!status) return;

  const user = currentVerifiedUser();
  if (!user) {
    status.textContent = 'Bitte melde dich mit einem bestätigten Konto an, um das Quiz zu nutzen.';
    if (karte) karte.hidden = true;
    return;
  }

  if (!quizInteraktionenGebunden) {
    bindeQuizInteraktionen();
    quizInteraktionenGebunden = true;
  }

  if (katalog && aktuelleFrage) {
    status.textContent = '';
    return;
  }

  status.textContent = 'Quizkatalog wird geladen...';
  if (karte) karte.hidden = true;

  try {
    await ladeKatalog();
    if (!katalog || !katalog.length) {
      status.textContent = 'Es sind derzeit keine Quizfragen verfügbar.';
      return;
    }
    befuelleQuizModus();
    neueRunde();
    await zeigeAktuelleFrage();
  } catch (error) {
    status.textContent = `Quizkatalog konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
  }
}

window.initialisiereQuiz = initialisiereQuiz;
