function waehleTeilbereich() {
    if (appIstBeschaeftigt) return;
    trainerShuffleResetState();
    trainerNochNieAktiv = false;
    trainerNochNieResetState();

    ladeToken++;
    aktuellerTeilbereich = document.getElementById("teilbereichSelect").value;
    aktuellesFach = "";
    aktuellesThema = "";
    aktuelleFrage = "";
    aktuelleMusterloesung = "";
    aktuelleStichpunkte = [];
    aktuelleFrageId = "";
    if (typeof aktualisiereTrainerAuswahlFallback === "function") aktualisiereTrainerAuswahlFallback();

    const fachSelect = document.getElementById("fachSelect");
    const fachBereich = document.getElementById("fachBereich");
    const themaSelect = document.getElementById("themaSelect");
    const themaBereich = document.getElementById("themaBereich");

    fachSelect.innerHTML = '<option value="">-- Fach wählen --</option>';
    themaSelect.innerHTML = '<option value="">-- Thema wählen --</option>';
    themaBereich.style.display = "none";

    if (!aktuellerTeilbereich) {
      fachBereich.style.display = "none";
      document.getElementById("fachStatus").textContent = "Bitte zuerst einen Teilbereich auswählen.";
      document.getElementById("anzeigeTeilbereich").textContent = "Kein Teilbereich";
      document.getElementById("anzeigeFach").textContent = "Kein Fach";
      document.getElementById("anzeigeThema").textContent = "Bitte Thema wählen";
      document.getElementById("frageText").textContent = "Bitte zuerst Teilbereich, Fach und Thema auswählen.";
      resetFrageAnzeige();
      updateStatAnzeige();
      return;
    }

    const faecher = faecherNachTeilbereich[aktuellerTeilbereich] || [];

    faecher.forEach(function(fach) {
      const option = document.createElement("option");
      option.value = fach;
      option.textContent = fach;
      fachSelect.appendChild(option);
    });

    fachBereich.style.display = "block";

    document.getElementById("anzeigeTeilbereich").textContent = aktuellerTeilbereich;
    document.getElementById("anzeigeFach").textContent = "Bitte Fach wählen";
    document.getElementById("anzeigeThema").textContent = "Bitte Thema wählen";
    document.getElementById("frageText").textContent = "Bitte zuerst ein Fach und dann ein Thema auswählen.";
    document.getElementById("fachStatus").textContent = "Teilbereich gewählt: " + aktuellerTeilbereich;

    resetFrageAnzeige();
    updateStatAnzeige();
  }

function waehleFachAusDropdown() {
    if (appIstBeschaeftigt) return;
    trainerShuffleResetState();
    trainerNochNieAktiv = false;
    trainerNochNieResetState();

    const fach = document.getElementById("fachSelect").value;

    if (!fach) {
      ladeToken++;
      aktuellesFach = "";
      aktuellesThema = "";
      aktuelleFrage = "";
      aktuelleMusterloesung = "";
      aktuelleStichpunkte = [];
      aktuelleFrageId = "";

      document.getElementById("themaBereich").style.display = "none";
      document.getElementById("themaSelect").innerHTML = '<option value="">-- Thema wählen --</option>';
      document.getElementById("anzeigeFach").textContent = "Kein Fach";
      document.getElementById("anzeigeThema").textContent = "Bitte Thema wählen";
      document.getElementById("frageText").textContent = "Bitte zuerst ein Fach auswählen.";
      document.getElementById("fachStatus").textContent = "Bitte ein Fach auswählen.";

      resetFrageAnzeige();
      updateStatAnzeige();
      return;
    }

    waehleFach(fach);
  }

function waehleThemaAusDropdown() {
    if (appIstBeschaeftigt) return;

    const thema = document.getElementById("themaSelect").value;

    if (!thema) {
      return;
    }

    starteThema();
  }

function ermittleTeilbereich(fach) {
    if (faecherNachTeilbereich.WQ.includes(fach)) return "WQ";
    if (faecherNachTeilbereich.HQ.includes(fach)) return "HQ";
    return aktuellerTeilbereich || "";
  }

let trainerTippTimer = null;
let trainerTippFrageToken = 0;
let trainerTippAngeboten = false;
let trainerShuffleAktiv = false;
let trainerProgressLoadToken = 0;
let trainerWiederholungSpeicherung = null;
let trainerWiederholungNavigationAngefordert = false;

// Each special mode has its own path; seenIds survives shuffle backtracking.
let trainerShuffleSeenIds = new Set();
let trainerShuffleHistory = [];
let trainerShuffleHistoryIndex = -1;
let trainerShufflePool = [];
let trainerNochNieAktiv = false;
let trainerNochNieHistory = [];
let trainerNochNieHistoryIndex = -1;
let trainerNochNiePool = [];
const trainerFragenCache = new Map();

function trainerAktualisiereVorherigeSchaltflaeche() {
  const button = document.getElementById("btnVorherigeFrage");
  if (button) button.disabled = appIstBeschaeftigt || (trainerShuffleAktiv
    ? trainerShuffleHistoryIndex <= 0
    : trainerNochNieAktiv ? trainerNochNieHistoryIndex <= 0 : !aktuelleFrageId);
  const unanswered = document.getElementById("trainerUnansweredBtn");
  if (unanswered && unanswered.textContent === "Alle Fragen bereits einmal beantwortet") unanswered.disabled = true;
}

function trainerShuffleResetState() {
  trainerShuffleAktiv = false;
  trainerShuffleSeenIds.clear();
  trainerShuffleHistory = [];
  trainerShuffleHistoryIndex = -1;
  trainerShufflePool = [];
  const button = document.getElementById("trainerShuffleBtn");
  if (button) { button.classList.remove("active"); button.textContent = "Shuffle Mix"; }
}

async function trainerThemenpoolLaden(fach, thema) {
  const result = await apiGet("questionsForTopic", { fach, thema });
  if (!result || !result.success || !Array.isArray(result.data)) throw new Error("Themenpool konnte nicht geladen werden.");
  const ids = new Set();
  return result.data.map((frage, index) => ({...frage, fragePosition:index + 1, frageGesamt:result.data.length}))
    .filter(frage => {
      const id = String(frage.id || "").trim();
      if (!id || ids.has(id)) return false;
      ids.add(id);
      frage.id = id;
      return true;
    });
}

