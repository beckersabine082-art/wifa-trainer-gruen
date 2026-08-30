let STATIC_QUIZ_CACHE_ = null;

function normalizeStaticQuizValue_(value) {
  return String(value == null ? "" : value).trim();
}

function isJaStaticQuizValue_(value) {
  return normalizeStaticQuizValue_(value).toLowerCase() === "ja";
}

function parseStaticQuizEntry_(row, rowNumber) {
  if (!Array.isArray(row)) {
    return null;
  }

  const quizKey = normalizeStaticQuizValue_(row[0]);
  const fach = normalizeStaticQuizValue_(row[1]);
  const frageId = normalizeStaticQuizValue_(row[2]);
  const antworten = [
    normalizeStaticQuizValue_(row[3]),
    normalizeStaticQuizValue_(row[4]),
    normalizeStaticQuizValue_(row[5]),
    normalizeStaticQuizValue_(row[6])
  ];
  const richtigeOption = normalizeStaticQuizValue_(row[7]).toUpperCase();
  const aktiv = normalizeStaticQuizValue_(row[8]);
  const erstelltAm = normalizeStaticQuizValue_(row[9]);
  const quizfrage = normalizeStaticQuizValue_(row[10]);
  const geprueft = normalizeStaticQuizValue_(row[11]);
  const hinweis = normalizeStaticQuizValue_(row[12]);

  const entry = {
    rowNumber: Number(rowNumber) || 0,
    quizKey: quizKey,
    fach: fach,
    frageId: frageId,
    antworten: antworten,
    richtigeOption: richtigeOption,
    aktiv: aktiv,
    erstelltAm: erstelltAm,
    quizfrage: quizfrage,
    geprueft: geprueft,
    hinweis: hinweis
  };

  if (!isValidStaticQuizEntry_(entry)) {
    return null;
  }

  return entry;
}

function isValidStaticQuizEntry_(entry) {
  if (!entry) {
    return false;
  }

  if (!entry.quizKey || !entry.fach || !entry.frageId) {
    return false;
  }

  if (!Array.isArray(entry.antworten) || entry.antworten.length !== 4) {
    return false;
  }

  if (entry.antworten.some(function(answer) { return !answer; })) {
    return false;
  }

  if (['A', 'B', 'C', 'D'].indexOf(String(entry.richtigeOption || '').toUpperCase()) === -1) {
    return false;
  }

  if (!isJaStaticQuizValue_(entry.aktiv)) {
    return false;
  }

  if (!entry.quizfrage) {
    return false;
  }

  if (!isJaStaticQuizValue_(entry.geprueft)) {
    return false;
  }

  return true;
}

function getStaticQuizEntries_() {
  if (STATIC_QUIZ_CACHE_) {
    return STATIC_QUIZ_CACHE_;
  }

  const sheet = getQuizSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    STATIC_QUIZ_CACHE_ = [];
    return STATIC_QUIZ_CACHE_;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const uniqueEntriesByKey = {};

  for (let i = 0; i < values.length; i++) {
    const parsed = parseStaticQuizEntry_(values[i], i + 2);
    if (!parsed) {
      continue;
    }

    uniqueEntriesByKey[parsed.quizKey] = parsed;
  }

  STATIC_QUIZ_CACHE_ = Object.keys(uniqueEntriesByKey)
    .map(function(key) {
      return uniqueEntriesByKey[key];
    })
    .sort(function(a, b) {
      return a.rowNumber - b.rowNumber;
    });

  return STATIC_QUIZ_CACHE_;
}

function getStaticQuizEntryByKey_(quizKey) {
  const normalizedKey = normalizeStaticQuizValue_(quizKey);

  if (!normalizedKey) {
    return null;
  }

  const entries = getStaticQuizEntries_();
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].quizKey === normalizedKey) {
      return entries[i];
    }
  }

  return null;
}

function getQuizCatalogFrontend() {
  const catalog = getStaticQuizEntries_();
  const metadataIndex = buildQuizMetadataIndex_();

  return catalog.map(function(entry) {
    const meta = metadataIndex[entry.quizKey] || {};

    return {
      quizKey: entry.quizKey,
      teilbereich: String(meta.teilbereich || "").trim(),
      fach: entry.fach,
      thema: String(meta.thema || "").trim(),
      frageId: entry.frageId
    };
  });
}

