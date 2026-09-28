
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

const TRAINER_PILOT_VERSION_ = "WIFA-TR-WQ3-20260927-v2";
const TRAINER_PILOT_PROGRESS_PREFIX_ = "tr-v2:";
const TRAINER_PILOT_RUNTIME_CACHE_TTL_ = 21600;
const TRAINER_PILOT_RUNTIME_CACHE_PREFIX_ = "trainer-pilot-runtime:" + TRAINER_PILOT_VERSION_ + ":";
const TRAINER_PILOT_RUNTIME_CACHE_KEYS_ = {
  core: TRAINER_PILOT_RUNTIME_CACHE_PREFIX_ + "core",
  Recht: TRAINER_PILOT_RUNTIME_CACHE_PREFIX_ + "Recht",
  Steuern: TRAINER_PILOT_RUNTIME_CACHE_PREFIX_ + "Steuern"
};

function getOptionalSheetByName_(name) {
  try {
    return getSpreadsheet_().getSheetByName(String(name || "").trim());
  } catch (error) {
    return null;
  }
}

function getTableObjects_(sheetName) {
  const sheet = getOptionalSheetByName_(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = (values[0] || []).map(function(value) { return String(value || "").trim(); });
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value !== null && value !== undefined; });
  }).map(function(row) {
    const item = {};
    headers.forEach(function(header, index) {
      if (header) item[header] = row[index];
    });
    return item;
  });
}

function getTrainerPilotMigration_() {
  const events = getTableObjects_("Trainer_Migrationen").filter(function(item) {
    return String(item.Version || "").trim() === TRAINER_PILOT_VERSION_;
  });
  if (!events.length) return null;
  const latest = events[events.length - 1];
  return {
    version: TRAINER_PILOT_VERSION_,
    migrationId: String(latest.MigrationID || "").trim(),
    status: String(latest.Laufstatus || "").trim().toUpperCase(),
    active: String(latest.Laufstatus || "").trim().toUpperCase() === "AKTIV"
  };
}

function indexTrainerPilotRuntimeMetadata_(metadata) {
  const details = metadata.details || [];
  const assignments = metadata.assignments || [];
  const detailByKey = {};
  details.forEach(function(item) {
    detailByKey[String(item.DetailKey || "").trim()] = item;
  });
  const assignmentById = {};
  assignments.forEach(function(item) {
    const id = String(item.TrainerID || "").trim();
    const detail = detailByKey[String(item.DetailKey || "").trim()] || {};
    if (id) assignmentById[id] = {
      assignment: item,
      detail: detail,
      uiThemenKey: String(detail.UIThemenKey || "").trim()
    };
  });
  metadata.detailByKey = detailByKey;
  metadata.assignmentById = assignmentById;
  return metadata;
}

function buildTrainerPilotRuntimeMetadata_() {
  const topics = getTableObjects_("Trainer_Themen").filter(function(item) {
    return String(item.Version || "").trim() === TRAINER_PILOT_VERSION_;
  });
  const details = getTableObjects_("Trainer_Detailgruppen").filter(function(item) {
    return String(item.Version || "").trim() === TRAINER_PILOT_VERSION_;
  });
  const assignments = getTableObjects_("Trainer_Zuordnung").filter(function(item) {
    return String(item.Version || "").trim() === TRAINER_PILOT_VERSION_;
  });
  const metadata = indexTrainerPilotRuntimeMetadata_({
    topics: topics,
    details: details,
    assignments: assignments,
    references: [],
    coverage: []
  });
  metadata.validationErrors = validateTrainerPilotRuntimeMetadata_(metadata);
  metadata.valid = metadata.validationErrors.length === 0;
  metadata.active = metadata.valid;
  return metadata;
}

function trainerPilotRuntimeCache_() {
  try {
    return CacheService.getScriptCache();
  } catch (error) {
    return null;
  }
}

function clearTrainerPilotRuntimeCache_(cache) {
  if (!cache) return;
  Object.keys(TRAINER_PILOT_RUNTIME_CACHE_KEYS_).forEach(function(key) {
    try { cache.remove(TRAINER_PILOT_RUNTIME_CACHE_KEYS_[key]); } catch (error) {}
  });
}

function serializeTrainerPilotRuntimeMetadata_(metadata) {
  const core = {
    version: TRAINER_PILOT_VERSION_,
    topics: (metadata.topics || []).map(function(item) {
      return [item.UIThemenKey, item.Teilbereich, item.Quellfach, item.Anzeigename,
        item.Sortierung, item.Sichtbar, item.Status];
    }),
    details: (metadata.details || []).map(function(item) {
      return [item.DetailKey, item.Teilbereich, item.Quellfach, item.UIThemenKey,
        item.RahmenplanPunktKey];
    })
  };
  const subjects = {};
  ["Recht", "Steuern"].forEach(function(fach) {
    subjects[fach] = {
      version: TRAINER_PILOT_VERSION_,
      fach: fach,
      assignments: (metadata.assignments || []).filter(function(item) {
        return String(item.Quellfach || "").trim() === fach;
      }).map(function(item) {
        return [item.TrainerID, item.Teilbereich, item.DetailKey, item.UIReihenfolge, item.QuellthemaAlt];
      })
    };
  });
  return {core: JSON.stringify(core), Recht: JSON.stringify(subjects.Recht), Steuern: JSON.stringify(subjects.Steuern)};
}

