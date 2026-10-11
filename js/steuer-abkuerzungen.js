const STEUER_ABKUERZUNGEN_QUELLEN = Object.freeze({
  BMF_ABKUERZUNGSVERZEICHNIS:
    'https://esth.bundesfinanzministerium.de/ksth/2026/Abkuerzungsverzeichnis/inhalt.html',
  BMF_EUER:
    'https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-08-29-anlage-EUER-2025.html',
  BZST_ZM:
    'https://www.bzst.de/DE/Unternehmen/Umsatzsteuer/ZusammenfassendeMeldung/ElektronischeAbgabe/BOP/BOP.html?lv2=90788',
  GRSTG:
    'https://www.gesetze-im-internet.de/grstg_1973/'
});

// Bewusst eng gefasstes, fachlich geprüftes Verzeichnis. Mehrdeutige Kurzformen
// wie AG, KG und UG werden nicht automatisch aufgelöst.
const STEUER_ABKUERZUNGEN = Object.freeze([
  ['USt-IdNr.', 'USt-IdNr', 'Umsatzsteuer-Identifikationsnummer', '.'],
  ['ErbStG', 'ErbStG', 'Erbschaftsteuer- und Schenkungsteuergesetz'],
  ['GewStG', 'GewStG', 'Gewerbesteuergesetz'],
  ['GrEStG', 'GrEStG', 'Grunderwerbsteuergesetz'],
  ['KStG', 'KStG', 'Körperschaftsteuergesetz'],
  ['UStG', 'UStG', 'Umsatzsteuergesetz'],
  ['EStG', 'EStG', 'Einkommensteuergesetz'],
  ['GrStG', 'GrStG', 'Grundsteuergesetz', '', 'GRSTG'],
  ['KapESt', 'KapESt', 'Kapitalertragsteuer'],
  ['GewSt', 'GewSt', 'Gewerbesteuer'],
  ['GmbH', 'GmbH', 'Gesellschaft mit beschränkter Haftung'],
  ['BewG', 'BewG', 'Bewertungsgesetz'],
  ['ESt', 'ESt', 'Einkommensteuer'],
  ['KSt', 'KSt', 'Körperschaftsteuer'],
  ['USt', 'USt', 'Umsatzsteuer'],
  ['BMF', 'BMF', 'Bundesministerium der Finanzen'],
  ['DBA', 'DBA', 'Doppelbesteuerungsabkommen'],
  ['EÜR', 'EÜR', 'Einnahmenüberschussrechnung', '', 'BMF_EUER'],
  ['EWR', 'EWR', 'Europäischer Wirtschaftsraum'],
  ['HGB', 'HGB', 'Handelsgesetzbuch'],
  ['BGB', 'BGB', 'Bürgerliches Gesetzbuch'],
  ['OHG', 'OHG', 'offene Handelsgesellschaft'],
  ['AO', 'AO', 'Abgabenordnung'],
  ['EU', 'EU', 'Europäische Union'],
  ['GG', 'GG', 'Grundgesetz'],
  ['ZM', 'ZM', 'Zusammenfassende Meldung', '', 'BZST_ZM']
].map(function([kuerzel, token, begriff, nachfolgendesSatzzeichen, quellenSchluessel]) {
  return Object.freeze({
    kuerzel,
    token,
    begriff,
    nachfolgendesSatzzeichen: nachfolgendesSatzzeichen || '',
    quelle: STEUER_ABKUERZUNGEN_QUELLEN[quellenSchluessel || 'BMF_ABKUERZUNGSVERZEICHNIS']
  });
}));

const steuerAbkuerzungWortmuster = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;

function steuerAbkuerzungFuerToken(token) {
  return STEUER_ABKUERZUNGEN.find(function(eintrag) {
    return token === eintrag.token;
  }) || null;
}

function steuerAbkuerzungErklaerungErstellen(document, eintrag) {
  const erklaerung = document.createElement('span');
  erklaerung.className = 'lerntexte-abkuerzung-erklaerung';
  erklaerung.setAttribute('data-podcast-ignore', 'true');
  erklaerung.setAttribute('data-steuer-abkuerzung', eintrag.kuerzel);
  erklaerung.appendChild(document.createTextNode(' (' + eintrag.begriff + ')'));
  return erklaerung;
}