function getQuestionTeilbereich_(sheetName, questionId) {
  const id = normalizeStaticQuizValue_(questionId);
  if (!id) {
    return "";
  }

  const meta = getSubjectMetadataMap_(sheetName);
  return String((meta[id] && meta[id].teilbereich) || "").trim();
}

function getQuestionFragetyp_(sheetName, questionId) {
  const id = normalizeStaticQuizValue_(questionId);
  if (!id) {
    return "";
  }

  const meta = getSubjectMetadataMap_(sheetName);
  return String((meta[id] && meta[id].fragetyp) || "").trim();
}

function buildQuizMetadataIndex_() {
  const metaIndex = {};
  const faecher = getFrontendSheetNames();

  faecher.forEach(function(fach) {
    const mapped = getSubjectMetadataMap_(fach);
    Object.keys(mapped).forEach(function(questionId) {
      metaIndex[getQuizKey_(fach, questionId)] = {
        teilbereich: mapped[questionId].teilbereich,
        thema: mapped[questionId].thema,
        fragetyp: mapped[questionId].fragetyp
      };
    });
  });

  return metaIndex;
}

function getSubjectMetadataMap_(sheetName) {
  const vertrauterName = normalizeStaticQuizValue_(sheetName);

  if (!vertrauterName) {
    return {};
  }

  try {
    const sheet = getSheetByNameSafe_(vertrauterName);
    const lastRow = sheet.getLastRow();

    if (lastRow < 3) {
      return {};
    }

    const values = sheet
      .getRange(3, 1, lastRow - 2, sheet.getLastColumn())
      .getValues();
    const metaMap = {};

    values.forEach(function(row) {
      const questionId = normalizeStaticQuizValue_(row[(typeof COL !== 'undefined' ? COL.ID : 1) - 1]);
      if (!questionId) {
        return;
      }

      metaMap[questionId] = {
        thema: normalizeStaticQuizValue_(row[(typeof COL !== 'undefined' ? COL.THEMA : 2) - 1]),
        teilbereich: normalizeStaticQuizValue_(row[(typeof COL !== 'undefined' ? COL.TEILBEREICH : 11) - 1]),
        fragetyp: normalizeStaticQuizValue_(row[(typeof COL !== 'undefined' ? COL.FRAGETYP : 12) - 1])
      };
    });

    return metaMap;
  } catch (error) {
    return {};
  }
}

function getQuizQuestionFrontend(fach, frageId) {
  const requestedFach = normalizeStaticQuizValue_(fach);
  const requestedId = normalizeStaticQuizValue_(frageId);

  if (!requestedFach || !requestedId) {
    throw new Error("Die Quizfrage ist nicht vollständig geprüft oder freigegeben.");
  }

  const quizKey = getQuizKey_(requestedFach, requestedId);
  const entry = getStaticQuizEntryByKey_(quizKey);

  if (!entry) {
    throw new Error("Die Quizfrage ist nicht vollständig geprüft oder freigegeben.");
  }

  const meta = getSubjectMetadataMap_(requestedFach);
  const metadata = meta[requestedId] || {};

  return {
    quizKey: entry.quizKey,
    teilbereich: String(metadata.teilbereich || "").trim(),
    fach: entry.fach,
    thema: String(metadata.thema || "").trim(),
    frageId: entry.frageId,
    frage: entry.quizfrage,
    antworten: [
      { id: "A", text: entry.antworten[0] },
      { id: "B", text: entry.antworten[1] },
      { id: "C", text: entry.antworten[2] },
      { id: "D", text: entry.antworten[3] }
    ],
    richtigeOption: entry.richtigeOption
  };
}