function trainerShuffleNaechsteFrage() {
  let freieFragen = trainerShufflePool.filter(frage => !trainerShuffleSeenIds.has(frage.id));
  if (!freieFragen.length) {
    if (!trainerShufflePool.length) return;
    if (!window.confirm("Du hast alle Fragen dieses Themas einmal im Shuffle gesehen. Shuffle von vorne beginnen?")) {
      setzeStatus("Shuffle-Runde abgeschlossen. Mit Nächste Frage kannst du eine neue Runde starten.");
      return;
    }
    trainerShuffleSeenIds.clear();
    trainerShuffleHistory = [];
    trainerShuffleHistoryIndex = -1;
    freieFragen = trainerShufflePool;
  }
  const frage = freieFragen[Math.floor(Math.random() * freieFragen.length)];
  trainerShuffleHistory = trainerShuffleHistory.slice(0, trainerShuffleHistoryIndex + 1);
  trainerShuffleHistory.push(frage.id);
  trainerShuffleHistoryIndex = trainerShuffleHistory.length - 1;
  trainerShuffleSeenIds.add(frage.id);
  zeigeGeladeneFrage(frage, aktuellesThema);
  setzeStatus("Shuffle: neue ungesehene Frage geladen.");
  return frage;
}

function trainerNochNieResetState() {
  trainerNochNieHistory = [];
  trainerNochNieHistoryIndex = -1;
  trainerNochNiePool = [];
  trainerFragenCache.clear();
  const button = document.getElementById("trainerUnansweredBtn");
  if (button) { button.classList.remove("active", "disabled"); button.disabled = false; button.textContent = "Noch nie beantwortet"; }
}

function baueFrageKey({ bereich, fach, thema, frageId }) {
  return ["wifa-trainer", String(bereich || "").trim(), String(fach || "").trim(), String(thema || "").trim(), String(frageId || "").trim()].join("::");
}

function filtereNochNieBeantworteteFragen(fragen, attempts) {
  const currentFach = String(aktuellesFach || "").trim();
  const currentThema = String(aktuellesThema || "").trim();
  const currentBereich = String(aktuellerTeilbereich || ermittleTeilbereich(currentFach) || "").trim();
  const answered = new Set();

  (Array.isArray(attempts) ? attempts : []).forEach(function(attempt) {
    if (!attempt) return;
    const modul = String(attempt.modul || "").trim();
    if (modul && modul !== "wifa-trainer") return;
    if (String(attempt.fach || "").trim() !== currentFach) return;
    if (String(attempt.thema || "").trim() !== currentThema) return;

    const key = String(attempt.questionKey || "").trim()
      || baueFrageKey({
        bereich: String(attempt.bereich || currentBereich || "").trim(),
        fach: String(attempt.fach || currentFach).trim(),
        thema: String(attempt.thema || currentThema).trim(),
        frageId: String(attempt.frageId || "").trim()
      });

    if (key) answered.add(key);
  });

  return (Array.isArray(fragen) ? fragen : []).filter(function(frage) {
    const frageId = String(frage && frage.id ? frage.id : "").trim();
    if (!frageId) return false;

    const key = baueFrageKey({
      bereich: currentBereich,
      fach: currentFach,
      thema: currentThema,
      frageId
    });

    return !answered.has(key);
  });
}

async function trainerNochNieFragenpoolLaden() {
  if (!aktuellesFach || !aktuellesThema) {
    trainerNochNiePool = [];
    return [];
  }

  const result = await apiGet("questionsForTopic", { fach: aktuellesFach, thema: aktuellesThema });
  if (!result || !result.success || !Array.isArray(result.data)) {
    throw new Error("Themenpool konnte nicht geladen werden.");
  }

  trainerNochNiePool = result.data.map(function(frage, index) {
    const frageId = String(frage && frage.id ? frage.id : "").trim();
    const withPosition = { ...frage };
    withPosition.fragePosition = index + 1;
    withPosition.frageGesamt = result.data.length;
    if (frageId) {
      trainerFragenCache.set(frageId, withPosition);
    }
    return withPosition;
  });

  return trainerNochNiePool;
}

async function trainerNochNieOffeneFragen() {
  const pool = trainerNochNiePool.length ? trainerNochNiePool : await trainerNochNieFragenpoolLaden();
  if (!pool.length) return [];

  const userId = aktuellerNutzerUid();
  const attempts = userId && typeof window.loadAttemptsForCurrentUser === "function"
    ? await window.loadAttemptsForCurrentUser({ uid: userId })
    : [];

  return filtereNochNieBeantworteteFragen(pool, attempts);
}

async function trainerNochNieAktualisiereButtonStatus() {
  const button = document.getElementById("trainerUnansweredBtn");
  if (!button) return;

  if (trainerNochNieAktiv) {
    button.classList.add("active");
    button.classList.remove("disabled");
    button.disabled = false;
    button.textContent = "Noch nie beantwortet: AKTIV";
    return;
  }

  const openQuestions = await trainerNochNieOffeneFragen();
  if (!openQuestions.length) {
    button.classList.remove("active");
    button.classList.add("disabled");
    button.disabled = true;
    button.textContent = "Alle Fragen bereits einmal beantwortet";
    return;
  }

  button.classList.remove("active");
  button.classList.remove("disabled");
  button.disabled = false;
  button.textContent = "Noch nie beantwortet";
}

async function trainerNochNieBeantwortet() {
  if (appIstBeschaeftigt) return false;

  if (!aktuellerTeilbereich || !aktuellesFach || !aktuellesThema) {
    alert("Bitte zuerst ein Fach und ein Thema auswählen.");
    return false;
  }

  if (trainerNochNieAktiv) {
    trainerNochNieAktiv = false;
    trainerNochNieResetState();

    await trainerNochNieAktualisiereButtonStatus();
    trainerAktualisiereVorherigeSchaltflaeche();
    setzeStatus("Noch nie beantwortet deaktiviert – normale Kreisnavigation ist wieder aktiv.");
    return true;
  }

  if (trainerShuffleAktiv) {
    trainerShuffleResetState();

    const shuffleBtn = document.getElementById("trainerShuffleBtn");
    if (shuffleBtn) {
      shuffleBtn.classList.remove("active");
      shuffleBtn.textContent = "Shuffle Mix";
    }
  }

  const userId = aktuellerNutzerUid();
  if (!userId) {
    alert("Bitte melde dich an, um unbeantwortete Fragen zu laden.");
    return false;
  }

  try {
    setzeAppBeschaeftigt(true);
    await trainerNochNieFragenpoolLaden();
    const offeneFragen = await trainerNochNieOffeneFragen();

    if (!offeneFragen.length) {
      trainerNochNieAktiv = false;
      trainerNochNieResetState();
      await trainerNochNieAktualisiereButtonStatus();
      alert("Du hast alle Fragen dieses Themas mindestens einmal beantwortet.");
      return false;
    }

    const ersteFrage = offeneFragen[0];
    const ersteFrageId = String(ersteFrage && ersteFrage.id ? ersteFrage.id : "").trim();
    if (!ersteFrageId) {
      throw new Error("Die erste unbeantwortete Frage konnte nicht bestimmt werden.");
    }

    trainerNochNieAktiv = true;
    trainerNochNieHistory = [ersteFrageId];
    trainerNochNieHistoryIndex = 0;


    const geladeneFrage = trainerNochNiePool.find(function(frage) {
      return String(frage && frage.id ? frage.id : "").trim() === ersteFrageId;
    }) || ersteFrage;

    if (geladeneFrage) {
      zeigeGeladeneFrage(geladeneFrage, aktuellesThema, false, false);
    }

    await trainerNochNieAktualisiereButtonStatus();
    setzeStatus("Noch nie beantwortet: AKTIV – nächste Frage wird in Themenreihenfolge gewählt.");
    return true;
  } catch (error) {
    trainerNochNieAktiv = false;
    trainerNochNieResetState();
    setzeStatus("Noch nie beantwortet konnte nicht geladen werden: " + (error.message || error));
    return false;
  } finally {
    setzeAppBeschaeftigt(false);
    trainerAktualisiereVorherigeSchaltflaeche();
  }
}

