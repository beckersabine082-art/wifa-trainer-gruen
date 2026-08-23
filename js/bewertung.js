async function bewerteAntwort() {
    if (appIstBeschaeftigt) return;

    const antwort = document.getElementById("antwortInput").value.trim();

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

    if (!aktuelleFrageId) {
      alert("Es ist aktuell keine Frage geladen.");
      return;
    }

    if (!antwort) {
      alert("Bitte zuerst eine Antwort eingeben.");
      return;
    }

    try {
      setzeAppBeschaeftigt(true);
      setzeStatus("Antwort wird ausgewertet...");

      const result = await apiPost("bewerteAntwort", {
        fach: aktuellesFach,
        frageId: aktuelleFrageId,
        antwort: antwort,
        speichereInSheet: false
      });

      if (!result.success) {
        throw new Error(result.error || "Auswertung fehlgeschlagen.");
      }

      const data = result.data || {};
      letzteAusgewerteteAntwort = antwort;

      document.getElementById("resultBox").style.display = "block";
      verbirgWiederholungsNavigation();

      const punkte = Number(data.punkte || 0);
      const maxPunkte = Number(data.maxPunkte || 0);
const bewertungText = bereinigeBewertungText(
  data.ergebnis || "Keine Auswertung erhalten."
);
      const punkteAnzeige = document.getElementById("punkteAnzeige");
      punkteAnzeige.textContent = punkte + " / " + maxPunkte + " Punkte";
      punkteAnzeige.classList.remove("good", "bad");
      punkteAnzeige.classList.add(maxPunkte > 0 && punkte >= maxPunkte / 2 ? "good" : "bad");

      document.getElementById("ergebnisText").textContent = bewertungText;
      zeigeBewertungskriterien(data);

      aktuelleMusterloesung = data.musterloesung || "";
      document.getElementById("solutionBox").style.display = "none";
      document.getElementById("musterloesungText").textContent = "";

      verbucheSessionErgebnis(
        aktuellesFach,
        aktuelleFrageId,
        punkte,
        maxPunkte
      );

      updateStatAnzeige();

      setzeStatus("Auswertung abgeschlossen. Lernstand wird gespeichert...");

      if (typeof window.speichereWifaAttempt !== "function") {
        throw new Error("Lernstand-Speicherung ist noch nicht bereit.");
      }

      await window.speichereWifaAttempt({
        bereich: aktuellerTeilbereich || ermittleTeilbereich(aktuellesFach),
        fach: aktuellesFach,
        thema: aktuellesThema,
        frageId: aktuelleFrageId,
          antwort: antwort,
        erreichtePunkte: punkte,
        maximalePunkte: maxPunkte
      });

      setzeStatus("Auswertung abgeschlossen und Lernstand gespeichert.");

      if (wiederholungsKontext) {
        await zeigeWiederholungsNavigation();
        sperreAbgeschlossenenWiederholungsversuch();
      }
    } catch (error) {
      setzeStatus("Fehler bei der Auswertung oder Speicherung: " + error.message);
    } finally {
      setzeAppBeschaeftigt(false);
    }
  }

function verbucheSessionErgebnis(fach, frageId, punkte, maxPunkte) {
    if (!fach || !frageId) return;

    if (!sessionStats.faecher[fach]) {
      sessionStats.faecher[fach] = { erreicht: 0, max: 0 };
    }

    const index = sessionStats.eintraege.findIndex(function(e) {
      return e.fach === fach && e.frageId === frageId;
    });

    if (index !== -1) {
      const alt = sessionStats.eintraege[index];

      sessionStats.faecher[fach].erreicht -= alt.punkte;
      sessionStats.faecher[fach].max -= alt.maxPunkte;

      sessionStats.totalErreicht -= alt.punkte;
      sessionStats.totalMax -= alt.maxPunkte;

      sessionStats.eintraege.splice(index, 1);
    }

    const neuerEintrag = {
      teilbereich: ermittleTeilbereich(fach),
      fach: fach,
      frageId: frageId,
      punkte: punkte,
      maxPunkte: maxPunkte,
      prozent: berechneProzent(punkte, maxPunkte)
    };

    sessionStats.eintraege.unshift(neuerEintrag);

    sessionStats.faecher[fach].erreicht += punkte;
    sessionStats.faecher[fach].max += maxPunkte;

    sessionStats.totalErreicht += punkte;
    sessionStats.totalMax += maxPunkte;
  }

function berechneProzent(erreicht, max) {
    if (!max || max <= 0) return 0;
    return Math.round((erreicht / max) * 100);
  }

function updateStatAnzeige() {
    const fachStats = aktuellesFach && sessionStats.faecher[aktuellesFach]
      ? sessionStats.faecher[aktuellesFach]
      : { erreicht: 0, max: 0 };

    const fachProzent = berechneProzent(fachStats.erreicht, fachStats.max);
    const sessionProzent = berechneProzent(sessionStats.totalErreicht, sessionStats.totalMax);

    document.getElementById("fachProzent").textContent = fachProzent + "%";
    document.getElementById("fachDetails").textContent =
      fachStats.erreicht + " von " + fachStats.max + " Punkten im aktuellen Fach";
    document.getElementById("fachProgressBar").style.width = fachProzent + "%";

    document.getElementById("sessionProzent").textContent = sessionProzent + "%";
    document.getElementById("sessionDetails").textContent =
      sessionStats.totalErreicht + " von " + sessionStats.totalMax + " Punkten in dieser Session";
    document.getElementById("sessionProgressBar").style.width = sessionProzent + "%";

  }