function testQuizCatalog() {
  const catalog = getQuizCatalogFrontend();
  const expectedCounts = {
    "Führung und Zusammenarbeit": 124,
    "Rechnungswesen": 43,
    "Recht": 540,
    "Steuern": 173,
    "BWL": 101,
    "VWL": 113,
    "Unternehmensführung": 194,
    "Betriebliches Management": 214,
    "Logistik": 192,
    "Marketing": 46,
    "Vertrieb": 29,
    "Betriebliches Rechnungswesen und Controlling": 65,
    "Investition und Finanzierung": 133
  };

  const total = catalog.length;
  if (total !== 1967) {
    throw new Error("Quizkatalog-Fehler: Erwartete Gesamtanzahl 1967, erhalten " + total + ".");
  }

  const actualCounts = {};
  catalog.forEach(function(item) {
    const fach = String(item.fach || "").trim();
    actualCounts[fach] = (actualCounts[fach] || 0) + 1;
  });

  Object.keys(expectedCounts).forEach(function(fach) {
    const actual = actualCounts[fach] || 0;
    if (actual !== expectedCounts[fach]) {
      throw new Error("Quizkatalog-Fehler für " + fach + ": erwartet " + expectedCounts[fach] + ", erhalten " + actual + ".");
    }
  });

  const seen = {};
  catalog.forEach(function(item) {
    const key = String(item.quizKey || "").trim();
    if (!key) {
      throw new Error("Quizkatalog-Fehler: Leerer Quiz-Key im Katalog.");
    }
    if (seen[key]) {
      throw new Error("Quizkatalog-Fehler: Doppelte Quiz-Key im Katalog: " + key);
    }
    seen[key] = true;

    const entry = getStaticQuizEntryByKey_(key);
    if (!entry) {
      throw new Error("Quizkatalog-Fehler: Katalogeintrag fehlt in statischer Datenbank: " + key);
    }

    if (!isValidStaticQuizEntry_(entry)) {
      throw new Error("Quizkatalog-Fehler: Ungültiger statischer Quiz-Eintrag: " + key);
    }

    if (!entry.quizfrage) {
      throw new Error("Quizkatalog-Fehler: Leere Quizfrage für " + key + ".");
    }

    const answerCount = entry.antworten.length;
    if (answerCount !== 4) {
      throw new Error("Quizkatalog-Fehler: Falsche Antwortanzahl für " + key + ": " + answerCount + ".");
    }

    if (entry.antworten.some(function(answer) { return !String(answer || "").trim(); })) {
      throw new Error("Quizkatalog-Fehler: Leere Antwort in " + key + ".");
    }

    if (['A', 'B', 'C', 'D'].indexOf(String(entry.richtigeOption || '').toUpperCase()) === -1) {
      throw new Error("Quizkatalog-Fehler: Ungültige richtige Option in " + key + ": " + entry.richtigeOption + ".");
    }
  });
}

function testQuizQuestion(fach, frageId) {
  const requestedFach = normalizeStaticQuizValue_(fach);
  const requestedId = normalizeStaticQuizValue_(frageId);

  if (!requestedFach || !requestedId) {
    throw new Error("Quizfrage-Test-Fehler: Fach und Frage-ID werden benötigt.");
  }

  const result = getQuizQuestionFrontend(requestedFach, requestedId);
  if (!result || !result.quizKey) {
    throw new Error("Quizfrage-Test-Fehler: Keine Quizfrage für " + requestedFach + "::" + requestedId + ".");
  }

  if (!result.frage || !String(result.frage).trim()) {
    throw new Error("Quizfrage-Test-Fehler: Leere Quizfrage für " + result.quizKey + ".");
  }

  if (!Array.isArray(result.antworten) || result.antworten.length !== 4) {
    throw new Error("Quizfrage-Test-Fehler: Antwortarray fehlerhaft für " + result.quizKey + ".");
  }

  if (result.antworten.some(function(answer) { return !String(answer && answer.text || "").trim(); })) {
    throw new Error("Quizfrage-Test-Fehler: Leere Antwort für " + result.quizKey + ".");
  }

  if (['A', 'B', 'C', 'D'].indexOf(String(result.richtigeOption || '').toUpperCase()) === -1) {
    throw new Error("Quizfrage-Test-Fehler: Ungültige richtige Option für " + result.quizKey + ": " + result.richtigeOption);
  }

  const entry = getStaticQuizEntryByKey_(result.quizKey);
  if (!entry) {
    throw new Error("Quizfrage-Test-Fehler: Kein statischer Eintrag für " + result.quizKey + ".");
  }

  if (result.frage !== entry.quizfrage) {
    throw new Error("Quizfrage-Test-Fehler: Quizfrage aus Quizfragen stimmt nicht mit Ergebnis überein: " + result.quizKey + ".");
  }

  const expectedAntworten = entry.antworten.map(function(answer, index) {
    return { id: ['A', 'B', 'C', 'D'][index], text: answer };
  });

  const actualAntworten = result.antworten.map(function(answer) { return answer.text; });
  const expectedAntwortenText = expectedAntworten.map(function(answer) { return answer.text; });

  if (JSON.stringify(actualAntworten) !== JSON.stringify(expectedAntwortenText)) {
    throw new Error("Quizfrage-Test-Fehler: Antworten aus statischer Quizfrage stimmen nicht überein: " + result.quizKey + ".");
  }
}
