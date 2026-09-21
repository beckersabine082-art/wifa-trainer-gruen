
// Spaltennummern
const COL = {
  ID: 1,
  THEMA: 2,
  FRAGE: 3,
  ANTWORT: 4,
  MUSTER: 5,
  STICHPUNKTE: 6,
  ERGEBNIS: 7,
  PUNKTE: 8,
  AKTIV: 9,
  LOESUNG: 10,
  TEILBEREICH: 11,
 FRAGETYP: 12,
AUFGABEN_HTML: 13,
LOESUNGSSCHLUESSEL: 14,
BILDDATEI: 15
};

// HIER DEINEN API-KEY EINTRAGEN
const OPENAI_API_KEY = PropertiesService
  .getScriptProperties()
  .getProperty('OPENAI_API_KEY');

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetByNameSafe_(name) {
  const ss = getSpreadsheet_();
  const gesuchterName = String(name || "").trim();

  if (!gesuchterName) {
    throw new Error("Kein Blattname übergeben.");
  }

  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = String(sheet.getName() || "").trim();

    if (sheetName === gesuchterName) {
      return sheet;
    }
  }

  throw new Error("Sheet nicht gefunden: " + gesuchterName);
}

function getSheetByName_(sheetName) {
  return getSheetByNameSafe_(sheetName);
}

function getSheet_() {
  const sheet = getSpreadsheet_().getActiveSheet();

  if (!sheet) {
    throw new Error("Kein aktives Blatt gefunden.");
  }

  return sheet;
}

function ensureNutzerFortschrittSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName("NutzerFortschritt");

  if (!sheet) {
    sheet = ss.insertSheet("NutzerFortschritt");
    sheet.appendRow([
      "Nutzer",
      "Bereich",
      "Fach",
      "Auswahl",
      "Letzte Frage-ID",
      "Aktualisiert"
    ]);
  }

  return sheet;
}

function ensurePodcastFortschrittSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName("PodcastFortschritt");

  if (!sheet) {
    sheet = ss.insertSheet("PodcastFortschritt");
    sheet.appendRow([
      "Nutzer",
      "Fach",
      "Einheit",
      "FirebasePfad",
      "LerntextHash",
      "SekundenPosition",
      "WortIndex",
      "Completed",
      "Aktualisiert"
    ]);
  }

  return sheet;
}

function validatePodcastProgressState_(state) {
  if (!state || typeof state !== "object") {
    throw new Error("Podcast-Fortschritt muss als Objekt übergeben werden.");
  }

  ["nutzer", "fach", "einheit", "firebasePfad", "lerntextHash"].forEach(function(field) {
    if (typeof state[field] !== "string" || !state[field].trim()) {
      throw new Error(field + " ist für Podcast-Fortschritt erforderlich.");
    }
  });

  if (typeof state.sekundenPosition !== "number" || !Number.isFinite(state.sekundenPosition) || state.sekundenPosition < 0) {
    throw new Error("SekundenPosition muss eine endliche Zahl >= 0 sein.");
  }

  if (typeof state.wortIndex !== "number" || !Number.isFinite(state.wortIndex) || !Number.isInteger(state.wortIndex) || state.wortIndex < 0) {
    throw new Error("WortIndex muss eine ganze Zahl >= 0 sein.");
  }

  if (typeof state.completed !== "boolean") {
    throw new Error("Completed muss boolean sein.");
  }
}

function podcastProgressDataFromRow_(row) {
  return {
    nutzer: row[0],
    fach: row[1],
    einheit: row[2],
    firebasePfad: row[3],
    lerntextHash: row[4],
    sekundenPosition: row[5],
    wortIndex: row[6],
    completed: row[7],
    aktualisiert: row[8]
  };
}

function getPodcastProgress(nutzer, fach) {
  if (typeof nutzer !== "string" || !nutzer.trim()) {
    throw new Error("Nutzer ist für getPodcastProgress erforderlich.");
  }

  if (typeof fach !== "string" || !fach.trim()) {
    throw new Error("Fach ist für getPodcastProgress erforderlich.");
  }

  const values = ensurePodcastFortschrittSheet_().getDataRange().getValues();
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];

    if (row[0] === nutzer && row[1] === fach) {
      result.push(podcastProgressDataFromRow_(row));
    }
  }

  return result;
}

function sheetLiteral_(value) {
  return typeof value === 'string' && /^\s*=/.test(value) ? "'" + value : value;
}

function savePodcastProgress(state) {
  validatePodcastProgressState_(state);

  const sheet = ensurePodcastFortschrittSheet_();
  const values = sheet.getDataRange().getValues();
  let existingRowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];

    if (row[0] === state.nutzer && row[3] === state.firebasePfad) {
      existingRowIndex = i + 1;
      break;
    }
  }

  const row = [
    state.nutzer,
    state.fach,
    state.einheit,
    state.firebasePfad,
    state.lerntextHash,
    state.sekundenPosition,
    state.wortIndex,
    state.completed,
    new Date()
  ];

  if (existingRowIndex > 0) {
    sheet.getRange(existingRowIndex, 1, 1, row.length).setValues([row.map(sheetLiteral_)]);
  } else {
    sheet.appendRow(row.map(sheetLiteral_));
  }

  return podcastProgressDataFromRow_(row);
}

function normalizeProgressSelection_(value) {
  const normalized = String(value || "").trim();
  return normalized ? normalized : "__ALL__";
}

function getProgressRowForKey_(sheet, nutzer, bereich, fach, auswahl) {
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];

    if (
      String(row[0] || "").trim() === String(nutzer || "").trim() &&
      String(row[1] || "").trim() === String(bereich || "").trim() &&
      String(row[2] || "").trim() === String(fach || "").trim() &&
      String(row[3] || "").trim() === String(auswahl || "").trim()
    ) {
      return {
        rowIndex: i + 1,
        data: {
          nutzer: String(row[0] || "").trim(),
          bereich: String(row[1] || "").trim(),
          fach: String(row[2] || "").trim(),
          auswahl: String(row[3] || "").trim(),
          letzteFrageId: String(row[4] || "").trim(),
          aktualisiert: row[5]
        }
      };
    }
  }

  return null;
}

function getProgressForKey_(nutzer, bereich, fach, auswahl) {
  const sheet = ensureNutzerFortschrittSheet_();
  const row = getProgressRowForKey_(sheet, nutzer, bereich, fach, auswahl);

  if (!row) {
    return null;
  }

  return row.data;
}

function upsertProgressForKey_(nutzer, bereich, fach, auswahl, frageId) {
  const sheet = ensureNutzerFortschrittSheet_();
  const safeNutzer = String(nutzer || "").trim();
  const safeBereich = String(bereich || "").trim();
  const safeFach = String(fach || "").trim();
  const safeAuswahl = normalizeProgressSelection_(auswahl);
  const safeFrageId = String(frageId || "").trim();

  if (!safeNutzer || !safeBereich || !safeFach || !safeFrageId) {
    throw new Error("Nutzer, Bereich, Fach und Frage-ID sind für Fortschritt erforderlich.");
  }

  const existing = getProgressRowForKey_(sheet, safeNutzer, safeBereich, safeFach, safeAuswahl);

  const timestamp = new Date();

  if (existing) {
    sheet.getRange(existing.rowIndex, 1, 1, 6).setValues([[
      safeNutzer,
      safeBereich,
      safeFach,
      safeAuswahl,
      safeFrageId,
      timestamp
    ].map(sheetLiteral_)]);
    return {
      nutzer: safeNutzer,
      bereich: safeBereich,
      fach: safeFach,
      auswahl: safeAuswahl,
      letzteFrageId: safeFrageId,
      aktualisiert: timestamp
    };
  }

  sheet.appendRow([
    safeNutzer,
    safeBereich,
    safeFach,
    safeAuswahl,
    safeFrageId,
    timestamp
  ].map(sheetLiteral_));

  return {
    nutzer: safeNutzer,
    bereich: safeBereich,
    fach: safeFach,
    auswahl: safeAuswahl,
    letzteFrageId: safeFrageId,
    aktualisiert: timestamp
  };
}

