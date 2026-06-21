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

function ermittleTeilbereich(fach) {
    if (faecherNachTeilbereich.WQ.includes(fach)) return "WQ";
    if (faecherNachTeilbereich.HQ.includes(fach)) return "HQ";
    return aktuellerTeilbereich || "";
  }

function resetFrageAnzeige() {
    document.getElementById("antwortInput").value = "";
    document.getElementById("resultBox").style.display = "none";
    document.getElementById("solutionBox").style.display = "none";
    document.getElementById("musterloesungText").textContent = "";
    document.getElementById("ergebnisText").textContent = "Hier erscheint die Bewertung.";
    document.getElementById("punkteAnzeige").textContent = "0 / 0 Punkte";
    document.getElementById("punkteAnzeige").classList.remove("good", "bad");
    setzeStatus("");
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

      themen.forEach(function(thema) {
        const option = document.createElement("option");
        option.value = thema;
        option.textContent = thema;
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

async function ladeFrageAusFach(fach, thema) {
    const eigenerToken = ++ladeToken;

    try {
      setzeAppBeschaeftigt(true);
      setzeStatus("Frage wird geladen...");

      const result = await apiGet("nextQuestion", { fach, thema });

      if (eigenerToken !== ladeToken) return;

      if (!result.success) {
        throw new Error(result.error || "Frage konnte nicht geladen werden.");
      }

      const daten = result.data || {};

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

      aktuelleFrage = daten.frage || "";
      aktuellesThema = daten.thema || thema || "Thema nicht hinterlegt";
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

let frageHtml = "";

const frageIdBadge = aktuelleFrageId
  ? '<span class="frage-id-badge">ID ' + escapeHtml(aktuelleFrageId) + '</span> '
  : "";

if (aktuelleFrage) {
  frageHtml += "<div>" + frageIdBadge + escapeHtml(aktuelleFrage) + "</div>";
}

if (aufgabenHtml) {
  frageHtml += '<div class="aufgaben-html-bereich">' + aufgabenHtml + "</div>";
}

frageTextBox.innerHTML = frageHtml || "Keine Frage hinterlegt.";

if (fragetyp === "TEXT") {
  if (antwortLabel) antwortLabel.style.display = "block";
  antwortInput.style.display = "block";
  antwortInput.placeholder = "Schreibe hier deine Antwort...";
} else if (fragetyp === "RECHNUNG") {
  if (antwortLabel) antwortLabel.style.display = "block";
  antwortInput.style.display = "block";
  antwortInput.placeholder = "Trage hier deinen Rechenweg oder deine Ergänzung ein...";
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
      document.getElementById("anzeigeThema").textContent = aktuellesThema;

      setzeStatus("Frage geladen.");
    } catch (error) {
      if (eigenerToken !== ladeToken) return;

      aktuelleFrage = "";
      aktuelleMusterloesung = "";
      aktuelleFrageId = "";

      document.getElementById("frageText").textContent = "Fehler beim Laden der Frage.";
      setzeStatus("Fehler: " + error.message);
    } finally {
      if (eigenerToken === ladeToken) {
        setzeAppBeschaeftigt(false);
      }
    }
  }

function starteThema() {
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
    ladeFrageAusFach(aktuellesFach, aktuellesThema);
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

    ladeFrageAusFach(aktuellesFach, aktuellesThema);
  }

function antwortLeeren() {
    if (appIstBeschaeftigt) return;
    document.getElementById("antwortInput").value = "";
  }
