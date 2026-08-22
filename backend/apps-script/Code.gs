/**
 * API-Funktion für die View "Lerntexte & Podcast".
 * Liefert alle aktiven Lerntexte eines Fachs aus dem Sheet "Lerntexte".
 *
 * WICHTIG: Diese Datei ist nur die lokale Quelle. Das tatsächlich unter
 * API_BASE_URL (js/api.js) deployte Apps-Script-Projekt ist NICHT Teil
 * dieses Repos. "Unbekannte Aktion" für "getLerntexte" bedeutet, dass die
 * veröffentlichte Web-App diese Funktion/Action noch nicht kennt.
 * Bitte getLerntexte(fach) unten in das produktive Skript übernehmen, dort
 * im bestehenden action-Router (switch/if) einen Fall "getLerntexte"
 * ergänzen und anschließend eine NEUE Bereitstellung (Deploy > Manage
 * deployments > bestehende Deployment-ID > neue Version) veröffentlichen.
 */
function getLerntexte(fach) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lerntexte");
  if (!sheet) {
    return { success: false, error: "Sheet 'Lerntexte' wurde nicht gefunden." };
  }

  const werte = sheet.getDataRange().getValues();
  const kopf = werte[0];
  const zeilen = werte.slice(1);

  const spaltenIndex = {};
  kopf.forEach(function (name, index) {
    spaltenIndex[String(name).trim()] = index;
  });

  const daten = zeilen
    .map(function (zeile) {
      return {
        id: zeile[spaltenIndex["ID"]],
        fach: zeile[spaltenIndex["Fach"]],
        hauptkapitelNr: zeile[spaltenIndex["Hauptkapitel_Nr"]],
        hauptkapitel: zeile[spaltenIndex["Hauptkapitel"]],
        unterkapitelNr: zeile[spaltenIndex["Unterkapitel_Nr"]],
        titel: zeile[spaltenIndex["Titel"]],
        lerntext: zeile[spaltenIndex["Lerntext"]],
        podcastText: zeile[spaltenIndex["Podcast_Text"]],
        kurzfassung: zeile[spaltenIndex["Kurzfassung"]],
        pruefungsfokus: zeile[spaltenIndex["Prüfungsfokus"]],
        reihenfolgeFach: Number(zeile[spaltenIndex["Reihenfolge_Fach"]]) || 0,
        reihenfolgeKapitel: Number(zeile[spaltenIndex["Reihenfolge_Kapitel"]]) || 0,
        // nur intern für den Filter unten, wird nicht zurückgegeben
        _aktiv: String(zeile[spaltenIndex["Aktiv"]] || "").trim().toLowerCase()
      };
    })
    .filter(function (eintrag) {
      return eintrag.fach === fach && eintrag._aktiv === "ja";
    })
    .map(function (eintrag) {
      delete eintrag._aktiv;
      return eintrag;
    })
    .sort(function (a, b) {
      return a.reihenfolgeFach - b.reihenfolgeFach || a.reihenfolgeKapitel - b.reihenfolgeKapitel;
    });

  return { success: true, data: daten };
}

/**
 * Referenz-Router, nur relevant, wenn dieses Skript eigenständig deployt wird.
 * Im produktiven Projekt bitte stattdessen den bestehenden action-Router um
 * den Fall "getLerntexte" ergänzen.
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === "getLerntexte") {
    return ContentService
      .createTextOutput(JSON.stringify(getLerntexte(e.parameter.fach)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: "Unbekannte Aktion." }))
    .setMimeType(ContentService.MimeType.JSON);
}
