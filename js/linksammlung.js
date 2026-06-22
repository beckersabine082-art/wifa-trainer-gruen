const gesetzesLinks = [
  {
    fach: "Recht",
    kurz: "BGB",
    name: "Bürgerliches Gesetzbuch",
    beschreibung: "Verträge, Kaufrecht, Mängelrechte, Schuldrecht, Sachenrecht",
    url: "https://www.gesetze-im-internet.de/bgb/"
  },
  {
    fach: "Recht",
    kurz: "HGB",
    name: "Handelsgesetzbuch",
    beschreibung: "Kaufmann, Handelsregister, Firma, Prokura, Handelsgeschäfte, Bilanzrecht",
    url: "https://www.gesetze-im-internet.de/hgb/"
  },
  {
    fach: "Recht",
    kurz: "BBiG",
    name: "Berufsbildungsgesetz",
    beschreibung: "Berufsausbildung, Ausbildende, Auszubildende, Prüfungen, Fortbildung",
    url: "https://www.gesetze-im-internet.de/bbig_2005/"
  },
  {
    fach: "Recht",
    kurz: "ArbZG",
    name: "Arbeitszeitgesetz",
    beschreibung: "Arbeitszeit, Ruhepausen, Ruhezeiten, Sonn- und Feiertagsarbeit",
    url: "https://www.gesetze-im-internet.de/arbzg/"
  },
  {
    fach: "Recht",
    kurz: "JuSchG",
    name: "Jugendschutzgesetz",
    beschreibung: "Jugendschutz, Aufenthalt, Alkohol, Tabak, Medien und Altersfreigaben",
    url: "https://www.gesetze-im-internet.de/juschg/"
  },
  {
    fach: "Steuern",
    kurz: "UStG",
    name: "Umsatzsteuergesetz",
    beschreibung: "Umsatzsteuer, Vorsteuer, Kleinunternehmer, Rechnungen, Steuerbefreiungen",
    url: "https://www.gesetze-im-internet.de/ustg_1980/"
  },
  {
    fach: "Steuern",
    kurz: "EStG",
    name: "Einkommensteuergesetz",
    beschreibung: "Einkommensteuer, Einkunftsarten, Betriebsausgaben, Werbungskosten",
    url: "https://www.gesetze-im-internet.de/estg/"
  },
  {
    fach: "Steuern",
    kurz: "GewStG",
    name: "Gewerbesteuergesetz",
    beschreibung: "Gewerbesteuer, Gewerbeertrag, Hinzurechnungen, Kürzungen",
    url: "https://www.gesetze-im-internet.de/gewstg/"
  },
  {
    fach: "Steuern",
    kurz: "KStG",
    name: "Körperschaftsteuergesetz",
    beschreibung: "Körperschaftsteuer, Kapitalgesellschaften, steuerpflichtige Körperschaften",
    url: "https://www.gesetze-im-internet.de/kstg_1977/"
  },
  {
    fach: "Steuern",
    kurz: "AO",
    name: "Abgabenordnung",
    beschreibung: "Grundregeln des Steuerrechts, Fristen, Steuerbescheide, Einspruch, Mitwirkungspflichten",
    url: "https://www.gesetze-im-internet.de/ao_1977/"
  }
];

function renderGesetzeslinks() {
  const container = document.getElementById("gesetzeslinksListe");
  if (!container) return;

  const gruppen = {};

  gesetzesLinks.forEach(function(link) {
    if (!gruppen[link.fach]) {
      gruppen[link.fach] = [];
    }

    gruppen[link.fach].push(link);
  });

  container.innerHTML = Object.keys(gruppen).map(function(fach) {
    return `
      <div class="gesetzeslinks-gruppe">
        <h3>${escapeHtml(fach)}</h3>

        ${gruppen[fach].map(function(link) {
          return `
            <a class="gesetzeslink-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
              <div class="gesetzeslink-kurz">${escapeHtml(link.kurz)}</div>
              <div class="gesetzeslink-inhalt">
                <strong>${escapeHtml(link.name)}</strong>
                <span>${escapeHtml(link.beschreibung)}</span>
              </div>
            </a>
          `;
        }).join("")}
      </div>
    `;
  }).join("");
}

window.addEventListener("load", renderGesetzeslinks);