function hydrateTrainerPilotRuntimeMetadata_(serialized) {
  const core = JSON.parse(serialized.core);
  const recht = JSON.parse(serialized.Recht);
  const steuern = JSON.parse(serialized.Steuern);
  if (!core || core.version !== TRAINER_PILOT_VERSION_ ||
      !recht || recht.version !== TRAINER_PILOT_VERSION_ || recht.fach !== "Recht" ||
      !steuern || steuern.version !== TRAINER_PILOT_VERSION_ || steuern.fach !== "Steuern" ||
      !Array.isArray(core.topics) || !Array.isArray(core.details) ||
      !Array.isArray(recht.assignments) || !Array.isArray(steuern.assignments)) {
    return null;
  }
  const topics = core.topics.map(function(row) {
    return {UIThemenKey: row[0], Teilbereich: row[1], Quellfach: row[2], Anzeigename: row[3],
      Sortierung: row[4], Sichtbar: row[5], Status: row[6]};
  });
  const details = core.details.map(function(row) {
    return {DetailKey: row[0], Teilbereich: row[1], Quellfach: row[2], UIThemenKey: row[3],
      RahmenplanPunktKey: row[4]};
  });
  const assignments = [recht, steuern].reduce(function(result, subject) {
    return result.concat(subject.assignments.map(function(row) {
      return {TrainerID: row[0], Teilbereich: row[1], Quellfach: subject.fach, DetailKey: row[2],
        UIReihenfolge: row[3], QuellthemaAlt: row[4]};
    }));
  }, []);
  return indexTrainerPilotRuntimeMetadata_({topics: topics, details: details, assignments: assignments,
    references: [], coverage: []});
}

function loadTrainerPilotRuntimeCache_() {
  const cache = trainerPilotRuntimeCache_();
  if (!cache) return null;
  try {
    const serialized = {
      core: cache.get(TRAINER_PILOT_RUNTIME_CACHE_KEYS_.core),
      Recht: cache.get(TRAINER_PILOT_RUNTIME_CACHE_KEYS_.Recht),
      Steuern: cache.get(TRAINER_PILOT_RUNTIME_CACHE_KEYS_.Steuern)
    };
    if (!serialized.core || !serialized.Recht || !serialized.Steuern) return null;
    const metadata = hydrateTrainerPilotRuntimeMetadata_(serialized);
    if (!metadata) {
      clearTrainerPilotRuntimeCache_(cache);
      return null;
    }
    metadata.validationErrors = validateTrainerPilotRuntimeMetadata_(metadata);
    metadata.valid = metadata.validationErrors.length === 0;
    metadata.active = metadata.valid;
    if (!metadata.valid) {
      clearTrainerPilotRuntimeCache_(cache);
      return null;
    }
    return metadata;
  } catch (error) {
    clearTrainerPilotRuntimeCache_(cache);
    return null;
  }
}

function storeTrainerPilotRuntimeCache_(metadata) {
  if (!metadata || !metadata.valid) return;
  const cache = trainerPilotRuntimeCache_();
  if (!cache) return;
  try {
    const serialized = serializeTrainerPilotRuntimeMetadata_(metadata);
    cache.put(TRAINER_PILOT_RUNTIME_CACHE_KEYS_.core, serialized.core, TRAINER_PILOT_RUNTIME_CACHE_TTL_);
    cache.put(TRAINER_PILOT_RUNTIME_CACHE_KEYS_.Recht, serialized.Recht, TRAINER_PILOT_RUNTIME_CACHE_TTL_);
    cache.put(TRAINER_PILOT_RUNTIME_CACHE_KEYS_.Steuern, serialized.Steuern, TRAINER_PILOT_RUNTIME_CACHE_TTL_);
  } catch (error) {
    clearTrainerPilotRuntimeCache_(cache);
  }
}

function getTrainerPilotRuntimeMetadata_() {
  const cached = loadTrainerPilotRuntimeCache_();
  if (cached) return cached;
  const metadata = buildTrainerPilotRuntimeMetadata_();
  storeTrainerPilotRuntimeCache_(metadata);
  return metadata;
}

function getTrainerPilotAuditMetadata_() {
  const metadata = buildTrainerPilotRuntimeMetadata_();
  metadata.migration = getTrainerPilotMigration_();
  metadata.references = getTableObjects_("Trainer_Rahmenplanbezug").filter(function(item) {
    return String(item.Version || "").trim() === TRAINER_PILOT_VERSION_;
  });
  metadata.coverage = getTableObjects_("Rahmenplan_Abdeckung").filter(function(item) {
    return String(item.FreigabeReferenz || "").trim() === TRAINER_PILOT_VERSION_;
  });
  metadata.validationErrors = validateTrainerPilotMetadata_(metadata);
  metadata.valid = metadata.validationErrors.length === 0;
  metadata.active = Boolean(metadata.migration && metadata.migration.active && metadata.valid);
  return metadata;
}

function getTrainerPilotMetadata_() {
  return getTrainerPilotAuditMetadata_();
}

