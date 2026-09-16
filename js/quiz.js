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
let quizSchwierigkeitsgrad = '';
let quizShuffleAktiv = false;
const letzteAntwortReihenfolge = new Map();
let sichtbareQuizPositionen = new Map();
const QUIZ_SCHWIERIGKEITEN = ['Einsteiger', 'Fortgeschritten', 'Profi'];
const QUIZ_REQUEST_TIMEOUT_MS = Number(window.QUIZ_REQUEST_TIMEOUT_MS) || 90000;
const QUIZ_PROGRESS_TIMEOUT_MS = Number(window.QUIZ_PROGRESS_TIMEOUT_MS) || 15000;
const QUIZ_SESSION_STORAGE_PREFIX = 'wifa.quiz.session.v1';
const QUIZ_LADEFACTS = {
  allgemein: [
    'Lernen gelingt oft besser in kurzen, konzentrierten Einheiten.',
    'Beim Wiederholen hilft es, Begriffe mit eigenen Beispielen zu verknüpfen.',
    'Ein klarer Überblick erleichtert das Einordnen neuer Fachbegriffe.'
  ],
  Marketing: [
    'AIDA steht für Attention, Interest, Desire und Action.',
    'Ein USP beschreibt ein besonderes Merkmal oder einen Nutzen, der ein Angebot vom Wettbewerb unterscheidet.',
    'Marktsegmentierung teilt einen Gesamtmarkt in unterscheidbare Gruppen.'
  ],
  Recht: [
    'Ein Vertrag entsteht grundsätzlich durch zwei übereinstimmende Willenserklärungen.',
    'Eine Frist bezeichnet einen Zeitraum, während ein Termin einen Zeitpunkt bezeichnet.',
    'Ansprüche können unter bestimmten Voraussetzungen verjähren.'
  ],
  Rechnungswesen: [
    'Das Eigenkapital steht auf der Passivseite der Bilanz.',
    'Planmäßige Abschreibungen verteilen die Anschaffungs- oder Herstellungskosten eines abnutzbaren Anlageguts über seine Nutzungsdauer.',
    'Eine Bilanz stellt Vermögen und Kapital zu einem Stichtag gegenüber.'
  ],
  Logistik: [
    'Die Lieferzeit beschreibt die Zeit zwischen Bestellung und Lieferung.',
    'Lagerbestände binden Kapital und verursachen Lagerkosten.',
    'Ein Warenfluss verbindet Beschaffung, Lagerung und Absatz.'
  ],
  BWL: [
    'Das ökonomische Prinzip beschreibt den sparsamen Umgang mit knappen Mitteln.',
    'Eine Unternehmung kombiniert Produktionsfaktoren zur Leistungserstellung.',
    'Liquidität bezeichnet die Fähigkeit, fällige Zahlungen leisten zu können.'
  ],
  VWL: [
    'Angebot und Nachfrage beeinflussen gemeinsam die Preisbildung am Markt.',
    'Das Bruttoinlandsprodukt misst den Wert der im Inland erzeugten Waren und Dienstleistungen unter Berücksichtigung der Vorleistungen.',
    'Inflation bezeichnet einen anhaltenden Anstieg des allgemeinen Preisniveaus.'
  ],
  Steuern: [
    'Steuern werden ohne individuelle Gegenleistung zur Finanzierung öffentlicher Aufgaben erhoben.',
    'Die Einkommensteuer ist eine Personensteuer.',
    'Die Umsatzsteuer knüpft grundsätzlich an Lieferungen und sonstige Leistungen an.'
  ],
  Unternehmensführung: [
    'Strategische Entscheidungen richten sich auf die langfristige Entwicklung eines Unternehmens.',
    'Ziele machen gewünschte Ergebnisse überprüfbar.',
    'Führung verbindet Aufgaben, Verantwortung und Zusammenarbeit.'
  ],
  'Führung und Zusammenarbeit': [
    'Feedback wirkt besonders hilfreich, wenn es konkret und zeitnah ist.',
    'Delegation überträgt Aufgaben, aber nicht automatisch die Gesamtverantwortung.',
    'Gute Zusammenarbeit braucht gemeinsame Ziele und klare Absprachen.'
  ],
  'Betriebliches Management': [
    'Prozesse beschreiben wiederkehrende Abläufe mit einem Ziel.',
    'Kennzahlen machen Entwicklungen messbar und vergleichbar.',
    'Planung verbindet Ziele mit Maßnahmen und Ressourcen.'
  ],
  Vertrieb: [
    'Vertrieb verbindet ein Angebot mit potenziellen und bestehenden Kunden.',
    'Kundenbedarf und Kundennutzen sind zentrale Bezugspunkte im Verkauf.',
    'Ein Verkaufsgespräch besteht typischerweise aus Vorbereitung, Gespräch und Nachbereitung.'
  ],
  'Investition und Finanzierung': [
    'Investitionen binden heute Mittel, um künftig Nutzen oder Erträge zu erzielen.',
    'Finanzierung beschreibt die Beschaffung von Kapital.',
    'Bei der Innenfinanzierung stammen die Mittel aus dem Unternehmen selbst.'
  ],
  'Betriebliches Rechnungswesen und Controlling': [
    'Controlling unterstützt die Unternehmensführung durch Informationen und Analysen.',
    'Kostenrechnung untersucht den Werteverzehr innerhalb eines Unternehmens.',
    'Soll-Ist-Vergleiche zeigen Abweichungen zwischen Planung und tatsächlicher Entwicklung.'
  ]
};

