async function ladeLernstand() {
    if (appIstBeschaeftigt) return;

    try {
      setzeAppBeschaeftigt(true);

      const status = document.getElementById("lernstandStatus");
      const liste = document.getElementById("lernstandListe");

      status.textContent = "Lernstand wird geladen...";
      liste.className = "result-list-empty";
      liste.innerHTML = "Bitte kurz warten...";

      const result = await apiGet("getLernstand", {
        nutzer: aktuellerNutzer
      });

      if (!result.success) {
        throw new Error(result.error || "Lernstand konnte nicht geladen werden.");
      }

      const daten = result.data || [];
      aktuellePruefungsDaten = daten;
const fachSelect =
  document.getElementById("pruefungFachSelect");

const gewaehlteOption =
  fachSelect.options[fachSelect.selectedIndex];

const minuten =
  Number(gewaehlteOption?.dataset?.zeit || 0);

if (minuten > 0) {
  startePruefungTimer(minuten);
}
      if (!daten.length) {
        status.textContent = "Keine gespeicherten Einträge gefunden.";
        liste.className = "result-list-empty";
        liste.innerHTML = "Für diesen Nutzer-Code wurde noch kein Lernstand gefunden.";
        return;
      }

      status.textContent = daten.length + " gespeicherte Auswertungen geladen.";
      liste.className = "";

      const fachMap = {};

      daten.forEach(function(eintrag) {
        const key = String(eintrag.teilbereich || "") + "||" + String(eintrag.fach || "");

        if (!fachMap[key]) {
          fachMap[key] = {
            teilbereich: eintrag.teilbereich || "",
            fach: eintrag.fach || "",
            erreicht: 0,
            max: 0,
            anzahl: 0,
            eintraege: []
          };
        }

        fachMap[key].erreicht += Number(eintrag.punkte || 0);
        fachMap[key].max += Number(eintrag.maxPunkte || 0);
        fachMap[key].anzahl += 1;
        fachMap[key].eintraege.push(eintrag);
      });

      const fachBloecke = Object.values(fachMap);

      liste.innerHTML = fachBloecke.map(function(fachBlock, index) {
        const prozent = fachBlock.max > 0
          ? Math.round((fachBlock.erreicht / fachBlock.max) * 100)
          : 0;

        return `
          <div class="result-mini-entry">
            <div class="result-mini-head">
              <div class="result-mini-title">
                ${escapeHtml(fachBlock.teilbereich)} · ${escapeHtml(fachBlock.fach)}
              </div>
              <div class="result-mini-score">
                ${prozent}%
              </div>
            </div>

            <div class="result-mini-bar">
              <div class="result-mini-fill" style="width: ${prozent}%;"></div>
            </div>

            <div class="result-mini-footer">
              <span>${fachBlock.erreicht} / ${fachBlock.max} Punkte · ${fachBlock.anzahl} Auswertungen</span>
              <button class="secondary-btn" style="padding:6px 10px; font-size:12px; width:auto;" onclick="toggleDetails(${index})">
                Details
              </button>
            </div>

            <div id="details-${index}" style="display:none; margin-top:10px;">
              ${fachBlock.eintraege.map(function(eintrag) {
                const einzelProzent = Number(eintrag.maxPunkte || 0) > 0
                  ? Math.round((Number(eintrag.punkte || 0) / Number(eintrag.maxPunkte || 0)) * 100)
                  : Number(eintrag.prozent || 0);

                return `
                  <div style="margin-top:10px; font-size:13px; color:#5a4a80; border-top:1px solid #eadfff; padding-top:8px; line-height:1.5;">
                    <strong>${einzelProzent}%</strong> · ${escapeHtml(eintrag.punkte)} / ${escapeHtml(eintrag.maxPunkte)} Punkte · ${escapeHtml(eintrag.datum)}<br>
                    <strong>Thema:</strong> ${escapeHtml(eintrag.thema)}<br>
                    <strong>Frage:</strong> ${escapeHtml(eintrag.frage || eintrag.frageId || "Frage nicht gefunden")}
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }).join("");

    } catch (error) {
      document.getElementById("lernstandStatus").textContent =
        "Fehler beim Laden: " + error.message;
    } finally {
      setzeAppBeschaeftigt(false);
    }
  }

function toggleDetails(index) {
    const el = document.getElementById("details-" + index);
    if (!el) return;
    el.style.display = el.style.display === "none" ? "block" : "none";
  }
