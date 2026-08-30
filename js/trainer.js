function waehleTeilbereich() {
    if (appIstBeschaeftigt) return;

    ladeToken++;
    aktuellerTeilbereich = document.getElementById("teilbereichSelect").value;
    aktuellesFach = "";
    aktuellesThema = "";
    aktuelleFrage = "";
    aktuelleMusterloesung = "";
    aktuelleStichpunkte = [];
    aktuelleFrageId = "";

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
  if (appIstBeschaeftigt) return;
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
      ladeFrageAusFach(context.fach, context.auswahl === "__ALL__" ? aktuellesThema : context.auswahl, "");
      setzeStatus("Fortschritt zurückgesetzt: Du startest wieder von vorne.");
    })
    .catch(function(error) {
      setzeStatus("Fortschritt konnte nicht zurückgesetzt werden: " + (error.message || error));
    });
}

function trainerShuffleMix() {
  trainerShuffleAktiv = !trainerShuffleAktiv;
  const btn = document.getElementById("trainerShuffleBtn");
  if (btn) {
    btn.classList.toggle("active", trainerShuffleAktiv);
    btn.textContent = trainerShuffleAktiv ? "Shuffle Mix: AN" : "Shuffle Mix";
  }
  setzeStatus(trainerShuffleAktiv
    ? "Shuffle Mix aktiv – dieser Verlauf bleibt nur in dieser Session lokal."
    : "Shuffle Mix deaktiviert – Fortschritt wird wieder gespeichert.");
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

async function zeigeWiederholungsNavigation() {
    if (!wiederholungsKontext) return;

    const box = document.getElementById("wiederholungNavBox");
    const hinweis = document.getElementById("wiederholungNavHinweis");
    const nextBtn = document.getElementById("btnNaechsterOffenerFehler");
    if (!box || !nextBtn) return;

    try {
      if (typeof window.ermittleNaechstenOffenenFehler !== "function") {
        throw new Error("Fehlerübersicht ist noch nicht bereit.");
      }

      const ergebnis = await window.ermittleNaechstenOffenenFehler(wiederholungsKontext.key);

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
      if (hinweis) hinweis.textContent = "Fehlerübersicht konnte nicht aktualisiert werden: " + error.message;
    } finally {
      box.style.display = "block";
    }
  }

async function naechsterOffenerFehler() {
    if (appIstBeschaeftigt) return;
    if (!wiederholungsKontext) return;

    const kontext = wiederholungsKontext;
    const hinweis = document.getElementById("wiederholungNavHinweis");

    try {
      setzeAppBeschaeftigt(true);

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
        return;
      }

      if (typeof window.oeffneWiederholungAusAttempt !== "function") {
        throw new Error("Die Wiederholungsfunktion ist noch nicht bereit.");
      }

      await window.oeffneWiederholungAusAttempt(zielAttempt);
    } catch (error) {
      setzeStatus("Nächster offener Fehler konnte nicht geladen werden: " + error.message);
    } finally {
      setzeAppBeschaeftigt(false);
    }
  }

function zurueckZurFehleranalyse() {
    if (appIstBeschaeftigt) return;
    wiederholungsKontext = null;
    if (typeof oeffneLernstandBereich === "function") {
      oeffneLernstandBereich("lernstandFehlerView");
    } else {
      zeigeBereich("lernstandFehlerView");
    }
  }

async function ladeThemen(fach) {
    const eigenerToken = ++ladeToken;

    try {
      setzeAppBeschaeftigt(true);

      const select = document.getElementById("themaSelect");
      const bereich = document.getElementById("themaBereich");

      select.innerHTML = '<option value="">Themen werden geladen...</option>';
      bereich.style.display = "block";
      document.getElementById("fachStatus").textContent = "Themen werden geladen für: " + fach;

      const result = await apiGet("topics", { fach });

      if (eigenerToken !== ladeToken) return;

      if (!result.success) {
        throw new Error(result.error || "Themen konnten nicht geladen werden.");
      }

      const themen = result.data || [];

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
    aktuellesFach = String(fach || "").trim();
    aktuellesThema = "";
    aktuelleFrage = "";
    aktuelleMusterloesung = "";
    aktuelleStichpunkte = [];
    aktuelleFrageId = "";

    document.getElementById("anzeigeFach").textContent = aktuellesFach || "Kein Fach";
    document.getElementById("anzeigeThema").textContent = "Bitte Thema wählen";
    document.getElementById("frageText").textContent = "Bitte zuerst ein Thema auswählen.";
    document.getElementById("fachStatus").textContent = "Ausgewähltes Fach: " + aktuellesFach;

    document.getElementById("themaSelect").innerHTML =
      '<option value="">Themen werden geladen...</option>';

    resetFrageAnzeige();
    updateStatAnzeige();

    if (aktuellesFach) {
      ladeThemen(aktuellesFach);
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

    let frageHtml = "";
    if (aktuelleFrage) {
      frageHtml += "<div>" + fragePositionsBadge + escapeHtml(aktuelleFrage) + "</div>";
    }
    if (aufgabenHtml) {
      frageHtml += '<div class="aufgaben-html-bereich">' + aufgabenHtml + "</div>";
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
  }

async function ladeFrageAusFach(fach, thema, currentId = "") {
  trainerTippTimerAbbrechen();
    const eigenerToken = ++ladeToken;

    try {
      setzeAppBeschaeftigt(true);
      setzeStatus("Frage wird geladen...");

      const result = await apiGet("nextQuestion", { fach, thema, currentId });

      if (eigenerToken !== ladeToken) return;

      if (!result.success) {
        throw new Error(result.error || "Frage konnte nicht geladen werden.");
      }

      const daten = result.data || {};
if (daten.themaAbgeschlossen) {
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

      setzeStatus("Frage geladen.");
    } catch (error) {
      if (eigenerToken !== ladeToken) return;

      setzeStatus("Fehler beim Laden der nächsten Frage: " + error.message + " Die bisherige Frage bleibt erhalten.");
    } finally {
      if (eigenerToken === ladeToken) {
        setzeAppBeschaeftigt(false);
      }
    }
  }

async function starteThema() {
    if (appIstBeschaeftigt) return;

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

    aktuellesThema = thema;
    aktuelleFrageId = "";
    wiederholungsKontext = null;

    const gespeicherteFrageId = await ladeTrainerFortschritt(aktuellesFach, aktuellesThema);
    ladeFrageAusFach(aktuellesFach, aktuellesThema, gespeicherteFrageId || "");
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

    wiederholungsKontext = null;
    ladeFrageAusFach(aktuellesFach, aktuellesThema, aktuelleFrageId);
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