function validateTrainerPilotRuntimeMetadata_(metadata) {
  const errors = [];
  const expectedTopics = {
    "ui-wq-recht-at": ["Recht", 85],
    "ui-wq-recht-schuld": ["Recht", 174],
    "ui-wq-recht-sachen": ["Recht", 84],
    "ui-wq-recht-handel": ["Recht", 75],
    "ui-wq-recht-arbeit": ["Recht", 116],
    "ui-wq-recht-wettbewerb": ["Recht", 17],
    "ui-wq-recht-gewerbe": ["Recht", 16],
    "ui-wq-steuern-grundlagen": ["Steuern", 12],
    "ui-wq-steuern-unternehmen": ["Steuern", 205],
    "ui-wq-steuern-ao": ["Steuern", 16]
  };
  const topicByKey = {};
  (metadata.topics || []).forEach(function(item) {
    const key = String(item.UIThemenKey || "").trim();
    if (!key || topicByKey[key]) errors.push("topic_identity");
    if (key) topicByKey[key] = item;
  });
  if ((metadata.topics || []).length !== 10 || Object.keys(topicByKey).length !== 10) errors.push("topic_count");
  Object.keys(expectedTopics).forEach(function(key) {
    const item = topicByKey[key];
    if (!item || String(item.Quellfach || "").trim() !== expectedTopics[key][0] ||
        String(item.Teilbereich || "").trim() !== "WQ" ||
        String(item.Sichtbar || "").trim().toLowerCase() !== "ja" ||
        String(item.Status || "").trim().toUpperCase() !== "AKTIV") errors.push("topic_contract");
  });

  const detailByKey = {};
  (metadata.details || []).forEach(function(item) {
    const key = String(item.DetailKey || "").trim();
    const uiKey = String(item.UIThemenKey || "").trim();
    if (!key || detailByKey[key]) errors.push("detail_identity");
    if (key) detailByKey[key] = item;
    if (!topicByKey[uiKey] || String(item.Quellfach || "").trim() !== String(topicByKey[uiKey].Quellfach || "").trim() ||
        String(item.Teilbereich || "").trim() !== "WQ") errors.push("detail_parent");
  });
  if ((metadata.details || []).length !== 35 || Object.keys(detailByKey).length !== 35) errors.push("detail_count");

  const assignmentIds = {};
  const topicCounts = {};
  let rechtCount = 0;
  let steuernCount = 0;
  (metadata.assignments || []).forEach(function(item) {
    const id = String(item.TrainerID || "").trim();
    const detail = detailByKey[String(item.DetailKey || "").trim()];
    if (!id || assignmentIds[id]) errors.push("assignment_identity");
    if (id) assignmentIds[id] = true;
    if (!detail || String(item.Quellfach || "").trim() !== String(detail.Quellfach || "").trim() ||
        String(item.Teilbereich || "").trim() !== "WQ") {
      errors.push("assignment_parent");
      return;
    }
    const uiKey = String(detail.UIThemenKey || "").trim();
    topicCounts[uiKey] = (topicCounts[uiKey] || 0) + 1;
    if (String(item.Quellfach || "").trim() === "Recht") rechtCount++;
    if (String(item.Quellfach || "").trim() === "Steuern") steuernCount++;
  });
  if ((metadata.assignments || []).length !== 800 || Object.keys(assignmentIds).length !== 800 || rechtCount !== 567 || steuernCount !== 233) {
    errors.push("assignment_count");
  }
  Object.keys(expectedTopics).forEach(function(key) {
    if (topicCounts[key] !== expectedTopics[key][1]) errors.push("topic_pool_count");
  });

  return Array.from(new Set(errors));
}

function validateTrainerPilotMetadata_(metadata) {
  const errors = validateTrainerPilotRuntimeMetadata_(metadata);
  const assignmentIds = {};
  (metadata.assignments || []).forEach(function(item) {
    const id = String(item.TrainerID || "").trim();
    if (id) assignmentIds[id] = true;
  });

  const primaryById = {};
  let primaryCount = 0;
  let crossCount = 0;
  (metadata.references || []).forEach(function(item) {
    const id = String(item.TrainerID || "").trim();
    const type = String(item.Bezugsart || "").trim().toUpperCase();
    if (!assignmentIds[id]) errors.push("reference_assignment");
    if (type === "PRIMAER") {
      primaryCount++;
      if (primaryById[id]) errors.push("reference_primary_identity");
      primaryById[id] = true;
    } else if (type === "QUERVERWEIS") {
      crossCount++;
    } else {
      errors.push("reference_type");
    }
    if (id === "R-0566" && String(item.PunktKey || "").trim() === "3.1.1") errors.push("r0566_evidence");
  });
  if (primaryCount !== 800 || Object.keys(primaryById).length !== 800 || crossCount !== 57) errors.push("reference_count");

  const coverageKeys = {};
  (metadata.coverage || []).forEach(function(item) {
    const key = String(item.PunktKey || "").trim();
    if (!key || coverageKeys[key]) errors.push("coverage_identity");
    if (key) coverageKeys[key] = true;
  });
  if ((metadata.coverage || []).length !== 71 || Object.keys(coverageKeys).length !== 71 || !coverageKeys["3"]) errors.push("coverage_count");
  return Array.from(new Set(errors));
}

function getTrainerPilotActiveSource_(metadata, fach) {
  const safeFach = String(fach || "").trim();
  const activeQuestions = getActiveQuestions(safeFach);
  const activeById = {};
  activeQuestions.forEach(function(question) {
    const id = String(question.id || "").trim();
    if (id) activeById[id] = question;
  });
  const assignmentIds = (metadata.assignments || []).filter(function(item) {
    return String(item.Quellfach || "").trim() === safeFach;
  }).map(function(item) {
    return String(item.TrainerID || "").trim();
  });
  const valid = assignmentIds.length === activeQuestions.length &&
    new Set(assignmentIds).size === assignmentIds.length &&
    assignmentIds.every(function(id) { return Boolean(activeById[id]); });
  return {valid: valid, activeById: activeById, questions: activeQuestions};
}

