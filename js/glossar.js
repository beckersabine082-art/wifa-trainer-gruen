async function ladeGlossar() {
    if (appIstBeschaeftigt) return;

    try {
      setzeAppBeschaeftigt(true);

      const status = document.getElementById("glossarStatus");
      const liste = document.getElementById("glossarListe");

      status.textContent = "Glossar wird geladen...";
      liste.className = "result-list-empty";
      liste.innerHTML = "Bitte kurz warten...";

      const result = await apiGet("getGlossar");

      if (!result.success) {
        throw new Error(result.error || "Glossar konnte nicht geladen werden.");
      }

      glossarDaten = result.data || [];

      if (!glossarDaten.length) {
        status.textContent = "Keine Glossar-Einträge gefunden.";
        liste.className = "result-list-empty";
        liste.innerHTML = "Im Sheet „Glossar“ wurden keine Einträge gefunden.";
        return;
      }

      status.textContent = glossarDaten.length + " Begriffe geladen.";
baueGlossarFilter();
resetGlossarFilter();

    } catch (error) {
      document.getElementById("glossarStatus").textContent =
        "Fehler beim Laden: " + error.message;
    } finally {
      setzeAppBeschaeftigt(false);
    }
  }

function baueGlossarFilter() {
  const themaSelect = document.getElementById("glossarThemaFilter");
  const alphabet = document.getElementById("glossarAlphabet");

  const themen = [...new Set(glossarDaten.map(function(eintrag) {
    return String(eintrag.thema || "").trim();
  }).filter(Boolean))].sort();

  themaSelect.innerHTML = '<option value="">Alle Themen</option>';

  themen.forEach(function(thema) {
    const option = document.createElement("option");
    option.value = thema;
    option.textContent = thema;
    themaSelect.appendChild(option);
  });

  const buchstaben = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ".split("");

  alphabet.innerHTML = buchstaben.map(function(buchstabe) {
    return `
      <button class="alphabet-btn" type="button" onclick="waehleGlossarBuchstabe('${buchstabe}')">
        ${buchstabe}
      </button>
    `;
  }).join("");
}

function waehleGlossarBuchstabe(buchstabe) {
  glossarAktiverBuchstabe = buchstabe;

  document.querySelectorAll(".alphabet-btn").forEach(function(btn) {
    btn.classList.remove("active");
    if (btn.textContent.trim() === buchstabe) {
      btn.classList.add("active");
    }
  });

  filtereGlossar();
}

function resetGlossarFilter() {
  glossarAktiverBuchstabe = "";

  document.getElementById("glossarSuche").value = "";
  document.getElementById("glossarThemaFilter").value = "";

  document.querySelectorAll(".alphabet-btn").forEach(function(btn) {
    btn.classList.remove("active");
  });

  document.getElementById("glossarStatus").textContent =
    glossarDaten.length ? glossarDaten.length + " Begriffe geladen." : "Noch nicht geladen.";

  document.getElementById("glossarListe").className = "result-list-empty";
  document.getElementById("glossarListe").innerHTML =
    "Wähle einen Buchstaben, ein Thema oder nutze die Suche.";
}

function filtereGlossar() {
  const suchbegriff = String(document.getElementById("glossarSuche").value || "").trim().toLowerCase();
  const themaFilter = String(document.getElementById("glossarThemaFilter").value || "").trim().toLowerCase();

  if (!glossarDaten.length) {
    document.getElementById("glossarListe").className = "result-list-empty";
    document.getElementById("glossarListe").innerHTML = "Bitte zuerst das Glossar laden.";
    return;
  }

  if (!suchbegriff && !themaFilter && !glossarAktiverBuchstabe) {
    document.getElementById("glossarListe").className = "result-list-empty";
    document.getElementById("glossarListe").innerHTML =
      "Wähle einen Buchstaben, ein Thema oder nutze die Suche.";
    document.getElementById("glossarStatus").textContent =
      glossarDaten.length + " Begriffe geladen.";
    return;
  }

  const treffer = glossarDaten.filter(function(eintrag) {
    const begriff = String(eintrag.begriff || "").trim().toLowerCase();
    const thema = String(eintrag.thema || "").trim().toLowerCase();

    const suchText = [
      eintrag.begriff,
      eintrag.erklaerung,
      eintrag.fach,
      eintrag.thema,
      eintrag.synonyme
    ].join(" ").toLowerCase();

    const passtZurSuche = !suchbegriff || suchText.includes(suchbegriff);
    const passtZumThema = !themaFilter || thema === themaFilter;
    const passtZumBuchstaben = !glossarAktiverBuchstabe ||
      begriff.startsWith(glossarAktiverBuchstabe.toLowerCase());

    return passtZurSuche && passtZumThema && passtZumBuchstaben;
  });

  document.getElementById("glossarStatus").textContent =
    treffer.length + " passende Begriffe gefunden.";

  renderGlossar(treffer);
}

function renderGlossar(daten) {
  const liste = document.getElementById("glossarListe");

  if (!daten.length) {
    liste.className = "result-list-empty";
    liste.innerHTML = "Keine passenden Begriffe gefunden.";
    return;
  }

  liste.className = "";
  liste.innerHTML = daten.map(function(eintrag) {
    return `
      <div class="result-mini-entry">
        <div class="result-mini-head">
          <div class="result-mini-title">${escapeHtml(eintrag.begriff)}</div>
          <div class="result-mini-score">${escapeHtml(eintrag.fach)}</div>
        </div>

        <div style="font-size:14px; line-height:1.5; color:#4a3970; margin-top:8px;">
          ${escapeHtml(eintrag.erklaerung)}
        </div>

        <div class="result-mini-footer">
          <span><strong>Thema:</strong> ${escapeHtml(eintrag.thema)}</span>
        </div>

        <div style="margin-top:8px; font-size:13px; color:#5a4a80;">
          <strong>Synonyme:</strong> ${escapeHtml(eintrag.synonyme || "keine")}
        </div>
      </div>
    `;
  }).join("");
}