function renderEinzelergebnisse() {
    const container = document.getElementById("einzelergebnisListe");

    if (!sessionStats.eintraege.length) {
      container.className = "result-list-empty";
      container.innerHTML = "Noch keine Ergebnisse in dieser Session.";
      return;
    }

    container.className = "";
    container.innerHTML = sessionStats.eintraege.map(function(eintrag) {
      return `
        <div class="result-mini-entry">
          <div class="result-mini-head">
            <div class="result-mini-title">${escapeHtml(eintrag.teilbereich)} · ${escapeHtml(eintrag.fach)}</div>
            <div class="result-mini-score">${eintrag.prozent}%</div>
          </div>

          <div class="result-mini-bar">
            <div class="result-mini-fill" style="width: ${eintrag.prozent}%;"></div>
          </div>

          <div class="result-mini-footer">
            <span>${eintrag.punkte} / ${eintrag.maxPunkte} Punkte</span>
          </div>
        </div>
      `;
    }).join("");
  }

function bereinigeBewertungText(text) {
  let sauber = String(text || "");

  sauber = sauber
    .replace(/Erkannte Stichpunkte:[\s\S]*?(Fehlende Stichpunkte:|$)/gi, "")
    .replace(/Fehlende Stichpunkte:[\s\S]*$/gi, "");

  sauber = sauber
    .split("\n")
    .filter(function(zeile) {
      const z = zeile.trim();

      if (!z) return false;
      if (z.startsWith("-")) return false;

      return true;
    })
    .join("\n")
    .trim();

  return sauber || "Ergebnis wurde berechnet.";
}

function normalisiereKriterien(wert) {
  if (Array.isArray(wert)) {
    return wert.map(function(eintrag) {
      return String(eintrag || "").trim();
    }).filter(Boolean);
  }

  return String(wert || "")
    .split(/[;\n]/)
    .map(function(eintrag) {
      return eintrag.replace(/^[•*-]\s*/, "").trim();
    })
    .filter(Boolean);
}

function findeKriterien(data, namen) {
  for (const name of namen) {
    if (data[name] !== undefined && data[name] !== null) {
      return normalisiereKriterien(data[name]);
    }
  }

  return [];
}

function extrahiereKriterienAusErgebnis(text) {
  const quelle = String(text || "");
  const erkannteMatch = quelle.match(/Erkannte Stichpunkte:\s*([\s\S]*?)(?=Fehlende Stichpunkte:|$)/i);
  const fehlendeMatch = quelle.match(/Fehlende Stichpunkte:\s*([\s\S]*?)$/i);

  return {
    erkannte: normalisiereKriterien(erkannteMatch ? erkannteMatch[1] : ""),
    fehlende: normalisiereKriterien(fehlendeMatch ? fehlendeMatch[1] : "")
  };
}

function zeigeBewertungskriterien(data) {
  const box = document.getElementById("bewertungskriterien");
  if (!box) return;

  let erkannte = findeKriterien(data, [
    "erkannteKriterien",
    "erfuellteKriterien",
    "erkannteStichpunkte",
    "erkannte"
  ]);
  let fehlende = findeKriterien(data, [
    "fehlendeKriterien",
    "nichtErfuellteKriterien",
    "fehlendeStichpunkte",
    "fehlende"
  ]);

  if (!erkannte.length && !fehlende.length) {
    const ausErgebnis = extrahiereKriterienAusErgebnis(data.ergebnis);
    erkannte = ausErgebnis.erkannte;
    fehlende = ausErgebnis.fehlende;
  }

  if (!erkannte.length && !fehlende.length) {
    const punkte = Number(data.punkte || 0);
    const maxPunkte = Number(data.maxPunkte || 0);
    if (maxPunkte > 0 && punkte >= maxPunkte) {
      box.textContent = "Alle wesentlichen Inhalte wurden erkannt.";
      box.hidden = false;
      return;
    }

    box.hidden = true;
    box.innerHTML = "";
    return;
  }

  let html = "";
  if (erkannte.length) {
    html += "<strong>Erkannt:</strong><ul>" + erkannte.map(function(kriterium) {
      return "<li>" + escapeHtml(kriterium) + "</li>";
    }).join("") + "</ul>";
  }

  if (fehlende.length) {
    html += "<strong>Für die volle Punktzahl fehlte noch:</strong><ul>" + fehlende.map(function(kriterium) {
      return "<li>" + escapeHtml(kriterium) + "</li>";
    }).join("") + "</ul>";
  }

  box.innerHTML = html;
  box.hidden = false;
}

function resetSession() {
    if (appIstBeschaeftigt) return;

    const bestaetigt = confirm("Möchtest du die komplette Lernsession wirklich zurücksetzen?");
    if (!bestaetigt) return;

    sessionStats.totalErreicht = 0;
    sessionStats.totalMax = 0;
    sessionStats.faecher = {};
    sessionStats.eintraege = [];

    updateStatAnzeige();
    setzeStatus("Lernsession wurde zurückgesetzt.");
  }

function hebeStichpunkteHervor(text, stichpunkte) {
  if (!text) return "";

  let html = escapeHtml(text);

  if (!Array.isArray(stichpunkte)) {
    return html;
  }

  stichpunkte.forEach(function(punkt) {
    const clean = String(punkt || "").trim();

    if (!clean) return;

    const escaped = escapeRegExp(clean);

    html = html.replace(
      new RegExp("(" + escaped + ")", "gi"),
      "<strong><em>$1</em></strong>"
    );
  });

  return html;
}

function zeigeMusterloesung() {
    if (!aktuelleMusterloesung) {
      alert("Zur aktuellen Frage ist keine Musterlösung vorhanden.");
      return;
    }

    document.getElementById("resultBox").style.display = "block";
    document.getElementById("solutionBox").style.display = "block";
    document.getElementById("musterloesungText").innerHTML =
  hebeStichpunkteHervor(aktuelleMusterloesung, []);
  }