function doGet(e) {
  const action = String(e?.parameter?.action || "").trim();

  if (!action) {
    return HtmlService.createHtmlOutputFromFile("Index")
      .setTitle("WiFa Prüfungs-Trainer");
  }

  try {
    let result = {};

    // Public question APIs must never act as readers for private progress tabs.
    if (['topics','questionById','firstQuestion','nextQuestion','questionsForTopic','getKarteikarten','quizQuestion'].includes(action) &&
        !istOeffentlichesFragenFach_(e?.parameter?.fach)) {
      return ContentService.createTextOutput(JSON.stringify({success:false,error:'invalid_request'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "subjects") {
      result = {
        success: true,
        data: getFrontendSheetNames()
      };

    } else if (action === "topics") {
      const fach = String(e?.parameter?.fach || "").trim();

      result = {
        success: true,
        data: getTopicsForSheet(fach)
      };

       } else if (action === "quizCatalog") {
      result = {
        success: true,
        data: getQuizCatalogFrontend()
      };

    } else if (action === "quizQuestion") {
      const fach = String(e?.parameter?.fach || "").trim();
      const frageId = String(e?.parameter?.frageId || "").trim();
      const schwierigkeitsgrad = String(e?.parameter?.schwierigkeitsgrad || "").trim();

      result = {
        success: true,
        data: getQuizQuestionFrontend(fach, frageId, schwierigkeitsgrad)
      };

    } else if (action === "nextQuestion") {
  const fach = String(e?.parameter?.fach || "").trim();
  const thema = String(e?.parameter?.thema || "").trim();
  const currentId = String(e?.parameter?.currentId || "").trim();

  result = {
    success: true,
    data: getNextQuestion(fach, thema, currentId)
  };

    } else if (action === "firstQuestion") {
      const fach = String(e?.parameter?.fach || "").trim();
      const thema = String(e?.parameter?.thema || "").trim();

      result = {
        success: true,
        data: getFirstActiveQuestion(fach, thema)
      };

    } else if (action === "questionsForTopic") {
      const fach = String(e?.parameter?.fach || "").trim();
      const thema = String(e?.parameter?.thema || "").trim();

      result = {
        success: true,
        data: getQuestionsForTopic(fach, thema)
      };

    } else if (action === "questionById") {
      const fach = String(e?.parameter?.fach || "").trim();
      const frageId = String(e?.parameter?.frageId || "").trim();

      result = {
        success: true,
        data: getQuestionById(fach, frageId)
      };

    } else if (action === "getGlossar") {
  result = {
    success: true,
    data: getGlossarFrontend()
  };

} else if (action === "getLerntexte") {
  const fach = String(e?.parameter?.fach || "").trim();

  result = {
    success: true,
    data: getLerntexte(fach)
  };

} else if (action === "getKarteikarten") {
  const fach = String(e?.parameter?.fach || "").trim();
  const thema = String(e?.parameter?.thema || "").trim();

  result = {
    success: true,
    data: getKarteikartenFrontend(fach, thema)
  };
   
  } else if (action === "getPruefungSimulation") {

  const teilbereich = String(e?.parameter?.teilbereich || "").trim();
  const simulationNr = String(e?.parameter?.simulation || "").trim();
  const einheit = String(e?.parameter?.einheit || "").trim();

  result = {
    success: true,
    data: getPruefungSimulationFrontend(
      teilbereich,
      simulationNr,
      einheit
    )
  };

} else if (action === "getFormelsammlung") {
  result = {
    success: true,
    data: getFormelsammlungFrontend()
  };

 } else {
      result = {
        success: false,
        error: "Unbekannte Aktion."
      };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: String(error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function getLernstandFrontend(nutzer) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName("Lernstand");

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const daten = values.slice(1);

  const gefiltert = daten
    .filter(function(row) {
      if (!nutzer) return true;
      return String(row[0] || "").trim() === nutzer;
    })
    .map(function(row) {
      const fach = String(row[3] || "").trim();
      const frageId = String(row[5] || "").trim();

      let frageText = "";

      try {
        const frageObj = getQuestionById(fach, frageId);
        frageText = frageObj && frageObj.frage ? frageObj.frage : "";
      } catch (e) {
        frageText = "";
      }

      return {
        nutzer: row[0],
        datum: row[1] instanceof Date
          ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm")
          : String(row[1] || ""),
        teilbereich: row[2],
        fach: row[3],
        thema: row[4],
        frageId: row[5],
        frage: frageText,
        punkte: row[6],
        maxPunkte: row[7],
        prozent: row[8],
        bewertung: row[9],
        antwort: row[10]
      };
    })
    .reverse()
    .slice(0, 50);

  return gefiltert;
}
function doPost(e) {
  try {
    let body;
    if (typeof e?.postData?.contents !== 'string' || e.postData.contents.length > 4000000) {
      return ContentService.createTextOutput(JSON.stringify({success:false,error:'invalid_request'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    try { body = JSON.parse(e.postData.contents || "{}"); }
    catch (_) {
      // Never echo malformed request bodies (which may contain authentication tokens).
      return ContentService.createTextOutput(JSON.stringify({success:false,error:'invalid_request'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (body && (body.action === 'usageRecord' || body.action === 'usageRead')) {
      return ContentService.createTextOutput(JSON.stringify(usageHandle_(body)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_request');
    const action = String(body.action || "").trim();
    if (action === 'sendFeedback') {
      if (Object.keys(body).some(key => !['action','idToken','feedback','page'].includes(key)) ||
          typeof body.feedback !== 'string' || body.feedback.length > 3000 || !body.feedback.trim() ||
          (body.page !== undefined && (typeof body.page !== 'string' || body.page.length > 300))) {
        throw new Error('invalid_request');
      }
      const feedbackUser = feedbackAuthorize_(body);
      const timestamp = Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm:ss z');
      const page = String(body.page || '').replace(/[\r\n\t]/g, ' ').trim() || 'Unbekannt';
      const recipient = 'biene-becks@web.de';
      const message = {
        to: recipient,
        subject: 'WiFa Trainer – neues Feedback',
        body: 'Feedback:\n' + body.feedback.trim() + '\n\nE-Mail: ' + (feedbackUser.email || 'Nicht verfügbar') +
          '\nNutzer-ID: ' + feedbackUser.uid + '\nDatum/Uhrzeit: ' + timestamp + '\nSeite/Bereich: ' + page
      };
      MailApp.sendEmail(message);
      return ContentService.createTextOutput(JSON.stringify({success:true}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const protectedActions = ['getLernstand','getProgress','getPodcastProgress','saveProgress',
      'savePodcastProgress','speichereLernstand','bewerteAntwort','frageKilian','bewertePruefung'];
    if (!protectedActions.includes(action)) throw new Error('invalid_request');
    body.action = action;
    const uid = learningAuthorize_(body);
    // Never let a client-selected identity choose a user's Sheet rows.
    body.nutzer = uid;

    let result = {};

    if (action === 'getLernstand') {
      result = {success:true, data:getLernstandFrontend(uid)};
    } else if (action === 'getProgress') {
      if (!body.bereich || !body.fach) throw new Error('invalid_request');
      result = {success:true, data:getProgressForKey_(uid, body.bereich, body.fach, normalizeProgressSelection_(body.auswahl))};
    } else if (action === 'getPodcastProgress') {
      result = {success:true, data:getPodcastProgress(uid, body.fach)};
    } else if (action === "bewerteAntwort") {
      if (!istOeffentlichesFragenFach_(body.fach)) throw new Error('invalid_request');
      result = {
        success: true,
       data: bewerteAntwortFrontend({
  fach: body.fach,
  frageId: body.frageId,
  antwort: body.antwort,
          skizze: body.skizze,
  speichereInSheet: false
})
      };

    } else if (action === "speichereLernstand") {
      speichereLernstandFrontend(
        body.nutzer,
        body.teilbereich,
        body.fach,
        body.thema,
        body.frageId,
        body.punkte,
        body.maxPunkte,
        body.bewertung,
        body.antwort
      );

      result = {
        success: true
      };

    } else if (action === "saveProgress") {
      const nutzer = String(body.nutzer || "").trim();
      const bereich = String(body.bereich || "").trim();
      const fach = String(body.fach || "").trim();
      const auswahl = normalizeProgressSelection_(body.auswahl);
      const frageId = String(body.frageId || "").trim();

      if (!nutzer || !bereich || !fach || !frageId) {
        result = {
          success: false,
          error: "Nutzer, Bereich, Fach und Frage-ID für saveProgress erforderlich."
        };
      } else {
        const saved = upsertProgressForKey_(nutzer, bereich, fach, auswahl, frageId);
        result = {
          success: true,
          data: saved
        };
      }

    } else if (action === "savePodcastProgress") {
      const state = {
        nutzer: body.nutzer,
        fach: body.fach,
        einheit: body.einheit,
        firebasePfad: body.firebasePfad,
        lerntextHash: body.lerntextHash,
        sekundenPosition: body.sekundenPosition,
        wortIndex: body.wortIndex,
        completed: body.completed
      };

      result = {
        success: true,
        data: savePodcastProgress(state)
      };

    } else if (action === "frageKilian") {
  result = {
    success: true,
    data: frageKilianFrontend(body.frage, body.trainerKontext)
  };

} else if (action === "bewertePruefung") {
  result = {
    success: true,
    data: bewertePruefungFrontend(body.daten || [])
  };

} else {
  result = {
    success: false,
    error: "Unbekannte POST-Aktion."
  };
}

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: ['unauthenticated','invalid_request','rate_limited','unavailable'].includes(error?.usageCode || error?.message)
          ? (error.usageCode || error.message) : 'request_failed'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetNames() {
  return getSpreadsheet_().getSheets().map(sheet => sheet.getName().trim());
}

function istOeffentlichesFragenFach_(fach) {
  // Include the two subject names already used by main.js, without changing its catalog.
  return getFrontendSheetNames().concat(['Investition und Finanzierung', 'Betriebliches Rechnungswesen und Controlling'])
    .includes(String(fach || '').trim());
}

function getFrontendSheetNames() {
  const gewuenschteReihenfolge = [
    "Recht",
    "Steuern",
    "Rechnungswesen",
    "BWL",
    "VWL",
    "Unternehmensführung",
    "Führung und Zusammenarbeit",
    "Betriebliches Management",
    "Logistik",
    "Marketing",
    "Vertrieb",
    "Finance Controlling"
  ];

  const vorhandeneSheets = getSpreadsheet_()
    .getSheets()
    .map(sheet => sheet.getName().trim());

  return gewuenschteReihenfolge.filter(name => vorhandeneSheets.includes(name));
}

function getTopicsForSheet(sheetName) {
  const activeQuestions = getActiveQuestions(sheetName);
  const themaMap = {};

  activeQuestions.forEach(function(q) {
    const thema = String(q.thema || "").trim();
    if (!thema) return;

    if (!themaMap[thema]) {
      themaMap[thema] = 0;
    }

    themaMap[thema]++;
  });

  return Object.keys(themaMap)
    .sort(function(a, b) {
      return a.localeCompare(b, "de");
    })
    .map(function(thema) {
      return {
        thema: thema,
        anzahl: themaMap[thema]
      };
    });
}

function getStichpunkteListe_(rawValue) {
  return String(rawValue || "")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);
}

function getMaxPunkteFromStichpunkte_(rawValue) {
  const liste = getStichpunkteListe_(rawValue);
  return liste.length > 0 ? liste.length : 10;
}

// German stopwords to ignore when extracting content
function getGermanStopwords_() {
  return new Set(['für', 'die', 'der', 'das', 'den', 'dem', 'des', 'ein', 'eine', 
                  'und', 'oder', 'aber', 'in', 'an', 'auf', 'zu', 'von', 'mit', 'bei', 
                  'ist', 'sind', 'wird', 'haben', 'hat']);
}

// Extract meaningful content words from text (remove stopwords, punctuation)
function extractContentWords_(text) {
  const stopwords = getGermanStopwords_();
  const words = String(text || '')
    .toLocaleLowerCase('de-DE')
    .replace(/[^\w\s-äöüß]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  return words.filter(w => !stopwords.has(w) && w.length > 2);
}

// Simple German stem normalization: remove common inflection endings
function normalizeGermanWord_(word) {
  let w = String(word || '').toLocaleLowerCase('de-DE');
  if (w.length < 4) return w;
  // Remove common endings: -en, -e, -n, -r, -s
  return w.replace(/(en|e|n|r|s)$/, '');
}

// Check if two words match considering German inflection
function wordMatches_(answerWord, criterionWord) {
  if (!answerWord || !criterionWord) return false;
  const a = String(answerWord).toLocaleLowerCase('de-DE');
  const c = String(criterionWord).toLocaleLowerCase('de-DE');
  if (a === c) return true;
  // Match on normalized stem if both are long enough
  if (a.length >= 4 && c.length >= 4) {
    return normalizeGermanWord_(a) === normalizeGermanWord_(c);
  }
  return false;
}

// Check for negation patterns near a word in text
// Ignores "nicht nur" pattern as it's not a negation for "und X sondern auch"
function hasNegationNear_(text, word) {
  const lower = String(text || '').toLocaleLowerCase('de-DE');
  const target = String(word || '').toLocaleLowerCase('de-DE');
  if (!target) return false;
  // Inspect every occurrence; a later negation must not be hidden by an earlier mention.
  let position = lower.indexOf(target);
  while (position !== -1) {
    const context = lower.substring(Math.max(0, position - 30), position + target.length + 30)
      .replace(/nicht\s+nur/g, '');
    if (/\b(?:kein(?:e|en|em|er|es)?|nicht|nie|niemals|ohne)\b/.test(context)) return true;
    position = lower.indexOf(target, position + target.length);
  }
  return false;
}

// Sentence-local fallback: rescue a criterion only if all content words 
// appear in the SAME sentence with no negation
function fallbackErkenneLexikalischVerpassteKriterien_(userAnswer, stichpunkteListe, fehlendeIds, kriterienIds) {
  const erkannteZusaetzlich = [];
  
  const answer = String(userAnswer || '');
  // Split into sentences (simple: period, question mark, exclamation)
  const sentences = answer.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  
  fehlendeIds = Array.isArray(fehlendeIds) ? fehlendeIds : [];
  stichpunkteListe = Array.isArray(stichpunkteListe) ? stichpunkteListe : [];
  kriterienIds = Array.isArray(kriterienIds) ? kriterienIds : [];
  
  fehlendeIds.forEach(function(fehlendId) {
    const index = kriterienIds.indexOf(fehlendId);
    if (index < 0 || index >= stichpunkteListe.length) return;
    
    const criterion = String(stichpunkteListe[index] || '');
    const contentWords = extractContentWords_(criterion);
    
    if (contentWords.length === 0) return;
    
    let positiveMatch = false;
    let negativeMatch = false;
    // Try to find ALL content words in the SAME sentence
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceWords = extractContentWords_(sentence);
      
      // Check if all criterion words appear in this sentence (with inflection matching)
      let allFound = true;
      for (let j = 0; j < contentWords.length; j++) {
        let found = false;
        for (let k = 0; k < sentenceWords.length; k++) {
          if (wordMatches_(sentenceWords[k], contentWords[j])) {
            found = true;
            break;
          }
        }
        if (!found) {
          allFound = false;
          break;
        }
      }
      
      if (allFound) {
        // All words found in this sentence. Check for negation.
        let hasNegation = false;
        for (let j = 0; j < contentWords.length; j++) {
          if (sentenceWords.some(function(word) {
            return wordMatches_(word, contentWords[j]) && hasNegationNear_(sentence, word);
          })) {
            hasNegation = true;
            break;
          }
        }
        
        if (!hasNegation) {
          positiveMatch = true;
        }
        if (hasNegation) negativeMatch = true;
      }
    }
    if (positiveMatch && !negativeMatch) erkannteZusaetzlich.push(fehlendId);
  });
  
  return {
    erkannteZusaetzlich: erkannteZusaetzlich
  };
}

function istExakteMusterantwort_(antwort, muster, istDiagramm) {
  return !istDiagramm && Boolean(antwort) && Boolean(muster) &&
    normalizeTextForCompare_(antwort) === normalizeTextForCompare_(muster);
}

function werteKriterienMitFallback_(text, antwort, stichpunkte, ids, istDiagramm) {
  const result = parseKriterienErgebnis_(text, ids);
  // A text-only rescue cannot verify a drawing and must not overturn visual rejection.
  if (istDiagramm) return result;
  const rescue = fallbackErkenneLexikalischVerpassteKriterien_(antwort, stichpunkte, result.fehlendeIds, ids);
  result.erkannteIds = [...new Set(result.erkannteIds.concat(rescue.erkannteZusaetzlich))];
  result.fehlendeIds = result.fehlendeIds.filter(id => !result.erkannteIds.includes(id));
  return result;
}

function diagrammBewertungsregel_(beschreibungErforderlich = true) {
  if (!beschreibungErforderlich) return '- Prüfe die Skizze fachlich anhand von Frage, Musterlösung und Kriterien (Achsen, Kurven, Verläufe, Schnittpunkte und Beschriftungen). Das Vorhandensein von Pixeln ist kein erfülltes Kriterium. Verlange keine zusätzliche schriftliche Beschreibung, wenn die Aufgabe nur eine grafische Darstellung verlangt. Eine falsche Skizze darf nicht durch richtigen Text ersetzt werden.';
  return '- Skizze UND schriftliche Beschreibung/Begründung sind erforderlich. Prüfe die Skizze fachlich anhand von Frage, Musterlösung und Kriterien (Achsen, Kurven, Verläufe, Schnittpunkte und Beschriftungen). Das Vorhandensein von Pixeln ist kein erfülltes Kriterium. Eine falsche Skizze darf nicht durch eine richtige Beschreibung als vollständig richtig bewertet werden. Bewerte ein zeichnungsbezogenes Kriterium nur als erfüllt, wenn die Skizze UND die zugehörige Beschreibung dazu passen; keines ersetzt das andere.';
}

function getKriterienIdsFuerStichpunkte_(stichpunkteListe) {
  return Array.isArray(stichpunkteListe)
    ? stichpunkteListe.map(function(_, index) {
        return "K" + (index + 1);
      })
    : [];
}

function normalizeKriterienId_(wert) {
  return String(wert || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function filterQuestionsByThema_(questions, thema) {
  const themaFilter = String(thema || "").trim();

  if (!themaFilter) {
    return questions;
  }

  return questions.filter(q => String(q.thema || "").trim() === themaFilter);
}

function getActiveQuestions(sheetName) {
  const sheet = getSheetByNameSafe_(sheetName);
  const lastRow = sheet.getLastRow();
  const questions = [];

  if (lastRow < 3) return questions;

  const startRow = 3;
  const numRows = lastRow - startRow + 1;
  const values = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();

  values.forEach(function(rowValues, index) {
    const row = startRow + index;
    const aktivWert = String(rowValues[COL.AKTIV - 1] || "").trim().toLowerCase();

    if (aktivWert === "ja") {
      questions.push({
        row: row,
        id: String(rowValues[COL.ID - 1] || "").trim(),
        thema: String(rowValues[COL.THEMA - 1] || "").trim(),
        frage: String(rowValues[COL.FRAGE - 1] || "").trim(),
        musterloesung: String(rowValues[COL.MUSTER - 1] || "").trim(),
        stichpunkte: String(rowValues[COL.STICHPUNKTE - 1] || "").trim(),
        fragetyp: String(rowValues[COL.FRAGETYP - 1] || "text").trim(),
        aufgabenHtml: String(rowValues[COL.AUFGABEN_HTML - 1] || "").trim(),
        loesungsschluessel: String(rowValues[COL.LOESUNGSSCHLUESSEL - 1] || "").trim(),
        bilddatei: String(rowValues[COL.BILDDATEI - 1] || "").trim()
      });
    }
  });

  return questions;
}

function getQuestionById(sheetName, questionId) {
  const sheet = getSheetByNameSafe_(sheetName);
  const lastRow = sheet.getLastRow();
  const idToFind = String(questionId || "").trim();

  if (!idToFind) {
    return {
      row: "",
      id: "",
      thema: "",
      frage: "Keine Frage-ID übergeben.",
      musterloesung: "",
      stichpunkte: ""
    };
  }

  if (lastRow < 3) {
    return {
      row: "",
      id: "",
      thema: "",
      frage: "Keine Fragen in diesem Fach gefunden.",
      musterloesung: "",
      stichpunkte: ""
    };
  }

  const startRow = 3;
  const numRows = lastRow - startRow + 1;
  const values = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowValues = values[i];
    const row = startRow + i;
    const currentId = String(rowValues[COL.ID - 1] || "").trim();

    if (currentId === idToFind) {
      return {
  row: row,
  id: currentId,
  thema: String(rowValues[COL.THEMA - 1] || "").trim(),
  frage: String(rowValues[COL.FRAGE - 1] || "").trim(),
  musterloesung: String(rowValues[COL.MUSTER - 1] || "").trim(),
  stichpunkte: String(rowValues[COL.STICHPUNKTE - 1] || "").trim(),
  fragetyp: String(rowValues[COL.FRAGETYP - 1] || "text").trim(),
  aufgabenHtml: String(rowValues[COL.AUFGABEN_HTML - 1] || "").trim(),
  loesungsschluessel: String(rowValues[COL.LOESUNGSSCHLUESSEL - 1] || "").trim(),
  bilddatei: String(rowValues[COL.BILDDATEI - 1] || "").trim()
};
    }
  }

  return {
    row: "",
    id: "",
    thema: "",
    frage: "Frage mit dieser ID nicht gefunden.",
    musterloesung: "",
    stichpunkte: ""
  };
}

function getQuestionsForTopic(sheetName, thema) {
  const activeQuestions = getActiveQuestions(sheetName);
  const gefilterteFragen = filterQuestionsByThema_(activeQuestions, thema);

  return gefilterteFragen.map(function(frage) {
    return {
      row: frage.row,
      id: frage.id,
      thema: frage.thema,
      frage: frage.frage,
      musterloesung: frage.musterloesung,
      stichpunkte: frage.stichpunkte,
      fragetyp: frage.fragetyp,
      aufgabenHtml: frage.aufgabenHtml,
      loesungsschluessel: frage.loesungsschluessel,
      bilddatei: frage.bilddatei
    };
  });
}

function getFirstActiveQuestion(sheetName, thema) {
  const activeQuestions = getActiveQuestions(sheetName);
  const gefilterteFragen = filterQuestionsByThema_(activeQuestions, thema);

  if (!gefilterteFragen.length) {
    return {
      row: "",
      id: "",
      thema: "",
      frage: "Keine aktive Frage für dieses Thema gefunden.",
      musterloesung: "",
      stichpunkte: ""
    };
  }

  return gefilterteFragen[0];
}

function getNextQuestion(sheetName, thema, currentId) {
  const activeQuestions = getActiveQuestions(sheetName);
  const gefilterteFragen = filterQuestionsByThema_(activeQuestions, thema);

  if (!gefilterteFragen.length) {
    return {
      id: "",
      thema: "",
      frage: "Keine aktive Frage für dieses Thema gefunden.",
      musterloesung: "",
      stichpunkte: "",
      fragePosition: 0,
      frageGesamt: 0,
      themaAbgeschlossen: false
    };
  }

  const aktuelleId = String(currentId || "").trim();
  let nextIndex = 0;

  if (aktuelleId) {
    const currentIndex = gefilterteFragen.findIndex(function(q) {
      return String(q.id || "").trim() === aktuelleId;
    });

    if (currentIndex >= 0) {
      if (currentIndex >= gefilterteFragen.length - 1) {
        return {
          id: "",
          thema: thema,
          frage: "",
          musterloesung: "",
          stichpunkte: "",
          fragePosition: gefilterteFragen.length,
          frageGesamt: gefilterteFragen.length,
          themaAbgeschlossen: true
        };
      }

      nextIndex = currentIndex + 1;
    }
  }

  const frage = gefilterteFragen[nextIndex];

  return {
    id: frage.id,
    thema: frage.thema,
    frage: frage.frage,
    musterloesung: frage.musterloesung,
    stichpunkte: frage.stichpunkte,
    fragetyp: frage.fragetyp,
    aufgabenHtml: frage.aufgabenHtml,
    loesungsschluessel: frage.loesungsschluessel,
    bilddatei: frage.bilddatei,
    fragePosition: nextIndex + 1,
    frageGesamt: gefilterteFragen.length,
    themaAbgeschlossen: false
  };
}

function istKeineVerwertbareAntwort_(text) {
  const t = String(text || "").trim().toLowerCase();

  if (!t) return true;

  const ungueltig = [
    "-", "--", "---",
    ".", "..", "...",
    "ja", "joa", "jup", "ok", "okay", "hmm", "hm",
    "weiß ich nicht", "weiss ich nicht",
    "weiß nicht", "weiss nicht",
    "keine ahnung", "kp", "idk"
  ];

  if (ungueltig.includes(t)) return true;
  if (t.length < 4) return true;

  const wortliste = t
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const unsicherheitsPhrasen = [
    "vielleicht",
    "möglicherweise",
    "moeglicherweise",
    "eventuell",
    "ich glaube",
    "ich denke",
    "bin mir nicht sicher",
    "nicht sicher",
    "weiß es nicht genau",
    "weiss es nicht genau",
    "weiß nicht so genau",
    "weiss nicht so genau"
  ];

  const nurUnsicherheit = unsicherheitsPhrasen.some(p => t === p || t.replace(/\s+/g, " ") === p)
    || /^((ich\s+glaube|ich\s+denke|vielleicht|eventuell|möglicherweise|moeglicherweise|bin\s+mir\s+nicht\s+sicher|nicht\s+sicher|weiß\s+es\s+nicht\s+genau|weiss\s+es\s+nicht\s+genau|weiß\s+nicht\s+so\s+genau|weiss\s+nicht\s+so\s+genau)[\s,.;:-]*)+$/.test(t);

  if (nurUnsicherheit && wortliste.length <= 10) return true;

  const unpassendeWoerter = [
    "brudi", "digga", "joker", "lol", "haha"
  ];

  if (unpassendeWoerter.some(w => t.includes(w))) return true;

  return false;
}

function parseKriterienErgebnis_(text, kriterienIds) {
  const ids = Array.isArray(kriterienIds) ? kriterienIds.map(String) : [];
  const validIdSet = new Set(ids.map(function(id) {
    return normalizeKriterienId_(id);
  }));

  const dedupe = function(values) {
    const result = [];
    const seen = new Set();

    values.forEach(function(value) {
      const candidate = normalizeKriterienId_(value);
      if (!candidate) return;
      if (!validIdSet.has(candidate)) return;
      const original = ids.find(function(id) {
        return normalizeKriterienId_(id) === candidate;
      });
      if (!original || seen.has(original)) return;
      seen.add(original);
      result.push(original);
    });

    return result;
  };

  let parsed = {};
  const rawText = String(text || "").trim();

  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        try {
          parsed = JSON.parse(codeBlockMatch[1]);
        } catch (innerError) {
          parsed = {};
        }
      }
    }
  }

  const erfuellt = Array.isArray(parsed.erfuellt) ? parsed.erfuellt : Array.isArray(parsed.erfüllt) ? parsed.erfüllt : [];
  const nichtErfuellt = Array.isArray(parsed.nicht_erfuellt) ? parsed.nicht_erfuellt : Array.isArray(parsed.nichtErfuellt) ? parsed.nichtErfuellt : [];

  const fulfilledSet = new Set(dedupe(erfuellt));
  const notFulfilledSet = new Set(dedupe(nichtErfuellt));

  const conflicting = new Set(
    [...fulfilledSet].filter(function(item) {
      return notFulfilledSet.has(item);
    })
  );

  conflicting.forEach(function(item) {
    fulfilledSet.delete(item);
    notFulfilledSet.add(item);
  });

  const erkannteIds = ids.filter(function(id) {
    return fulfilledSet.has(id);
  });
  const fehlendeIds = ids.filter(function(id) {
    return !fulfilledSet.has(id);
  });

  return {
    erkannteIds: erkannteIds,
    fehlendeIds: fehlendeIds,
    erkannte: erkannteIds,
    fehlende: fehlendeIds
  };
}

function berechnePunkteAusKriterien_(erfuellt, anzahlKriterien, maxPunkte) {
  const kriteriumAnzahl = Number(anzahlKriterien || 0);
  const maxPunkteNum = Number(maxPunkte || 0);
  const count = Number(erfuellt || 0);

  if (kriteriumAnzahl <= 0 || maxPunkteNum <= 0) {
    return 0;
  }

  const anteil = count / kriteriumAnzahl;
  const berechnet = anteil * maxPunkteNum;
  const gerundet = Math.round(berechnet);

  return Math.max(0, Math.min(maxPunkteNum, gerundet));
}

function parseTrainerKriterienErgebnis_(text, kriterienIds) {
  const ids = Array.isArray(kriterienIds) ? kriterienIds.map(String) : [];
  let parsed = {};
  const rawText = String(text || '').trim();
  if (rawText) {
    try { parsed = JSON.parse(rawText); } catch (error) {
      const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (match && match[1]) { try { parsed = JSON.parse(match[1]); } catch (innerError) { parsed = {}; } }
    }
  }
  const bewertungen = parsed && parsed.bewertungen && typeof parsed.bewertungen === 'object' ? parsed.bewertungen : {};
  const statusById = {};
  ids.forEach(function(id) {
    const status = String(bewertungen[id] || '').trim().toLowerCase();
    statusById[id] = ['voll_erfuellt', 'teilweise_erfuellt', 'nicht_erfuellt'].includes(status) ? status : 'nicht_erfuellt';
  });
  if (Object.keys(bewertungen).length === 0 && Array.isArray(parsed.erfuellt)) {
    parsed.erfuellt.map(String).forEach(function(id) {
      if (Object.prototype.hasOwnProperty.call(statusById, id)) statusById[id] = 'voll_erfuellt';
    });
  }
  return statusById;
}

function berechneTrainerPunkteAusKriterien_(statusById, kriterienIds, maxPunkte) {
  const ids = Array.isArray(kriterienIds) ? kriterienIds.map(String) : [];
  const maxPunkteNum = Number(maxPunkte || 0);
  if (!ids.length || !Number.isFinite(maxPunkteNum) || maxPunkteNum <= 0) return { punkte: 0, erkannte: [], teilweise: [], fehlende: ids };
  let anteil = 0;
  const erkannte = [], teilweise = [], fehlende = [];
  ids.forEach(function(id) {
    const status = statusById && statusById[id];
    if (status === 'voll_erfuellt') { anteil += 1; erkannte.push(id); }
    else if (status === 'teilweise_erfuellt') { anteil += 0.5; teilweise.push(id); }
    else fehlende.push(id);
  });
  const punkte = Math.max(0, Math.min(maxPunkteNum, Math.round((anteil / ids.length) * maxPunkteNum)));
  return { punkte: punkte, erkannte: erkannte, teilweise: teilweise, fehlende: fehlende };
}

function bewerteAntwortFrontend(payload) {
  const sheetName = String(payload?.fach || "").trim();
  const questionId = String(payload?.frageId || "").trim();
  const userAnswer = String(payload?.antwort || "").trim();
  const skizze = String(payload?.skizze || "").trim();
const speichereInSheet = payload?.speichereInSheet !== false;

  if (!sheetName) {
    throw new Error("Kein Fach übergeben.");
  }

  if (!questionId) {
    throw new Error("Keine Frage-ID übergeben.");
  }

  const frageDaten = getQuestionById(sheetName, questionId);

  if (!frageDaten.id) {
    return {
      id: "",
      punkte: 0,
      maxPunkte: 0,
      ergebnis: "Frage nicht gefunden.",
      musterloesung: "",
      erkannte: [],
      fehlende: []
    };
  }

  const frage = String(frageDaten.frage || "").trim();
  const muster = String(frageDaten.musterloesung || "").trim();
  const stichpunkteRaw = String(frageDaten.stichpunkte || "").trim();
  const fragetyp = String(frageDaten.fragetyp || "text").trim().toLowerCase();
  const istDiagramm = fragetyp === "diagramm";
  const hatSkizze = istDiagramm && skizze.startsWith("data:image");

  const stichpunkteListe = getStichpunkteListe_(stichpunkteRaw);
  const maxPunkte = getMaxPunkteFromStichpunkte_(stichpunkteRaw);

  if ((!userAnswer && !hatSkizze) || (istDiagramm && (!userAnswer || !hatSkizze))) {
    return {
      id: frageDaten.id,
      punkte: 0,
      maxPunkte: maxPunkte,
      ergebnis: istDiagramm ? "Skizze und schriftliche Beschreibung/Begründung erforderlich." : "Keine Antwort eingegeben.",
      musterloesung: muster,
      erkannte: [],
      fehlende: stichpunkteListe
    };
  }

  if (!hatSkizze && istKeineVerwertbareAntwort_(userAnswer)) {
    const feedbackText =
      "Ergebnis: unzureichend\n\n" +
      "Erkannte Stichpunkte:\n- keine\n\n" +
      "Fehlende Stichpunkte:\n" +
      (stichpunkteListe.length ? "- " + stichpunkteListe.join("\n- ") : "- keine");

    if (speichereInSheet) {
  speichereFrontendErgebnis_(
    sheetName,
    frageDaten.row,
    userAnswer,
    feedbackText,
    `0/${maxPunkte}`,
    muster
  );
}

    return {
      id: frageDaten.id,
      punkte: 0,
      maxPunkte: maxPunkte,
      ergebnis: feedbackText,
      musterloesung: muster,
      erkannte: [],
      fehlende: stichpunkteListe
    };
  }

  if (!muster && stichpunkteListe.length === 0) {
    return {
      id: frageDaten.id,
      punkte: 0,
      maxPunkte: maxPunkte,
      ergebnis: "Für diese Frage fehlen Musterlösung und Stichpunkte.",
      musterloesung: "",
      erkannte: [],
      fehlende: []
    };
  }

  const antwortIstExakteMusterloesung =
    istExakteMusterantwort_(userAnswer, muster, istDiagramm);

  if (antwortIstExakteMusterloesung) {
    const feedbackText =
      "Ergebnis: vollständig richtig\n\n" +
      "Erkannte Stichpunkte:\n" +
      (stichpunkteListe.length
        ? "- " + stichpunkteListe.join("\n- ")
        : "- keine") +
      "\n\nFehlende Stichpunkte:\n- keine";

    if (speichereInSheet) {
      speichereFrontendErgebnis_(
        sheetName,
        frageDaten.row,
        userAnswer,
        feedbackText,
        `${maxPunkte}/${maxPunkte}`,
        muster
      );
    }

    return {
      id: frageDaten.id,
      punkte: maxPunkte,
      maxPunkte: maxPunkte,
      ergebnis: feedbackText,
      musterloesung: muster,
      erkannte: stichpunkteListe,
      fehlende: []
    };
  }
  const kriterienIds = getKriterienIdsFuerStichpunkte_(stichpunkteListe);
  const prompt = `
Du bist ein strenger, fachlich genauer Korrektor für ein Lerntool.

Deine Aufgabe:
Prüfe zuerst, ob die Teilnehmerantwort die konkrete Frage beantwortet. Bewerte danach
JEDES Bewertungskriterium einzeln und unabhängig anhand des fachlichen Inhalts der gesamten Teilnehmerantwort.

Die Stichpunkte sind Bewertungskriterien und keine Pflichtwörter. Ein Kriterium ist
erfüllt, wenn die Antwort seine fachliche Kernaussage eindeutig wiedergibt. Anerkenne
grammatische Varianten, geläufige Synonyme, Alltagssprache und klare Umschreibungen.
Bei einer Erklärungs- oder Beschreibungsfrage genügt eine fachlich richtige Beschreibung auch
dann, wenn der Fachbegriff nicht verwendet wird. Eine Frage, die ausdrücklich nach
einem Namen, einer Bezeichnung oder einem Fachbegriff fragt (zum Beispiel mit
"Nennen Sie", "Wie heißt" oder "Welcher Fachbegriff"), verlangt dagegen die
entsprechende Bezeichnung.

Frage:
${frage}

Musterlösung:
${muster}

Bewertungskriterien:
${stichpunkteListe.map(function(stichpunkt, index) {
  return (index + 1) + ". " + kriterienIds[index] + ": " + stichpunkt;
}).join("\n")}

Teilnehmerantwort:
${userAnswer}

Bewertungsregeln:
- Bewerte ausschließlich die Teilnehmerantwort.
- Musterlösung und Kriterien zählen NICHT als vom Teilnehmer genannt.
- Die Musterlösung und Beispiele dienen als fachliche Referenz. Die Musterlösung nicht als Checkliste und nicht als Wortlautvorlage verwenden. Bei offenen Aufgaben können auch andere fachlich korrekte Lösungen die Kriterien erfüllen. Verlange nicht, dass die Nutzerantwort ein Beispiel aus der Musterlösung wörtlich oder inhaltlich identisch übernimmt, sofern das Bewertungskriterium allgemein formuliert ist.
- Die konkrete Frage kann mehrere fachlich richtige Wege zulassen. Berücksichtige alternative fachlich richtige Wege auch dann, wenn sie nicht ausdrücklich in der Musterlösung oder im einzelnen Stichpunkt genannt sind; prüfe sie anhand der Frage und des fachlichen Zusammenhangs.
- Prüfe jedes Kriterium (K1...Kn) einzeln und unabhängig in der gesamten Teilnehmerantwort: Suche in der gesamten Antwort nach einer fachlich gleichwertigen Aussage und entscheide für jedes Kriterium eigenständig.
- Inhalt vor Wortlaut: Ein Kriterium gilt als erfüllt, wenn der fachliche Inhalt eindeutig vorhanden ist – auch bei anderen Wörtern, Synonymen, veränderter Satzstellung, abweichendem Singular/Plural, Umschreibungen oder Alltagssprache statt Fachbuchbegriffen (z. B. gelten Aussagen wie "wertvoll für Kunden und Verbraucher", "Mehrwert für Kunden", "Kunden profitieren davon", "Vorteile für Kunden schaffen" oder "den Kunden etwas Wertvolles bieten" als Erfüllung des Kriteriums "Nutzen für Kunden").
- Nicht überstreng auf bestimmte Einzelwörter bestehen: Wenn der fachliche Sinn eindeutig getroffen ist, darf ein Kriterium nicht abgelehnt werden, nur weil ein bestimmtes Wort (z. B. "Nutzen") nicht wörtlich vorkommt.
- Kriterien nicht miteinander vermischen: Jedes Kriterium wird separat bewertet. Wenn eine Antwort den Inhalt eines Kriteriums (z. B. K3) erfüllt, darf dieser Inhalt nicht ignoriert werden, nur weil ein anderes Kriterium (z. B. K2) im selben Satz oder Kontext unvollständig ist.
- Fachlich präzise bleiben (kein reines Keyword-Matching): Ein Kriterium ist nur erfüllt, wenn die Aussage tatsächlich fachlich dazu passt. Bloße Schlagwörter ohne den geforderten Sinnzusammenhang (z. B. nur das Wort "Kunden" ohne Nutzenbezug wie "Kunden zahlen den Preis") erfüllen das Kriterium nicht.
- Prüfe Negationen und Gegenteile ausdrücklich: "Kein/nicht" oder fachlich gegenteilige Aussagen (z. B. "Kosten steigen" statt "Kosten sinken") dürfen kein positives Kriterium erfüllen.
- Widersprüche und fachliche Ungenauigkeiten differenziert bewerten: Wenn der fachliche Kern eines Kriteriums richtig erkannt ist, aber ein Teil fehlt, unpräzise formuliert oder fachlich unsauber eingeschränkt wird, gib "teilweise_erfuellt" zurück. Ein richtiger fachlicher Kern bleibt teilweise_erfuellt, auch wenn eine begrenzte zusätzliche Ungenauigkeit enthalten ist. Gib nur dann "nicht_erfuellt" zurück, wenn der relevante Inhalt vollständig fehlt, die Antwort themenfremd ist oder der Kern des Kriteriums durch eine Negation bzw. einen unauflösbaren Widerspruch entwertet wird. Ein Fehler in einem Kriterium darf andere korrekt bewertete Kriterien nicht entwerten.
- Keine zusätzlichen Anforderungen erfinden: Bewerte nur die tatsächlich vorgegebenen Kriterien. Verlange keine zusätzlichen Voraussetzungen oder Lehrbuchdetails, die nicht Teil des Kriteriums sind, und ziehe keine Punkte für fehlende Zusatzdetails ab, die nicht im Kriterium stehen.
- Die Antwort muss zur konkreten Frage passen, nicht nur grob zum gleichen Thema. Wenn die Antwort eine andere Aufgabenstellung beantwortet, ist sie falsch.
- Verwende ausschließlich die vorgegebenen Kriterien-IDs. Erfinde keine neuen IDs.
- Verwende pro Kriterium genau einen Status: "voll_erfuellt", "teilweise_erfuellt" oder "nicht_erfuellt". Ein echter Fehler, Widerspruch oder eine Negation entwertet das Kriterium nur dann vollständig, wenn dadurch sein fachlicher Kern aufgehoben wird; bleibt der Kern erkennbar richtig, ist das Kriterium "teilweise_erfuellt". Bereits korrekt erfüllte andere Kriterien bleiben davon unberührt.
- "teilweise_erfuellt" darf nur vergeben werden, wenn ein wesentlicher Teil des Kriteriums fachlich richtig erfasst ist; bloße Schlagwörter ohne Zusammenhang sind "nicht_erfuellt".
- Unsicherheitsformulierungen wie "ich glaube", "wahrscheinlich", "vielleicht" sind nur dann relevant, wenn sie den fachlichen Inhalt selbst entwerten. Sonst zählt der fachliche Inhalt normal.

${istDiagramm ? diagrammBewertungsregel_() : ""}

Gib das Ergebnis exakt als JSON zurück, ohne Markdown-Codeblock:
{
  "bewertungen": {
    "K1": "voll_erfuellt",
    "K2": "teilweise_erfuellt",
    "K3": "nicht_erfuellt"
  }
}
`;

  const messages = [];
  if (istDiagramm && hatSkizze) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: skizze } }
      ]
    });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
    method: "post",
    headers: {
      "Authorization": "Bearer " + OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0
    }),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const bodyText = response.getContentText();

  if (statusCode !== 200) {
    throw new Error("API-Fehler: " + statusCode + " - " + bodyText);
  }

  const result = JSON.parse(bodyText);
  const text = result?.choices?.[0]?.message?.content || "";

  const statusById = parseTrainerKriterienErgebnis_(text, kriterienIds);
  if (!/"bewertungen"\s*:/.test(String(text || ''))) {
    const legacy = werteKriterienMitFallback_(text, userAnswer, stichpunkteListe, kriterienIds, istDiagramm);
    legacy.erkannteIds.forEach(function(id) { statusById[id] = 'voll_erfuellt'; });
  }
  const trainerPunkte = berechneTrainerPunkteAusKriterien_(statusById, kriterienIds, maxPunkte);
  const erkannteIds = trainerPunkte.erkannte;
  const teilweiseIds = trainerPunkte.teilweise;
  const fehlendeIds = trainerPunkte.fehlende;

  const erkannte = erkannteIds
    .map(function(id) {
      const index = kriterienIds.indexOf(id);
      return index >= 0 ? stichpunkteListe[index] : id;
    })
    .filter(Boolean);

  const fehlende = fehlendeIds
    .map(function(id) {
      const index = kriterienIds.indexOf(id);
      return index >= 0 ? stichpunkteListe[index] : id;
    })
    .filter(Boolean);

  const uniqueErkannte = [...new Set(erkannte)];
  const uniqueFehlende = [...new Set(fehlende.filter(function(item) {
    return !uniqueErkannte.includes(item);
  }))];

  const teilweise = teilweiseIds.map(function(id) {
    const index = kriterienIds.indexOf(id);
    return index >= 0 ? stichpunkteListe[index] : id;
  }).filter(Boolean);

  const erreichtePunkte = trainerPunkte.punkte;
  const gesamtPunkte = maxPunkte;

  let ergebnisText = "";
  const quote = gesamtPunkte > 0 ? erreichtePunkte / gesamtPunkte : 0;

  if (erreichtePunkte === gesamtPunkte && gesamtPunkte > 0) {
    ergebnisText = "vollständig richtig";
  } else if (quote >= 0.7) {
    ergebnisText = "größtenteils richtig";
  } else if (quote >= 0.3) {
    ergebnisText = "teilweise richtig";
  } else {
    ergebnisText = "unzureichend";
  }

  let feedbackText = `Ergebnis: ${ergebnisText}\n\n`;

  if (uniqueErkannte.length) {
    feedbackText += "Erkannte Stichpunkte:\n- " + uniqueErkannte.join("\n- ") + "\n\n";
  } else {
    feedbackText += "Erkannte Stichpunkte:\n- keine\n\n";
  }

  if (teilweise.length) {
    feedbackText += "Teilweise erkannte Stichpunkte:\n- " + teilweise.join("\n- ") + "\n\n";
  }

  if (uniqueFehlende.length) {
    feedbackText += "Fehlende Stichpunkte:\n- " + uniqueFehlende.join("\n- ");
  } else {
    feedbackText += "Fehlende Stichpunkte:\n- keine";
  }

  if (speichereInSheet) {
  speichereFrontendErgebnis_(
    sheetName,
    frageDaten.row,
    userAnswer,
    feedbackText,
    `${erreichtePunkte}/${gesamtPunkte}`,
    muster
  );
}

  return {
    id: frageDaten.id,
    punkte: erreichtePunkte,
    maxPunkte: gesamtPunkte,
    ergebnis: feedbackText,
    musterloesung: muster,
    erkannte: uniqueErkannte,
    fehlende: uniqueFehlende
  };
}

function speichereFrontendErgebnis_(sheetName, row, antwort, ergebnisText, punkteText, muster) {
  if (!row) return;

  const ss = getSpreadsheet_();
  const sheet = getSheetByNameSafe_(sheetName);

  // --- Bisheriges Verhalten (Fragen-Sheet aktualisieren) ---
  sheet.getRange(row, COL.ANTWORT).setValue(antwort);
  sheet.getRange(row, COL.ERGEBNIS).setValue(ergebnisText).setBackground("#eadcf8");
  sheet.getRange(row, COL.PUNKTE).setValue(punkteText);

  const punkteZelle = sheet.getRange(row, COL.PUNKTE);
  const teile = String(punkteText).split("/");
  const erreicht = Number(teile[0] || 0);
  const gesamt = Number(teile[1] || 0);
  const quote = gesamt > 0 ? erreicht / gesamt : 0;

  if (quote === 1) {
    punkteZelle.setBackground("#b6d7a8");
  } else if (quote > 0.7) {
    punkteZelle.setBackground("#c9e7b7");
  } else if (quote >= 0.3) {
    punkteZelle.setBackground("#ffe599");
  } else {
    punkteZelle.setBackground("#f4cccc");
  }

  if (muster) {
    sheet.getRange(row, COL.LOESUNG).setValue(muster);
  }

  // --- NEU: Verlauf im Sheet "Lernstand" speichern ---
  let verlaufSheet = ss.getSheetByName("Lernstand");

  if (!verlaufSheet) {
    verlaufSheet = ss.insertSheet("Lernstand");
    verlaufSheet.appendRow([
      "Nutzer Code",
      "Datum",
      "Teilbereich",
      "Fach",
      "Thema",
      "Frage ID",
      "Punkte",
      "Max. punkte",
      "Prozent",
      "Bewertung",
      "Antwort"
    ]);
  }

  const frageId = sheet.getRange(row, COL.ID).getValue();
  const thema = sheet.getRange(row, COL.THEMA).getValue();

  // Falls du später Nutzer/Teilbereich dynamisch machst, hier anpassen
  const nutzer = "Sabine 0412"; 
  const teilbereich = "HQ"; 

  const prozent = gesamt > 0 ? Math.round((erreicht / gesamt) * 100) : 0;

  verlaufSheet.appendRow([
    nutzer,
    new Date(),
    teilbereich,
    sheetName,
    thema,
    frageId,
    erreicht,
    gesamt,
    prozent,
    ergebnisText,
    antwort
  ]);
}
function extractBulletList_(text, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    escapedHeading + "\\s*([\\s\\S]*?)(?=\\n\\s*[A-ZÄÖÜa-zäöü][^\\n]*:|$)",
    "i"
  );

  const match = text.match(regex);
  if (!match || !match[1]) return [];

  return match[1]
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("-"))
    .map(line => line.replace(/^-+\s*/, "").trim())
    .filter(Boolean);
}

function normalizeTextForCompare_(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9äöüß ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMatches_(returnedItems, originalItems) {
  const normalizedOriginals = originalItems.map(item => ({
    original: item,
    normalized: normalizeTextForCompare_(item)
  }));

  const results = [];

  for (const returned of returnedItems) {
    const normReturned = normalizeTextForCompare_(returned);

    const exact = normalizedOriginals.find(o => o.normalized === normReturned);
    if (exact) {
      results.push(exact.original);
      continue;
    }

    const contains = normalizedOriginals.find(o =>
      o.normalized.includes(normReturned) || normReturned.includes(o.normalized)
    );
    if (contains) {
      results.push(contains.original);
    }
  }

  return results;
}

function bewerteAntwort() {
  try {
    const sheet = getSheet_();
    const activeCell = sheet.getActiveCell();
    const row = activeCell.getRow();
    const col = activeCell.getColumn();

    if (row < 3) {
      SpreadsheetApp.getUi().alert("Bitte eine echte Fragenzeile auswählen.");
      return;
    }

    if (col !== COL.ANTWORT) {
      SpreadsheetApp.getUi().alert("Bitte direkt in die Antwortzelle (Spalte D) klicken und dann auswerten.");
      return;
    }

    const frage = String(sheet.getRange(row, COL.FRAGE).getValue()).trim();
    const antwort = String(sheet.getRange(row, COL.ANTWORT).getValue()).trim();
    const muster = String(sheet.getRange(row, COL.MUSTER).getValue()).trim();
    const stichpunkteRaw = String(sheet.getRange(row, COL.STICHPUNKTE).getValue()).trim();

    const stichpunkteListe = getStichpunkteListe_(stichpunkteRaw);
    const maxPunkte = getMaxPunkteFromStichpunkte_(stichpunkteRaw);

    if (!frage) {
      SpreadsheetApp.getUi().alert("In dieser Zeile ist keine Frage hinterlegt.");
      return;
    }

    if (!antwort) {
      SpreadsheetApp.getUi().alert("Bitte zuerst eine Antwort eingeben.");
      return;
    }

    if (!muster && stichpunkteListe.length === 0) {
      SpreadsheetApp.getUi().alert("Für diese Frage fehlen Musterlösung und/oder Stichpunkte.");
      return;
    }

    sheet.getRange(row, COL.ERGEBNIS).clearContent().setBackground("#ffffff");
    sheet.getRange(row, COL.PUNKTE).clearContent().setBackground("#ffffff");
    sheet.getRange(row, COL.LOESUNG).clearContent().setBackground("#ffffff");

    const prompt = `
Bewerte die folgende Antwort streng, aber fair wie ein IHK-Prüfer.

Frage: ${frage}
Musterlösung: ${muster}

Stichpunkte:
${stichpunkteListe.map(p => "- " + p).join("\n")}

Maximale Punkte: ${maxPunkte}

Antwort:
${antwort}

WICHTIG:
- Prüfe ausschließlich den fachlichen Inhalt, nicht die sprachliche Qualität.
- Auch kurze Antworten dürfen volle Punkte bekommen, wenn der Kern korrekt ist.
- Stichpunkte müssen sinngemäß erkannt werden.
- Ziehe nur Punkte ab, wenn Inhalte fehlen oder falsch sind.

WICHTIGES FORMAT (KEIN MARKDOWN):
Punkte: X/Y
Ergebnis: vollständig richtig / größtenteils richtig / teilweise richtig / unzureichend
Feedback:
- ...
- ...
`;

    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      }),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const bodyText = response.getContentText();

    if (statusCode !== 200) {
      SpreadsheetApp.getUi().alert("API-Fehler: " + statusCode + "\n" + bodyText);
      return;
    }

    const result = JSON.parse(bodyText);
    const text = result?.choices?.[0]?.message?.content || "";

    const cleanText = text
      .replace(/Punkte[^0-9]*(\d+\s*\/\s*\d+)/i, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    sheet.getRange(row, COL.ERGEBNIS)
      .setValue(cleanText)
      .setBackground("#eadcf8");

    const punkteMatch = text.match(/(\d+\s*\/\s*\d+)/);
    const punkteZelle = sheet.getRange(row, COL.PUNKTE);

    if (punkteMatch) {
      const normalized = punkteMatch[1].replace(/\s+/g, "");
      punkteZelle.setValue(normalized);
    } else {
      punkteZelle.setValue("nicht erkannt");
    }

    const lower = cleanText.toLowerCase();

    if (lower.includes("vollständig richtig")) {
      punkteZelle.setBackground("#b6d7a8");
    } else if (lower.includes("größtenteils richtig")) {
      punkteZelle.setBackground("#c9e7b7");
    } else if (lower.includes("teilweise richtig")) {
      punkteZelle.setBackground("#ffe599");
    } else if (lower.includes("unzureichend")) {
      punkteZelle.setBackground("#f4cccc");
    } else {
      punkteZelle.setBackground("#ffffff");
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert("Script-Fehler:\n" + error);
  }
}

function zeigeLoesung() {
  try {
    const sheet = getSheet_();
    const row = sheet.getActiveRange().getRow();

    if (row < 3) {
      SpreadsheetApp.getUi().alert("Bitte eine echte Fragenzeile auswählen.");
      return;
    }

    const muster = String(sheet.getRange(row, COL.MUSTER).getValue()).trim();

    if (!muster) {
      SpreadsheetApp.getUi().alert("Keine Musterlösung vorhanden.");
      return;
    }

    sheet.getRange(row, COL.LOESUNG)
      .clearContent()
      .setBackground("#ffffff");

    sheet.getRange(row, COL.LOESUNG)
      .setValue(muster)
      .setBackground("#d9ead3");

  } catch (error) {
    SpreadsheetApp.getUi().alert("Script-Fehler:\n" + error);
  }
}

function speichereLernstand(eintrag) {
  const sheet = getSheetByNameSafe_("Lernstand");

  const maxPunkte = Number(eintrag.maxPunkte || 0);
  const punkte = Number(eintrag.punkte || 0);
  const prozent = maxPunkte > 0 ? Math.round((punkte / maxPunkte) * 100) : 0;

  sheet.appendRow([
    String(eintrag.nutzer || "Gast").trim(),
    new Date(),
    String(eintrag.teilbereich || "").trim(),
    String(eintrag.fach || "").trim(),
    String(eintrag.thema || "").trim(),
    String(eintrag.frageId || "").trim(),
    punkte,
    maxPunkte,
    prozent,
    String(eintrag.bewertung || "").trim(),
    String(eintrag.antwort || "").trim()
  ].map(sheetLiteral_));
}

function speichereLernstandFrontend(
  nutzer,
  teilbereich,
  fach,
  thema,
  frageId,
  punkte,
  maxPunkte,
  bewertung,
  antwort
) {
  speichereLernstand({
    nutzer: nutzer,
    teilbereich: teilbereich,
    fach: fach,
    thema: thema,
    frageId: frageId,
    punkte: punkte,
    maxPunkte: maxPunkte,
    bewertung: bewertung,
    antwort: antwort
  });
}

function getGlossarFrontend() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName("Glossar");

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values.slice(1)
    .filter(function(row) {
       return String(row[0] || "").trim();
    })
    .map(function(row) {
      return {
        begriff: row[0],
        erklaerung: row[1],
        fach: row[2],
        thema: row[3],
        synonyme: row[4]
      };
    })
    .sort(function(a, b) {
      return String(a.begriff).localeCompare(String(b.begriff), "de");
    });
}

function getQuizSheet_() {
  const sheet = getSpreadsheet_().getSheetByName("Quizfragen");

  if (!sheet) {
    throw new Error('Sheet "Quizfragen" nicht gefunden.');
  }

  return sheet;
}

function getQuizKey_(fach, frageId) {
  const fachName = String(fach || "").trim();
  const id = String(frageId || "").trim();

  if (!fachName || !id) {
    throw new Error("Fach und Frage-ID werden für den Quiz-Key benötigt.");
  }

  return fachName + "::" + id;
}

function getKarteikartenFrontend(fach, thema) {
    const sheetName = String(fach || "").trim();
  const themaFilter = String(thema || "").trim();

  if (!sheetName) {
    return [];
  }

  const fragen = getActiveQuestions(sheetName);

  const gefiltert = fragen.filter(function(frage) {
    if (!themaFilter) return true;
    return String(frage.thema || "").trim() === themaFilter;
  });

  return gefiltert
    .filter(function(frage) {
      return String(frage.frage || "").trim() &&
             String(frage.musterloesung || "").trim();
    })
    .map(function(frage) {
      return {
        id: frage.id,
        fach: sheetName,
        thema: frage.thema,
        vorderseite: frage.frage,
        rueckseite: frage.musterloesung
      };
    });
}

function getLerntexte(fach) {
  const fachFilter = String(fach || "").trim();

  if (!fachFilter) {
    return [];
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Lerntexte");

  if (!sheet) {
    throw new Error('Sheet "Lerntexte" wurde nicht gefunden.');
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 3) {
    return [];
  }

  // Überschriften stehen in Zeile 2
  const headers = sheet
    .getRange(2, 1, 1, lastColumn)
    .getValues()[0]
    .map(function(header) {
      return String(header || "").trim();
    });

  const rows = sheet
    .getRange(3, 1, lastRow - 2, lastColumn)
    .getValues();

  const index = {};
  headers.forEach(function(header, i) {
    index[header] = i;
  });

  const requiredHeaders = [
    "ID",
    "Fach",
    "Hauptkapitel_Nr",
    "Hauptkapitel",
    "Unterkapitel_Nr",
    "Titel",
    "Lerntext",
    "Podcast_Text",
    "Kurzfassung",
    "Prüfungsfokus",
    "Reihenfolge_Fach",
    "Reihenfolge_Kapitel",
    "Aktiv"
  ];

  requiredHeaders.forEach(function(header) {
    if (index[header] === undefined) {
      throw new Error(
        'Spalte "' + header + '" im Sheet "Lerntexte" nicht gefunden.'
      );
    }
  });

  return rows
    .filter(function(row) {
      const rowFach = String(row[index["Fach"]] || "").trim();
      const aktiv = String(row[index["Aktiv"]] || "")
        .trim()
        .toLowerCase();

      return rowFach === fachFilter && aktiv === "ja";
    })
    .map(function(row) {
      return {
        id: String(row[index["ID"]] || "").trim(),
        fach: String(row[index["Fach"]] || "").trim(),
        hauptkapitelNr: String(row[index["Hauptkapitel_Nr"]] || "").trim(),
        hauptkapitel: String(row[index["Hauptkapitel"]] || "").trim(),
        unterkapitelNr: String(row[index["Unterkapitel_Nr"]] || "").trim(),
        titel: String(row[index["Titel"]] || "").trim(),
        lerntext: String(row[index["Lerntext"]] || "").trim(),
        podcastText: String(row[index["Podcast_Text"]] || "").trim(),
        kurzfassung: String(row[index["Kurzfassung"]] || "").trim(),
        pruefungsfokus: String(row[index["Prüfungsfokus"]] || "").trim(),
        reihenfolgeFach: Number(row[index["Reihenfolge_Fach"]]) || 0,
        reihenfolgeKapitel: Number(row[index["Reihenfolge_Kapitel"]]) || 0
      };
    })
    .sort(function(a, b) {
      return a.reihenfolgeFach - b.reihenfolgeFach;
    });
}
function frageKilianFrontend(frage, trainerKontext) {
  const userFrage = String(frage || "").trim();

  if (!userFrage) {
    return {
      antwort: "Keine Frage übergeben."
    };
  }

  const trainerContextText = trainerKontext && String(trainerKontext.frage || '').trim()
    ? "\n\nKontext der aktuell sichtbaren Traineraufgabe (verbindlich berücksichtigen):\n" +
      "Teilbereich: " + String(trainerKontext.bereich || '') + "\n" +
      "Fach: " + String(trainerKontext.fach || '') + "\n" +
      "Thema/Kategorie: " + String(trainerKontext.thema || '') + "\n" +
      "Frage-ID: " + String(trainerKontext.frageId || '') + "\n" +
      "Exakter Fragetext: " + String(trainerKontext.frage || '') + "\n" +
      "Aktuelle Nutzerantwort: " + String(trainerKontext.antwort || '') + "\n" +
      "Musterlösung: " + String(trainerKontext.musterloesung || '') + "\n" +
      "Punkte: " + (trainerKontext.punkte == null ? '' : String(trainerKontext.punkte)) +
      " / " + (trainerKontext.maxPunkte == null ? '' : String(trainerKontext.maxPunkte)) + "\n" +
      "Ergebnis/Bewertungsstatus: " + String(trainerKontext.ergebnis || '') + "\n" +
      "Bewertungskriterien: " + String(trainerKontext.bewertungskriterien || '')
    : '';

  const systemPrompt =
  "Du bist Kilian, ein verständlicher Lernassistent für Lern- und Bildungsinhalte. " +
  "Du erklärst Themen klar, strukturiert und praxisnah auf Deutsch. " +

  "Dein Schwerpunkt liegt auf kaufmännischen, wirtschaftlichen, mathematischen, organisatorischen, technischen, unternehmerischen, rechtlichen, steuerlichen und allgemeinen Bildungsthemen. " +

  "Du hilfst beim Lernen, Verstehen, Zusammenfassen, Erklären und Wiederholen von Wissen. " +

  "Du beantwortest KEINE Fragen zu Pornografie, sexuellen Inhalten, Fetischen, Gewaltfantasien, illegalen Aktivitäten, Drogenmissbrauch, Hassinhalten, rassistischen oder antisemitischen Inhalten oder anderen unangemessenen Themen. " +

  "Wenn solche Fragen gestellt werden, lehne höflich ab und lenke zurück auf sinnvolle Lern- oder Wissensfragen. " +

  "Antworte niemals flirtend, anzüglich oder provozierend. " +

  "Antworte sachlich, freundlich und verständlich. " +

  "Nutze bei Erklärungen gerne Beispiele und einfache Sprache." + trainerContextText;

  const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
    method: "post",
    headers: {
      "Authorization": "Bearer " + OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userFrage
        }
      ],
      temperature: 0.4
    }),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const bodyText = response.getContentText();

  if (statusCode !== 200) {
    throw new Error("OpenAI-Fehler: " + statusCode + " - " + bodyText);
  }

  const result = JSON.parse(bodyText);

  return {
antwort: result?.choices?.[0]?.message?.content || "Keine Antwort erhalten."  
};

}

function getFormelsammlungFrontend() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName("Formelsammlung");

  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(function(h) {
    return String(h || "").trim().toLowerCase();
  });

function norm(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\//g, "")
    .replace(/:/g, "");
}

function col() {
  const headerNorm = headers.map(norm);

  for (let i = 0; i < arguments.length; i++) {
    const gesucht = norm(arguments[i]);
    const index = headerNorm.indexOf(gesucht);
    if (index !== -1) return index;
  }

  return -1;
}

  const cFach = col("fach");
  const cKapitel = col("kapitel", "thema");
  const cFormelname = col("formelname", "formel name", "bezeichnung");
  const cIhkSeite = col("ihk seite", "ihk 2025", "ihk", "ihk-seite");
  const cIhkFormel = col("ihk formel", "ihk-formel", "formel");
  const cKurzformel = col(
    "kurzformel",
    "kurz formel",
    "kurz-formel",
    "kompakt",
    "kompaktformel",
    "kompakteformel",
    "formelkurz",
    "formel kurz",
    "formel kurzformel"
  );
 const cAbkuerzungen = col(
  "abkürzungen",
  "abkuerzungen",
  "kürzel",
  "kuerzel",
  "variable",
  "variablen",
  "variable/kürzel",
  "variable / kürzel",
  "variablen/kürzel",
  "variablen / kürzel",
  "variable/kuerzel",
  "variable / kuerzel",
  "variablen/kuerzel",
  "variablen / kuerzel",
  "variablen und kürzel",
  "variablen und kuerzel"
);
  const cErklaerung = col("kurzerklärung", "kurz-erklärung", "kurz erklärung", "erklärung", "erklaerung");
  const cBeispiel = col("beispiel");
  const cSchwierigkeit = col("schwierigkeit");

  return values.slice(1)
    .filter(function(row) {
      const formelname = cFormelname >= 0 ? String(row[cFormelname] || "").trim() : "";
      const ihkFormel = cIhkFormel >= 0 ? String(row[cIhkFormel] || "").trim() : "";
      const beispiel = cBeispiel >= 0 ? String(row[cBeispiel] || "").trim() : "";

      return formelname || ihkFormel || beispiel;
    })
    .map(function(row) {
      const gespeicherteKurzformel = cKurzformel >= 0 ? String(row[cKurzformel] || "").trim() : "";
      const fach = cFach >= 0 ? String(row[cFach] || "").trim() : "";
      const formelname = cFormelname >= 0 ? String(row[cFormelname] || "").trim() : "";
      const ihkFormel = cIhkFormel >= 0 ? String(row[cIhkFormel] || "").trim() : "";
      const variablen = cAbkuerzungen >= 0 ? String(row[cAbkuerzungen] || "").trim() : "";
      const ergaenzung = getErgaenzteKurzformel_(fach, formelname);
      const kurzformel = istMathematischeKurzformel(gespeicherteKurzformel)
        ? gespeicherteKurzformel
        : ergaenzung
          ? ergaenzung.formel
          : ableiteteKurzformelOhneExterneAbkuerzung(ihkFormel, variablen);
      const variablenMitErgaenzung = ergaenzung && ergaenzung.variablen
        ? ergaenzeVariablen_(variablen, ergaenzung.variablen)
        : variablen;

      return {
        fach: fach,
        kapitel: cKapitel >= 0 ? String(row[cKapitel] || "").trim() : "",
        unterkapitel: "",
        formelname: formelname,
        ihkSeite: cIhkSeite >= 0 ? String(row[cIhkSeite] || "").trim() : "",
        ihkFormel: ihkFormel,
        kurzformel: kurzformel,
        kurzformelStatus: kurzformel ? "sicher" : "manuell_pruefen",
        variablen: variablenMitErgaenzung,
        erklaerung: cErklaerung >= 0 ? String(row[cErklaerung] || "").trim() : "",
        beispiel: cBeispiel >= 0 ? String(row[cBeispiel] || "").trim() : "",
        schwierigkeit: cSchwierigkeit >= 0 ? String(row[cSchwierigkeit] || "").trim() : ""
      };
    })
    .sort(function(a, b) {
      return String(a.formelname).localeCompare(String(b.formelname), "de");
    });
}

const FORMEL_KURZFORMEL_ERGAENZUNGEN_ = {
  "Rechnungswesen|Abschreibungsquote": {
    formel: "A / AV * 100",
    variablen: "A = Abschreibungen; AV = Anlagevermögen"
  },
  "Rechnungswesen|Anlagenabnutzungsgrad": {
    formel: "kA / AV * 100",
    variablen: "kA = kumulierte Abschreibungen; AV = Anlagevermögen"
  },
  "Rechnungswesen|Anlagendeckung II": {
    formel: "LK / AV * 100",
    variablen: "LK = langfristiges Kapital; AV = Anlagevermögen"
  },
  "Rechnungswesen|Anlagenintensität": {
    formel: "AV / GV * 100",
    variablen: "AV = Anlagevermögen; GV = Gesamtvermögen"
  },
  "Rechnungswesen|Betriebsergebnis": {
    formel: "BE = UE - SK",
    variablen: "BE = Betriebsergebnis; UE = Umsatzerlöse; SK = Selbstkosten des Umsatzes"
  },
  "Rechnungswesen|Break-even-Menge": {
    formel: "x_BEP = Kf / (p - kv)",
    variablen: "x_BEP = Break-even-Menge; Kf = fixe Kosten; p = Preis je Stück; kv = variable Stückkosten"
  },
  "Rechnungswesen|Liquidität 1. Grades": {
    formel: "LM / KFV * 100",
    variablen: "LM = liquide Mittel; KFV = kurzfristige Verbindlichkeiten"
  },
  "Rechnungswesen|Liquidität 2. Grades": {
    formel: "(LM + KFO) / KFV * 100",
    variablen: "LM = liquide Mittel; KFO = kurzfristige Forderungen; KFV = kurzfristige Verbindlichkeiten"
  },
  "Rechnungswesen|Liquidität 3. Grades": {
    formel: "UV / KFV * 100",
    variablen: "UV = Umlaufvermögen; KFV = kurzfristige Verbindlichkeiten"
  },
  "Rechnungswesen|ROI": {
    formel: "ROI = G / GK * 100",
    variablen: "ROI = Return on Investment; G = Gewinn; GK = Gesamtkapital"
  },
  "Rechnungswesen|Working Capital": {
    formel: "WC = UV - KFV",
    variablen: "WC = Working Capital; UV = Umlaufvermögen; KFV = kurzfristige Verbindlichkeiten"
  },
  "Rechnungswesen|Wirtschaftlichkeit": {
    formel: "W = UE / SK",
    variablen: "W = Wirtschaftlichkeit; UE = Umsatzerlöse; SK = Selbstkosten des Umsatzes"
  },
  "Finanzierung und Investition|Amortisationsdauer": {
    formel: "t_a = (AK - RW) / R",
    variablen: "t_a = Amortisationsdauer; AK = Anschaffungskosten; RW = Restwert; R = durchschnittlicher Jahresrückfluss"
  },
  "Volkswirtschaftslehre|Arbeitslosenquote": {
    formel: "AL / EP * 100",
    variablen: "AL = registrierte Arbeitslose; EP = zivile Erwerbspersonen"
  },
  "Volkswirtschaftslehre|BIP Entstehungsrechnung": {
    formel: "BIP = PW - VL",
    variablen: "BIP = Bruttoinlandsprodukt; PW = Produktionswert; VL = Vorleistungen"
  },
  "Volkswirtschaftslehre|BIP Verwendungsrechnung": {
    formel: "BIP = C + I + G + X - M",
    variablen: "BIP = Bruttoinlandsprodukt; C = Konsum; I = Investitionen; G = Staatsausgaben; X = Exporte; M = Importe"
  },
  "Volkswirtschaftslehre|Zahlungsbilanz": {
    formel: "LB + KB + DB = 0",
    variablen: "LB = Leistungsbilanz; KB = Kapitalbilanz; DB = Devisenbilanz"
  },
  "Marketing und Vertrieb|Absoluter Marktanteil in %": {
    formel: "U / MV * 100",
    variablen: "U = Unternehmensumsatz; MV = Marktvolumen"
  },
  "Marketing und Vertrieb|Angebotserfolg in %": {
    formel: "EA / AA * 100",
    variablen: "EA = erteilte Aufträge; AA = abgegebene Angebote"
  },
  "Marketing und Vertrieb|Werbeerfolg in %": {
    formel: "UZ / WA * 100",
    variablen: "UZ = Umsatzzuwachs; WA = Werbekosten"
  },
  "Betriebliches Personalwesen|Abwesenheitsstruktur in %": {
    formel: "AW / M * 100",
    variablen: "AW = Anzahl Abwesende; M = Anzahl Mitarbeiter"
  },
  "Betriebliches Personalwesen|Ausbildungsquote in %": {
    formel: "AZ / M * 100",
    variablen: "AZ = Anzahl Auszubildende; M = Anzahl Mitarbeiter"
  }
};

function getErgaenzteKurzformel_(fach, formelname) {
  return FORMEL_KURZFORMEL_ERGAENZUNGEN_[String(fach || "") + "|" + String(formelname || "")] || null;
}

function ableiteteKurzformelOhneExterneAbkuerzung(ihkFormel, variablenText) {
  const formel = String(ihkFormel || "").trim();
  if (!formel) return "";

  if (istMathematischeKurzformel(formel)) return formel;

  const variablen = parseVariablenKuerzel_(variablenText);
  if (!variablen.length) return "";

  const abkuerzungen = variablen.filter(function(item) {
    const symbol = item.symbol;
    if (!symbol) return false;
    if (symbol.length > 8) return false;
    if (/\s/.test(symbol)) return false;
    if (/[+\-*/=]/.test(symbol)) return false;
    return true;
  });

  if (!abkuerzungen.length) return "";

  let kandidat = formel;
  abkuerzungen
    .filter(function(item) {
      return item.meaning && item.meaning.length >= 2;
    })
    .sort(function(a, b) {
      return b.meaning.length - a.meaning.length;
    })
    .forEach(function(item) {
      kandidat = ersetzeGanzesWort(kandidat, item.meaning, item.symbol);
    });

  return istMathematischeKurzformel(kandidat) ? kandidat : "";
}

function ersetzeGanzesWort(text, quell, ersatz) {
  if (!text || !quell) return text;

  const escaped = quell
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const regex = new RegExp("(^|[^A-Za-zÄÖÜäöüß0-9_])(" + escaped + ")(?=[^A-Za-zÄÖÜäöüß0-9_]|$)", "gi");

  return text.replace(regex, function(match, prefix, token) {
    return (prefix || "") + ersatz;
  });
}

function parseVariablenKuerzel_(variablenText) {
  const text = String(variablenText || "").trim();
  if (!text) return [];

  const teile = String(text)
    .replace(/;/g, ",")
    .split(/[,\n]/)
    .map(function(item) {
      return String(item || "").trim();
    })
    .filter(Boolean);

  return teile
    .map(function(teil) {
      const idx = teil.indexOf("=");
      if (idx <= 0) return null;

      const symbol = teil.substring(0, idx).trim();
      const meaning = teil.substring(idx + 1).trim();
      if (!symbol || !meaning) return null;
      if (/^\d+$/.test(symbol)) return null;

      return { symbol: symbol, meaning: meaning };
    })
    .filter(Boolean);
}

function ergaenzeVariablen_(vorhanden, ergaenzung) {
  const basis = String(vorhanden || "").trim();
  const vorhandeneSymbole = parseVariablenKuerzel_(basis).map(function(item) {
    return item.symbol.toLowerCase();
  });
  const neueDefinitionen = parseVariablenKuerzel_(ergaenzung).filter(function(item) {
    return vorhandeneSymbole.indexOf(item.symbol.toLowerCase()) < 0;
  }).map(function(item) {
    return item.symbol + " = " + item.meaning;
  });

  return [basis, neueDefinitionen.join("; ")].filter(Boolean).join("; ");
}

function istMathematischeKurzformel(text) {
  const t = String(text || "").trim();
  if (!t) return false;

  const hasOperator = /[=+\-*/\u00d7\u00b7\u00f7^()]/.test(t);
  if (!hasOperator) return false;

  const shortSymbolCount = (t.match(/\b[a-zA-Z]{1,8}(?:\([^)]*\))?|\b[xX]\b/g) || []).length;
  if (!shortSymbolCount) return false;

  const longWords = t.match(/\b[A-Za-zÄÖÜäöüß]{5,}\b/g) || [];
  if (longWords.length) return false;
  if (/\bbzw\.?\b/i.test(t)) return false;

  if (/\b(?:insgesamt|erhöhte|gesamte|gesamten|wird|werden|mit|und|oder|je|pro|nach|wenn|ist|sind|aus|in|bei)\b/i.test(t)) return false;

  return true;
}
function getPruefungSimulationFrontend(teilbereich, simulationNr, einheit) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName("Prüfungssimulation");

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const zielTeilbereich = String(teilbereich || "").trim();
  const zielSimulationNr = String(simulationNr || "").trim();
  const zielEinheit = String(einheit || "").trim();

  return values.slice(1)
    .filter(function(row) {
      const simulationId = String(row[0] || "").trim();
      const rowTeilbereich = String(row[1] || "").trim();
      const rowFach = String(row[2] || "").trim();
      const aktiv = String(row[11] || "").trim().toLowerCase();

      const passtAktiv = aktiv === "ja";
      const passtTeilbereich = rowTeilbereich === zielTeilbereich;
      const passtSimulation = simulationId.endsWith("_SIM_" + zielSimulationNr);

      let passtEinheit = false;

      if (zielTeilbereich === "WQ") {
        passtEinheit = rowFach === zielEinheit;
      }

      if (zielTeilbereich === "HQ") {
        passtEinheit = rowFach === zielEinheit;
      }

      return passtAktiv && passtTeilbereich && passtSimulation && passtEinheit;
    })
    .map(function(row) {
      return {
        simulationId: row[0],
        teilbereich: row[1],
        fach: row[2],
        aufgabe: row[3],
        teilaufgabe: row[4],
        punkte: row[5],
        situation: row[6],
        thema: row[7],
        frage: row[8],
        musterloesung: row[9],
        stichpunkte: row[10],
        fragetyp: row[12] || "text",
        aufgabenHtml: row[13] || "",
        bilddatei: row[14] || "",
        hauptsituation: row[15] || ""
      };
    });
}
function bewertePruefungFrontend(daten) {
  if (!Array.isArray(daten)) {
    return {
      gesamtPunkte: 0,
      gesamtMaxPunkte: 0,
      aufgaben: []
    };
  }

  let gesamtPunkte = 0;
  let gesamtMaxPunkte = 0;

  const ergebnisse = daten.map(function(eintrag) {
    const frage = String(eintrag.frage || "").trim();
    const muster = String(eintrag.musterloesung || "").trim();
    const antwort = String(eintrag.antwort || "").trim();
    const stichpunkteRaw = String(eintrag.stichpunkte || "").trim();
    const fragetyp = String(eintrag.fragetyp || "text").trim().toLowerCase();
    const skizze = String(eintrag.skizze || "").trim();

    const stichpunkteListe = getStichpunkteListe_(stichpunkteRaw);
    const maxPunkte = Number(eintrag.maxPunkte || stichpunkteListe.length || 0);

    gesamtMaxPunkte += maxPunkte;

    const istDiagramm = fragetyp === "diagramm";
    const beschreibungErforderlich = /beschreib|erläuter|erlaeuter|begründe|begruende|erklär|erklaer|beurteil|interpretier/i.test(frage);
    const hatText = antwort.length > 0;
    const hatSkizze = skizze.length > 0 && skizze.startsWith("data:image");

    if ((!hatText && !hatSkizze) || (istDiagramm && (!hatSkizze || (beschreibungErforderlich && !hatText))) ||
        (!istDiagramm && istKeineVerwertbareAntwort_(antwort))) {
      return {
        simulationId: eintrag.simulationId,
        aufgabe: eintrag.aufgabe,
        teilaufgabe: eintrag.teilaufgabe,
        punkte: 0,
        maxPunkte: maxPunkte,
        ergebnis: istDiagramm ? (beschreibungErforderlich ? "Skizze und schriftliche Beschreibung/Begründung erforderlich." : "Skizze erforderlich.") : "Keine Antwort eingegeben.",
        erkannte: [],
        fehlende: stichpunkteListe
      };
    }

    if (istExakteMusterantwort_(antwort, muster, istDiagramm)) {
      gesamtPunkte += maxPunkte;
      return {simulationId:eintrag.simulationId, aufgabe:eintrag.aufgabe, teilaufgabe:eintrag.teilaufgabe,
        punkte:maxPunkte, maxPunkte, ergebnis:'vollständig richtig', erkannte:stichpunkteListe, fehlende:[]};
    }
    const kriterienIds = getKriterienIdsFuerStichpunkte_(stichpunkteListe);
  const promptText = `
Du bist ein strenger, fachlich genauer Korrektor für eine Prüfungssimulation.

Deine Aufgabe:
Prüfe zuerst, ob die Teilnehmerantwort die konkrete Frage beantwortet. Bewerte danach
JEDES Bewertungskriterium einzeln und unabhängig anhand des fachlichen Inhalts der gesamten Teilnehmerantwort.

Die Stichpunkte sind Bewertungskriterien und keine Pflichtwörter. Ein Kriterium ist
erfüllt, wenn die Antwort seine fachliche Kernaussage eindeutig wiedergibt. Anerkenne
grammatische Varianten, geläufige Synonyme, Alltagssprache und klare Umschreibungen.

Fragetyp:
${fragetyp}

Frage:
${frage}

Musterlösung:
${muster}

Bewertungskriterien:
${stichpunkteListe.map(function(stichpunkt, index) {
  return (index + 1) + ". " + kriterienIds[index] + ": " + stichpunkt;
}).join("\n")}

Teilnehmerantwort:
${antwort || "(keine schriftliche Ergänzung)"}

Bewertungsregeln:
${istDiagramm ? diagrammBewertungsregel_(beschreibungErforderlich) : ""}
- Bewerte ausschließlich die Teilnehmerantwort.
- Musterlösung und Kriterien zählen NICHT als vom Teilnehmer genannt.
- Die Musterlösung und Beispiele dienen als fachliche Referenz. Bei offenen Aufgaben können auch andere fachlich korrekte Lösungen die Kriterien erfüllen. Verlange nicht, dass die Nutzerantwort ein Beispiel aus der Musterlösung wörtlich oder inhaltlich identisch übernimmt, sofern das Bewertungskriterium allgemein formuliert ist.
- Prüfe jedes Kriterium (K1...Kn) einzeln und unabhängig in der gesamten Teilnehmerantwort: Suche in der gesamten Antwort nach einer fachlich gleichwertigen Aussage und entscheide für jedes Kriterium eigenständig.
- Inhalt vor Wortlaut: Ein Kriterium gilt als erfüllt, wenn der fachliche Inhalt eindeutig vorhanden ist – auch bei anderen Wörtern, Synonymen, veränderter Satzstellung, abweichendem Singular/Plural, Umschreibungen oder Alltagssprache statt Fachbuchbegriffen (z. B. gelten Aussagen wie "wertvoll für Kunden und Verbraucher", "Mehrwert für Kunden", "Kunden profitieren davon", "Vorteile für Kunden schaffen" oder "den Kunden etwas Wertvolles bieten" als Erfüllung des Kriteriums "Nutzen für Kunden").
- Nicht überstreng auf bestimmte Einzelwörter bestehen: Wenn der fachliche Sinn eindeutig getroffen ist, darf ein Kriterium nicht abgelehnt werden, nur weil ein bestimmtes Wort (z. B. "Nutzen") nicht wörtlich vorkommt.
- Kriterien nicht miteinander vermischen: Jedes Kriterium wird separat bewertet. Wenn eine Antwort den Inhalt eines Kriteriums erfüllt, darf dieser Inhalt nicht ignoriert werden, nur weil ein anderes Kriterium im selben Satz oder Kontext unvollständig ist.
- Fachlich präzise bleiben (kein reines Keyword-Matching): Ein Kriterium ist nur erfüllt, wenn die Aussage tatsächlich fachlich dazu passt. Bloße Schlagwörter ohne den geforderten Sinnzusammenhang erfüllen kein Kriterium.
- Prüfe Negationen und Gegenteile ausdrücklich: "Kein/nicht" oder fachlich gegenteilige Aussagen dürfen kein positives Kriterium erfüllen.
- Widersprüche beachten: Wenn die Antwort zu demselben Kriterium gleichzeitig eine richtige und eine fachlich gegenteilige Aussage trifft, gilt das Kriterium als nicht_erfuellt.
- Keine zusätzlichen Anforderungen erfinden: Bewerte nur die tatsächlich vorgegebenen Kriterien. Verlange keine zusätzlichen Voraussetzungen oder Lehrbuchdetails, die nicht Teil des Kriteriums sind.
- Die Antwort muss zur konkreten Frage passen, nicht nur grob zum gleichen Thema. Wenn die Antwort eine andere Aufgabenstellung beantwortet, ist sie falsch.
- Verwende ausschließlich die vorgegebenen Kriterien-IDs. Erfinde keine neuen IDs.
- Wenn kein Kriterium eindeutig erfüllt ist, gib "erfuellt": [] zurück.
- Unsicherheitsformulierungen wie "ich glaube", "wahrscheinlich", "vielleicht" sind nur dann relevant, wenn sie den fachlichen Inhalt selbst entwerten. Sonst zählt der fachliche Inhalt normal.

Gib das Ergebnis exakt als JSON zurück, ohne Markdown-Codeblock:
{
  "erfuellt": ["K1", "K3"],
  "nicht_erfuellt": ["K2", "K4"]
}
`;

const messages = [];

    if (fragetyp === "diagramm" && hatSkizze) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: promptText
          },
          {
            type: "image_url",
            image_url: {
              url: skizze
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: promptText
      });
    }

    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post",
      headers: {
        "Authorization": "Bearer " + OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0
      }),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const bodyText = response.getContentText();

    if (statusCode !== 200) {
      throw new Error("API-Fehler bei Prüfungsauswertung: " + statusCode + " - " + bodyText);
    }

    const result = JSON.parse(bodyText);
    const text = result?.choices?.[0]?.message?.content || "";

    const kriterienAuswertung = werteKriterienMitFallback_(text, antwort, stichpunkteListe, kriterienIds, fragetyp === "diagramm");
    const erkannteIds = Array.isArray(kriterienAuswertung.erkannteIds) ? kriterienAuswertung.erkannteIds : [];
    const fehlendeIds = Array.isArray(kriterienAuswertung.fehlendeIds) ? kriterienAuswertung.fehlendeIds : [];

    const erkannte = erkannteIds.map(function(id) {
      const index = kriterienIds.indexOf(id);
      return index >= 0 ? stichpunkteListe[index] : id;
    }).filter(Boolean);

    const fehlende = fehlendeIds.map(function(id) {
      const index = kriterienIds.indexOf(id);
      return index >= 0 ? stichpunkteListe[index] : id;
    }).filter(Boolean);

    const uniqueErkannte = [...new Set(erkannte)];
    const uniqueFehlende = [...new Set(fehlende.filter(function(f) {
      return !uniqueErkannte.includes(f);
    }))];

    let erreichtePunkte = berechnePunkteAusKriterien_(uniqueErkannte.length, stichpunkteListe.length, maxPunkte);

    gesamtPunkte += erreichtePunkte;

    return {
      simulationId: eintrag.simulationId,
      aufgabe: eintrag.aufgabe,
      teilaufgabe: eintrag.teilaufgabe,
      punkte: erreichtePunkte,
      maxPunkte: maxPunkte,
      ergebnis: text,
      erkannte: uniqueErkannte,
      fehlende: uniqueFehlende
    };
  });

  return {
    gesamtPunkte: gesamtPunkte,
    gesamtMaxPunkte: gesamtMaxPunkte,
    aufgaben: ergebnisse
  };
}