async function trainerNochNieNaechsteFrage() {
  if (!trainerNochNieAktiv) return null;

  const offeneFragen = await trainerNochNieOffeneFragen();
  if (!offeneFragen.length) {
    trainerNochNieAktiv = false;
    trainerNochNieResetState();
    await trainerNochNieAktualisiereButtonStatus();
    alert("Du hast alle Fragen dieses Themas mindestens einmal beantwortet.");
    return null;
  }

  const aktuelleId = String(aktuelleFrageId || "").trim();
  const aktuelleIndex = trainerNochNiePool.findIndex(function(frage) {
    return String(frage && frage.id ? frage.id : "").trim() === aktuelleId;
  });
  const offeneIds = new Set(offeneFragen.map(frage => String(frage.id).trim()));
  const naechsteFrage = trainerNochNiePool.slice(aktuelleIndex + 1).find(frage => offeneIds.has(String(frage.id).trim())) || offeneFragen[0];
  const naechsteId = String(naechsteFrage && naechsteFrage.id ? naechsteFrage.id : "").trim();

  if (!naechsteId) {
    return null;
  }

  trainerNochNieHistory = trainerNochNieHistory.slice(0, trainerNochNieHistoryIndex + 1);
  trainerNochNieHistory.push(naechsteId);
  trainerNochNieHistoryIndex = trainerNochNieHistory.length - 1;


  const frage = trainerFragenCache.get(naechsteId) || trainerNochNiePool.find(function(item) {
    return String(item && item.id ? item.id : "").trim() === naechsteId;
  }) || naechsteFrage;

  if (frage) {
    zeigeGeladeneFrage(frage, aktuellesThema, false, false);
    setzeStatus("Noch nie beantwortet: nächste offene Frage geladen.");
    return frage;
  }

  return null;
}


function trainerProgressSelectionMatches(fach, thema) {
  const expectedFach = String(fach || "").trim();
  const expectedThema = String(thema || "").trim();
  const currentFach = String(aktuellesFach || "").trim();
  const currentThema = String(aktuellesThema || "").trim();

  return currentFach === expectedFach && currentThema === expectedThema;
}

function aktuellerNutzerUid() {
  try {
    if (auth && auth.currentUser && auth.currentUser.uid) {
      return String(auth.currentUser.uid).trim();
    }
  } catch (error) {}

  const fallback = window.aktuellerNutzer;
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : "";
}

function trainerResumeContext() {
  return {
    bereich: "trainer",
    fach: String(aktuellesFach || "").trim(),
    auswahl: String(aktuellesThema || "").trim() || "__ALL__"
  };
}

async function speichereTrainerFortschritt(fach, thema, frageId) {
  const userId = aktuellerNutzerUid();
  const safeFach = String(fach || "").trim();
  const safeThema = String(thema || "").trim();
  const safeFrageId = String(frageId || "").trim();

  if (!userId || !safeFach || !safeFrageId || trainerShuffleAktiv) {
    return false;
  }

  const context = trainerResumeContext();
  const result = await apiPost("saveProgress", {
    nutzer: userId,
    bereich: context.bereich,
    fach: context.fach || safeFach,
    auswahl: context.auswahl || safeThema || "__ALL__",
    frageId: safeFrageId
  });

  return Boolean(result && result.success);
}

async function ladeTrainerFortschritt(fach, thema, requestToken = ++trainerProgressLoadToken) {
  const userId = aktuellerNutzerUid();
  const safeFach = String(fach || "").trim();
  const safeThema = String(thema || "").trim();

  if (!userId || !safeFach) {
    return null;
  }

  const context = {
    bereich: "trainer",
    fach: safeFach,
    auswahl: safeThema || "__ALL__"
  };

  try {
    const result = await apiGet("getProgress", {
      nutzer: userId,
      bereich: context.bereich,
      fach: context.fach,
      auswahl: context.auswahl
    });

    if (requestToken !== trainerProgressLoadToken) {
      return null;
    }

    if (!result || !result.success || !result.data || !result.data.letzteFrageId) {
      return null;
    }

    if (!trainerProgressSelectionMatches(safeFach, safeThema)) {
      return null;
    }

    const frageResult = await apiGet("questionById", {
      fach: safeFach,
      frageId: result.data.letzteFrageId
    });

    if (requestToken !== trainerProgressLoadToken) {
      return null;
    }

    const frage = frageResult && frageResult.success ? frageResult.data : null;
    const frageId = String(frage && frage.id ? frage.id : "").trim();
    const themaMatch = String(frage && frage.thema ? frage.thema : "").trim();

    if (frageId && (!safeThema || themaMatch === safeThema)) {
      if (!trainerProgressSelectionMatches(safeFach, safeThema)) {
        return null;
      }
      return frageId;
    }
  } catch (error) {
    console.warn("Trainer-Fortschritt konnte nicht geladen werden:", error);
  }

  return null;
}

function trainerVonVorne() {
  const usageTicket = window.WifaUsage?.captureTicket();
  if (appIstBeschaeftigt) return;
    trainerShuffleResetState();
    trainerNochNieAktiv = false;
    trainerNochNieResetState();
  if (!aktuellesFach || !aktuellesThema) {
    alert("Bitte zuerst ein Fach und ein Thema auswählen.");
    return;
  }

  trainerShuffleAktiv = false;
  const shuffleBtn = document.getElementById("trainerShuffleBtn");
  if (shuffleBtn) {
    shuffleBtn.classList.remove("active");
    shuffleBtn.textContent = "Shuffle Mix";
  }

  const context = trainerResumeContext();
  const userId = aktuellerNutzerUid();
  if (!userId) {
    setzeStatus("Bitte melde dich an, um den Fortschritt zurückzusetzen.");
    return;
  }

  apiGet("firstQuestion", { fach: context.fach, thema: context.auswahl === "__ALL__" ? aktuellesThema : context.auswahl })
    .then(function(result) {
      if (!result || !result.success || !result.data || !result.data.id) {
        return;
      }

      const firstId = String(result.data.id || "").trim();
      return apiPost("saveProgress", {
        nutzer: userId,
        bereich: context.bereich,
        fach: context.fach,
        auswahl: context.auswahl,
        frageId: firstId
      });
    })
    .then(function() {
      window.WifaAnalytics?.reset('trainer');
      if (window.WifaUsage?.isCurrent(usageTicket)) window.WifaUsage.reset('trainer');
      ladeFrageAusFach(context.fach, context.auswahl === "__ALL__" ? aktuellesThema : context.auswahl, "", usageTicket);
      setzeStatus("Fortschritt zurückgesetzt: Du startest wieder von vorne.");
    })
    .catch(function(error) {
      setzeStatus("Fortschritt konnte nicht zurückgesetzt werden: " + (error.message || error));
    });
}