const TRAINER_ROLLOUT_VERSION_ = "WIFA-TR-GESAMT-20260927-REV2-FREIGEGEBENE-GRENZFAELLE";
const TRAINER_ROLLOUT_CACHE_TTL_ = 21600;
const TRAINER_ROLLOUT_CONTRACTS_ = [
  {groupCode:"WQ-1", fachKey:"wq-volks-betriebswirtschaft", aliases:["Volks- und Betriebswirtschaft","VWL","BWL"], topicCount:4, detailCount:21, idCount:283},
  {groupCode:"WQ-2", fachKey:"wq-rechnungswesen", aliases:["Rechnungswesen"], topicCount:5, detailCount:17, idCount:122},
  {groupCode:"WQ-3", fachKey:"wq-recht-steuern", aliases:["Recht","Steuern"], topicCount:10, detailCount:35, idCount:800},
  {groupCode:"WQ-4", fachKey:"wq-unternehmensfuehrung", aliases:["Unternehmensführung"], topicCount:3, detailCount:15, idCount:235},
  {groupCode:"HQ-5", fachKey:"hq-betriebliches-management", aliases:["Betriebliches Management"], topicCount:4, detailCount:13, idCount:264},
  {groupCode:"HQ-6", fachKey:"hq-investition-finanzierung-controlling", aliases:["Investition, Finanzierung, betriebliches Rechnungswesen und Controlling","Investition und Finanzierung","Betriebliches Rechnungswesen und Controlling"], topicCount:5, detailCount:26, idCount:269},
  {groupCode:"HQ-7", fachKey:"hq-logistik", aliases:["Logistik"], topicCount:5, detailCount:23, idCount:317},
  {groupCode:"HQ-8", fachKey:"hq-marketing-vertrieb", aliases:["Marketing und Vertrieb","Marketing","Vertrieb"], topicCount:5, detailCount:22, idCount:191},
  {groupCode:"HQ-9", fachKey:"hq-fuehrung-zusammenarbeit", aliases:["Führung und Zusammenarbeit"], topicCount:7, detailCount:24, idCount:205}
];

function getTrainerRolloutContracts_() {
  return TRAINER_ROLLOUT_CONTRACTS_.map(function(item) { return Object.assign({}, item, {aliases:item.aliases.slice()}); });
}

function getTrainerRolloutContract_(fach) {
  const safe = String(fach || "").trim();
  return TRAINER_ROLLOUT_CONTRACTS_.find(function(item) {
    return item.groupCode !== "WQ-3" && item.aliases.includes(safe);
  }) || null;
}

function getTrainerRolloutMigration_(contract) {
  if (!contract) return null;
  const rows = getTableObjects_("Trainer_Migrationen").filter(function(item) {
    return String(item.Version || "").trim() === TRAINER_ROLLOUT_VERSION_ &&
      String(item.FachgruppeCode || "").trim() === contract.groupCode;
  });
  if (!rows.length) return null;
  const latest = rows[rows.length - 1];
  const status = String(latest.Laufstatus || "").trim().toUpperCase();
  return {migrationId:String(latest.MigrationID || "").trim(),status:status,active:status === "AKTIV"};
}

function indexTrainerRolloutMetadata_(metadata) {
  const topicByKey = {}, detailByKey = {}, assignmentById = {};
  (metadata.topics || []).forEach(function(x) { topicByKey[String(x.UIThemenKey || "").trim()] = x; });
  (metadata.details || []).forEach(function(x) { detailByKey[String(x.DetailKey || "").trim()] = x; });
  (metadata.assignments || []).forEach(function(x) {
    const id = String(x.TrainerID || "").trim(), detail = detailByKey[String(x.DetailKey || "").trim()] || {};
    if (id) assignmentById[id] = {assignment:x,detail:detail,uiThemenKey:String(detail.UIThemenKey || "").trim()};
  });
  metadata.topicByKey=topicByKey; metadata.detailByKey=detailByKey; metadata.assignmentById=assignmentById;
  return metadata;
}

function validateTrainerRolloutMetadata_(metadata, contract) {
  const errors=[], topicKeys={}, detailKeys={}, ids={}, topicCounts={};
  (metadata.topics || []).forEach(function(x){const k=String(x.UIThemenKey||"").trim();if(!k||topicKeys[k])errors.push("topic_identity");topicKeys[k]=true;if(String(x.Sichtbar||"").toLowerCase()!=="ja")errors.push("topic_visibility");});
  (metadata.details || []).forEach(function(x){const k=String(x.DetailKey||"").trim(),u=String(x.UIThemenKey||"").trim();if(!k||detailKeys[k])errors.push("detail_identity");detailKeys[k]=true;if(!topicKeys[u])errors.push("detail_parent");});
  (metadata.assignments || []).forEach(function(x){const id=String(x.TrainerID||"").trim(),d=metadata.detailByKey[String(x.DetailKey||"").trim()];if(!id||ids[id])errors.push("assignment_identity");ids[id]=true;if(!d)errors.push("assignment_parent");else{const u=String(d.UIThemenKey||"").trim();topicCounts[u]=(topicCounts[u]||0)+1;}});
  if(Object.keys(topicKeys).length!==contract.topicCount)errors.push("topic_count");
  if(Object.keys(detailKeys).length!==contract.detailCount)errors.push("detail_count");
  if(Object.keys(ids).length!==contract.idCount)errors.push("assignment_count");
  Object.keys(topicKeys).forEach(function(k){if(!topicCounts[k])errors.push("empty_topic");});
  return Array.from(new Set(errors));
}

