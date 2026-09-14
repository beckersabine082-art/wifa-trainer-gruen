const pruefungsEinheitenNachTeilbereich = {
  WQ: [
    { key: "VWL/BWL", label: "VWL/BWL", zeit: 75, punkte: 100 },
    { key: "Rechnungswesen", label: "Rechnungswesen", zeit: 90, punkte: 100 },
    { key: "Recht und Steuern", label: "Recht und Steuern", zeit: 75, punkte: 100 },
    { key: "Unternehmensführung", label: "Unternehmensführung", zeit: 90, punkte: 100 }
  ],
  HQ: [
    {
      key: "HQ_A1",
      label: "Aufgabenstellung 1 – Betriebliches Management | Marketing | Führung und Zusammenarbeit",
      zeit: 240,
      punkte: 100
    },
    {
      key: "HQ_A2",
      label: "Aufgabenstellung 2 – Investition, Finanzierung, Rechnungswesen und Controlling | Logistik | Vertrieb",
      zeit: 240,
      punkte: 100
    }
  ]
};

// Schreibgeschützter Zugriff auf den Prüfungskatalog für js/pruefungslernstand.js (Modul-Scope sieht dieses const sonst nicht)
window.getPruefungsEinheitenNachTeilbereich = function() {
  return pruefungsEinheitenNachTeilbereich;
};

let pruefungAuswertungBereitsGespeichert = false;
let pruefungAuswertungWirdGespeichert = false;
let pruefungLetzterSpeicherPayload = null;
let pruefungIstAktiv = false;
let pruefungAuswertungLaeuft = false;
let pruefungLadeVersion = 0;
let pruefungAbgabeWirdGestartet = false;
let pruefungIstAbgeschlossen = false;
let pruefungLaufEndzeit = null;
let pruefungLaufKontext = null;

const PRUEFUNG_LAUF_STORAGE_KEY = "wifa.pruefung.lauf.v1";

function holePruefungLaufSpeicher() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch (error) {}

  try {
    return window.sessionStorage || null;
  } catch (error) {
    return null;
  }
}

function leseGespeichertenPruefungslauf() {
  const speicher = holePruefungLaufSpeicher();
  if (!speicher) return null;

  try {
    const rohwert = speicher.getItem(PRUEFUNG_LAUF_STORAGE_KEY);
    if (!rohwert) return null;

    const lauf = JSON.parse(rohwert);
    if (!lauf || lauf.version !== 1 || !Number.isFinite(Number(lauf.endTime))) return null;
    if (!lauf.teilbereich || !lauf.simulation || !lauf.einheit) return null;

    return {
      ...lauf,
      endTime: Number(lauf.endTime),
      antworten: Array.isArray(lauf.antworten) ? lauf.antworten : []
    };
  } catch (error) {
    return null;
  }
}

function speicherePruefungslauf(lauf) {
  const speicher = holePruefungLaufSpeicher();
  if (!speicher) return;

  try {
    speicher.setItem(PRUEFUNG_LAUF_STORAGE_KEY, JSON.stringify(lauf));
  } catch (error) {}
}

function loescheGespeichertenPruefungslauf() {
  const speicher = holePruefungLaufSpeicher();
  if (!speicher) return;

  try {
    speicher.removeItem(PRUEFUNG_LAUF_STORAGE_KEY);
  } catch (error) {}
}

function erstellePruefungsLaufKontext(teilbereich, simulation, einheit) {
  return {
    teilbereich: String(teilbereich || ""),
    simulation: String(simulation || ""),
    einheit: String(einheit || "")
  };
}

function pruefungLaufPasstZuKontext(lauf, kontext) {
  return Boolean(
    lauf
    && kontext
    && String(lauf.teilbereich) === String(kontext.teilbereich)
    && String(lauf.simulation) === String(kontext.simulation)
    && String(lauf.einheit) === String(kontext.einheit)
  );
}

function pruefungEingabenElemente() {
  return Array.from(document.querySelectorAll(
    "#pruefungContainer textarea.pruefung-antwort, #pruefungContainer .pruefung-input"
  ));
}

function lesePruefungsEingaben() {
  return pruefungEingabenElemente().map(function(feld, index) {
    return {
      index: index,
      value: String(feld.value || "")
    };
  });
}

function stelleGespeichertePruefungsEingabenWiederHer(lauf) {
  if (!lauf || !Array.isArray(lauf.antworten)) return;

  const antwortenNachIndex = new Map(
    lauf.antworten.map(function(antwort) {
      return [Number(antwort.index), String(antwort.value || "")];
    })
  );

  pruefungEingabenElemente().forEach(function(feld, index) {
    if (antwortenNachIndex.has(index)) {
      feld.value = antwortenNachIndex.get(index);
    }
  });
}

function speichereAktuellePruefungsEingaben() {
  const lauf = leseGespeichertenPruefungslauf();
  if (!pruefungLaufPasstZuKontext(lauf, pruefungLaufKontext)) return;

  lauf.antworten = lesePruefungsEingaben();
  speicherePruefungslauf(lauf);
}

function initialisierePruefungsEingabenSpeicherung() {
  pruefungEingabenElemente().forEach(function(feld) {
    if (!feld || typeof feld.addEventListener !== "function") return;

    const speichere = function() {
      speichereAktuellePruefungsEingaben();
    };

    feld.addEventListener("input", speichere);
    feld.addEventListener("change", speichere);
  });
}

function bereinigePruefungTimer() {
  clearInterval(pruefungTimerInterval);
  pruefungTimerInterval = null;
  pruefungRestzeitSekunden = 0;
  pruefungLaufEndzeit = null;
  pruefungLaufKontext = null;

  const timerText = document.getElementById("pruefungTimerText");
  const timerBox = document.getElementById("pruefungTimerBox");
  if (timerText) timerText.textContent = "00:00";
  if (timerBox) timerBox.style.display = "none";
}