async function trainerShuffleMix() {
  if (appIstBeschaeftigt || !aktuellesFach || !aktuellesThema) return;
  if (trainerShuffleAktiv) {
    trainerShuffleResetState();
    trainerAktualisiereVorherigeSchaltflaeche();
    setzeStatus("Shuffle Mix deaktiviert – Fortschritt wird wieder gespeichert.");
    return;
  }
  trainerNochNieAktiv = false;
  trainerNochNieResetState();
  const btn = document.getElementById("trainerShuffleBtn");
  const fach = aktuellesFach, thema = aktuellesThema;
  const token = ++ladeToken;
  try {
    setzeAppBeschaeftigt(true);
    const pool = await trainerThemenpoolLaden(fach, thema);
    if (token !== ladeToken || !trainerProgressSelectionMatches(fach, thema)) return;
    if (!pool.length) throw new Error("Im aktuellen Thema wurden keine Fragen gefunden.");
    trainerShuffleResetState();
    trainerShufflePool = pool;
    trainerShuffleAktiv = true;
    if (btn) { btn.classList.add("active"); btn.textContent = "Shuffle Mix: AKTIV"; }
    trainerShuffleNaechsteFrage();
  } catch (error) {
    trainerShuffleResetState();
    setzeStatus("Shuffle konnte nicht geladen werden: " + error.message);
  } finally {
    if (token === ladeToken) {
      setzeAppBeschaeftigt(false);
      trainerAktualisiereVorherigeSchaltflaeche();
    }
  }
}

function trainerTippAusblenden() {
    const hinweis = document.getElementById("trainerTippHinweis");
    if (!hinweis) return;
    hinweis.hidden = true;
    hinweis.classList.remove("trainer-tipp-neu");
  }

function trainerTippTimerAbbrechen() {
    if (trainerTippTimer !== null) {
      clearTimeout(trainerTippTimer);
      trainerTippTimer = null;
    }
    trainerTippFrageToken++;
    trainerTippAngeboten = false;
    trainerTippAusblenden();
  }

function starteTrainerTippTimer() {
    trainerTippTimerAbbrechen();
    const frageToken = trainerTippFrageToken;
    const antwortInput = document.getElementById("antwortInput");
    const hatInteraktiveTabellenFelder = Boolean(
      document.querySelector('.aufgaben-html-bereich .trainer-tabellen-input, .aufgaben-html-bereich input:not([type="hidden"]), .aufgaben-html-bereich textarea, .aufgaben-html-bereich select')
    );

    if (!aktuelleFrageId) return;
    if (!antwortInput && !hatInteraktiveTabellenFelder) return;
    if (antwortInput && antwortInput.style.display === "none" && !hatInteraktiveTabellenFelder) return;

    trainerTippTimer = window.setTimeout(function() {
      trainerTippTimer = null;
      if (frageToken !== trainerTippFrageToken || trainerTippAngeboten) return;
      if (appIstBeschaeftigt || antwortInput.value.trim() || document.getElementById("resultBox").style.display !== "none") return;
      const kilianView = document.getElementById("kilianView");
      if (kilianView && kilianView.classList.contains("active")) return;

      const hinweis = document.getElementById("trainerTippHinweis");
      if (!hinweis) return;
      trainerTippAngeboten = true;
      hinweis.hidden = false;
      hinweis.classList.add("trainer-tipp-neu");
    }, 5000);
  }

function fordereTrainerTippAn(event) {
    if (typeof pruefungIstAktiv !== 'undefined' && pruefungIstAktiv === true) {
      alert("Sorry – Betrug auf diesem Weg nicht möglich.\n\nDie Prüfung soll deinen tatsächlichen Wissensstand zeigen.\nIn den anderen Lernbereichen unterstütze ich dich danach gerne wieder.");
      return;
    }

    if (!aktuelleFrageId || trainerTippAngeboten === false) return;

    if (event) event.stopPropagation();

    trainerTippTimerAbbrechen();
    trainerTippAngeboten = true;

    // Show small hint bubble instead of full Kilian chat
    if (typeof zeigeTrainerHintBubble === "function") {
      zeigeTrainerHintBubble();
    }
  }

function ergaenzeLeereTabellenAntwortfelder() {
    const container = document.querySelector(".aufgaben-html-bereich");
    if (!container) return;

    container.querySelectorAll("table td").forEach(function(td) {
      if (td.closest("thead") || td.querySelector("input, textarea, select, button, label")) {
        return;
      }

      const text = String(td.textContent || "").replace(/\u00A0/g, " ").trim();
      if (text) return;
      if (td.dataset.trainerInputErzeugt === "true") return;

      const istTextarea = td.dataset.inputType === "textarea" || td.dataset.textarea === "true" || td.dataset.langeAntwort === "true";
      const feld = istTextarea ? document.createElement("textarea") : document.createElement("input");
      const answer = String(td.dataset.answer || td.getAttribute("data-answer") || td.dataset.loesung || td.getAttribute("data-loesung") || "").trim();
      const name = String(td.dataset.name || td.dataset.key || td.dataset.schluessel || "").trim();

      if (istTextarea) {
        feld.rows = 3;
      } else {
        feld.type = "text";
      }

      feld.className = "trainer-tabellen-input";
      feld.placeholder = istTextarea ? "Antwort..." : "Antwort...";
      feld.setAttribute("aria-label", "Tabellenantwort");
      if (answer) feld.setAttribute("data-answer", answer);
      if (name) feld.name = name;

      td.textContent = "";
      td.appendChild(feld);
      td.dataset.trainerInputErzeugt = "true";
    });
  }