function buildTrainerRolloutMetadata_(contract) {
  const topics=getTableObjects_("Trainer_Themen").filter(function(x){return String(x.Version||"").trim()===TRAINER_ROLLOUT_VERSION_&&String(x.FachgruppeCode||"").trim()===contract.groupCode;});
  const topicKeys=new Set(topics.map(function(x){return String(x.UIThemenKey||"").trim();}));
  const details=getTableObjects_("Trainer_Detailgruppen").filter(function(x){return String(x.Version||"").trim()===TRAINER_ROLLOUT_VERSION_&&topicKeys.has(String(x.UIThemenKey||"").trim());});
  const assignments=getTableObjects_("Trainer_Zuordnung").filter(function(x){return String(x.Version||"").trim()===TRAINER_ROLLOUT_VERSION_&&String(x.FachgruppeCode||"").trim()===contract.groupCode;});
  const metadata=indexTrainerRolloutMetadata_({topics:topics,details:details,assignments:assignments});
  metadata.validationErrors=validateTrainerRolloutMetadata_(metadata,contract);metadata.valid=metadata.validationErrors.length===0;return metadata;
}

function serializeTrainerRolloutMetadata_(metadata) {
  return JSON.stringify({
    version:TRAINER_ROLLOUT_VERSION_,
    topics:(metadata.topics||[]).map(function(x){return [x.UIThemenKey,x.Teilbereich,x.FachgruppeCode,x.Quellfach,x.Anzeigename,x.Sortierung,x.Sichtbar,x.Status];}),
    details:(metadata.details||[]).map(function(x){return [x.DetailKey,x.Teilbereich,x.Quellfach,x.UIThemenKey,x.RahmenplanPunktKey];}),
    assignments:(metadata.assignments||[]).map(function(x){return [x.TrainerID,x.Teilbereich,x.Quellfach,x.DetailKey,x.UIReihenfolge,x.QuellthemaAlt,x.FachgruppeCode,x.PrimaerPunktKey];})
  });
}

function hydrateTrainerRolloutMetadata_(raw) {
  const parsed=JSON.parse(raw);
  if(!parsed||parsed.version!==TRAINER_ROLLOUT_VERSION_||!Array.isArray(parsed.topics)||!Array.isArray(parsed.details)||!Array.isArray(parsed.assignments))return null;
  return indexTrainerRolloutMetadata_({
    topics:parsed.topics.map(function(r){return {UIThemenKey:r[0],Teilbereich:r[1],FachgruppeCode:r[2],Quellfach:r[3],Anzeigename:r[4],Sortierung:r[5],Sichtbar:r[6],Status:r[7]};}),
    details:parsed.details.map(function(r){return {DetailKey:r[0],Teilbereich:r[1],Quellfach:r[2],UIThemenKey:r[3],RahmenplanPunktKey:r[4]};}),
    assignments:parsed.assignments.map(function(r){return {TrainerID:r[0],Teilbereich:r[1],Quellfach:r[2],DetailKey:r[3],UIReihenfolge:r[4],QuellthemaAlt:r[5],FachgruppeCode:r[6],PrimaerPunktKey:r[7]};})
  });
}

function getTrainerRolloutMetadata_(contract) {
  const cache=trainerPilotRuntimeCache_(), key="trainer-rollout:"+TRAINER_ROLLOUT_VERSION_+":"+contract.groupCode;
  if(cache){try{const raw=cache.get(key);if(raw){const hydrated=hydrateTrainerRolloutMetadata_(raw);if(hydrated){hydrated.validationErrors=validateTrainerRolloutMetadata_(hydrated,contract);hydrated.valid=hydrated.validationErrors.length===0;if(hydrated.valid)return hydrated;}cache.remove(key);}}catch(error){try{cache.remove(key);}catch(ignore){}}}
  const metadata=buildTrainerRolloutMetadata_(contract);
  if(cache&&metadata.valid){try{const raw=serializeTrainerRolloutMetadata_(metadata);if(raw.length<90000)cache.put(key,raw,TRAINER_ROLLOUT_CACHE_TTL_);}catch(error){}}
  return metadata;
}

function getTrainerRolloutActiveSource_(metadata) {
  const activeById={};
  const sources=Array.from(new Set((metadata.assignments||[]).map(function(x){return String(x.Quellfach||"").trim();})));
  sources.forEach(function(source){getActiveQuestions(source).forEach(function(q){const id=String(q.id||"").trim();if(id)activeById[id]=q;});});
  const valid=(metadata.assignments||[]).every(function(x){return Boolean(activeById[String(x.TrainerID||"").trim()]);});
  return {valid:valid,activeById:activeById};
}

function getTrainerRolloutCatalog_(fach, contract, migration) {
  const metadata=getTrainerRolloutMetadata_(contract);
  if(!metadata.valid)return {active:false,version:"legacy",fach:fach,fachKey:contract.fachKey,fachgruppeCode:contract.groupCode,fallbackReason:"invalid_metadata",migrationStatus:migration.status,topics:[]};
  const source=getTrainerRolloutActiveSource_(metadata);
  if(!source.valid)return {active:false,version:"legacy",fach:fach,fachKey:contract.fachKey,fachgruppeCode:contract.groupCode,fallbackReason:"invalid_source",migrationStatus:migration.status,topics:[]};
  const topics=metadata.topics.slice().sort(function(a,b){return Number(a.Sortierung||0)-Number(b.Sortierung||0);}).map(function(x){const k=String(x.UIThemenKey||"").trim();return {uiThemenKey:k,thema:String(x.Anzeigename||"").trim(),anzahl:metadata.assignments.filter(function(a){return metadata.assignmentById[String(a.TrainerID||"").trim()].uiThemenKey===k;}).length,sortierung:Number(x.Sortierung||0),version:TRAINER_ROLLOUT_VERSION_};});
  return {active:true,version:TRAINER_ROLLOUT_VERSION_,fach:fach,fachKey:contract.fachKey,fachgruppeCode:contract.groupCode,migrationId:migration.migrationId,migrationStatus:migration.status,topics:topics};
}

