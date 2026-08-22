// Ansicht "Lerntexte & Podcast"

const lerntexteFaecher = [
  "Führung und Zusammenarbeit",
  "Rechnungswesen",
  "Recht",
  "Steuern",
  "BWL",
  "VWL",
  "Unternehmensführung",
  "Betriebliches Management",
  "Logistik",
  "Marketing",
  "Vertrieb",
  "Betriebliches Rechnungswesen und Controlling",
  "Investition und Finanzierung"
];

let lerntexteFaecherAufgebaut = false;
let lerntexteAktuellesFach = "";
let lerntexteAktuellesKapitel = "";
let lerntexteDaten = [];

let lerntexteAudioAktiv = false;
let lerntexteAudioPausiert = false;
let lerntexteAudioGeneration = 0;

function lerntexteElement(id) {
  return document.getElementById(id);
}

function initialisiereLerntexteAnsicht() {
  if (lerntexteFaecherAufgebaut) return;
  lerntexteFaecherAufgebaut = true;

  const grid = lerntexteElement("lerntexteFachGrid");
  grid.innerHTML = "";

  lerntexteFaecher.forEach(function (fach) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subject-btn";
    button.textContent = fach;
    button.onclick = function () {
      lerntexteFachWaehlen(fach);
    };
    grid.appendChild(button);
  });
}

async function lerntexteFachWaehlen(fach) {
  lerntexteAudioStoppen();
  lerntexteAktuellesFach = fach;
  lerntexteAktuellesKapitel = "";
  lerntexteDaten = [];

  document.querySelectorAll("#lerntexteFachGrid .subject-btn").forEach(function (button) {
    button.classList.toggle("active", button.textContent === fach);
  });

  lerntexteElement("lerntexteKapitelBereich").style.display = "none";
  lerntexteElement("lerntexteAudioCard").style.display = "none";
  lerntexteElement("lerntexteInhaltBereich").innerHTML = "";

  try {
    lerntexteElement("lerntexteStatus").textContent = "Lerntexte werden geladen...";

    const result = await apiGet("getLerntexte", { fach: fach });

    if (!result.success) {
      throw new Error(result.error || "Lerntexte konnten nicht geladen werden.");
    }

    lerntexteDaten = (result.data || [])
      .slice()
      .sort(function (a, b) {
        return (Number(a.reihenfolgeFach) || 0) - (Number(b.reihenfolgeFach) || 0)
          || (Number(a.reihenfolgeKapitel) || 0) - (Number(b.reihenfolgeKapitel) || 0);
      });

    if (!lerntexteDaten.length) {
      lerntexteElement("lerntexteStatus").textContent = "Für dieses Fach sind noch keine Lerntexte hinterlegt.";
      return;
    }

    lerntexteBaueKapitelDropdown();
    lerntexteElement("lerntexteKapitelBereich").style.display = "block";
    lerntexteElement("lerntexteAudioCard").style.display = "block";
    lerntexteElement("lerntexteStatus").textContent = lerntexteDaten.length + " Lerneinheiten geladen.";

    lerntexteAnzeigen();

  } catch (error) {
    lerntexteElement("lerntexteStatus").textContent =
      "Fehler beim Laden der Lerntexte: " + error.message;
  }
}

function lerntexteBaueKapitelDropdown() {
  const select = lerntexteElement("lerntexteKapitelSelect");
  select.innerHTML = '<option value="">Alle Kapitel</option>';

  const gesehen = new Set();

  lerntexteDaten.forEach(function (eintrag) {
    const key = String(eintrag.hauptkapitelNr);
    if (gesehen.has(key)) return;
    gesehen.add(key);

    const option = document.createElement("option");
    option.value = key;
    option.textContent = "Kapitel " + eintrag.hauptkapitelNr + " – " + eintrag.hauptkapitel;
    select.appendChild(option);
  });
}

function lerntexteKapitelWaehlen() {
  lerntexteAudioStoppen();
  lerntexteAktuellesKapitel = lerntexteElement("lerntexteKapitelSelect").value;
  lerntexteAnzeigen();
}

function lerntexteAusgewaehlteEinheiten() {
  if (!lerntexteAktuellesKapitel) return lerntexteDaten;
  return lerntexteDaten.filter(function (eintrag) {
    return String(eintrag.hauptkapitelNr) === lerntexteAktuellesKapitel;
  });
}

// Erkennt vollständig großgeschriebene Abschnittsbezeichnungen (z.B. "KERNIDEE:") am Absatzanfang,
// nach einem Zeilenumbruch oder nach " | " und hebt sie in der lila Akzentfarbe hervor.
function lerntexteHebeAbschnittsbezeichnungenHervor(escapedText) {
  return escapedText.replace(
    /(^|\n|\|\s*)([A-ZÄÖÜ][A-ZÄÖÜ0-9 \/\-\.]*:)/gm,
    function (match, prefix, label) {
      return prefix + '<strong class="lerntexte-abschnitt">' + label + "</strong>";
    }
  );
}

function lerntexteFormatiereText(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map(function (absatz) {
      const hervorgehoben = lerntexteHebeAbschnittsbezeichnungenHervor(escapeHtml(absatz));
      return "<p>" + hervorgehoben.replace(/\n/g, "<br>") + "</p>";
    })
    .join("");
}