function resetFrageAnzeige() {
    window.trainerKilianKontextLeeren?.();
    trainerTippTimerAbbrechen();
    // Close hint bubble when moving to another question
    if (typeof schliesseTrainerHint === "function") {
      schliesseTrainerHint();
    }
    const antwortInput = document.getElementById("antwortInput");
  const diagrammCanvas = document.getElementById("skizze-normal");
    const resultBox = document.getElementById("resultBox");
    const solutionBox = document.getElementById("solutionBox");
    const musterloesungText = document.getElementById("musterloesungText");
    const bewertungBox = document.getElementById("bewertungskriterien");
    const ergebnisText = document.getElementById("ergebnisText");
    const punkteAnzeige = document.getElementById("punkteAnzeige");

    if (antwortInput) antwortInput.value = "";
    if (diagrammCanvas) loescheSkizze("normal");
    letzteAusgewerteteAntwort = "";
    if (resultBox) resultBox.style.display = "none";
    if (solutionBox) solutionBox.style.display = "none";
    if (musterloesungText) musterloesungText.textContent = "";
    if (bewertungBox) {
      bewertungBox.innerHTML = "";
      bewertungBox.hidden = true;
    }
    if (ergebnisText) ergebnisText.textContent = "Hier erscheint die Bewertung.";
    if (punkteAnzeige) {
      punkteAnzeige.textContent = "0 / 0 Punkte";
      punkteAnzeige.classList.remove("good", "bad");
    }
    verbirgWiederholungsNavigation();
    aktualisiereWiederholungsSperre();
    setzeStatus("");
  }

// Vor Auswertung einer Wiederholungsfrage bleibt die Musterlösung verborgen, alle Eingaben sind sonst frei
function aktualisiereWiederholungsSperre() {
    const antwortInput = document.getElementById("antwortInput");
    const auswertungBtn = document.getElementById("btnAuswertungStarten");
    const antwortLeerenBtn = document.getElementById("btnAntwortLeeren");
    const musterloesungBtn = document.getElementById("btnMusterloesungAnzeigen");

    if (antwortInput) antwortInput.readOnly = false;
    if (auswertungBtn) auswertungBtn.disabled = false;
    if (antwortLeerenBtn) antwortLeerenBtn.disabled = false;
    if (musterloesungBtn) {
      musterloesungBtn.disabled = Boolean(wiederholungsKontext);
      musterloesungBtn.hidden = Boolean(wiederholungsKontext);
    }
  }

// Nach erfolgreicher Auswertung und Firestore-Speicherung einer Wiederholungsfrage wird der Versuch fixiert
function sperreAbgeschlossenenWiederholungsversuch() {
    const antwortInput = document.getElementById("antwortInput");
    const auswertungBtn = document.getElementById("btnAuswertungStarten");
    const antwortLeerenBtn = document.getElementById("btnAntwortLeeren");
    const musterloesungBtn = document.getElementById("btnMusterloesungAnzeigen");

    if (antwortInput) antwortInput.readOnly = true;
    if (auswertungBtn) auswertungBtn.disabled = true;
    if (antwortLeerenBtn) antwortLeerenBtn.disabled = true;
    if (musterloesungBtn) {
      musterloesungBtn.disabled = false;
      musterloesungBtn.hidden = false;
    }
  }

function verbirgWiederholungsNavigation() {
    trainerWiederholungSpeicherung = null;
    const box = document.getElementById("wiederholungNavBox");
    if (!box) return;
    box.style.display = "none";
    const hinweis = document.getElementById("wiederholungNavHinweis");
    if (hinweis) hinweis.textContent = "";
    const nextBtn = document.getElementById("btnNaechsterOffenerFehler");
    if (nextBtn) {
      nextBtn.style.display = "";
      nextBtn.disabled = false;
      nextBtn.textContent = "Nächsten offenen Fehler";
    }
  }

async function zeigeWiederholungsNavigation(speicherung = Promise.resolve()) {
    if (!wiederholungsKontext) return;
    const kontext = wiederholungsKontext;

    const box = document.getElementById("wiederholungNavBox");
    const hinweis = document.getElementById("wiederholungNavHinweis");
    const nextBtn = document.getElementById("btnNaechsterOffenerFehler");
    if (!box || !nextBtn) return;
    box.style.display = "block";
    const backBtn = document.getElementById("btnZurueckZurFehleranalyse");
    [nextBtn, backBtn].filter(Boolean).forEach(button => {
      button.disabled = false;
      button.style.opacity = "1";
      button.style.cursor = "";
    });

    try {
      // Render immediately, but only inspect errors after the new attempt is durable.
      await speicherung;
      if (wiederholungsKontext !== kontext || trainerWiederholungNavigationAngefordert) return;
      if (typeof window.ermittleNaechstenOffenenFehler !== "function") {
        throw new Error("Fehlerübersicht ist noch nicht bereit.");
      }

      const ergebnis = await window.ermittleNaechstenOffenenFehler(kontext.key);
      if (wiederholungsKontext !== kontext || trainerWiederholungNavigationAngefordert) return;

      if (ergebnis.hasOtherOpenError) {
        nextBtn.style.display = "";
        nextBtn.disabled = false;
        nextBtn.textContent = "Nächsten offenen Fehler";
        if (hinweis) hinweis.textContent = "";
      } else if (ergebnis.currentIsOpen) {
        nextBtn.style.display = "";
        nextBtn.disabled = false;
        nextBtn.textContent = "Diesen Fehler erneut versuchen";
        if (hinweis) hinweis.textContent = "";
      } else {
        nextBtn.style.display = "none";
        nextBtn.disabled = true;
        if (hinweis) hinweis.textContent = "Keine weiteren offenen Fehler.";
      }
    } catch (error) {
      if (wiederholungsKontext !== kontext || trainerWiederholungNavigationAngefordert) return;
      if (hinweis) hinweis.textContent = "Fehlerübersicht konnte nicht aktualisiert werden: " + error.message;
    }
  }

async function naechsterOffenerFehler() {
    if (trainerWiederholungNavigationAngefordert || (appIstBeschaeftigt && !trainerWiederholungSpeicherung)) return;
    if (!wiederholungsKontext) return;

    const kontext = wiederholungsKontext;
    const hinweis = document.getElementById("wiederholungNavHinweis");
    trainerWiederholungNavigationAngefordert = true;
    let eigeneSperre = false;

    try {
      await trainerWiederholungSpeicherung;
      if (wiederholungsKontext !== kontext) return;
      setzeAppBeschaeftigt(true);
      eigeneSperre = true;

      if (typeof window.ermittleNaechstenOffenenFehler !== "function") {
        throw new Error("Fehlerübersicht ist noch nicht bereit.");
      }

      const ergebnis = await window.ermittleNaechstenOffenenFehler(kontext.key);

      let zielAttempt = ergebnis.nextEntry ? ergebnis.nextEntry.latestAttempt : null;
      if (!zielAttempt && ergebnis.currentIsOpen) {
        zielAttempt = { fach: kontext.fach, frageId: kontext.frageId, thema: kontext.thema, bereich: kontext.bereich };
      }

      if (!zielAttempt) {
        if (hinweis) hinweis.textContent = "Keine weiteren offenen Fehler.";
        const nextBtn = document.getElementById("btnNaechsterOffenerFehler");
        if (nextBtn) nextBtn.style.display = "none";
        return;
      }

      if (typeof window.oeffneWiederholungAusAttempt !== "function") {
        throw new Error("Die Wiederholungsfunktion ist noch nicht bereit.");
      }

      await window.oeffneWiederholungAusAttempt(zielAttempt);
    } catch (error) {
      setzeStatus("Nächster offener Fehler konnte nicht geladen werden: " + error.message);
    } finally {
      trainerWiederholungNavigationAngefordert = false;
      if (eigeneSperre) setzeAppBeschaeftigt(false);
    }
  }