const sitzungsStatistik = { richtig: 0, falsch: 0 };

function setzeQuizLadehinweis(fach = '', ladeart = 'frage') {
  const status = document.getElementById('quizStatus');
  if (!status) return;

  const pool = QUIZ_LADEFACTS[String(fach || '').trim()] || QUIZ_LADEFACTS.allgemein;
  const fact = pool[Math.floor(Math.random() * pool.length)];
  const hinweis = ladeart === 'katalog' ? 'Quiz lädt …' : 'Frage lädt …';
  status.replaceChildren();

  const hinweisElement = document.createElement('div');
  hinweisElement.className = 'quiz-loading-hinweis';
  hinweisElement.textContent = hinweis;

  const factLabel = document.createElement('div');
  factLabel.className = 'quiz-loading-fact-label';
  factLabel.textContent = 'Wusstest du schon?';

  const factElement = document.createElement('div');
  factElement.className = 'quiz-loading-fact';
  factElement.textContent = fact;

  status.appendChild(hinweisElement);
  status.appendChild(factLabel);
  status.appendChild(factElement);
}

function quizRequestMitTimeout(promise, fehlermeldung, timeoutMs = QUIZ_REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(fehlermeldung)), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      error => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function quizQuestionMitDiagnose(fach, frageId, schwierigkeitsgrad = '') {
  const startzeit = Date.now();
  const kennung = {
    fach: String(fach || '').trim(),
    frageId: String(frageId || '').trim(),
    ...(schwierigkeitsgrad ? {schwierigkeitsgrad} : {})
  };
  let timeoutErreicht = false;
  const timeoutTimer = window.setTimeout(() => {
    timeoutErreicht = true;
    console.warn('[quizQuestion Diagnose] Timeout erreicht', {
      ...kennung,
      timeoutNachMs: QUIZ_REQUEST_TIMEOUT_MS
    });
  }, QUIZ_REQUEST_TIMEOUT_MS);

  const request = window.apiGet('quizQuestion', kennung);
  request.then(
    result => {
      window.clearTimeout(timeoutTimer);
      const dauerMs = Date.now() - startzeit;
      if (timeoutErreicht) {
        console.warn('[quizQuestion Diagnose] Antwort nach Timeout', {
          ...kennung,
          timeoutNachMs: QUIZ_REQUEST_TIMEOUT_MS,
          zurueckNachMs: dauerMs,
          erfolg: Boolean(result && result.success),
          apiFehler: result && result.success ? undefined : String(result && result.error || '')
        });
      } else {
        console.info('[quizQuestion Diagnose] Antwort erhalten', {
          ...kennung,
          dauerMs,
          erfolg: Boolean(result && result.success),
          apiFehler: result && result.success ? undefined : String(result && result.error || '')
        });
      }
    },
    error => {
      window.clearTimeout(timeoutTimer);
      console.warn('[quizQuestion Diagnose] Request-Fehler', {
        ...kennung,
        dauerMs: Date.now() - startzeit,
        timeoutErreicht,
        fehler: error && error.message ? error.message : String(error)
      });
    }
  );

  return request;
}