function getTrainerRolloutQuestions_(fach, uiKey, contract, migration) {
  const metadata=getTrainerRolloutMetadata_(contract);if(!metadata.valid)return {active:false,version:"legacy",fach:fach,fachKey:contract.fachKey,fachgruppeCode:contract.groupCode,uiThemenKey:"",fallbackReason:"invalid_metadata",questions:[]};
  const source=getTrainerRolloutActiveSource_(metadata);if(!source.valid)return {active:false,version:"legacy",fach:fach,fachKey:contract.fachKey,fachgruppeCode:contract.groupCode,uiThemenKey:"",fallbackReason:"invalid_source",questions:[]};
  const topic=metadata.topicByKey[uiKey];if(!topic)return {active:true,version:TRAINER_ROLLOUT_VERSION_,fach:fach,fachKey:contract.fachKey,fachgruppeCode:contract.groupCode,uiThemenKey:uiKey,questions:[]};
  const questions=metadata.assignments.filter(function(x){const link=metadata.assignmentById[String(x.TrainerID||"").trim()];return link&&link.uiThemenKey===uiKey;}).sort(function(a,b){return Number(a.UIReihenfolge||0)-Number(b.UIReihenfolge||0);}).map(function(x,index,all){const id=String(x.TrainerID||"").trim(),link=metadata.assignmentById[id],q=source.activeById[id];return Object.assign({},q,{legacyThema:q.thema,quellfach:String(x.Quellfach||"").trim(),uiThemenKey:uiKey,uiThemenName:String(topic.Anzeigename||"").trim(),rahmenplanPunktKey:String(x.PrimaerPunktKey||link.detail.RahmenplanPunktKey||"").trim(),fragePosition:index+1,frageGesamt:all.length});});
  return {active:true,version:TRAINER_ROLLOUT_VERSION_,fach:fach,fachKey:contract.fachKey,fachgruppeCode:contract.groupCode,uiThemenKey:uiKey,thema:String(topic.Anzeigename||"").trim(),questions:questions};
}

function isTrainerPilotSubject_(fach) {
  return ["Recht", "Steuern"].includes(String(fach || "").trim());
}

function getTrainerCatalogFrontend(fach) {
  const safeFach = String(fach || "").trim();
  if (!isTrainerPilotSubject_(safeFach)) {
    const contract = getTrainerRolloutContract_(safeFach);
    const migration = getTrainerRolloutMigration_(contract);
    if (contract && migration && migration.active) return getTrainerRolloutCatalog_(safeFach, contract, migration);
    return {
      active: false,
      version: "legacy",
      fach: safeFach,
      fallbackReason: "",
      migrationStatus: "",
      topics: getTopicsForSheet(safeFach)
    };
  }
  const migration = getTrainerPilotMigration_();
  if (!migration) {
    return {active: false, version: "legacy", fach: safeFach, fallbackReason: "missing_migration", migrationStatus: "", topics: []};
  }
  const migrationStatus = String(migration.status || "").trim().toUpperCase();
  if (!migration.active) {
    const rolledBack = migrationStatus === "ZURUECKGEROLLT";
    return {
      active: false,
      version: "legacy",
      fach: safeFach,
      fallbackReason: rolledBack ? "" : "inactive_migration",
      migrationStatus: migrationStatus,
      topics: rolledBack ? getTopicsForSheet(safeFach) : []
    };
  }
  const metadata = getTrainerPilotRuntimeMetadata_();
  if (!metadata.valid) {
    return {active: false, version: "legacy", fach: safeFach, fallbackReason: "invalid_metadata", migrationStatus: migrationStatus, topics: []};
  }
  const source = getTrainerPilotActiveSource_(metadata, safeFach);
  if (!source.valid) {
    return {active: false, version: "legacy", fach: safeFach, fallbackReason: "invalid_source", migrationStatus: migrationStatus, topics: []};
  }
  const topics = metadata.topics.filter(function(item) {
    return String(item.Quellfach || "").trim() === safeFach &&
      String(item.Sichtbar || "").trim().toLowerCase() === "ja" &&
      String(item.Status || "").trim().toUpperCase() === "AKTIV";
  }).sort(function(first, second) {
    return Number(first.Sortierung || 0) - Number(second.Sortierung || 0);
  }).map(function(item) {
    const uiThemenKey = String(item.UIThemenKey || "").trim();
    const count = metadata.assignments.filter(function(assignment) {
      const detail = metadata.assignmentById[String(assignment.TrainerID || "").trim()];
      return String(assignment.Quellfach || "").trim() === safeFach && detail && detail.uiThemenKey === uiThemenKey;
    }).length;
    return {
      uiThemenKey: uiThemenKey,
      thema: String(item.Anzeigename || "").trim(),
      anzahl: count,
      sortierung: Number(item.Sortierung || 0),
      version: TRAINER_PILOT_VERSION_
    };
  });
  return {
    active: true,
    version: TRAINER_PILOT_VERSION_,
    migrationId: migration.migrationId,
    migrationStatus: migrationStatus,
    fach: safeFach,
    topics: topics
  };
}