async function zurueckZurFehleranalyse() {
    if (trainerWiederholungNavigationAngefordert || (appIstBeschaeftigt && !trainerWiederholungSpeicherung)) return;
    const kontext = wiederholungsKontext;
    trainerWiederholungNavigationAngefordert = true;
    try {
      await trainerWiederholungSpeicherung;
      if (wiederholungsKontext !== kontext) return;
      wiederholungsKontext = null;
      if (typeof oeffneLernstandBereich === "function") {
        oeffneLernstandBereich("lernstandFehlerView");
      } else {
        zeigeBereich("lernstandFehlerView");
      }
    } catch (error) {
      setzeStatus("Lernstand konnte nicht gespeichert werden: " + error.message);
    } finally {
      trainerWiederholungNavigationAngefordert = false;
    }
  }

async function ladeTrainerThemenDaten(fach) {
    const result = await apiGet("topics", { fach });
    if (!result.success) {
      throw new Error(result.error || "Themen konnten nicht geladen werden.");
    }
    return result.data || [];
  }

window.ladeTrainerThemenDaten = ladeTrainerThemenDaten;

async function ladeThemen(fach) {
    const eigenerToken = ++ladeToken;

    try {
      setzeAppBeschaeftigt(true);

      const select = document.getElementById("themaSelect");
      const bereich = document.getElementById("themaBereich");

      select.innerHTML = '<option value="">Themen werden geladen...</option>';
      bereich.style.display = "block";
      document.getElementById("fachStatus").textContent = "Themen werden geladen für: " + fach;

      if (eigenerToken !== ladeToken) return;
      const themen = await ladeTrainerThemenDaten(fach);
      if (eigenerToken !== ladeToken) return;

      select.innerHTML = '<option value="">-- Thema wählen --</option>';

      if (!themen.length) {
        select.innerHTML = '<option value="">Keine Themen gefunden</option>';
        document.getElementById("fachStatus").textContent =
          "Keine Themen gefunden für: " + fach + ". Prüfe, ob im Sheet aktive Fragen mit Aktiv = ja vorhanden sind.";
        return;
      }

      themen.forEach(function(eintrag) {
  const themaName = typeof eintrag === "string"
    ? eintrag
    : String(eintrag.thema || "").trim();

  const anzahl = typeof eintrag === "object"
    ? Number(eintrag.anzahl || 0)
    : 0;

  const option = document.createElement("option");
  option.value = themaName;
  option.textContent = anzahl > 0
    ? themaName + " (" + anzahl + " Fragen)"
    : themaName;

  option.dataset.fragenAnzahl = anzahl;

  select.appendChild(option);
});

      document.getElementById("fachStatus").textContent =
        "Themen geladen für: " + fach + " (" + themen.length + ")";
      return themen;
    } catch (error) {
      if (eigenerToken !== ladeToken) return;

      document.getElementById("themaSelect").innerHTML =
        '<option value="">Fehler beim Laden</option>';

      document.getElementById("fachStatus").textContent =
        "Fehler beim Laden der Themen: " + error.message;
    } finally {
      if (eigenerToken === ladeToken) {
        setzeAppBeschaeftigt(false);
      }
    }
  }