function quizProgressContext() {
  return {
    bereich: 'quiz',
    fach: String(quizFach || '').trim() || '__ALL__',
    auswahl: quizSchwierigkeitsgrad ? `__ALL__:${quizSchwierigkeitsgrad}` : '__ALL__'
  };
}

async function speichereQuizFortschritt(frageId) {
  const user = currentVerifiedUser();
  const safeFrageId = String(frageId || '').trim();

  if (!user || !safeFrageId || quizShuffleAktiv) {
    return false;
  }

  const context = quizProgressContext();
  const result = await quizRequestMitTimeout(
    window.apiPost('saveProgress', {
      nutzer: user.uid,
      bereich: context.bereich,
      fach: context.fach,
      auswahl: context.auswahl,
      frageId: safeFrageId
    }),
    'Das Speichern des Quiz-Fortschritts hat zu lange gedauert.'
  );

  return Boolean(result && result.success);
}

async function ladeQuizFortschritt() {
  const user = currentVerifiedUser();
  if (!user) return null;

  const context = quizProgressContext();
  const result = await window.apiGet('getProgress', {
    nutzer: user.uid,
    bereich: context.bereich,
    fach: context.fach,
    auswahl: context.auswahl
  });

  if (!result || !result.success || !result.data || !result.data.letzteFrageId) {
    return null;
  }

  const savedId = String(result.data.letzteFrageId || '').trim();
  const pool = neuerFragenpool();
  const matchIndex = pool.findIndex(item => String(item.frageId || item.quizKey || '').trim() === savedId);

  if (matchIndex < 0) {
    return null;
  }

  return matchIndex;
}

async function quizVonVorne() {
  const usageTicket = window.WifaUsage?.captureTicket();
  const pool = neuerFragenpool();
  if (!pool.length) return;

  const firstEntry = pool[0];
  const firstId = String(firstEntry.frageId || '').trim();
  if (!firstId) return;

  quizShuffleAktiv = false;
  const btn = document.getElementById('quizShuffleBtn');
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = 'Shuffle Mix';
  }

  const user = currentVerifiedUser();
  if (user) {
    const context = quizProgressContext();
    const result = await window.apiPost('saveProgress', {
      nutzer: user.uid,
      bereich: context.bereich,
      fach: context.fach,
      auswahl: context.auswahl,
      frageId: firstId
    });

    if (!result || !result.success) {
      const status = document.getElementById('quizStatus');
      if (status) {
        status.textContent = 'Quiz-Fortschritt konnte nicht zurückgesetzt werden.';
      }
      return;
    }
  }

  window.WifaAnalytics?.reset('quiz');
  if (window.WifaUsage?.isCurrent(usageTicket)) window.WifaUsage.reset('quiz');
  rundenNummer = 1;
  fragenIndex = 0;
  rundenReihenfolge = [...pool];
  aktuellerKatalogEintrag = firstEntry;
  aktuelleFrage = null;
  antwortGespeichert = false;
  letzteAuswahl = null;
  speichereQuizSitzung();

  await zeigeAktuelleFrage(usageTicket);
}

