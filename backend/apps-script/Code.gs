
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

function doGet(e) {
  const action = String(e?.parameter?.action || "").trim();

  if (!action) {
    return HtmlService.createHtmlOutputFromFile("Index")
      .setTitle("WiFa Prüfungs-Trainer");
  }

  try {
    let result = {};

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

      result = {
        success: true,
        data: getQuizQuestionFrontend(fach, frageId)
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

    } else if (action === "questionById") {
      const fach = String(e?.parameter?.fach || "").trim();
      const frageId = String(e?.parameter?.frageId || "").trim();

      result = {
        success: true,
        data: getQuestionById(fach, frageId)
      };

    } else if (action === "getLernstand") {
      const nutzer = String(e?.parameter?.nutzer || "").trim();

      result = {
        success: true,
        data: getLernstandFrontend(nutzer)
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
    const body = JSON.parse(e.postData.contents || "{}");
    const action = String(body.action || "").trim();

    let result = {};

    if (action === "bewerteAntwort") {
      result = {
        success: true,
       data: bewerteAntwortFrontend({
  fach: body.fach,
  frageId: body.frageId,
  antwort: body.antwort,
          skizze: body.skizze,
  speichereInSheet: body.speichereInSheet
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

    } else if (action === "frageKilian") {
  result = {
    success: true,
    data: frageKilianFrontend(body.frage)
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
        error: String(error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetNames() {
  return getSpreadsheet_().getSheets().map(sheet => sheet.getName().trim());
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

  const hatUnsicherheit = unsicherheitsPhrasen.some(p => t.includes(p));

  if (hatUnsicherheit) {
    const wortliste = t
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);

    if (wortliste.length <= 10) return true;
  }

  const unpassendeWoerter = [
    "brudi", "digga", "joker", "lol", "haha"
  ];

  if (unpassendeWoerter.some(w => t.includes(w))) return true;

  return false;
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

  if (!userAnswer && !hatSkizze) {
    return {
      id: frageDaten.id,
      punkte: 0,
      maxPunkte: maxPunkte,
      ergebnis: "Keine Antwort eingegeben.",
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
    Boolean(muster) &&
    Boolean(userAnswer) &&
    !istDiagramm &&
    normalizeTextForCompare_(userAnswer) ===
      normalizeTextForCompare_(muster);

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
  const prompt = `
Du bist ein strenger, fachlich genauer Korrektor für ein Lerntool.

Deine Aufgabe:
Prüfe zuerst, ob die Teilnehmerantwort die konkrete Frage beantwortet. Bewerte danach
JEDEN Stichpunkt einzeln anhand des fachlichen Inhalts der Teilnehmerantwort.

Die Stichpunkte sind Bewertungskriterien und keine Pflichtwörter. Ein Stichpunkt ist
erfüllt, wenn die Antwort seine fachliche Aussage eindeutig wiedergibt. Anerkenne
grammatische Varianten, geläufige Synonyme und klare Umschreibungen. Bei einer
Erklärungs- oder Beschreibungsfrage genügt eine fachlich richtige Beschreibung auch
dann, wenn der Fachbegriff nicht verwendet wird. Eine Frage, die ausdrücklich nach
einem Namen, einer Bezeichnung oder einem Fachbegriff fragt (zum Beispiel mit
"Nennen Sie", "Wie heißt" oder "Welcher Fachbegriff"), verlangt dagegen die
entsprechende Bezeichnung.

Frage:
${frage}

Musterlösung:
${muster}

Vorgegebene Stichpunkte zur Bewertung:
${stichpunkteListe.map(p => "- " + p).join("\n")}

Teilnehmerantwort:
${userAnswer}

Bewertungsregeln:
- Bewerte ausschließlich die Teilnehmerantwort.
- Musterlösung und Stichpunkte zählen NICHT als vom Teilnehmer genannt.
- Berücksichtige die Frage als Kontext: Eine kurze Antwort wie "Nein, grundsätzlich nicht"
  kann bei einer eindeutig passenden Ja/Nein-Frage eine vollständige Negation der
  Frage aussagen. Verlange in diesem Fall keine Wiederholung von Fragewörtern.
- Prüfe Negationen ausdrücklich. "Kein/keine/keinen" und "nicht" dürfen einen
  positiven Anspruch nicht als negierten Anspruch erscheinen lassen. "Es gibt einen
  gesetzlichen Anspruch" erfüllt daher nicht "kein gesetzlicher Anspruch"; eine
  eindeutige Negation erfüllt ihn.
- Die Antwort muss zur konkreten Frage passen, nicht nur grob zum gleichen Thema.
- Wenn die Antwort eine andere Aufgabenstellung beantwortet, ist sie falsch.
- Wenn die Antwort ein anderes Verfahren, Beispiel oder Konzept beschreibt und die Kernaussage der Musterlösung nicht trifft, ist sie falsch.
- In diesem Fall dürfen keine Stichpunkte als erkannt aufgeführt werden.
- Ein Stichpunkt ist nur erkannt, wenn ein konkreter Bestandteil der Teilnehmerantwort
  ihn trägt. Eine bloß allgemeine oder thematisch passende Aussage erfüllt keinen
  zusätzlichen Stichpunkt.
- Sinngemäße Antworten sind erlaubt, wenn sie dieselbe fachliche Kernaussage treffen;
  der exakte Wortlaut ist nicht erforderlich.
- Rollen, Beziehungen oder Abläufe dürfen auch durch konkrete Beschreibungen statt
  durch Fachbegriffe erfüllt sein, wenn aus dem Kontext eindeutig hervorgeht, wer
  welche Rolle hat oder welcher Ablauf gemeint ist.
- Leite aus einem Satz nicht automatisch mehrere Kriterien ab. Jedes Kriterium muss
  einzeln inhaltlich gedeckt sein.
- Bei Definitionen reicht eine fachlich richtige Kurzfassung, wenn der Kern eindeutig enthalten ist.
- Allgemeine Aussagen zum Thema reichen nicht aus.
- Es dürfen keine Stichpunkte erfunden werden.
- Verwende ausschließlich Stichpunkte aus der vorgegebenen Liste.
- Wenn kein Stichpunkt eindeutig enthalten ist, schreibe bei erkannten Stichpunkten nur "- keine".

${istDiagramm ? "- Bewerte bei DIAGRAMM zusätzlich die übermittelte Skizze auf Achsen, Kurven, Verläufe, Verschiebungen, Schnittpunkte und relevante Beschriftungen. Eine Skizze darf die schriftliche Antwort ergänzen oder ersetzen." : ""}

Arbeitsweise vor der Ausgabe (nicht ausgeben):
1. Prüfe die Passung zur Frage.
2. Entscheide für jeden Stichpunkt separat: eindeutig erfüllt oder nicht erfüllt.
3. Prüfe bei jedem erfüllten Kriterium, ob die konkrete Aussage wirklich in der
  Teilnehmerantwort steht und nicht nur aus Musterlösung oder Thema stammt.
4. Gib bei erkannten Kriterien ausschließlich die unveränderten Stichpunkttexte aus.

Gib das Ergebnis EXAKT in diesem Format zurück:

Erkannte Stichpunkte:
- ...

Fehlende Stichpunkte:
- ...
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

  const erkannte = extractBulletList_(text, "Erkannte Stichpunkte:");
  const fehlende = extractBulletList_(text, "Fehlende Stichpunkte:");

  const erkannteBereinigt = normalizeMatches_(erkannte, stichpunkteListe);
  const fehlendeBereinigt = normalizeMatches_(fehlende, stichpunkteListe);

  const uniqueErkannte = [...new Set(erkannteBereinigt)];
  const uniqueFehlende = [...new Set(fehlendeBereinigt.filter(f => !uniqueErkannte.includes(f)))];

  const erreichtePunkte = uniqueErkannte.length;
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
  ]);
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

function getQuizCatalogFrontend() {
  const result = [];
  const faecher = getFrontendSheetNames();

  faecher.forEach(function(fach) {
    const sheet = getSheetByNameSafe_(fach);
    const lastRow = sheet.getLastRow();

    if (lastRow < 3) return;

    const values = sheet
      .getRange(3, 1, lastRow - 2, sheet.getLastColumn())
      .getValues();

    values.forEach(function(row) {
      const aktiv = String(row[COL.AKTIV - 1] || "").trim().toLowerCase();
      const frageId = String(row[COL.ID - 1] || "").trim();
      const thema = String(row[COL.THEMA - 1] || "").trim();
      const frage = String(row[COL.FRAGE - 1] || "").trim();
      const muster = String(row[COL.MUSTER - 1] || "").trim();
      const teilbereich = String(row[COL.TEILBEREICH - 1] || "").trim();
      const fragetyp = String(
        row[COL.FRAGETYP - 1] || "text"
      ).trim().toLowerCase();

      if (aktiv !== "ja" || !frageId || !frage || !muster) return;
      if (fragetyp && fragetyp !== "text") return;

      result.push({
        quizKey: getQuizKey_(fach, frageId),
        teilbereich: teilbereich,
        fach: fach,
        thema: thema,
        frageId: frageId
      });
    });
  });

  return result;
}

function findQuizEntry_(quizKey) {
  const sheet = getQuizSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const currentKey = String(row[0] || "").trim();

    if (currentKey === quizKey) {
      return {
        row: i + 2,
        quizKey: currentKey,
        fach: String(row[1] || "").trim(),
        frageId: String(row[2] || "").trim(),
        antworten: [
          String(row[3] || "").trim(),
          String(row[4] || "").trim(),
          String(row[5] || "").trim(),
          String(row[6] || "").trim()
        ],
        richtigeOption: String(row[7] || "").trim().toUpperCase(),
        aktiv: String(row[8] || "").trim().toLowerCase()
      };
    }
  }

  return null;
}

function shuffleQuizOptions_(items) {
  const result = items.slice();

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
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
function frageKilianFrontend(frage) {
  const userFrage = String(frage || "").trim();

  if (!userFrage) {
    return {
      antwort: "Keine Frage übergeben."
    };
  }

  const systemPrompt =
  "Du bist Kilian, ein verständlicher Lernassistent für Lern- und Bildungsinhalte. " +
  "Du erklärst Themen klar, strukturiert und praxisnah auf Deutsch. " +

  "Dein Schwerpunkt liegt auf kaufmännischen, wirtschaftlichen, mathematischen, organisatorischen, technischen, unternehmerischen, rechtlichen, steuerlichen und allgemeinen Bildungsthemen. " +

  "Du hilfst beim Lernen, Verstehen, Zusammenfassen, Erklären und Wiederholen von Wissen. " +

  "Du beantwortest KEINE Fragen zu Pornografie, sexuellen Inhalten, Fetischen, Gewaltfantasien, illegalen Aktivitäten, Drogenmissbrauch, Hassinhalten, rassistischen oder antisemitischen Inhalten oder anderen unangemessenen Themen. " +

  "Wenn solche Fragen gestellt werden, lehne höflich ab und lenke zurück auf sinnvolle Lern- oder Wissensfragen. " +

  "Antworte niemals flirtend, anzüglich oder provozierend. " +

  "Antworte sachlich, freundlich und verständlich. " +

  "Nutze bei Erklärungen gerne Beispiele und einfache Sprache.";

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
      return {
        fach: cFach >= 0 ? String(row[cFach] || "").trim() : "",
        kapitel: cKapitel >= 0 ? String(row[cKapitel] || "").trim() : "",
        unterkapitel: "",
        formelname: cFormelname >= 0 ? String(row[cFormelname] || "").trim() : "",
        ihkSeite: cIhkSeite >= 0 ? String(row[cIhkSeite] || "").trim() : "",
        ihkFormel: cIhkFormel >= 0 ? String(row[cIhkFormel] || "").trim() : "",
        variablen: cAbkuerzungen >= 0 ? String(row[cAbkuerzungen] || "").trim() : "",
        erklaerung: cErklaerung >= 0 ? String(row[cErklaerung] || "").trim() : "",
        beispiel: cBeispiel >= 0 ? String(row[cBeispiel] || "").trim() : "",
        schwierigkeit: cSchwierigkeit >= 0 ? String(row[cSchwierigkeit] || "").trim() : ""
      };
    })
    .sort(function(a, b) {
      return String(a.formelname).localeCompare(String(b.formelname), "de");
    });
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

    const hatText = antwort.length > 0;
    const hatSkizze = skizze.length > 0 && skizze.startsWith("data:image");

    if (!hatText && !hatSkizze) {
      return {
        simulationId: eintrag.simulationId,
        aufgabe: eintrag.aufgabe,
        teilaufgabe: eintrag.teilaufgabe,
        punkte: 0,
        maxPunkte: maxPunkte,
        ergebnis: "Keine Antwort eingegeben.",
        erkannte: [],
        fehlende: stichpunkteListe
      };
    }

    const promptText = `
Du bist ein strenger, fachlich genauer Korrektor für eine Prüfungssimulation.

Deine Aufgabe:
Prüfe zuerst, ob die Teilnehmerantwort die konkrete Frage beantwortet. Bewerte danach
JEDEN Stichpunkt einzeln anhand des fachlichen Inhalts der Teilnehmerantwort.

Die Stichpunkte sind Bewertungskriterien und keine Pflichtwörter. Ein Stichpunkt ist
erfüllt, wenn die Antwort seine fachliche Aussage eindeutig wiedergibt. Anerkenne
grammatische Varianten, geläufige Synonyme und klare Umschreibungen.

Fragetyp:
${fragetyp}

Frage:
${frage}

Musterlösung:
${muster}

Vorgegebene Stichpunkte zur Bewertung:
${stichpunkteListe.map(function(p) { return "- " + p; }).join("\n")}

Teilnehmerantwort:
${antwort || "(keine schriftliche Ergänzung)"}

Bewertungsregeln:
- Bewerte ausschließlich die Teilnehmerantwort.
- Musterlösung und Stichpunkte zählen NICHT als vom Teilnehmer genannt.
- Die Antwort muss zur konkreten Frage passen, nicht nur grob zum gleichen Thema.
- Wenn die Antwort eine andere Aufgabenstellung beantwortet, ist sie falsch.
- Ein Stichpunkt ist nur erkannt, wenn ein konkreter Bestandteil der Teilnehmerantwort ihn trägt.
- Eine bloß allgemeine oder thematisch passende Aussage erfüllt keinen Stichpunkt.
- Prüfe bei jedem erfüllten Kriterium, ob die konkrete Aussage wirklich in der
  Teilnehmerantwort steht und nicht nur aus Musterlösung oder Thema stammt.
- Verwende ausschließlich Stichpunkte aus der vorgegebenen Liste.
- Erfinde keine neuen Stichpunkte.
- Wenn kein Stichpunkt eindeutig enthalten ist, schreibe bei erkannten Stichpunkten nur "- keine".

Besonderheiten:
- Prüfe Negationen ausdrücklich. "Kein/keine/keinen" und "nicht" dürfen einen positiven Anspruch nicht als negiert erscheinen lassen.
${fragetyp === "diagramm" ? "- Bei Diagrammaufgaben zählen erkennbare Achsen, Kurven, Schnittpunkte, Hilfslinien und Beschriftungen auch ohne lange Textbeschreibung." : ""}
- Bei Synonymen und sinngemäßen Formulierungen ist der exakte Wortlaut nicht erforderlich.

Arbeitsweise vor der Ausgabe (nicht ausgeben):
1. Prüfe die Passung zur Frage.
2. Entscheide für jeden Stichpunkt separat: eindeutig erfüllt oder nicht erfüllt.
3. Prüfe bei jedem erfüllten Kriterium, ob die konkrete Aussage wirklich in der Teilnehmerantwort steht.
4. Gib bei erkannten Kriterien ausschließlich die unveränderten Stichpunkttexte aus.

Gib das Ergebnis EXAKT in diesem Format zurück:

Erkannte Stichpunkte:
- ...

Fehlende Stichpunkte:
- ...
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

    const erkannte = extractBulletList_(text, "Erkannte Stichpunkte:");
    const fehlende = extractBulletList_(text, "Fehlende Stichpunkte:");

    const erkannteBereinigt = normalizeMatches_(erkannte, stichpunkteListe);
    const fehlendeBereinigt = normalizeMatches_(fehlende, stichpunkteListe);

    const uniqueErkannte = [...new Set(erkannteBereinigt)];
    const uniqueFehlende = [...new Set(fehlendeBereinigt.filter(function(f) {
      return !uniqueErkannte.includes(f);
    }))];

    let erreichtePunkte = uniqueErkannte.length;

if (uniqueErkannte.length === stichpunkteListe.length && stichpunkteListe.length > 0) {
  erreichtePunkte = maxPunkte;
} else if (stichpunkteListe.length > 0 && maxPunkte !== stichpunkteListe.length) {
  erreichtePunkte = Math.round((uniqueErkannte.length / stichpunkteListe.length) * maxPunkte);
}

if (erreichtePunkte > maxPunkte) {
  erreichtePunkte = maxPunkte;
}

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