function waehleFach(fach) {
    trainerShuffleResetState();
    trainerNochNieAktiv = false;
    trainerNochNieResetState();
    aktuellesFach = String(fach || "").trim();
    aktuellesThema = "";
    aktuelleFrage = "";
    aktuelleMusterloesung = "";
    aktuelleStichpunkte = [];
    aktuelleFrageId = "";
    if (typeof aktualisiereTrainerAuswahlFallback === "function") aktualisiereTrainerAuswahlFallback();

    document.getElementById("anzeigeFach").textContent = aktuellesFach || "Kein Fach";
    document.getElementById("anzeigeThema").textContent = "Bitte Thema wählen";
    document.getElementById("frageText").textContent = "Bitte zuerst ein Thema auswählen.";
    document.getElementById("fachStatus").textContent = "Ausgewähltes Fach: " + aktuellesFach;

    document.getElementById("themaSelect").innerHTML =
      '<option value="">Themen werden geladen...</option>';

    resetFrageAnzeige();
    updateStatAnzeige();

    if (aktuellesFach) {
      return ladeThemen(aktuellesFach);
    }
  }

  function zeigeGeladeneFrage(daten, fallbackThema, istWiederholungsfrage = false) {
    aktuelleFrage = daten.frage || "";
    aktuellesThema = daten.thema || fallbackThema || "Thema nicht hinterlegt";
    aktuelleMusterloesung = daten.musterloesung || "";
    aktuelleStichpunkte = String(daten.stichpunkte || "")
      .split(";")
      .map(function(punkt) {
        return punkt.trim();
      })
      .filter(Boolean);
    aktuelleFrageId = daten.id || "";

    const frageTextBox = document.getElementById("frageText");
    const antwortLabel = document.querySelector('label[for="antwortInput"]');
    const antwortInput = document.getElementById("antwortInput");
    const fragetyp = String(daten.fragetyp || "TEXT").trim().toUpperCase();
    const aufgabenHtml = String(daten.aufgabenHtml || "").trim();
    const frageGesamt = Number(daten.frageGesamt || 0);
    const fragePosition = Number(daten.fragePosition || 0);
    const fragePositionsBadge = istWiederholungsfrage
      ? '<span class="frage-id-badge">Wiederholungsfrage</span> '
      : frageGesamt > 0 && fragePosition > 0
        ? '<span class="frage-id-badge">Frage ' + fragePosition + ' von ' + frageGesamt + '</span> '
        : "";

    resetFrageAnzeige();

    window.trainerKilianKontextSetzen?.({
      bereich: aktuellerTeilbereich,
      fach: aktuellesFach,
      thema: aktuellesThema,
      frageId: aktuelleFrageId,
      frage: aktuelleFrage,
      musterloesung: aktuelleMusterloesung,
      bewertungskriterien: aktuelleStichpunkte.join('; ')
    });

    let frageHtml = "";
    if (aktuelleFrage) {
      frageHtml += "<div>" + fragePositionsBadge + escapeHtml(aktuelleFrage) + "</div>";
    }
    if (aufgabenHtml) {
      frageHtml += '<div class="aufgaben-html-bereich">' + sanitizeAufgabenHtml(aufgabenHtml) + "</div>";
    }
    if (fragetyp === "DIAGRAMM") {
      frageHtml += '<div class="pruefung-zusatzbereich normal-diagramm-bereich">' +
        '<strong>Skizzenbereich:</strong>' +
        '<div class="skizzen-toolbar">' +
        '<button type="button" onclick="zeichneAchsenvorlage(\'normal\')">Achsenvorlage</button>' +
        '<button type="button" onclick="loescheSkizze(\'normal\')">Skizze löschen</button>' +
        '</div>' +
        '<canvas class="skizzen-canvas" id="skizze-normal" width="760" height="420"></canvas>' +
        '</div>';
    }
    frageTextBox.innerHTML = frageHtml || "Keine Frage hinterlegt.";
    frageTextBox.dataset.fragetyp = fragetyp;
    frageTextBox.dataset.loesungsschluessel = String(daten.loesungsschluessel || "");

    ergaenzeLeereTabellenAntwortfelder();

    if (fragetyp === "DIAGRAMM" && typeof initialisiereSkizzenCanvas === "function") {
      initialisiereSkizzenCanvas(document.getElementById("skizze-normal"));
    }

    if (fragetyp === "ANKREUZ") {
      const ankreuzCheckboxes = frageTextBox.querySelectorAll('.aufgaben-html-bereich input[type="checkbox"]');
      ankreuzCheckboxes.forEach(function(checkbox) {
        checkbox.addEventListener("change", function() {
          const schluessel = String(checkbox.value || "").split("=")[0];
          ankreuzCheckboxes.forEach(function(andereCheckbox) {
            if (andereCheckbox !== checkbox && String(andereCheckbox.value || "").split("=")[0] === schluessel) {
              andereCheckbox.checked = false;
            }
          });
        });
      });
    }

    if (fragetyp === "TEXT") {
      if (antwortLabel) antwortLabel.style.display = "block";
      antwortInput.style.display = "block";
      antwortInput.placeholder = "Schreibe hier deine Antwort...";
    } else if (fragetyp === "RECHNUNG") {
      if (antwortLabel) antwortLabel.style.display = "block";
      antwortInput.style.display = "block";
      antwortInput.placeholder = "Trage hier deinen Rechenweg oder deine Ergänzung ein...";
    } else if (fragetyp === "DIAGRAMM") {
      if (antwortLabel) antwortLabel.style.display = "block";
      antwortInput.style.display = "block";
      antwortInput.placeholder = "Schriftliche Ergänzung zur Skizze (optional)...";
    } else {
      if (antwortLabel) antwortLabel.style.display = "none";
      antwortInput.style.display = "none";
      antwortInput.value = "";
    }

    if (daten.bilddatei) {
      frageTextBox.innerHTML += `
        <div class="question-image-wrap">
          <img src="bilder/${daten.bilddatei}" alt="Aufgabenbild" class="question-image">
        </div>
      `;
    }

    if (String(daten.id || "").trim()) {
      aktuelleFrageId = String(daten.id || "").trim();
      speichereTrainerFortschritt(aktuellesFach, aktuellesThema, aktuelleFrageId);
    }

    document.getElementById("anzeigeThema").textContent = aktuellesThema;
    starteTrainerTippTimer();
    trainerAktualisiereVorherigeSchaltflaeche();
  }

async function ladeFrageAusFach(fach, thema, currentId = "", usageTicket = window.WifaUsage?.captureTicket(), rueckwaerts = false) {
  trainerTippTimerAbbrechen();
    const eigenerToken = ++ladeToken;

    try {
      setzeAppBeschaeftigt(true);
      setzeStatus("Frage wird geladen...");

      let result;
      if (rueckwaerts) {
        const pool = await trainerThemenpoolLaden(fach, thema);
        const index = pool.findIndex(frage => frage.id === currentId);
        result = {success:true, data:pool.length ? pool[(index <= 0 ? pool.length : index) - 1] : {}};
      } else {
        result = await apiGet("nextQuestion", { fach, thema, currentId });
        if (eigenerToken !== ladeToken) return;
        // The existing backend returns a completion sentinel at the last question.
        if (result && result.success && result.data?.themaAbgeschlossen) {
          result = await apiGet("nextQuestion", { fach, thema, currentId:"" });
        }
      }

      if (eigenerToken !== ladeToken) return;

      if (!result.success) {
        throw new Error(result.error || "Frage konnte nicht geladen werden.");
      }

      const daten = result.data || {};
if (daten.themaAbgeschlossen) {
  window.WifaAnalytics?.complete('trainer');
  aktuelleFrage = "";
  aktuelleMusterloesung = "";
  aktuelleStichpunkte = [];
  aktuelleFrageId = "";

  const frageGesamt = Number(daten.frageGesamt || 0);

  document.getElementById("frageText").innerHTML =
    '<div class="thema-abgeschlossen-box">' +
      '<strong>Thema abgeschlossen</strong><br>' +
      'Du hast alle ' + frageGesamt + ' Fragen in diesem Thema einmal durchgeklickt.<br>' +
      'Wenn du nochmal von vorne starten möchtest, klicke erneut auf <strong>Thema starten</strong>.' +
    '</div>';

  document.getElementById("anzeigeThema").textContent = aktuellesThema;

  const antwortLabel = document.querySelector('label[for="antwortInput"]');
  const antwortInput = document.getElementById("antwortInput");

  if (antwortLabel) antwortLabel.style.display = "none";
  antwortInput.style.display = "none";
  antwortInput.value = "";

  document.getElementById("resultBox").style.display = "none";
  document.getElementById("solutionBox").style.display = "none";

  setzeStatus("Thema abgeschlossen.");
  return;
}
      if (!daten.id) {
        aktuelleFrage = "";
        aktuelleMusterloesung = "";
        aktuelleStichpunkte = [];
        aktuelleFrageId = "";

        document.getElementById("frageText").textContent =
          daten.frage || "Keine aktive Frage gefunden.";
        document.getElementById("anzeigeThema").textContent = thema || "Thema nicht hinterlegt";

        resetFrageAnzeige();
        setzeStatus("Keine aktive Frage gefunden.");
        return;
      }

      zeigeGeladeneFrage(daten, thema);
      window.WifaAnalytics?.start('trainer', fach, thema);
      if (window.WifaUsage?.isCurrent(usageTicket)) window.WifaUsage.start('trainer', fach);
      window.WifaAnalytics?.content('trainer', fach, daten.thema || thema);

      setzeStatus("Frage geladen.");
    } catch (error) {
      if (eigenerToken !== ladeToken) return;

      setzeStatus("Fehler beim Laden der nächsten Frage: " + error.message + " Die bisherige Frage bleibt erhalten.");
    } finally {
      if (eigenerToken === ladeToken) {
        setzeAppBeschaeftigt(false);
        trainerAktualisiereVorherigeSchaltflaeche();
      }
    }
  }