function verwerfeAktuellePruefung(optionen = {}) {
  pruefungLadeVersion++;
  bereinigePruefungTimer();
  if (!optionen.gespeichertenLaufBeibehalten) {
    loescheGespeichertenPruefungslauf();
  }
  pruefungIstAktiv = false;
  pruefungAbgabeWirdGestartet = false;
  pruefungIstAbgeschlossen = false;
  aktuellePruefungsDaten = [];
  letztePruefungsAntworten = [];
}

function pruefungTeilbereichWaehlen(optionen = {}) {
  if (pruefungAuswertungLaeuft || pruefungIstAktiv) return;
  verwerfeAktuellePruefung(optionen);
  const teilbereich = document.getElementById("pruefungTeilbereichSelect").value;
  const simulationBereich = document.getElementById("pruefungSimulationBereich");
  const simulationSelect = document.getElementById("pruefungSimulationSelect");
  const fachBereich = document.getElementById("pruefungFachBereich");
  const fachSelect = document.getElementById("pruefungFachSelect");

  simulationSelect.innerHTML = '<option value="">-- Simulation wählen --</option>';
  fachSelect.innerHTML = '<option value="">-- Prüfungsfach wählen --</option>';

  fachBereich.style.display = "none";
  document.getElementById("pruefungContainer").innerHTML = "";

  if (!teilbereich) {
    simulationBereich.style.display = "none";
    document.getElementById("pruefungStatus").textContent =
      "Bitte zuerst einen Teilbereich auswählen.";
    return;
  }

  for (let i = 1; i <= 4; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = "Simulation " + i;
    simulationSelect.appendChild(option);
  }

  simulationBereich.style.display = "block";
  document.getElementById("pruefungStatus").textContent =
    "Teilbereich gewählt. Bitte Simulation auswählen.";
}

function pruefungSimulationWaehlen(optionen = {}) {
  if (pruefungAuswertungLaeuft || pruefungIstAktiv) return;
  verwerfeAktuellePruefung(optionen);
  const teilbereich = document.getElementById("pruefungTeilbereichSelect").value;
  const simulation = document.getElementById("pruefungSimulationSelect").value;
  const fachBereich = document.getElementById("pruefungFachBereich");
  const fachSelect = document.getElementById("pruefungFachSelect");

  fachSelect.innerHTML = '<option value="">-- Prüfungsfach wählen --</option>';
  document.getElementById("pruefungContainer").innerHTML = "";

  if (!teilbereich || !simulation) {
    fachBereich.style.display = "none";
    document.getElementById("pruefungStatus").textContent =
      "Bitte Simulation auswählen.";
    return;
  }

const einheiten = pruefungsEinheitenNachTeilbereich[teilbereich] || [];
  einheiten.forEach(function(eintrag) {
  const option = document.createElement("option");
  option.value = eintrag.key;
  option.textContent =
    eintrag.label + " – " + eintrag.zeit + " Minuten – " + eintrag.punkte + " Punkte";
  option.dataset.zeit = eintrag.zeit;
  option.dataset.punkte = eintrag.punkte;
  fachSelect.appendChild(option);
});

  fachBereich.style.display = "block";
  document.getElementById("pruefungStatus").textContent =
    "Simulation gewählt. Bitte Prüfungsfach auswählen.";
}

function pruefungFachWaehlen(optionen = {}) {
  if (pruefungAuswertungLaeuft || pruefungIstAktiv) return;
  verwerfeAktuellePruefung(optionen);
  document.getElementById("pruefungContainer").innerHTML = "";
  document.getElementById("pruefungStatus").textContent = "Bitte Prüfung starten.";
}

function startePruefungSimulation() {
  if (pruefungIstAktiv || pruefungAuswertungLaeuft) return;

  const teilbereich = document.getElementById("pruefungTeilbereichSelect").value;
  const simulation = document.getElementById("pruefungSimulationSelect").value;
  const fach = document.getElementById("pruefungFachSelect").value;

  if (!teilbereich) {
    alert("Bitte zuerst einen Teilbereich auswählen.");
    return;
  }

  if (!simulation) {
    alert("Bitte zuerst eine Simulation auswählen.");
    return;
  }

  if (!fach) {
    alert("Bitte zuerst ein Prüfungsfach auswählen.");
    return;
  }

  ladePruefungSimulation();
}

function ermittlePruefungsEinheitTitel(teilbereich, einheitKey) {
  const einheiten = pruefungsEinheitenNachTeilbereich[teilbereich] || [];
  const einheit = einheiten.find(function(item) {
    return String(item.key) === String(einheitKey);
  });

  if (!einheit) return einheitKey;

  if (String(einheit.key) === "HQ_A1") return "Aufgabenstellung 1";
  if (String(einheit.key) === "HQ_A2") return "Aufgabenstellung 2";

  return einheit.label || einheit.key;
}

