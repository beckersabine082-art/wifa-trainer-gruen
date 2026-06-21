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

function pruefungTeilbereichWaehlen() {
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

function pruefungSimulationWaehlen() {
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

function startePruefungSimulation() {
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

async function ladePruefungSimulation() {
  const box = document.getElementById("pruefungContainer");

  box.innerHTML = "<div class='status'>Prüfung wird geladen...</div>";

  try {
    const teilbereich = document.getElementById("pruefungTeilbereichSelect").value;
    const simulation = document.getElementById("pruefungSimulationSelect").value;
    const einheit = document.getElementById("pruefungFachSelect").value;

    const response = await fetch(
      API_BASE_URL
      + "?action=getPruefungSimulation"
      + "&teilbereich=" + encodeURIComponent(teilbereich)
      + "&simulation=" + encodeURIComponent(simulation)
      + "&einheit=" + encodeURIComponent(einheit)
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Fehler");
    }

    const daten = result.data || [];
    aktuellePruefungsDaten = daten;

    const fachSelect = document.getElementById("pruefungFachSelect");
    const gewaehlteOption = fachSelect.options[fachSelect.selectedIndex];
    const minuten = Number(gewaehlteOption?.dataset?.zeit || 0);

    if (minuten > 0) {
      startePruefungTimer(minuten);
    }

    if (!daten.length) {
      box.innerHTML = "<div class='status'>Keine Prüfung gefunden.</div>";
      return;
    }

       let html = "";
    let letzteAufgabe = "";

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
      }

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

          <div style="
            margin-bottom:12px;
            line-height:1.6;
          ">
            ${item.frage}
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

    initialisiereAlleSkizzenfelder();

  } catch (error) {
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
        <div>${aufgabenHtml}</div>
      </div>
    `;
  }

  if ((fragetyp === "rechnung" || fragetyp === "formel") && aufgabenHtml) {
    return `
      <div class="pruefung-zusatzbereich">
        <strong>Rechen-/Formelstruktur:</strong>
        <div>${aufgabenHtml}</div>
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
    event.preventDefault();
    zeichnet = true;

    const pos = position(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function zeichnen(event) {
    if (!zeichnet) return;
    event.preventDefault();

    const pos = position(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
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
}

function zeichneAchsenvorlage(index) {
  const canvas = document.getElementById("skizze-" + index);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

function startePruefungTimer(minuten) {

stoppePruefungTimer();
      
  pruefungRestzeitSekunden = minuten * 60;

  const timerBox =
    document.getElementById("pruefungTimerBox");

  const timerText =
    document.getElementById("pruefungTimerText");

timerBox.style.display = "block";
  aktualisierePruefungTimerAnzeige();

  pruefungTimerInterval = setInterval(function() {

    pruefungRestzeitSekunden--;

    aktualisierePruefungTimerAnzeige();

   if (pruefungRestzeitSekunden <= 0) {
  pruefungBeendenWegenZeitablauf();
}
  }, 1000);
}

function pruefungBeendenWegenZeitablauf() {
  clearInterval(pruefungTimerInterval);
  pruefungTimerInterval = null;
  pruefungRestzeitSekunden = 0;

  document.getElementById("pruefungTimerText").textContent =
    "Zeit abgelaufen";

  document.querySelectorAll("#pruefungContainer textarea").forEach(function(textarea) {
    textarea.disabled = true;
    textarea.style.background = "#f3f4f6";
    textarea.style.cursor = "not-allowed";
  });

  document.querySelectorAll("#pruefungContainer button").forEach(function(button) {
    button.disabled = true;
    button.style.opacity = "0.6";
    button.style.cursor = "not-allowed";
  });

  document.getElementById("pruefungTimerStatus").textContent =
    "Die Bearbeitungszeit ist abgelaufen. Die Prüfung wurde gesperrt.";

  document.getElementById("pruefungStatus").textContent =
    "Prüfung beendet: Zeit abgelaufen.";
}

function pruefungManuellAbgeben() {

  const bestaetigt = confirm(
    "Möchtest du die Prüfung wirklich abgeben?"
  );

  if (!bestaetigt) {
    return;
  }

  clearInterval(pruefungTimerInterval);

  document.querySelectorAll(
    "#pruefungContainer textarea"
  ).forEach(function(textarea) {

    textarea.disabled = true;
    textarea.style.background = "#f3f4f6";
  });

  document.getElementById("pruefungStatus").textContent =
    "Prüfung manuell abgegeben.";

  document.getElementById("pruefungTimerText").textContent =
    "Prüfung beendet";
      startePruefungsAuswertung();
}

function renderPruefungsAuswertung(data) {
  const gesamtPunkte = Number(data.gesamtPunkte || 0);
  const gesamtMaxPunkte = Number(data.gesamtMaxPunkte || 0);

  const prozent =
    gesamtMaxPunkte > 0
      ? Math.round((gesamtPunkte / gesamtMaxPunkte) * 100)
      : 0;

  const bestanden = prozent >= 50;

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

    aufgaben.forEach(function(item, index) {
      const eigeneAntwort = letztePruefungsAntworten.find(function(eintrag) {
        return String(eintrag.aufgabe) === String(item.aufgabe)
          && String(eintrag.teilaufgabe) === String(item.teilaufgabe);
      }) || {};

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

  document.getElementById("pruefungContainer").innerHTML += html;
}

function togglePruefungsMusterloesung(index) {
  const box = document.getElementById("pruefungMusterloesung-" + index);
  if (!box) return;

  box.style.display =
    box.style.display === "none" ? "block" : "none";
}

function stoppePruefungTimer() {

  clearInterval(pruefungTimerInterval);

  pruefungTimerInterval = null;

  pruefungRestzeitSekunden = 0;

  document.getElementById("pruefungTimerText").textContent =
    "00:00";

  document.getElementById("pruefungTimerBox").style.display =
    "none";
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

      if (fragetyp === "diagramm") {
        const canvas = document.getElementById("skizze-" + index);
        if (canvas) {
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

  } catch (error) {
    document.getElementById("pruefungStatus").textContent =
      "Fehler bei der Prüfungsauswertung: " + error.message;

    alert("Fehler bei der Prüfungsauswertung:\n\n" + error.message);
  }
}

function togglePruefungDropdown(event) {
  event.stopPropagation();

  const dropdown =
    document.getElementById("navPruefung").closest(".dropdown");

  dropdown.classList.toggle("open");
}

function oeffnePruefungMitTeilbereich(teilbereich) {
  zeigeBereich("pruefungView");

  const select =
    document.getElementById("pruefungTeilbereichSelect");

  select.value = teilbereich;

  pruefungTeilbereichWaehlen();
}