function getTrainerQuestionsFrontend(fach, uiThemenKey) {
  const safeFach = String(fach || "").trim();
  const safeUiKey = String(uiThemenKey || "").trim();
  if (!isTrainerPilotSubject_(safeFach)) {
    const contract = getTrainerRolloutContract_(safeFach);
    const migration = getTrainerRolloutMigration_(contract);
    if (contract && migration && migration.active) return getTrainerRolloutQuestions_(safeFach, safeUiKey, contract, migration);
    return {active: false, version: "legacy", fach: safeFach, uiThemenKey: "", questions: []};
  }
  const migration = getTrainerPilotMigration_();
  if (!migration || !migration.active) {
    return {active: false, version: "legacy", fach: safeFach, uiThemenKey: "", questions: []};
  }
  const metadata = getTrainerPilotRuntimeMetadata_();
  if (!metadata.valid) {
    return {active: false, version: "legacy", fach: safeFach, uiThemenKey: "", fallbackReason: "invalid_metadata", questions: []};
  }
  const topic = metadata.topics.find(function(item) {
    return String(item.Quellfach || "").trim() === safeFach && String(item.UIThemenKey || "").trim() === safeUiKey;
  });
  if (safeUiKey && !topic) {
    return {active: true, version: TRAINER_PILOT_VERSION_, fach: safeFach, uiThemenKey: safeUiKey, questions: []};
  }
  const source = getTrainerPilotActiveSource_(metadata, safeFach);
  if (!source.valid) {
    return {active: false, version: "legacy", fach: safeFach, uiThemenKey: "", fallbackReason: "invalid_source", questions: []};
  }
  const activeById = source.activeById;
  const questions = metadata.assignments.filter(function(item) {
    const id = String(item.TrainerID || "").trim();
    const link = metadata.assignmentById[id];
    return String(item.Quellfach || "").trim() === safeFach && activeById[id] &&
      (!safeUiKey || (link && link.uiThemenKey === safeUiKey));
  }).sort(function(first, second) {
    return Number(first.UIReihenfolge || 0) - Number(second.UIReihenfolge || 0);
  }).map(function(item, index, all) {
    const id = String(item.TrainerID || "").trim();
    const link = metadata.assignmentById[id];
    const question = activeById[id];
    const uiTopic = metadata.topics.find(function(candidate) {
      return String(candidate.UIThemenKey || "").trim() === link.uiThemenKey;
    }) || {};
    return Object.assign({}, question, {
      legacyThema: question.thema,
      uiThemenKey: link.uiThemenKey,
      uiThemenName: String(uiTopic.Anzeigename || "").trim(),
      rahmenplanPunktKey: String(link.detail.RahmenplanPunktKey || "").trim(),
      fragePosition: index + 1,
      frageGesamt: all.length
    });
  });
  return {
    active: true,
    version: TRAINER_PILOT_VERSION_,
    fach: safeFach,
    uiThemenKey: safeUiKey,
    thema: String(topic && topic.Anzeigename || "").trim(),
    questions: questions
  };
}