async function ladePruefungSimulation(optionen = {}) {
  if (pruefungAuswertungLaeuft || pruefungIstAktiv) return;

  const ausgewaehlterKontext = erstellePruefungsLaufKontext(
    document.getElementById("pruefungTeilbereichSelect").value,
    document.getElementById("pruefungSimulationSelect").value,
    document.getElementById("pruefungFachSelect").value
  );
  const gespeicherterLauf = leseGespeichertenPruefungslauf();
  const laufBeibehalten = optionen.gespeichertenLaufBeibehalten
    || pruefungLaufPasstZuKontext(gespeicherterLauf, ausgewaehlterKontext);

  verwerfeAktuellePruefung({ gespeichertenLaufBeibehalten: laufBeibehalten });
  const ladeVersion = pruefungLadeVersion;
  const usageTicket = window.WifaUsage?.captureTicket();
  const box = document.getElementById("pruefungContainer");

  pruefungAuswertungBereitsGespeichert = false;
  pruefungAuswertungWirdGespeichert = false;
  pruefungLetzterSpeicherPayload = null;

  box.innerHTML = "<div class='status'>Prüfung wird geladen...</div>";

  try {
    const teilbereich = document.getElementById("pruefungTeilbereichSelect").value;
    const simulation = document.getElementById("pruefungSimulationSelect").value;
    const einheit = document.getElementById("pruefungFachSelect").value;

    // Redaktionell geprüfte Prüfungsinhalte liegen lokal. Das Google Sheet
    // bleibt unverändert; Trainer und Lerntexte verwenden weiterhin ihre Quellen.
    const response = await fetch("data/pruefungssimulation/katalog.json");
    if (!response.ok) {
      throw new Error("Der Prüfungskatalog konnte nicht geladen werden.");
    }

    const katalog = await response.json();
    if (ladeVersion !== pruefungLadeVersion) return;
    const pruefung = Array.isArray(katalog?.einheiten)
      ? katalog.einheiten.find(function(item) {
        return item.teilbereich === teilbereich
          && String(item.simulation) === String(simulation)
          && item.einheit === einheit;
      })
      : null;
    if (!pruefung || !Array.isArray(pruefung.aufgaben)) {
      throw new Error("Die gewählte Prüfung fehlt im lokalen Prüfungskatalog.");
    }

    const daten = pruefung.aufgaben;
    aktuellePruefungsDaten = daten;

    const fachSelect = document.getElementById("pruefungFachSelect");
    const gewaehlteOption = fachSelect.options[fachSelect.selectedIndex];
    const minuten = Number(gewaehlteOption?.dataset?.zeit || 0);

    if (!daten.length) {
      box.innerHTML = "<div class='status'>Keine Prüfung gefunden.</div>";
      return;
    }

       let html = "";
    let letzteAufgabe = "";
    let letzteSituation = "";

    const hauptSituation = String(
      daten.find(function(item) {
        return String(item.hauptsituation || "").trim();
      })?.hauptsituation || ""
    ).trim();

    if (teilbereich === "HQ" && hauptSituation) {
      html += `
        <div class="card" style="margin-bottom:18px;">

          <h2 class="section-title">
            ${escapeHtml(ermittlePruefungsEinheitTitel(teilbereich, einheit))}
          </h2>

          <div style="
            background:#f4ecff;
            padding:16px;
            border-radius:14px;
            line-height:1.7;
            white-space:pre-wrap;
          ">
            ${escapeHtml(hauptSituation)}
          </div>

        </div>
      `;
    }

    daten.forEach(function(item, index) {
      const fragetyp = String(item.fragetyp || "text").trim().toLowerCase();
      const aufgabenHtml = String(item.aufgabenHtml || item.aufgabenHTML || "").trim();

      if (letzteAufgabe !== "" && letzteAufgabe !== item.aufgabe) {
        html += `</div>`;
      }

      if (letzteAufgabe !== item.aufgabe) {
        html += `
          <div class="card" style="margin-bottom:18px;">
            <h2 style="margin-bottom:10px;">
              Aufgabe ${escapeHtml(item.aufgabe)}
            </h2>

            <div style="
              background:#f4ecff;
              padding:14px;
              border-radius:12px;
              margin-bottom:16px;
              line-height:1.6;
            ">
              ${escapeHtml(item.situation)}
            </div>
        `;

        letzteAufgabe = item.aufgabe;
        letzteSituation = String(item.situation || "").trim();
      }

      const situation = String(item.situation || "").trim();
      const ergaenzendeSituation = situation && situation !== letzteSituation
        ? `<div style="background:#f4ecff;padding:14px;border-radius:12px;margin-bottom:12px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(situation)}</div>`
        : "";
      if (situation) letzteSituation = situation;

      html += `
        <div style="
          border:1px solid #ddd;
          border-radius:12px;
          padding:14px;
          margin-bottom:14px;
        ">

          <div style="
            font-weight:700;
            margin-bottom:8px;
          ">
            ${escapeHtml(item.teilaufgabe)})
            (${escapeHtml(item.punkte)} Punkte)
          </div>

          ${ergaenzendeSituation}

          <div style="
            margin-bottom:12px;
            line-height:1.6;
          ">
            ${sanitizeAufgabenHtml(item.frage)}
          </div>

          ${bauePruefungsZusatzbereich(item, index)}

          <textarea
            class="input pruefung-antwort"
            rows="6"
            placeholder="Deine schriftliche Ergänzung..."
            data-index="${index}"
            data-fragetyp="${escapeHtml(fragetyp)}"
            data-simulation-id="${escapeHtml(item.simulationId)}"
            data-aufgabe="${escapeHtml(item.aufgabe)}"
            data-teilaufgabe="${escapeHtml(item.teilaufgabe)}"
            data-fach="${escapeHtml(item.fach)}"
            data-thema="${escapeHtml(item.thema)}"
            data-punkte="${escapeHtml(item.punkte)}"
            data-frage="${escapeHtml(item.frage)}"
            data-musterloesung="${escapeHtml(item.musterloesung)}"
            data-stichpunkte="${escapeHtml(item.stichpunkte)}"
          ></textarea>

        </div>
      `;
    });

    html += `</div>`;
    box.innerHTML = html;

    pruefungIstAktiv = true;
    pruefungIstAbgeschlossen = false;
    pruefungAbgabeWirdGestartet = false;

    const laufKontext = erstellePruefungsLaufKontext(teilbereich, simulation, einheit);
    const laufVorhanden = pruefungLaufPasstZuKontext(leseGespeichertenPruefungslauf(), laufKontext);

    stelleGespeichertePruefungsEingabenWiederHer(leseGespeichertenPruefungslauf());
    initialisierePruefungsEingabenSpeicherung();
    sperrePruefungsAuswahl(true);

    if (!laufVorhanden) {
      window.WifaAnalytics?.reset('exam');
      window.WifaAnalytics?.start('exam', daten.every(item => item.fach === daten[0].fach) ? daten[0].fach : '');
      if (window.WifaUsage?.isCurrent(usageTicket)) window.WifaUsage.record('simulation_start', daten.every(item => item.fach === daten[0].fach) ? daten[0].fach : '', teilbereich);
    }

    if (minuten > 0) {
      startePruefungTimer(minuten, laufKontext);
    }

    initialisiereAlleSkizzenfelder();

  } catch (error) {
    if (ladeVersion !== pruefungLadeVersion) return;
    box.innerHTML = "<div class='status'>Fehler: " + escapeHtml(error.message || error) + "</div>";
  }
}