// Google Sheets interpretiert Werte wie "1.1" oder "5.10" teils als Datum
function lerntexteNormalisiereUnterkapitelNr(wert) {
  const text = String(wert === null || wert === undefined ? "" : wert).trim();

  if (/^\d+\.\d+$/.test(text)) return text;

  const datum = new Date(wert);
  if (!isNaN(datum.getTime())) {
    return datum.getDate() + "." + (datum.getMonth() + 1);
  }

  return text;
}

function lerntexteAnzeigen() {
  const bereich = lerntexteElement("lerntexteInhaltBereich");
  bereich.innerHTML = "";

  const einheiten = lerntexteAusgewaehlteEinheiten();
  if (!einheiten.length) return;

  const zeigeKapitelUeberschrift = !lerntexteAktuellesKapitel;
  let letzteKapitelNr = null;

  einheiten.forEach(function (eintrag) {
    if (zeigeKapitelUeberschrift && String(eintrag.hauptkapitelNr) !== letzteKapitelNr) {
      letzteKapitelNr = String(eintrag.hauptkapitelNr);

      const kapitelTitel = document.createElement("h3");
      kapitelTitel.className = "lerntexte-kapitel-titel";
      kapitelTitel.textContent = "Kapitel " + eintrag.hauptkapitelNr + " – " + eintrag.hauptkapitel;
      bereich.appendChild(kapitelTitel);
    }

    const block = document.createElement("div");
    block.className = "lerntexte-einheit";

    const titel = document.createElement("h4");
    titel.className = "lerntexte-einheit-titel";
    const unterkapitelNr = eintrag.unterkapitelNr ? lerntexteNormalisiereUnterkapitelNr(eintrag.unterkapitelNr) : "";
    titel.textContent = (unterkapitelNr ? unterkapitelNr + " " : "") + (eintrag.titel || "");

    const text = document.createElement("div");
    text.className = "lerntexte-text";
    text.innerHTML = lerntexteFormatiereText(eintrag.lerntext);

    block.appendChild(titel);
    block.appendChild(text);
    bereich.appendChild(block);
  });
}

function lerntexteAudioSteuerungAktualisieren() {
  lerntexteElement("lerntexteAudioPauseBtn").disabled = !(lerntexteAudioAktiv && !lerntexteAudioPausiert);
  lerntexteElement("lerntexteAudioStopBtn").disabled = !lerntexteAudioAktiv;
}

function lerntexteAudioStoppen(status) {
  lerntexteAudioGeneration++;
  lerntexteAudioAktiv = false;
  lerntexteAudioPausiert = false;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  if (lerntexteElement("lerntexteAudioStatus")) {
    lerntexteElement("lerntexteAudioStatus").textContent = status || "Audio gestoppt.";
  }
  if (lerntexteElement("lerntexteAudioPauseBtn")) {
    lerntexteAudioSteuerungAktualisieren();
  }
}

function lerntexteAudioAbspielen() {
  if (lerntexteAudioPausiert) {
    if ("speechSynthesis" in window) window.speechSynthesis.resume();
    lerntexteAudioPausiert = false;
    lerntexteAudioSteuerungAktualisieren();
    lerntexteElement("lerntexteAudioStatus").textContent = "Audio läuft.";
    return;
  }

  const einheiten = lerntexteAusgewaehlteEinheiten();
  if (!einheiten.length) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Keine Lerneinheiten zum Anhören vorhanden.";
    return;
  }
  if (!("speechSynthesis" in window)) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Dein Browser unterstützt die Vorlesefunktion leider nicht.";
    return;
  }

  lerntexteAudioStoppen();
  lerntexteAudioAktiv = true;
  const generation = ++lerntexteAudioGeneration;
  lerntexteAudioSteuerungAktualisieren();

  lerntexteSprechen(einheiten, 0, generation);
}

function lerntexteSprechen(einheiten, index, generation) {
  if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
  if (index >= einheiten.length) {
    lerntexteAudioStoppen("Alle Podcast-Texte wurden vorgelesen.");
    return;
  }

  const eintrag = einheiten[index];
  const utterance = new SpeechSynthesisUtterance(String(eintrag.podcastText || eintrag.lerntext || ""));
  utterance.lang = "de-DE";

  utterance.onstart = function () {
    if (generation !== lerntexteAudioGeneration) return;
    lerntexteElement("lerntexteAudioStatus").textContent =
      "Audio läuft: Einheit " + (index + 1) + " von " + einheiten.length;
  };

  utterance.onend = function () {
    if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
    lerntexteSprechen(einheiten, index + 1, generation);
  };

  utterance.onerror = function () {
    if (generation === lerntexteAudioGeneration) {
      lerntexteAudioStoppen("Audio konnte nicht abgespielt werden.");
    }
  };

  window.speechSynthesis.speak(utterance);
}

function lerntexteAudioPausieren() {
  if (!lerntexteAudioAktiv || lerntexteAudioPausiert) return;
  lerntexteAudioPausiert = true;
  if ("speechSynthesis" in window) window.speechSynthesis.pause();
  lerntexteElement("lerntexteAudioStatus").textContent = "Audio pausiert.";
  lerntexteAudioSteuerungAktualisieren();
}

window.initialisiereLerntexteAnsicht = initialisiereLerntexteAnsicht;
window.lerntexteAudioStoppen = lerntexteAudioStoppen;
