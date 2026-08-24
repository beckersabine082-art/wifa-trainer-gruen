function normalisiereLueckenwert(wert) {
    return String(wert || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("de-DE");
  }

function canvasHatInhalt(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return false;

    const context = canvas.getContext("2d");
    if (!context) return false;

    const pixelDaten = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixelDaten.length; index += 4) {
      if (pixelDaten[index] !== 0) return true;
    }

    return false;
  }

function ermittleLueckenLoesungen(loesungsschluessel) {
    const text = String(loesungsschluessel || "").trim();
    if (!text) return [];

    try {
      const jsonWert = JSON.parse(text);
      if (Array.isArray(jsonWert)) {
        return jsonWert.map(function(wert) {
          return String(wert || "").trim();
        });
      }
    } catch (error) {
      // Der Lösungsschlüssel ist normalerweise eine Semikolon-/Zeilenliste.
    }

    return text
      .split(/[;\r\n]+/)
      .map(function(wert) {
        return wert.replace(/^\s*\d+\s*[.):-]\s*/, "").trim();
      })
      .filter(Boolean);
  }

function ermittleMaxPunkteFuerFrage(frageTextBox, fallbackWert) {
    if (Number.isFinite(fallbackWert) && fallbackWert > 0) {
      return fallbackWert;
    }
    return 0;
  }

function bewerteLueckentext(lueckenInputs, loesungsschluessel, maxPunkteOverride) {
    const schluesselLoesungen = ermittleLueckenLoesungen(loesungsschluessel);
    const erkannte = [];
    const fehlende = [];
    let punkte = 0;

    lueckenInputs.forEach(function(input, index) {
      const antwort = String(input.value || "").trim();
      const dataAnswer = String(input.getAttribute("data-answer") || "").trim();
      const loesung = dataAnswer || schluesselLoesungen[index] || "";
      const istRichtig = Boolean(loesung) &&
        normalisiereLueckenwert(antwort) === normalisiereLueckenwert(loesung);

      if (istRichtig) {
        punkte++;
        erkannte.push("Lücke " + (index + 1) + ": " + loesung);
      } else {
        fehlende.push("Lücke " + (index + 1) + (loesung ? ": " + loesung : ""));
      }
    });

    const maxPunkte = Number.isFinite(maxPunkteOverride) && maxPunkteOverride > 0
      ? maxPunkteOverride
      : lueckenInputs.length;
    const ergebnis = punkte + " von " + maxPunkte + " Punkten.\n" +
      (punkte === maxPunkte
        ? "Alle Lücken sind richtig beantwortet."
        : "Falsch oder leer: " + fehlende.join(", ") + ".");

    return {
      punkte: punkte,
      maxPunkte: maxPunkte,
      ergebnis: ergebnis,
      musterloesung: loesungsschluessel,
      erkannte: erkannte,
      fehlende: fehlende
    };
  }

function bewerteZuordnung(zuordnungInputs, maxPunkteOverride, loesungsschluessel) {
    const erkannte = [];
    const fehlende = [];
    const paare = ermittleStrukturPaare(loesungsschluessel);
    let punkte = 0;

    zuordnungInputs.forEach(function(input, index) {
      const antwort = String(input.value || "").trim();
      const loesung = String(input.getAttribute("data-answer") || input.dataset.answer || input.name || paare[index]?.loesung || "").trim();
      const istRichtig = Boolean(loesung) &&
        normalisiereLueckenwert(antwort) === normalisiereLueckenwert(loesung);

      if (istRichtig) {
        punkte++;
        erkannte.push("Zuordnung " + (index + 1) + ": " + loesung);
      } else {
        fehlende.push("Zuordnung " + (index + 1) + (loesung ? ": " + loesung : ""));
      }
    });

    const maxPunkte = Number.isFinite(maxPunkteOverride) && maxPunkteOverride > 0
      ? maxPunkteOverride
      : zuordnungInputs.length;
    const ergebnis = punkte + " von " + maxPunkte + " Punkten.\n" +
      (punkte === maxPunkte
        ? "Alle Zuordnungen sind richtig beantwortet."
        : "Falsch oder leer: " + fehlende.join(", ") + ".");

    return {
      punkte: punkte,
      maxPunkte: maxPunkte,
      ergebnis: ergebnis,
      musterloesung: zuordnungInputs.map(function(input) {
        return String(input.getAttribute("data-answer") || "").trim();
      }).filter(Boolean),
      erkannte: erkannte,
      fehlende: fehlende
    };
  }