function bauePruefungsZusatzbereich(item, index) {
  const fragetyp = String(item.fragetyp || "text").trim().toLowerCase();
  const aufgabenHtml = String(item.aufgabenHtml || item.aufgabenHTML || "").trim();

  if (fragetyp === "diagramm") {
    return `
      <div class="pruefung-zusatzbereich">
        <strong>Skizzenbereich:</strong>
        <div class="skizzen-toolbar">
          <button type="button" onclick="zeichneAchsenvorlage(${index})">Achsenvorlage</button>
          <button type="button" onclick="loescheSkizze(${index})">Skizze löschen</button>
        </div>
        <canvas class="skizzen-canvas" id="skizze-${index}" width="760" height="420"></canvas>
      </div>
    `;
  }

  if (fragetyp === "tabelle" && aufgabenHtml) {
    return `
      <div class="pruefung-zusatzbereich">
        <strong>Tabellen-/Aufgabenstruktur:</strong>
        <div>${sanitizeAufgabenHtml(aufgabenHtml)}</div>
      </div>
    `;
  }

  if ((fragetyp === "rechnung" || fragetyp === "formel") && aufgabenHtml) {
    return `
      <div class="pruefung-zusatzbereich">
        <strong>Rechen-/Formelstruktur:</strong>
        <div>${sanitizeAufgabenHtml(aufgabenHtml)}</div>
      </div>
    `;
  }

  return "";
}

function initialisiereAlleSkizzenfelder() {
  document.querySelectorAll(".skizzen-canvas").forEach(function(canvas) {
    initialisiereSkizzenCanvas(canvas);
  });
}

function initialisiereSkizzenCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  let zeichnet = false;

  // Track if user has actually drawn on this canvas
  canvas.hasUserDrawing = false;
  canvas.drawingLocked = false;

  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#111111";

  function position(event) {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches && event.touches[0];

    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function start(event) {
    if (canvas.drawingLocked) return;
    event.preventDefault();
    zeichnet = true;

    const pos = position(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function zeichnen(event) {
    if (!zeichnet || canvas.drawingLocked) return;
    event.preventDefault();

    const pos = position(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    canvas.hasUserDrawing = true;
  }

  function stopp(event) {
    if (!zeichnet) return;
    event.preventDefault();
    zeichnet = false;
  }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", zeichnen);
  canvas.addEventListener("mouseup", stopp);
  canvas.addEventListener("mouseleave", stopp);

  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", zeichnen, { passive: false });
  canvas.addEventListener("touchend", stopp, { passive: false });
}

function loescheSkizze(index) {
  const canvas = document.getElementById("skizze-" + index);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Reset the drawing flag when clearing
  canvas.hasUserDrawing = false;
}

function zeichneAchsenvorlage(index) {
  const canvas = document.getElementById("skizze-" + index);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.hasUserDrawing = false;

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#111111";
  ctx.font = "18px Arial";

  ctx.beginPath();
  ctx.moveTo(80, 360);
  ctx.lineTo(720, 360);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(80, 360);
  ctx.lineTo(80, 40);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(720, 360);
  ctx.lineTo(700, 350);
  ctx.moveTo(720, 360);
  ctx.lineTo(700, 370);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(80, 40);
  ctx.lineTo(70, 60);
  ctx.moveTo(80, 40);
  ctx.lineTo(90, 60);
  ctx.stroke();

  ctx.fillText("Preis", 25, 45);
  ctx.fillText("Menge", 690, 395);
}

function sperrePruefungsAuswahl(gesperrt) {
  ["pruefungTeilbereichSelect", "pruefungSimulationSelect", "pruefungFachSelect"]
    .forEach(function(id) {
      const element = document.getElementById(id);
      if (element) element.disabled = Boolean(gesperrt);
    });
}

function startePruefungTimer(minuten, laufKontext) {
  bereinigePruefungTimer();

  const kontext = laufKontext || erstellePruefungsLaufKontext(
    document.getElementById("pruefungTeilbereichSelect")?.value,
    document.getElementById("pruefungSimulationSelect")?.value,
    document.getElementById("pruefungFachSelect")?.value
  );
  const bestehenderLauf = leseGespeichertenPruefungslauf();
  const lauf = pruefungLaufPasstZuKontext(bestehenderLauf, kontext)
    ? bestehenderLauf
    : (() => {
      const startzeit = Date.now();
      return {
        version: 1,
        ...kontext,
        startedAt: startzeit,
        endTime: startzeit + Number(minuten) * 60 * 1000,
        antworten: []
      };
    })();

  pruefungLaufKontext = kontext;
  pruefungLaufEndzeit = Number(lauf.endTime);
  speicherePruefungslauf(lauf);

  const timerBox = document.getElementById("pruefungTimerBox");
  if (timerBox) timerBox.style.display = "block";
  const timerStatus = document.getElementById("pruefungTimerStatus");
  if (timerStatus) timerStatus.textContent = "Die Prüfung läuft.";

  aktualisierePruefungTimerNachEndzeit();
  if (pruefungRestzeitSekunden > 0) {
    pruefungTimerInterval = setInterval(function() {
      aktualisierePruefungTimerNachEndzeit();
    }, 1000);
  }
}

function aktualisierePruefungTimerNachEndzeit() {
  if (!Number.isFinite(Number(pruefungLaufEndzeit))) return;

  pruefungRestzeitSekunden = Math.max(
    0,
    Math.ceil((Number(pruefungLaufEndzeit) - Date.now()) / 1000)
  );
  aktualisierePruefungTimerAnzeige();

  if (pruefungRestzeitSekunden <= 0) {
    clearInterval(pruefungTimerInterval);
    pruefungTimerInterval = null;
    pruefungBeendenWegenZeitablauf();
  }
}

function sperrePruefungsEingaben() {
  document.querySelectorAll('#pruefungContainer .skizzen-canvas').forEach(function(canvas) {
    canvas.drawingLocked = true;
  });

  document.querySelectorAll(
    "#pruefungContainer textarea, #pruefungContainer input, #pruefungContainer button"
  ).forEach(function(element) {
    element.disabled = true;
    element.style.background = "#f3f4f6";
    element.style.cursor = "not-allowed";
  });
}

function beendePruefungUndBewerte(statusText, timerStatusText, timerText) {
  if (pruefungAbgabeWirdGestartet || pruefungAuswertungLaeuft || pruefungIstAbgeschlossen) return;

  pruefungAbgabeWirdGestartet = true;
  clearInterval(pruefungTimerInterval);
  pruefungTimerInterval = null;
  pruefungLaufEndzeit = null;
  pruefungIstAktiv = false;
  pruefungIstAbgeschlossen = true;
  sperrePruefungsEingaben();
  sperrePruefungsAuswahl(true);
  loescheGespeichertenPruefungslauf();

  if (typeof zeigeBereich === "function") zeigeBereich("pruefungView");

  const timerTextElement = document.getElementById("pruefungTimerText");
  if (timerTextElement) timerTextElement.textContent = timerText;
  const timerStatusElement = document.getElementById("pruefungTimerStatus");
  if (timerStatusElement) timerStatusElement.textContent = timerStatusText;
  const statusElement = document.getElementById("pruefungStatus");
  if (statusElement) statusElement.textContent = statusText;

  if (!document.querySelectorAll("#pruefungContainer textarea.pruefung-antwort").length) return;
  return startePruefungsAuswertung();
}

function pruefungBeendenWegenZeitablauf() {
  return beendePruefungUndBewerte(
    "Prüfung beendet: Zeit abgelaufen.",
    "Die Bearbeitungszeit ist abgelaufen. Die Prüfung wurde gesperrt.",
    "00:00"
  );
}

function pruefungManuellAbgeben() {
  if (
    pruefungAuswertungLaeuft
    || pruefungAbgabeWirdGestartet
    || pruefungIstAbgeschlossen
    || !pruefungIstAktiv
    || !document.querySelectorAll("#pruefungContainer textarea.pruefung-antwort").length
  ) return;

  const bestaetigt = confirm(
    "Möchtest du die Prüfung wirklich abgeben?"
  );

  if (!bestaetigt) return;

  return beendePruefungUndBewerte(
    "Prüfung manuell abgegeben.",
    "Die Prüfung wurde manuell abgegeben.",
    "Prüfung beendet"
  );
}

function renderPruefungsPunkteBegründung(item) {
  const erkannte = Array.isArray(item.erkannte) ? item.erkannte : [];
  const fehlende = Array.isArray(item.fehlende) ? item.fehlende : [];
  const punkte = Number(item.punkte || 0);
  const maxPunkte = Number(item.maxPunkte || 0);

  let html = "";

  if (punkte === 0 && erkannte.length === 0 && fehlende.length === 0) {
    return html;
  }

  html += `<div style="margin-bottom: 14px; padding: 12px; background: #f9f7ff; border-radius: 8px;">`;

  if (erkannte.length > 0) {
    html += `
      <div style="margin-bottom: 10px;">
        <strong style="color: #16a34a;">Dafür hast du Punkte erhalten:</strong><br>
    `;
    erkannte.forEach(function(kriterium) {
      html += `<div style="margin: 4px 0; color: #16a34a;">✓ ${escapeHtml(kriterium)}</div>`;
    });
    html += `</div>`;
  }

  if (fehlende.length > 0) {
    html += `
      <div>
        <strong style="color: #dc2626;">Für weitere Punkte fehlte noch / war nicht korrekt:</strong><br>
    `;
    fehlende.forEach(function(kriterium) {
      html += `<div style="margin: 4px 0; color: #dc2626;">✗ ${escapeHtml(kriterium)}</div>`;
    });
    html += `</div>`;
  }

  if (erkannte.length === 0 && fehlende.length > 0) {
    html = `<div style="margin-bottom: 14px; padding: 12px; background: #f9f7ff; border-radius: 8px;">
      <strong style="color: #dc2626;">Für die erreichbaren Punkte fehlte:</strong><br>
    `;
    fehlende.forEach(function(kriterium) {
      html += `<div style="margin: 4px 0; color: #dc2626;">✗ ${escapeHtml(kriterium)}</div>`;
    });
  }

  if (erkannte.length > 0 && fehlende.length === 0) {
    html = `<div style="margin-bottom: 14px; padding: 12px; background: #f9f7ff; border-radius: 8px;">
      <strong style="color: #16a34a;">Alle Bewertungskriterien erfüllt.</strong>
    `;
  }

  html += `</div><br>`;

  return html;
}

function renderPruefungsAuswertung(data) {
  const gesamtPunkte = Number(data.gesamtPunkte || 0);
  const gesamtMaxPunkte = Number(data.gesamtMaxPunkte || 0);

  const prozent =
    gesamtMaxPunkte > 0
      ? Math.round((gesamtPunkte / gesamtMaxPunkte) * 100)
      : 0;

  const bestanden = gesamtMaxPunkte > 0 && gesamtPunkte / gesamtMaxPunkte >= 0.5;

  let html = `
    <div class="card">
      <h2 class="section-title">Prüfungsauswertung</h2>

      <div class="stat-value">
        ${gesamtPunkte} / ${gesamtMaxPunkte} Punkte
      </div>

      <div class="progress-bar">
        <div class="progress-fill" style="width:${prozent}%;"></div>
      </div>

      <div class="status">
        Ergebnis: <strong>${prozent}%</strong><br>
        Status:
        <strong style="color:${bestanden ? "#16a34a" : "#dc2626"};">
          ${bestanden ? "BESTANDEN" : "NICHT BESTANDEN"}
        </strong>
      </div>
    </div>
  `;

  const aufgaben = data.aufgaben || [];

  if (aufgaben.length) {
    html += `
      <div class="card">
        <h2 class="section-title">Einzelbewertung</h2>
    `;

    let letzteAngezeigteSituation = "";

    aufgaben.forEach(function(item, index) {
      const eigeneAntwort = letztePruefungsAntworten.find(function(eintrag) {
        return String(eintrag.aufgabe) === String(item.aufgabe)
          && String(eintrag.teilaufgabe) === String(item.teilaufgabe);
      }) || {};

      const pruefungsAufgabe = (aktuellePruefungsDaten || []).find(function(eintrag) {
        const gleicheTeilaufgabe = String(eintrag.aufgabe) === String(item.aufgabe)
          && String(eintrag.teilaufgabe) === String(item.teilaufgabe);

        if (!gleicheTeilaufgabe) return false;

        if (item.simulationId && eintrag.simulationId) {
          return String(eintrag.simulationId) === String(item.simulationId);
        }

        return true;
      }) || {};

      const frage = eigeneAntwort.frage || pruefungsAufgabe.frage || item.frage || "Keine Frage hinterlegt.";
      const hauptsituation = String(pruefungsAufgabe.hauptsituation || "").trim();
      const situation = String(pruefungsAufgabe.situation || "").trim();
      const zeigtHauptsituation = hauptsituation && hauptsituation !== letzteAngezeigteSituation;
      const zeigtSituation = !zeigtHauptsituation
        && situation
        && situation !== hauptsituation
        && situation !== letzteAngezeigteSituation;

      if (zeigtHauptsituation) {
        letzteAngezeigteSituation = hauptsituation;
      } else if (zeigtSituation) {
        letzteAngezeigteSituation = situation;
      }

      const musterloesung =
        item.musterloesung ||
        eigeneAntwort.musterloesung ||
        "Keine Musterlösung hinterlegt.";

      html += `
        <div class="result-mini-entry">

          <div class="result-mini-head">
            <div class="result-mini-title">
              Aufgabe ${escapeHtml(item.aufgabe)}${escapeHtml(item.teilaufgabe)}
            </div>

            <div class="result-mini-score">
              ${Number(item.punkte || 0)} / ${Number(item.maxPunkte || 0)} Punkte
            </div>
          </div>

          ${zeigtHauptsituation || zeigtSituation ? `
            <div style="background:#f4ecff; padding:14px; border-radius:12px; margin-bottom:14px; line-height:1.6; white-space:pre-wrap;">
              ${escapeHtml(zeigtHauptsituation ? hauptsituation : situation)}
            </div>
          ` : ""}

          <div style="margin-bottom:14px; line-height:1.6;">
            <strong>Frage:</strong><br>
            ${escapeHtml(frage)}
          </div>

          <div style="font-size:13px; line-height:1.5; color:#5a4a80;">

            <strong>Deine Antwort:</strong><br>
            ${escapeHtml(eigeneAntwort.antwort || "keine schriftliche Ergänzung")}

            <br><br>

            ${eigeneAntwort.skizze ? `
              <strong>Deine Skizze:</strong><br>

              <img
                src="${eigeneAntwort.skizze}"
                style="
                  max-width:100%;
                  border:1px solid #d8c8f8;
                  border-radius:12px;
                  margin:8px 0 14px 0;
                "
              >

              <br>
            ` : ""}

            ${renderPruefungsPunkteBegründung(item)}

            <button
              class="secondary-btn"
              type="button"
              onclick="togglePruefungsMusterloesung(${index})"
              style="margin-top:10px;"
            >
              Musterlösung anzeigen
            </button>

            <div
              class="solution-box"
              id="pruefungMusterloesung-${index}"
              style="display:none; margin-top:12px;"
            >
              <strong>Musterlösung:</strong><br>
              ${escapeHtml(musterloesung)}
            </div>

          </div>

        </div>
      `;
    });

    html += `</div>`;
  }

  document.getElementById("pruefungStatus").innerHTML =
    "Prüfung abgeschlossen.";

  document.getElementById("pruefungContainer").innerHTML = html;
}

function togglePruefungsMusterloesung(index) {
  const box = document.getElementById("pruefungMusterloesung-" + index);
  if (!box) return;

  box.style.display =
    box.style.display === "none" ? "block" : "none";
}

// Baut aus den eigenen Antworten (letztePruefungsAntworten) und der Server-Bewertung genau einen speicherbaren Pruefungsversuch, ohne Skizzendaten
function erstellePruefungsSpeicherPayload(auswertungsDaten) {
  const teilbereich = document.getElementById("pruefungTeilbereichSelect")?.value || "";
  const simulation = document.getElementById("pruefungSimulationSelect")?.value || "";
  const einheit = document.getElementById("pruefungFachSelect")?.value || "";

  if (!teilbereich || !simulation || !einheit) return null;

  const gesamtPunkte = Number(auswertungsDaten.gesamtPunkte || 0);
  const gesamtMaxPunkte = Number(auswertungsDaten.gesamtMaxPunkte || 0);
  const serverAufgaben = Array.isArray(auswertungsDaten.aufgaben) ? auswertungsDaten.aufgaben : [];

  const tasks = (letztePruefungsAntworten || []).map(function(eigeneAntwort) {
    const treffer = serverAufgaben.find(function(item) {
      const gleicheAufgabe =
        String(item.aufgabe) === String(eigeneAntwort.aufgabe)
        && String(item.teilaufgabe) === String(eigeneAntwort.teilaufgabe);

      if (!gleicheAufgabe) return false;

      if (item.simulationId !== undefined && item.simulationId !== null && String(item.simulationId) !== "") {
        return String(item.simulationId) === String(eigeneAntwort.simulationId);
      }

      return true;
    }) || {};

    const maxPunkte = Number(treffer.maxPunkte ?? eigeneAntwort.maxPunkte ?? 0);
    const punkte = Number(treffer.punkte ?? 0);

    return {
      simulationId: String(eigeneAntwort.simulationId || ""),
      aufgabe: String(eigeneAntwort.aufgabe || ""),
      teilaufgabe: String(eigeneAntwort.teilaufgabe || ""),
      fach: String(eigeneAntwort.fach || ""),
      thema: String(eigeneAntwort.thema || ""),
      fragetyp: String(eigeneAntwort.fragetyp || "text"),
      frage: String(eigeneAntwort.frage || ""),
      antwort: String(eigeneAntwort.antwort || ""),
      punkte: Number.isFinite(punkte) ? punkte : 0,
      maxPunkte: Number.isFinite(maxPunkte) ? maxPunkte : 0,
      // ergebnis ist beim Apps Script ein ausführlicher Feedbacktext, kein Enum-Wert
      ergebnis: String(treffer.ergebnis || ""),
      erkannte: Array.isArray(treffer.erkannte) ? treffer.erkannte.map(String).slice(0, 30) : [],
      fehlende: Array.isArray(treffer.fehlende) ? treffer.fehlende.map(String).slice(0, 30) : [],
      // musterloesung kommt ausschließlich aus den eigenen Prüfungsdaten, da das Bewertungsobjekt sie nicht zuverlässig liefert
      musterloesung: String(eigeneAntwort.musterloesung || ""),
      hatSkizze: Boolean(eigeneAntwort.skizze)
    };
  }).slice(0, 100);

  if (!tasks.length) return null;

  const einheitLabel = String(ermittlePruefungsEinheitTitel(teilbereich, einheit) || einheit || "").trim() || einheit;

  return {
    teilbereich: teilbereich,
    simulation: String(simulation),
    einheit: einheit,
    einheitLabel: einheitLabel,
    gesamtPunkte: Number.isFinite(gesamtPunkte) ? gesamtPunkte : 0,
    gesamtMaxPunkte: Number.isFinite(gesamtMaxPunkte) ? gesamtMaxPunkte : 0,
    tasks: tasks
  };
}

function aktualisierePruefungsSpeicherStatus(erfolgreich, error) {
  const status = document.getElementById("pruefungStatus");
  if (!status) return;

  if (erfolgreich) {
    status.innerHTML = "Prüfung abgeschlossen und Lernstand gespeichert.";
    return;
  }

  status.innerHTML =
    "Prüfung ausgewertet, Lernstand konnte nicht gespeichert werden. "
    + '<button type="button" class="secondary-btn" onclick="pruefungLernstandErneutSpeichern()">Lernstand erneut speichern</button>';

  if (error) {
    console.warn("Lernstand konnte nicht gespeichert werden:", error);
  }
}

// Speichert (oder wiederholt) genau einen abgeschlossenen Pruefungsversuch, ruft dabei nie erneut die Bewertung auf
async function fuehrePruefungsSpeicherungDurch() {
  if (pruefungAuswertungBereitsGespeichert || pruefungAuswertungWirdGespeichert) return;
  if (!pruefungLetzterSpeicherPayload || typeof window.speicherePruefungsAttempt !== "function") return;

  pruefungAuswertungWirdGespeichert = true;

  try {
    await window.speicherePruefungsAttempt(pruefungLetzterSpeicherPayload);
    pruefungAuswertungBereitsGespeichert = true;
    aktualisierePruefungsSpeicherStatus(true);
  } catch (error) {
    aktualisierePruefungsSpeicherStatus(false, error);
  } finally {
    pruefungAuswertungWirdGespeichert = false;
  }
}

function pruefungLernstandErneutSpeichern() {
  if (pruefungAuswertungBereitsGespeichert || pruefungAuswertungWirdGespeichert) return;

  const status = document.getElementById("pruefungStatus");
  if (status) {
    status.textContent = "Lernstand wird erneut gespeichert...";
  }

  fuehrePruefungsSpeicherungDurch();
}

function aktualisierePruefungTimerAnzeige() {

  const minuten =
    Math.floor(pruefungRestzeitSekunden / 60);

  const sekunden =
    pruefungRestzeitSekunden % 60;

  document.getElementById("pruefungTimerText").textContent =
    String(minuten).padStart(2, "0")
    + ":"
    + String(sekunden).padStart(2, "0");
}

async function startePruefungsAuswertung() {
  if (pruefungAuswertungLaeuft) return;
  if (!document.querySelectorAll("#pruefungContainer textarea.pruefung-antwort").length) return;
  pruefungAbgabeWirdGestartet = true;
  pruefungAuswertungLaeuft = true;
  const auswahlFelder = ['pruefungTeilbereichSelect', 'pruefungSimulationSelect', 'pruefungFachSelect'];
  auswahlFelder.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
  try {
    const antworten = document.querySelectorAll("#pruefungContainer textarea.pruefung-antwort");
    const daten = [];

    antworten.forEach(function(textarea) {
      const aufgabenBlock = textarea.closest("div");

      const tabellenFelder = aufgabenBlock
        ? aufgabenBlock.querySelectorAll(".pruefung-input")
        : [];

      let tabellenAntwort = "";

      if (tabellenFelder.length) {
        const tabellenWerte = [];

tabellenFelder.forEach(function(feld, index) {

    const wert = String(feld.value || "").trim();

    if (wert) {

        const zeile = feld.closest("tr");
        let zeilenTitel = "";

        if (zeile) {
            const ersteZelle = zeile.querySelector("td");

            zeilenTitel = ersteZelle
                ? ersteZelle.textContent.trim()
                : "";
        }

        tabellenWerte.push(
            (zeilenTitel
                ? zeilenTitel + " = " + wert
                : "Tabellenfeld " + (index + 1) + " = " + wert)
        );
    }
});

        if (tabellenWerte.length) {
          tabellenAntwort =
            "Tabelleneingaben:\n- " +
            tabellenWerte.join("\n- ");
        }
      }

      const freieAntwort = String(textarea.value || "").trim();

      let kompletteAntwort = "";

      if (tabellenAntwort && freieAntwort) {
        kompletteAntwort = tabellenAntwort + "\n\nSchriftliche Ergänzung:\n" + freieAntwort;
      } else if (tabellenAntwort) {
        kompletteAntwort = tabellenAntwort;
      } else {
        kompletteAntwort = freieAntwort;
      }

      const simulationId = textarea.dataset.simulationId || "";
      const aufgabe = textarea.dataset.aufgabe || "";
      const teilaufgabe = textarea.dataset.teilaufgabe || "";

      const passendeAufgabe = aktuellePruefungsDaten.find(function(item) {
        return String(item.simulationId) === String(simulationId)
          && String(item.aufgabe) === String(aufgabe)
          && String(item.teilaufgabe) === String(teilaufgabe);
      });

      const index = textarea.dataset.index || "";
      const fragetyp = textarea.dataset.fragetyp || "text";
      let skizze = "";

      // Only include sketch if it's a diagram question AND user actually drew on it
      if (fragetyp === "diagramm") {
        const canvas = document.getElementById("skizze-" + index);
        if (canvas && canvas.hasUserDrawing === true) {
          skizze = canvas.toDataURL("image/png");
        }
      }

      daten.push({
        simulationId: simulationId,
        aufgabe: aufgabe,
        teilaufgabe: teilaufgabe,
        fach: textarea.dataset.fach || "",
        thema: textarea.dataset.thema || "",
        frage: textarea.dataset.frage || "",
        fragetyp: fragetyp,
        musterloesung: textarea.dataset.musterloesung || "",
        stichpunkte: textarea.dataset.stichpunkte || "",
        maxPunkte: Number(
          textarea.dataset.punkte
          || passendeAufgabe?.punkte
          || 0
        ),
        antwort: kompletteAntwort,
        skizze: skizze
      });
    });

    letztePruefungsAntworten = daten;

    document.getElementById("pruefungStatus").textContent =
      "Prüfungsauswertung läuft...";

    const bewertung = await bewertePruefungsAntworten(daten);

    console.log("Bewertung:", bewertung);

    if (!bewertung || bewertung.success !== true) {
      throw new Error(bewertung?.error || "Unbekannter Fehler bei der Prüfungsauswertung.");
    }

    renderPruefungsAuswertung(bewertung.data || {});
    window.WifaAnalytics?.complete('exam');

    pruefungIstAktiv = false;

    pruefungLetzterSpeicherPayload = erstellePruefungsSpeicherPayload(bewertung.data || {});
    await fuehrePruefungsSpeicherungDurch();

  } catch (error) {
    document.getElementById("pruefungStatus").textContent =
      "Fehler bei der Prüfungsauswertung: " + error.message;

    alert("Fehler bei der Prüfungsauswertung:\n\n" + error.message);
  } finally {
    pruefungAuswertungLaeuft = false;
    auswahlFelder.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
  }
}

function togglePruefungDropdown(event) {
  event.stopPropagation();

  const button = document.getElementById("navPruefung");
  const dropdown = button.closest(".dropdown");
  const isOpen = dropdown.classList.contains("open");

  document.querySelectorAll(".dropdown.open").forEach(function(openDropdown) {
    openDropdown.classList.remove("open");
    const openButton = openDropdown.querySelector("button");
    if (openButton) {
      openButton.setAttribute("aria-expanded", "false");
    }
  });

  dropdown.classList.toggle("open", !isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
}

function oeffnePruefungMitTeilbereich(teilbereich) {
  if (pruefungAuswertungLaeuft) return;
  if (typeof requireAuth === 'function') {
    requireAuth('pruefungView');
  } else {
    zeigeBereich('pruefungView');
  }

  if (pruefungIstAktiv) return;

  const select = document.getElementById("pruefungTeilbereichSelect");
  select.value = teilbereich;
  pruefungTeilbereichWaehlen();
}

async function stelleLaufendePruefungWiederHer() {
  const lauf = leseGespeichertenPruefungslauf();
  if (!lauf) return false;

  const teilbereichSelect = document.getElementById("pruefungTeilbereichSelect");
  const simulationSelect = document.getElementById("pruefungSimulationSelect");
  const fachSelect = document.getElementById("pruefungFachSelect");
  if (!teilbereichSelect || !simulationSelect || !fachSelect) return false;

  if (typeof zeigeBereich === "function") zeigeBereich("pruefungView");

  teilbereichSelect.value = lauf.teilbereich;
  pruefungTeilbereichWaehlen({ gespeichertenLaufBeibehalten: true });

  simulationSelect.value = lauf.simulation;
  pruefungSimulationWaehlen({ gespeichertenLaufBeibehalten: true });

  fachSelect.value = lauf.einheit;
  pruefungFachWaehlen({ gespeichertenLaufBeibehalten: true });

  await ladePruefungSimulation({ gespeichertenLaufBeibehalten: true });
  return true;
}

window.stelleLaufendePruefungWiederHer = stelleLaufendePruefungWiederHer;

if (typeof window.addEventListener === "function") {
  window.addEventListener("pageshow", function() {
    if (pruefungIstAktiv) aktualisierePruefungTimerNachEndzeit();
  });
}