function quizShuffleMix() {
  quizShuffleAktiv = !quizShuffleAktiv;
  window.kilianQuizKontextLeeren?.();
  if (aktuelleFrage) window.kilianQuizKontextSetzen?.(aktuelleFrage);
  const btn = document.getElementById('quizShuffleBtn');
  if (btn) {
    btn.classList.toggle('active', quizShuffleAktiv);
    btn.textContent = quizShuffleAktiv ? 'Shuffle Mix: AN' : 'Shuffle Mix';
  }

  const status = document.getElementById('quizStatus');
  if (status) {
    status.textContent = quizShuffleAktiv
      ? 'Shuffle Mix aktiv – Reihenfolge bleibt nur in dieser Session lokal.'
      : 'Shuffle Mix deaktiviert – Fortschritt wird wieder gespeichert.';
  }
}

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
  const pool = Array.isArray(katalog) ? katalog : [];
  const gefiltert = pool.filter(item =>
    (!quizFach || String(item?.fach || '').trim() === String(quizFach || '').trim()) &&
    (!quizSchwierigkeitsgrad || String(item?.schwierigkeitsgrad || '').trim() === quizSchwierigkeitsgrad)
  );
  return [...new Map(gefiltert.map(item => [String(item.quizKey || '').trim(), item])).values()].filter(Boolean);
}