function ermittleStrukturPaare(loesungsschluessel) {
    return String(loesungsschluessel || "")
  .split(/[|;\r\n]+/)
      .map(function(wert) {
        const teile = wert.trim().split(/\s*=\s*/);
        return teile.length >= 2
          ? { schluessel: teile.shift().trim(), loesung: teile.join("=").trim() }
          : null;
      })
      .filter(function(paar) {
        return paar && paar.schluessel && paar.loesung;
      });
  }

function ermittleAuswahlFuerSchluessel(eingaben, paar) {
    const passende = eingaben.filter(function(eingabe) {
      const wert = String(eingabe.value || "").trim();
      const name = String(eingabe.name || eingabe.parentElement?.name || "").trim();
      return wert === paar.schluessel + "=" + paar.loesung ||
        (name === paar.schluessel &&
          normalisiereLueckenwert(wert) === normalisiereLueckenwert(paar.loesung));
    });
    return {
      passend: passende,
      ausgewaehlt: passende.filter(function(eingabe) { return eingabe.checked || eingabe.selected; })
    };
  }

function bewerteAnkreuz(eingaben, loesungsschluessel, maxPunkteOverride) {
    const paare = ermittleStrukturPaare(loesungsschluessel);
    const erkannte = [];
    const fehlende = [];
    let punkte = 0;

    paare.forEach(function(paar) {
      const gruppe = eingaben.filter(function(eingabe) {
        return String(eingabe.value || "").trim().split("=")[0] === paar.schluessel;
      });
      const auswahl = ermittleAuswahlFuerSchluessel(eingaben, paar).ausgewaehlt;
      const istRichtig = gruppe.length > 0 && auswahl.length === 1;

      if (istRichtig) {
        punkte++;
        erkannte.push("Aussage " + paar.schluessel + ": " + paar.loesung);
      } else {
        fehlende.push("Aussage " + paar.schluessel + ": " + paar.loesung);
      }
    });

    const maxPunkte = Number.isFinite(maxPunkteOverride) && maxPunkteOverride > 0
      ? maxPunkteOverride
      : paare.length;

    return {
      punkte: punkte,
      maxPunkte: maxPunkte,
      ergebnis: punkte + " von " + maxPunkte + " Punkten.\n" +
        (punkte === maxPunkte
          ? "Alle Aussagen sind richtig beantwortet."
          : "Falsch oder leer: " + fehlende.join(", ") + "."),
      musterloesung: paare.map(function(paar) { return paar.schluessel + "=" + paar.loesung; }),
      erkannte: erkannte,
      fehlende: fehlende
    };
  }

function bewerteMatrix(eingaben, loesungsschluessel, maxPunkteOverride) {
    const paare = ermittleStrukturPaare(loesungsschluessel);
    const erkannte = [];
    const fehlende = [];
    let punkte = 0;

    paare.forEach(function(paar, index) {
      const eingabe = eingaben[index];
      if (eingabe && !["checkbox", "radio"].includes(eingabe.type) && eingabe.tagName !== "SELECT" && !eingabe.name && !eingabe.getAttribute("data-answer")) {
        const antwort = String(eingabe.value || "").trim();
        const istRichtig = normalisiereLueckenwert(antwort) === normalisiereLueckenwert(paar.loesung);
        if (istRichtig) {
          punkte++;
          erkannte.push("Zuordnung " + paar.schluessel + ": " + paar.loesung);
        } else {
          fehlende.push("Zuordnung " + paar.schluessel + ": " + paar.loesung);
        }
        return;
      }
      const auswahl = ermittleAuswahlFuerSchluessel(eingaben, paar).ausgewaehlt;
      const istRichtig = auswahl.length === 1;

      if (istRichtig) {
        punkte++;
        erkannte.push("Zuordnung " + paar.schluessel + ": " + paar.loesung);
      } else {
        fehlende.push("Zuordnung " + paar.schluessel + ": " + paar.loesung);
      }
    });

    const maxPunkte = Number.isFinite(maxPunkteOverride) && maxPunkteOverride > 0
      ? maxPunkteOverride
      : paare.length;

    return {
      punkte: punkte,
      maxPunkte: maxPunkte,
      ergebnis: punkte + " von " + maxPunkte + " Punkten.\n" +
        (punkte === maxPunkte
          ? "Alle Zuordnungen sind richtig beantwortet."
          : "Falsch oder leer: " + fehlende.join(", ") + "."),
      musterloesung: paare.map(function(paar) { return paar.schluessel + "=" + paar.loesung; }),
      erkannte: erkannte,
      fehlende: fehlende
    };
  }

