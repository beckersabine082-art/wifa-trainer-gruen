async function ladeFormelsammlung() {
  if (appIstBeschaeftigt) return;

  try {
    setzeAppBeschaeftigt(true);

    const status = document.getElementById("formelStatus");
    const liste = document.getElementById("formelListe");

    status.textContent = "Formelsammlung wird geladen...";
    liste.className = "result-list-empty";
    liste.innerHTML = "Bitte kurz warten...";

    const result = await apiGet("getFormelsammlung");

    if (!result.success) {
      throw new Error(result.error || "Formelsammlung konnte nicht geladen werden.");
    }

    formelDaten = result.data || [];

    if (!formelDaten.length) {
      status.textContent = "Keine aktiven Formeln gefunden.";
      liste.className = "result-list-empty";
      liste.innerHTML = "Im Sheet „Formelsammlung“ wurden keine aktiven Formeln gefunden.";
      return;
    }

    baueFormelFilter();
    resetFormelFilter();

  } catch (error) {
    document.getElementById("formelStatus").textContent =
      "Fehler beim Laden: " + error.message;
  } finally {
    setzeAppBeschaeftigt(false);
  }
}

function baueFormelFilter() {
  const themaSelect = document.getElementById("formelThemaFilter");

  const faecher = [...new Set(formelDaten.map(function(eintrag) {
    return String(eintrag.fach || "").trim();
  }).filter(Boolean))].sort();

  themaSelect.innerHTML = '<option value="">Alle Fächer</option>';

  faecher.forEach(function(fach) {
    const option = document.createElement("option");
    option.value = fach;
    option.textContent = fach;
    themaSelect.appendChild(option);
  });
}

function resetFormelFilter() {
  document.getElementById("formelSuche").value = "";
  document.getElementById("formelThemaFilter").value = "";

  document.getElementById("formelStatus").textContent =
    formelDaten.length + " Formeln geladen.";

  renderFormeln(formelDaten);
}

function filtereFormeln() {
  const suche = String(document.getElementById("formelSuche").value || "").trim().toLowerCase();
  const themaFilter = String(document.getElementById("formelThemaFilter").value || "").trim().toLowerCase();

  if (!formelDaten.length) {
    document.getElementById("formelListe").className = "result-list-empty";
    document.getElementById("formelListe").innerHTML = "Formelsammlung wird noch geladen.";
    return;
  }

  const treffer = formelDaten.filter(function(eintrag) {
    const kapitelAnzeige = eintrag.unterkapitel
      ? String(eintrag.kapitel || "") + " / " + String(eintrag.unterkapitel || "")
      : String(eintrag.kapitel || "");

    const suchText = [
      eintrag.fach,
      eintrag.kapitel,
      eintrag.unterkapitel,
      eintrag.formelname,
      eintrag.ihkSeite,
      eintrag.ihkFormel,
      eintrag.variablen,
      eintrag.erklaerung,
      eintrag.beispiel
    ].join(" ").toLowerCase();

    const passtZurSuche = !suche || suchText.includes(suche);
const passtZumThema = !themaFilter || String(eintrag.fach || "").toLowerCase() === themaFilter;
    return passtZurSuche && passtZumThema;
  });

  document.getElementById("formelStatus").textContent =
    treffer.length + " passende Formeln gefunden.";

  renderFormeln(treffer);
}

function renderFormeln(daten) {
  const liste = document.getElementById("formelListe");

  if (!daten.length) {
    liste.className = "result-list-empty";
    liste.innerHTML = "Keine passenden Formeln gefunden.";
    return;
  }

  liste.className = "";
  liste.innerHTML = daten.map(function(eintrag) {
    const kapitelAnzeige = eintrag.unterkapitel
      ? escapeHtml(eintrag.kapitel) + " / " + escapeHtml(eintrag.unterkapitel)
      : escapeHtml(eintrag.kapitel);

    return `
      <div class="result-mini-entry">
        <div class="result-mini-head">
          <div class="result-mini-title">${escapeHtml(eintrag.formelname)}</div>
          <div class="result-mini-score">IHK S. ${escapeHtml(eintrag.ihkSeite || "-")}</div>
        </div>

        <div class="result-mini-footer">
          <span><strong>Fach:</strong> ${escapeHtml(eintrag.fach)}</span>
          <span><strong>Kapitel:</strong> ${kapitelAnzeige}</span>
        </div>

        <div style="font-size:16px; line-height:1.6; color:#2d1f46; margin-top:10px;">
          <strong>IHK-Formel:</strong><br>
          ${escapeHtml(eintrag.ihkFormel)}
        </div>

        <div style="font-size:14px; line-height:1.6; color:#4a3970; margin-top:10px;">
          <strong>Variablen / Kürzel:</strong><br>
          ${escapeHtml(eintrag.variablen || "keine hinterlegt")}
        </div>

        <div style="font-size:14px; line-height:1.6; color:#4a3970; margin-top:10px;">
          <strong>Kurz-Erklärung:</strong><br>
          ${escapeHtml(eintrag.erklaerung || "keine Erklärung hinterlegt")}
        </div>

        <div style="font-size:14px; line-height:1.6; color:#4a3970; margin-top:10px;">
          <strong>Beispiel:</strong><br>
          ${escapeHtml(eintrag.beispiel || "kein Beispiel hinterlegt")}
        </div>
      </div>
    `;
  }).join("");
}