function progressTimestampMillis_(value) {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTrainerCompatibleProgress_(nutzer, bereich, fach, auswahl) {
  const safeAuswahl = normalizeProgressSelection_(auswahl);
  const pilotSubject = isTrainerPilotSubject_(fach);
  const rolloutContract = pilotSubject ? null : getTrainerRolloutContract_(fach);
  const rolloutMigration = rolloutContract ? getTrainerRolloutMigration_(rolloutContract) : null;
  if (String(bereich || "").trim() !== "trainer" || (!pilotSubject && !(rolloutMigration && rolloutMigration.active))) {
    return getProgressForKey_(nutzer, bereich, fach, safeAuswahl);
  }
  if (pilotSubject) getTrainerPilotMigration_();
  const metadata = pilotSubject ? getTrainerPilotRuntimeMetadata_() : getTrainerRolloutMetadata_(rolloutContract);
  if (!metadata.assignments.length) return getProgressForKey_(nutzer, bereich, fach, safeAuswahl);
  const requestedUiKey = safeAuswahl.indexOf(TRAINER_PILOT_PROGRESS_PREFIX_) === 0
    ? safeAuswahl.slice(TRAINER_PILOT_PROGRESS_PREFIX_.length) : "";
  const sheet = ensureNutzerFortschrittSheet_();
  const values = sheet.getDataRange().getValues();
  const activeIds = pilotSubject
    ? new Set(getActiveQuestions(fach).map(function(question) { return String(question.id || "").trim(); }))
    : new Set(Object.keys(getTrainerRolloutActiveSource_(metadata).activeById));
  const allowedProgressSubjects = pilotSubject ? [String(fach || "").trim()] : rolloutContract.aliases;
  const candidates = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    if (String(row[0] || "").trim() !== String(nutzer || "").trim() ||
        String(row[1] || "").trim() !== String(bereich || "").trim() ||
        !allowedProgressSubjects.includes(String(row[2] || "").trim())) continue;
    const sourceSelection = String(row[3] || "").trim();
    const id = String(row[4] || "").trim();
    if (!activeIds.has(id)) continue;
    const link = metadata.assignmentById[id];
    if (!link || (pilotSubject && String(link.assignment.Quellfach || "").trim() !== String(fach || "").trim())) continue;
    const matches = requestedUiKey
      ? link.uiThemenKey === requestedUiKey
      : String(link.assignment.QuellthemaAlt || "").trim() === safeAuswahl;
    if (!matches) continue;
    candidates.push({
      nutzer: String(row[0] || "").trim(),
      bereich: String(row[1] || "").trim(),
      fach: String(row[2] || "").trim(),
      auswahl: safeAuswahl,
      aufgeloestAus: sourceSelection,
      letzteFrageId: id,
      aktualisiert: row[5]
    });
  }
  candidates.sort(function(first, second) {
    return progressTimestampMillis_(second.aktualisiert) - progressTimestampMillis_(first.aktualisiert);
  });
  return candidates[0] || getProgressForKey_(nutzer, bereich, fach, safeAuswahl);
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
    if (['topics','trainerCatalog','trainerQuestions','questionById','firstQuestion','nextQuestion','questionsForTopic','getKarteikarten','quizQuestion'].includes(action) &&
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

    } else if (action === "trainerCatalog") {
      const fach = String(e?.parameter?.fach || "").trim();
      result = {success: true, data: getTrainerCatalogFrontend(fach)};

    } else if (action === "trainerQuestions") {
      const fach = String(e?.parameter?.fach || "").trim();
      const uiThemenKey = String(e?.parameter?.uiThemenKey || "").trim();
      result = {success: true, data: getTrainerQuestionsFrontend(fach, uiThemenKey)};

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
      result = {success:true, data:getTrainerCompatibleProgress_(uid, body.bereich, body.fach, normalizeProgressSelection_(body.auswahl))};
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
- Ordne die Aufgabe zunächst intern ein: geschlossene Wissens-/Begriffsfrage, Nennen-/Aufzählungsaufgabe, offene Maßnahmen-/Lösungsfrage, Erklären-/Begründen-/Erläutern-Aufgabe, Berechnungsaufgabe oder mehrteilige/kombinierte Aufgabe. Gib diese Einordnung nicht aus.
- Bestimme den erwarteten fachlichen Inhalt gemeinsam aus Frage, Musterlösung, Kriterien und allgemeinem Fachwissen. Die Musterlösung ist eine Referenzlösung und die Stichpunkte sind Bewertungsanker, aber bei offenen Aufgaben keine abschließende Liste aller zulässigen Lösungen.
- Bei offenen Maßnahmen-/Lösungsfragen prüfe zuerst, ob die Antwort die konkrete Frage auf einem fachlich vertretbaren Weg beantwortet. Eine alternative fachlich richtige Maßnahme darf nicht allein deshalb abgelehnt werden, weil sie nicht in Musterlösung oder Stichpunkten steht.
- Bei geschlossenen Fragen gelten ausdrücklich verlangte Begriffe, gesetzliche Voraussetzungen, Werte, Rechenschritte oder Anzahlen weiterhin als verbindlich. Ein nur thematisch ähnlicher Inhalt ersetzt diese Anforderung nicht.
- Bei Erklärungs- und Begründungsfragen ist der fachlich richtige Zusammenhang entscheidend. Bei Berechnungen können Ansatz, Rechenweg und Ergebnis getrennte fachliche Leistungen sein; ein begrenzter Rechenfehler am Ende entwertet einen richtigen Ansatz nicht automatisch.
- Bewerte ausschließlich die Teilnehmerantwort.
- Musterlösung und Kriterien zählen NICHT als vom Teilnehmer genannt.
- Die Musterlösung und Beispiele dienen als fachliche Referenz. Die Musterlösung nicht als Checkliste und nicht als Wortlautvorlage verwenden. Bei offenen Aufgaben können auch andere fachlich korrekte Lösungen die Kriterien erfüllen. Verlange nicht, dass die Nutzerantwort ein Beispiel aus der Musterlösung wörtlich oder inhaltlich identisch übernimmt, sofern das Bewertungskriterium allgemein formuliert ist.
- Die konkrete Frage kann mehrere fachlich richtige Wege zulassen. Berücksichtige alternative fachlich richtige Wege auch dann, wenn sie nicht ausdrücklich in der Musterlösung oder im einzelnen Stichpunkt genannt sind; prüfe sie anhand der Frage und des fachlichen Zusammenhangs.
- Prüfe jedes Kriterium (K1...Kn) einzeln und unabhängig in der gesamten Teilnehmerantwort: Suche in der gesamten Antwort nach einer fachlich gleichwertigen Aussage und entscheide für jedes Kriterium eigenständig.
- Vermeide Doppelabzüge: Wenn mehrere Kriterien denselben oder eng überlappenden fachlichen Kern beschreiben, darf das Fehlen eines zusätzlichen Details nur das dafür zuständige Kriterium mindern. Bereits erfüllte Kriterien dürfen nicht nochmals indirekt wegen desselben fehlenden Details abgewertet werden.
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
    ? "\n\nVerbindliche Regeln für die aktuell sichtbare Traineraufgabe:\n" +
      "Beziehe Formulierungen wie 'hier', 'meine Antwort', 'diese Frage', 'warum 0 Punkte', 'warum falsch' oder 'was fehlt' immer auf genau diese Traineraufgabe. Frage bei vorhandenem Trainerkontext nicht erneut nach Frage, Thema oder Antwort.\n" +
      "Analysiere den konkreten Fragetext und die konkrete Nutzerantwort fachlich. Vergleiche die Nutzerantwort mit Musterlösung und Bewertungskriterien. Benenne ausdrücklich, welche Teile der Nutzerantwort richtig oder als relevanter Ansatz erkennbar sind, was fehlt oder fachlich ungenau ist und wie die angezeigte Bewertung zustande gekommen sein könnte. Behandle die gespeicherte Punktzahl nicht als automatisch fachlich richtig: Wenn die Bewertung anhand des vorliegenden Kontexts möglicherweise zu streng oder fachlich fragwürdig ist, sage das klar. Antworte konkret auf die vorliegende Aufgabe und nicht allgemein über mögliche Bewertungsgründe.\n\n" +
      "Kontext der aktuell sichtbaren Traineraufgabe (verbindlich berücksichtigen):\n" +
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