function steuerAbkuerzungErklaerungEinfuegen(wortElement, eintrag) {
  const parent = wortElement && wortElement.parentNode;
  const document = wortElement && wortElement.ownerDocument;
  if (!parent || !document) return false;

  const erklaerung = steuerAbkuerzungErklaerungErstellen(document, eintrag);

  const geschwister = Array.from(parent.childNodes);
  const wortPosition = geschwister.indexOf(wortElement);
  let naechsterKnoten = wortPosition >= 0 ? geschwister[wortPosition + 1] || null : null;

  if (
    eintrag.nachfolgendesSatzzeichen
    && naechsterKnoten
    && naechsterKnoten.nodeType === 3
    && naechsterKnoten.data.startsWith(eintrag.nachfolgendesSatzzeichen)
  ) {
    naechsterKnoten.data = naechsterKnoten.data.slice(eintrag.nachfolgendesSatzzeichen.length);
    parent.insertBefore(document.createTextNode(eintrag.nachfolgendesSatzzeichen), naechsterKnoten);
  }

  parent.insertBefore(erklaerung, naechsterKnoten);
  return true;
}

function erklaereSteuerAbkuerzungen(root, fach, options) {
  if (!root || String(fach || '').trim() !== 'Steuern') return { anzahl: 0 };
  if (root.getAttribute && root.getAttribute('data-steuer-abkuerzungen-erklaert') === 'true') {
    return { anzahl: 0 };
  }

  const bereitsErklaert = options && options.bereitsErklaert ? options.bereitsErklaert : new Set();
  let anzahl = 0;

  Array.from(root.querySelectorAll('[data-word-index]')).forEach(function(wortElement) {
    const eintrag = steuerAbkuerzungFuerToken(String(wortElement.textContent || ''));
    if (!eintrag || bereitsErklaert.has(eintrag.kuerzel)) return;

    if (steuerAbkuerzungErklaerungEinfuegen(wortElement, eintrag)) {
      bereitsErklaert.add(eintrag.kuerzel);
      anzahl += 1;
    }
  });

  if (root.setAttribute) root.setAttribute('data-steuer-abkuerzungen-erklaert', 'true');
  return { anzahl };
}

function erklaereSteuerAbkuerzungenInUeberschrift(root, fach, bereitsErklaert) {
  if (!root || String(fach || '').trim() !== 'Steuern') return { anzahl: 0 };
  if (root.getAttribute && root.getAttribute('data-steuer-abkuerzungen-erklaert') === 'true') {
    return { anzahl: 0 };
  }

  const document = root.ownerDocument;
  const source = String(root.textContent || '');
  const teile = [];
  let offset = 0;
  let anzahl = 0;

  Array.from(source.matchAll(steuerAbkuerzungWortmuster)).forEach(function(match) {
    const eintrag = steuerAbkuerzungFuerToken(match[0]);
    if (!eintrag || bereitsErklaert.has(eintrag.kuerzel)) return;

    let ende = match.index + match[0].length;
    if (eintrag.nachfolgendesSatzzeichen && source.startsWith(eintrag.nachfolgendesSatzzeichen, ende)) {
      ende += eintrag.nachfolgendesSatzzeichen.length;
    }
    teile.push(document.createTextNode(source.slice(offset, ende)));
    teile.push(steuerAbkuerzungErklaerungErstellen(document, eintrag));
    offset = ende;
    bereitsErklaert.add(eintrag.kuerzel);
    anzahl += 1;
  });

  if (anzahl > 0) {
    teile.push(document.createTextNode(source.slice(offset)));
    root.textContent = '';
    teile.forEach(function(teil) { root.appendChild(teil); });
  }
  if (root.setAttribute) root.setAttribute('data-steuer-abkuerzungen-erklaert', 'true');
  return { anzahl };
}

function erklaereSteuerAbkuerzungenInLerneinheit(titelRoot, textRoot, fach) {
  const bereitsErklaert = new Set();
  const titelErgebnis = erklaereSteuerAbkuerzungenInUeberschrift(titelRoot, fach, bereitsErklaert);
  const textErgebnis = erklaereSteuerAbkuerzungen(textRoot, fach, { bereitsErklaert });
  return { anzahl: titelErgebnis.anzahl + textErgebnis.anzahl };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STEUER_ABKUERZUNGEN,
    STEUER_ABKUERZUNGEN_QUELLEN,
    erklaereSteuerAbkuerzungen,
    erklaereSteuerAbkuerzungenInLerneinheit
  };
}

if (typeof window !== 'undefined') {
  window.STEUER_ABKUERZUNGEN = STEUER_ABKUERZUNGEN;
  window.erklaereSteuerAbkuerzungen = erklaereSteuerAbkuerzungen;
  window.erklaereSteuerAbkuerzungenInLerneinheit = erklaereSteuerAbkuerzungenInLerneinheit;
}