async function starteThema() {
    const usageTicket = window.WifaUsage?.captureTicket();
    if (appIstBeschaeftigt) return;
    trainerShuffleResetState();
    trainerNochNieAktiv = false;
    trainerNochNieResetState();

    const thema = document.getElementById("themaSelect").value;

    if (!aktuellerTeilbereich) {
      alert("Bitte zuerst einen Teilbereich auswählen.");
      return;
    }

    if (!aktuellesFach) {
      alert("Bitte zuerst ein Fach auswählen.");
      return;
    }

    if (!thema) {
      alert("Bitte zuerst ein Thema auswählen.");
      return;
    }

    window.WifaAnalytics?.reset('trainer');
    window.WifaUsage?.reset('trainer');
    aktuellesThema = thema;
    aktuelleFrageId = "";
    wiederholungsKontext = null;
    if (typeof aktualisiereTrainerAuswahlFallback === "function") aktualisiereTrainerAuswahlFallback();

    const gespeicherteFrageId = await ladeTrainerFortschritt(aktuellesFach, aktuellesThema);
    ladeFrageAusFach(aktuellesFach, aktuellesThema, gespeicherteFrageId || "", usageTicket);
  }

function naechsteFrage() {
    if (appIstBeschaeftigt) return;

    if (!aktuellerTeilbereich) {
      alert("Bitte zuerst einen Teilbereich auswählen.");
      return;
    }

    if (!aktuellesFach) {
      alert("Bitte zuerst ein Fach auswählen.");
      return;
    }

    if (!aktuellesThema) {
      alert("Bitte zuerst ein Thema auswählen.");
      return;
    }

    if (trainerNochNieAktiv) {
      setzeAppBeschaeftigt(true);
      return trainerNochNieNaechsteFrage().catch(error => setzeStatus(error.message)).finally(() => {
        setzeAppBeschaeftigt(false);
        trainerAktualisiereVorherigeSchaltflaeche();
      });
    }
    wiederholungsKontext = null;
    if (trainerShuffleAktiv) return trainerShuffleNaechsteFrage();
    return ladeFrageAusFach(aktuellesFach, aktuellesThema, aktuelleFrageId);
  }

function vorherigeFrage() {
  if (appIstBeschaeftigt || !aktuellerTeilbereich || !aktuellesFach || !aktuellesThema || !aktuelleFrageId) return;
  wiederholungsKontext = null;
  if (trainerShuffleAktiv) {
    if (trainerShuffleHistoryIndex <= 0) return;
    const id = trainerShuffleHistory[--trainerShuffleHistoryIndex];
    const frage = trainerShufflePool.find(frage => frage.id === id);
    if (frage) zeigeGeladeneFrage(frage, aktuellesThema);
    return;
  }
  if (trainerNochNieAktiv) {
    if (trainerNochNieHistoryIndex <= 0) return;
    const id = trainerNochNieHistory[--trainerNochNieHistoryIndex];
    const frage = trainerFragenCache.get(id);
    if (frage) zeigeGeladeneFrage(frage, aktuellesThema);
    return;
  }
  return ladeFrageAusFach(aktuellesFach, aktuellesThema, aktuelleFrageId, window.WifaUsage?.captureTicket(), true);
}

function antwortLeeren() {
    if (appIstBeschaeftigt) return;

    const antwortInput = document.getElementById("antwortInput");
    if (antwortInput) antwortInput.value = "";

    document.querySelectorAll(".aufgaben-html-bereich input[type='text'], .aufgaben-html-bereich textarea, .aufgaben-html-bereich select").forEach(function(element) {
      element.value = "";
    });

    document.querySelectorAll(".aufgaben-html-bereich input[type='checkbox'], .aufgaben-html-bereich input[type='radio']").forEach(function(element) {
      element.checked = false;
    });

    if (document.getElementById("skizze-normal")) loescheSkizze("normal");
    letzteAusgewerteteAntwort = "";
  }

document.getElementById("antwortInput").addEventListener("keydown", function(event) {
  if (event.key !== "Enter" || event.shiftKey) return;

  const antwort = event.currentTarget.value.trim();
  if (!antwort || appIstBeschaeftigt || antwort === letzteAusgewerteteAntwort) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  bewerteAntwort();
});

document.getElementById("antwortInput").addEventListener("input", function(event) {
  if (event.currentTarget.value.trim()) {
    trainerTippAusblenden();
  }
});

function oeffneWifaWiederholungsfrage(daten, kontext) {
  const fach = String(kontext?.fach || "").trim();
  const bereich = String(kontext?.bereich || ermittleTeilbereich(fach)).trim();
  const thema = String(daten.thema || kontext?.thema || "").trim();

  if (!fach || !bereich || !String(daten?.id || "").trim()) {
    throw new Error("Die Wiederholungsfrage enthält keine vollständigen Trainerdaten.");
  }

  aktuellerTeilbereich = bereich;
  aktuellesFach = fach;
  aktuellesThema = thema;
  wiederholungsKontext = {
    fach,
    frageId: String(daten.id || "").trim(),
    thema,
    bereich,
    key: fach + "::" + String(daten.id || "").trim()
  };

  const teilbereichSelect = document.getElementById("teilbereichSelect");
  const fachSelect = document.getElementById("fachSelect");
  const themaSelect = document.getElementById("themaSelect");
  teilbereichSelect.value = bereich;
  fachSelect.innerHTML = '<option value="">-- Fach wählen --</option>';
  (faecherNachTeilbereich[bereich] || []).forEach(function(fachName) {
    const option = document.createElement("option");
    option.value = fachName;
    option.textContent = fachName;
    fachSelect.appendChild(option);
  });
  fachSelect.value = fach;
  themaSelect.innerHTML = '<option value="">-- Thema wählen --</option>';
  const themaOption = document.createElement("option");
  themaOption.value = thema;
  themaOption.textContent = thema;
  themaSelect.appendChild(themaOption);
  themaSelect.value = thema;

  document.getElementById("fachBereich").style.display = "block";
  document.getElementById("themaBereich").style.display = "block";
  document.getElementById("anzeigeTeilbereich").textContent = bereich;
  document.getElementById("anzeigeFach").textContent = fach;
  document.getElementById("fachStatus").textContent = "Wiederholungsfrage geladen: " + fach;
  updateStatAnzeige();
  zeigeBereich("trainerView");
  zeigeGeladeneFrage(daten, thema, true);
  setzeStatus("Wiederholungsfrage geladen.");
  document.getElementById("frageText").scrollIntoView({ behavior: "smooth", block: "start" });
}

window.oeffneWifaWiederholungsfrage = oeffneWifaWiederholungsfrage;

window.trainerNochNieBeantwortet = trainerNochNieBeantwortet;