function neueRunde(usageTicket = window.WifaUsage?.captureTicket()) {
  window.WifaAnalytics?.reset('quiz');
  if (window.WifaUsage?.isCurrent(usageTicket)) window.WifaUsage.reset('quiz');
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

async function ladeQuizNachAuswahl(usageTicket = window.WifaUsage?.captureTicket()) {
  if (!quizSchwierigkeitsgrad) return;
  ladeToken += 1;
  const auswahlToken = ladeToken;
  aktuelleFrage = null;
  aktuellerKatalogEintrag = null;
  antwortGespeichert = false;
  letzteAuswahl = null;
  const status = document.getElementById('quizStatus');
  const karte = document.getElementById('quizKarte');
  if (karte) karte.hidden = true;
  setQuizButtonsDisabled(true);
  setNaechsteSichtbar(false);
  document.querySelectorAll('input[name="quizOption"]').forEach(input => {
    input.checked = false;
    input.disabled = true;
  });
  hideErgebnis();
  setzeQuizLadehinweis(quizFach, 'frage');
  letzteFrageAlterRunde = null;
  rundenNummer = 0;
  neueRunde();
  if (!rundenReihenfolge.length) {
    if (status) status.textContent = `Für ${quizFach || 'alle Fächer'} sind keine aktiven Fragen mit der Stufe „${quizSchwierigkeitsgrad}“ verfügbar.`;
    return;
  }
  const savedSessionIndex = ladeQuizSitzung();
  if (savedSessionIndex === null) {
    let savedIndex = null;
    try {
      savedIndex = await quizRequestMitTimeout(
        ladeQuizFortschritt(),
        'Das Laden des Quiz-Fortschritts hat zu lange gedauert.',
        QUIZ_PROGRESS_TIMEOUT_MS
      );
    } catch (error) {
      if (auswahlToken !== ladeToken) return;
      console.warn('Quiz-Fortschritt konnte nicht geladen werden; die Session startet bei Frage 1.', error);
    }
    if (auswahlToken !== ladeToken) return;
    if (typeof savedIndex === 'number' && savedIndex >= 0 && savedIndex < rundenReihenfolge.length) {
      fragenIndex = savedIndex;
    }
  }

  if (status) status.textContent = '';
  await zeigeAktuelleFrage(usageTicket);
}

function ladeQuizAuswahlMitFehlerbehandlung() {
  ladeQuizNachAuswahl().catch(error => {
    const karte = document.getElementById('quizKarte');
    const status = document.getElementById('quizStatus');
    if (karte) karte.hidden = true;
    setQuizButtonsDisabled(false);
    setNaechsteSichtbar(false);
    if (status) status.textContent = `Frage konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
  });
}

function wechsleQuizmodus(event) {
  quizFach = event.target.value;
  if (!quizSchwierigkeitsgrad) {
    const status = document.getElementById('quizStatus');
    if (status) status.textContent = 'Bitte wähle zuerst einen Schwierigkeitsgrad.';
    return;
  }
  ladeQuizAuswahlMitFehlerbehandlung();
}

function wechsleQuizSchwierigkeitsgrad(event) {
  const value = String(event.target?.value || '').trim();
  if (!QUIZ_SCHWIERIGKEITEN.includes(value)) return;
  quizSchwierigkeitsgrad = value;
  ladeQuizAuswahlMitFehlerbehandlung();
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
  const richtigePosition = sichtbareQuizPositionen.get(richtigeOption) || richtigeOption;
  ergebnisBereich.textContent = richtig ? 'Richtig!' : `Falsch. Die richtige Antwort ist Option ${richtigePosition}.`;
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
    const antwortObjekte = antworten
      .map(option => ({ originalOption: String(option?.id || '').trim(), text: String(option?.text || '') }))
      .filter(option => OPTION_IDS.includes(option.originalOption));
    const frageKey = String(q.quizKey || q.frageId || '').trim();
    sichtbareQuizPositionen = new Map();
    let gemischt = mischen(antwortObjekte);
    const vorigeReihenfolge = letzteAntwortReihenfolge.get(frageKey);
    if (gemischt.length > 1 && vorigeReihenfolge === gemischt.map(option => option.originalOption).join('')) {
      gemischt = [gemischt[1], gemischt[0], ...gemischt.slice(2)];
    }
    letzteAntwortReihenfolge.set(frageKey, gemischt.map(option => option.originalOption).join(''));
    gemischt.forEach((option, index) => {
      const optionId = option.originalOption;
      sichtbareQuizPositionen.set(optionId, OPTION_IDS[index]);

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
      letter.textContent = OPTION_IDS[index];

      const text = document.createElement('span');
      text.className = 'quiz-option-text';
      text.textContent = option.text;

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

async function zeigeAktuelleFrage(usageTicket = window.WifaUsage?.captureTicket()) {
  const status = document.getElementById('quizStatus');
  const karte = document.getElementById('quizKarte');
  const eintrag = rundenReihenfolge[fragenIndex];
  aktuellerKatalogEintrag = eintrag;
  aktuelleFrage = null;
  antwortGespeichert = false;
  letzteAuswahl = null;
  const token = ++ladeToken;

  window.kilianQuizKontextLeeren?.();
  setQuizButtonsDisabled(true);
  setNaechsteSichtbar(false);
  hideErgebnis();
  if (karte) karte.hidden = true;
  setzeQuizLadehinweis(eintrag?.fach);

  try {
    const result = await quizRequestMitTimeout(
      quizQuestionMitDiagnose(eintrag.fach, eintrag.frageId, quizSchwierigkeitsgrad),
      'Das Laden der Quizfrage hat zu lange gedauert.'
    );
    if (token !== ladeToken) return;
    if (!result.success) throw new Error(result.error || 'Die Quizfrage konnte nicht geladen werden.');
    aktuelleFrage = result.data || {};
    renderFrage();
    window.kilianQuizKontextSetzen?.(aktuelleFrage);
    if (status) status.textContent = '';
    if (karte) karte.hidden = false;
    if (aktuelleFrage && String(aktuelleFrage.frageId || aktuellerKatalogEintrag.frageId || '').trim()) {
      speichereQuizFortschritt(String(aktuelleFrage.frageId || aktuellerKatalogEintrag.frageId || '').trim())
        .catch(error => console.warn('Quiz-Fortschritt konnte nicht gespeichert werden.', error));
    }
    speichereQuizSitzung();
    window.WifaAnalytics?.start('quiz', quizFach);
    if (window.WifaUsage?.isCurrent(usageTicket)) window.WifaUsage.start('quiz', quizFach);
    window.WifaAnalytics?.content('quiz', aktuelleFrage.fach, aktuelleFrage.thema);
  } catch (error) {
    if (token !== ladeToken) return;
    setQuizButtonsDisabled(false);
    setNaechsteSichtbar(false);
    if (status) status.textContent = `Frage konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
  }
}

function quizSessionStorageKey() {
  const user = currentVerifiedUser();
  const fach = String(quizFach || '').trim();
  if (!user || !fach) return null;
  return `${QUIZ_SESSION_STORAGE_PREFIX}:${user.uid}:${fach}:${quizSchwierigkeitsgrad || 'legacy'}`;
}

function speichereQuizSitzung() {
  if (quizShuffleAktiv) return false;

  const key = quizSessionStorageKey();
  const current = rundenReihenfolge[fragenIndex];
  const order = rundenReihenfolge
    .map(item => String(item?.quizKey || '').trim())
    .filter(Boolean);
  const currentQuizKey = String(current?.quizKey || '').trim();

  if (!key || !order.length || !currentQuizKey) return false;

  try {
    window.localStorage.setItem(key, JSON.stringify({ order, currentQuizKey, rundenNummer }));
    return true;
  } catch (error) {
    console.warn('Quiz-Sitzung konnte nicht gespeichert werden.', error);
    return false;
  }
}

function ladeQuizSitzung() {
  if (quizShuffleAktiv) return null;

  const key = quizSessionStorageKey();
  if (!key) return null;

  let saved;
  try {
    saved = JSON.parse(window.localStorage.getItem(key) || 'null');
  } catch (error) {
    return null;
  }

  if (!saved || !Array.isArray(saved.order) || !saved.order.length) return null;

  const pool = neuerFragenpool();
  const entriesByKey = new Map(pool.map(item => [String(item.quizKey || '').trim(), item]));
  const order = saved.order.map(item => String(item || '').trim());
  const uniqueOrder = new Set(order);
  if (uniqueOrder.size !== pool.length || order.length !== pool.length ||
      order.some(quizKey => !entriesByKey.has(quizKey))) {
    return null;
  }

  const restoredIndex = order.indexOf(String(saved.currentQuizKey || '').trim());
  if (restoredIndex < 0) return null;

  rundenReihenfolge = order.map(quizKey => entriesByKey.get(quizKey));
  fragenIndex = restoredIndex;
  if (Number.isInteger(saved.rundenNummer) && saved.rundenNummer > 0) {
    rundenNummer = saved.rundenNummer;
  }
  return restoredIndex;
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
    if (fragenIndex === rundenReihenfolge.length - 1) window.WifaAnalytics?.complete('quiz');
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
  const schwierigkeitsgradRadios = document.querySelectorAll('input[name="quizSchwierigkeitsgrad"]');
  const shuffleBtn = document.getElementById('quizShuffleBtn');
  const vonVorneBtn = document.getElementById('quizVonVorneBtn');

  if (pruefenBtn) pruefenBtn.addEventListener('click', pruefeAntwort);
  if (naechsteBtn) naechsteBtn.addEventListener('click', naechsteFrageHandler);
  if (modus) modus.addEventListener('change', wechsleQuizmodus);
  schwierigkeitsgradRadios.forEach(radio => radio.addEventListener('change', wechsleQuizSchwierigkeitsgrad));
  if (shuffleBtn) shuffleBtn.addEventListener('click', quizShuffleMix);
  if (vonVorneBtn) vonVorneBtn.addEventListener('click', quizVonVorne);
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
  const usageTicket = window.WifaUsage?.captureTicket();
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

  setzeQuizLadehinweis('', 'katalog');
  if (karte) karte.hidden = true;

  try {
    await ladeKatalog();
    if (!katalog || !katalog.length) {
      status.textContent = 'Es sind derzeit keine Quizfragen verfügbar.';
      return;
    }
    befuelleQuizModus();
    const radios = document.querySelectorAll('input[name="quizSchwierigkeitsgrad"]');
    const selectedDifficulty = Array.from(radios).find(radio => radio.checked);
    if (selectedDifficulty && QUIZ_SCHWIERIGKEITEN.includes(selectedDifficulty.value)) {
      quizSchwierigkeitsgrad = selectedDifficulty.value;
      await ladeQuizNachAuswahl(usageTicket);
    } else {
      status.textContent = 'Bitte wähle einen Schwierigkeitsgrad, um das Quiz zu starten.';
    }
  } catch (error) {
    status.textContent = `Quizkatalog konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler.'}`;
  }
}

window.initialisiereQuiz = initialisiereQuiz;
window.quizVonVorne = quizVonVorne;