async function bewerteAntwort() {
    if (appIstBeschaeftigt) return;

    const frageTextBox = document.getElementById("frageText");
    const fragetyp = String(frageTextBox?.dataset.fragetyp || "TEXT").trim().toUpperCase();
    const istLueckentext = fragetyp === "LUECKENTEXT";
    const istZuordnung = fragetyp === "ZUORDNUNG";
    const istAnkreuz = fragetyp === "ANKREUZ";
    const istMatrix = fragetyp === "MATRIX";
    const istDiagramm = fragetyp === "DIAGRAMM";
    const loesungsschluessel = String(frageTextBox?.dataset.loesungsschluessel || "");
    const lueckenInputs = istLueckentext
      ? Array.from(document.querySelectorAll('.aufgaben-html-bereich input:not([type="hidden"]), .aufgaben-html-bereich textarea'))
      : [];
    const zuordnungInputs = istZuordnung || istMatrix
      ? Array.from(document.querySelectorAll('.aufgaben-html-bereich input:not([type="hidden"]), .aufgaben-html-bereich textarea, .aufgaben-html-bereich select'))
      : [];
    const strukturInputs = istAnkreuz
      ? Array.from(document.querySelectorAll('.aufgaben-html-bereich input[type="checkbox"]'))
      : istMatrix
        ? Array.from(document.querySelectorAll('.aufgaben-html-bereich input:not([type="hidden"]), .aufgaben-html-bereich textarea, .aufgaben-html-bereich select, .aufgaben-html-bereich input[type="checkbox"], .aufgaben-html-bereich input[type="radio"]'))
        : [];
    const maxPunkteFuerFrage = ermittleMaxPunkteFuerFrage(
      frageTextBox,
      istZuordnung
        ? ermittleStrukturPaare(loesungsschluessel).length
        : istLueckentext
          ? ermittleLueckenLoesungen(loesungsschluessel).length
          : istAnkreuz || istMatrix
            ? ermittleStrukturPaare(loesungsschluessel).length
            : fragetyp === "RECHNUNG"
              ? ermittleStrukturPaare(loesungsschluessel).length
              : 0
    );
    const lueckenAntworten = lueckenInputs.map(function(input) {
      return String(input.value || "").trim();
    });
    const nurWert = function(input) {
      if (input && (input.type === "checkbox" || input.type === "radio")) {
        return input.checked ? String(input.value || "").trim() : "";
      }
      if (input && input.tagName === "SELECT") {
        return String(input.value || "").trim();
      }
      return String(input && input.value || "").trim();
    };
    const antwort = istLueckentext
      ? lueckenAntworten.join(" | ").trim()
      : istZuordnung
        ? zuordnungInputs.map(function(input) { return String(input.value || "").trim(); }).filter(Boolean).join(" | ").trim()
        : istAnkreuz || istMatrix
          ? strukturInputs.map(nurWert).filter(Boolean).join(" | ").trim()
          : document.getElementById("antwortInput").value.trim();
    const hatAusgefüllteLücke = lueckenAntworten.some(Boolean);
    const hatAusgefüllteZuordnung = zuordnungInputs.some(function(input) {
      return String(input.value || "").trim();
    });
    const hatAusgefüllteStruktur = strukturInputs.some(function(input) {
      return Boolean(nurWert(input));
    });
    const diagrammCanvas = istDiagramm ? document.getElementById("skizze-normal") : null;
    const hatSkizze = Boolean(diagrammCanvas && canvasHatInhalt(diagrammCanvas));
    const skizze = hatSkizze ? diagrammCanvas.toDataURL("image/png") : "";

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

    try {
      setzeAppBeschaeftigt(true);
      setzeStatus("Antwort wird ausgewertet...");

      const result = istLueckentext
        ? {
            success: true,
            data: bewerteLueckentext(
              lueckenInputs,
              loesungsschluessel,
              maxPunkteFuerFrage
            )
          }
        : istZuordnung
          ? {
              success: true,
              data: bewerteZuordnung(zuordnungInputs, maxPunkteFuerFrage, loesungsschluessel)
            }
        : istAnkreuz
          ? {
              success: true,
              data: bewerteAnkreuz(strukturInputs, loesungsschluessel, maxPunkteFuerFrage)
            }
        : istMatrix
          ? {
              success: true,
              data: bewerteMatrix(strukturInputs, loesungsschluessel, maxPunkteFuerFrage)
            }
        : await apiPost("bewerteAntwort", {
            fach: aktuellesFach,
            frageId: aktuelleFrageId,
            antwort: antwort,
            ...(istDiagramm ? { skizze: skizze } : {}),
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
