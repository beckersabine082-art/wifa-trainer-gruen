const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');
const context = {
  console,
  Utilities: { formatDate: () => '' },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '' }) },
  SpreadsheetApp: { getUi: () => ({ alert: () => {} }) },
  ContentService: { createTextOutput: () => ({ setMimeType: () => ({}) }), MimeType: { JSON: 'application/json' } },
  Session: { getScriptTimeZone: () => 'UTC' },
  HtmlService: { createHtmlOutputFromFile: () => ({ setTitle: () => ({}) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-key' }) },
  OPENAI_API_KEY: 'test-key',
  getSpreadsheet_: () => ({ getSheets: () => [], getSheetByName: () => null, insertSheet: () => ({ appendRow: () => {}, getDataRange: () => ({ getValues: () => [] }), getRange: () => ({ getValues: () => [], setValue: () => ({ setBackground: () => ({}) }), clearContent: () => ({ setBackground: () => ({}) }), setBackground: () => ({}) }) }) }),
  getSheetByNameSafe_: () => ({ getLastRow: () => 0, getRange: () => ({ getValues: () => [] }) }),
  getSheet_: () => ({ getActiveCell: () => ({ getRow: () => 3, getColumn: () => 0 }), getRange: () => ({ getValue: () => '', setValue: () => ({ setBackground: () => ({}) }), clearContent: () => ({ setBackground: () => ({}) }), setBackground: () => ({}) }) }),
  JSON,
  Date,
  Math,
  RegExp,
  Array,
  String,
  Object,
  Number,
  Boolean,
  Set,
  Map,
  Error
};

vm.createContext(context);
vm.runInContext(source, context);

test('unsicherheitsformulierungen dürfen keine fachlich richtige Antwort automatisch als unbrauchbar markieren', () => {
  assert.equal(
    context.istKeineVerwertbareAntwort_("Ich glaube, die Mitarbeiter sollten frühzeitig informiert und beteiligt werden."),
    false
  );
});

test('keine Ahnung bleibt als echte Nichtantwort nach wie vor unbrauchbar', () => {
  assert.equal(context.istKeineVerwertbareAntwort_("keine Ahnung"), true);
});

test('Kriterien-IDs aus der KI-Auswertung werden stabil gemappt und nicht erneut per Stringvergleich verworfen', () => {
  const result = context.parseKriterienErgebnis_(
    '{"erfuellt":["K1","K3","K4"],"nicht_erfuellt":["K2"]}',
    ['K1', 'K2', 'K3', 'K4', 'K5']
  );

  assert.equal(JSON.stringify(Array.from(result.erkannteIds)), JSON.stringify(['K1', 'K3', 'K4']));
  assert.equal(JSON.stringify(Array.from(result.fehlendeIds)), JSON.stringify(['K2', 'K5']));
  assert.equal(JSON.stringify(Array.from(result.erkannte)), JSON.stringify(['K1', 'K3', 'K4']));
  assert.equal(JSON.stringify(Array.from(result.fehlende)), JSON.stringify(['K2', 'K5']));
});

test('drei von fünf Kriterien bleiben als 3/5 Punkte nachvollziehbar', () => {
  const result = context.parseKriterienErgebnis_(
    '{"erfuellt":["K1","K3","K5"],"nicht_erfuellt":["K2","K4"]}',
    ['K1', 'K2', 'K3', 'K4', 'K5']
  );

  assert.equal(result.erkannte.length, 3);
  assert.equal(result.fehlende.length, 2);
  assert.equal(result.erkannteIds.length, 3);
});

test('Test 1 – nahezu wortgleich liefert Treffer', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":["K1"],"nicht_erfuellt":[]}', ['K1', 'K2', 'K3', 'K4', 'K5']);
  assert.equal(result.erkannteIds.length, 1);
  assert.equal(result.erkannteIds[0], 'K1');
});

test('Test 2 – Synonym wird als Treffer akzeptiert', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":["K2"],"nicht_erfuellt":[]}', ['K1', 'K2', 'K3', 'K4', 'K5']);
  assert.equal(result.erkannteIds.includes('K2'), true);
});

test('Test 3 – fachliche Umschreibung wird als Treffer akzeptiert', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":["K3"],"nicht_erfuellt":[]}', ['K1', 'K2', 'K3', 'K4', 'K5']);
  assert.equal(result.erkannteIds.includes('K3'), true);
});

test('Test 4 – 3 von 5 Kriterien ergeben Teilpunktzahl', () => {
  assert.equal(context.berechnePunkteAusKriterien_(3, 5, 5), 3);
});

test('Test 5 – Keyword ohne richtigen Zusammenhang bleibt ohne Treffer', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":[],"nicht_erfuellt":["K1","K2","K3","K4","K5"]}', ['K1', 'K2', 'K3', 'K4', 'K5']);
  assert.equal(result.erkannteIds.length, 0);
});

test('Test 6 – fachliches Gegenteil / Negation bleibt ohne Treffer', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":[],"nicht_erfuellt":["K1"]}', ['K1', 'K2', 'K3', 'K4', 'K5']);
  assert.equal(result.erkannteIds.includes('K1'), false);
});

test('Test 7 – Unsicherheitsformulierung blockiert keinen fachlichen Inhalt', () => {
  assert.equal(context.istKeineVerwertbareAntwort_('Ich glaube, die Mitarbeiter sollten von Anfang an beteiligt werden.'), false);
});

test('Test 8 – echte Nichtantwort bleibt 0 Punkte', () => {
  assert.equal(context.istKeineVerwertbareAntwort_('keine Ahnung'), true);
});

test('Test 9 – leere Antwort bleibt 0 Punkte', () => {
  assert.equal(context.istKeineVerwertbareAntwort_('   '), true);
});

test('Test 10 – vollständige Antwort in eigenen Worten bleibt vollwertig', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":["K1","K2","K3","K4","K5"],"nicht_erfuellt":[]}', ['K1', 'K2', 'K3', 'K4', 'K5']);
  assert.equal(result.erkannteIds.length, 5);
});

test('unbekannte Kriterien-ID wird ignoriert', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":["K99"],"nicht_erfuellt":[]}', ['K1', 'K2']);
  assert.equal(result.erkannteIds.length, 0);
});

test('doppelte Kriterien-ID wird nur einmal gezählt', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":["K1","K1","K2"],"nicht_erfuellt":[]}', ['K1', 'K2']);
  assert.equal(JSON.stringify(Array.from(result.erkannteIds)), JSON.stringify(['K1', 'K2']));
});

test('Konflikt zwischen erfüllt und nicht erfüllt wird eindeutig aufgelöst', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":["K1","K2"],"nicht_erfuellt":["K2","K3"]}', ['K1', 'K2', 'K3']);
  assert.equal(result.erkannteIds.includes('K2'), false);
  assert.equal(result.fehlendeIds.includes('K2'), true);
});

test('Kriterienanzahl kleiner als maxPunkte skaliert sauber', () => {
  assert.equal(context.berechnePunkteAusKriterien_(2, 4, 6), 3);
});

test('Kriterienanzahl größer/anders als maxPunkte skaliert sauber und bleibt im Limit', () => {
  assert.equal(context.berechnePunkteAusKriterien_(3, 5, 10), 6);
  assert.equal(context.berechnePunkteAusKriterien_(5, 5, 10), 10);
});

test('ungültige KI-Antwort wird kontrolliert behandelt', () => {
  const result = context.parseKriterienErgebnis_('gar nichts brauchbares', ['K1', 'K2']);
  assert.equal(result.erkannteIds.length, 0);
  assert.equal(result.fehlendeIds.length, 2);
});

test('keine Stichpunkte vorhanden bleibt ohne Bewertung', () => {
  const result = context.parseKriterienErgebnis_('{"erfuellt":["K1"],"nicht_erfuellt":[]}', []);
  assert.equal(result.erkannteIds.length, 0);
  assert.equal(result.fehlendeIds.length, 0);
});

test('maxPunkte leer oder ungültig gibt 0', () => {
  assert.equal(context.berechnePunkteAusKriterien_(2, 4, 0), 0);
});

test('Bewertungsprompt enthält die Regel für generische Kriterien und alternative Beispiele', () => {
  let capturedPayload = null;
  context.UrlFetchApp.fetch = (url, options) => {
    capturedPayload = JSON.parse(options.payload);
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ choices: [{ message: { content: '{"erfuellt":["K1","K2","K3","K4"],"nicht_erfuellt":[]}' } }] })
    };
  };

  context.getQuestionById = () => ({
    id: 'UF-0005',
    row: 3,
    thema: 'Unternehmensführung',
    frage: 'Die Circle Harbor GmbH plant die Expansion in weitere EU-Staaten...',
    musterloesung: 'Beispiel 1: Umweltschutz...',
    stichpunkte: 'Unternehmensziel 1 fachlich plausibel;Zielkonflikt 1 zur Expansion nachvollziehbar erläutert;Unternehmensziel 2 fachlich plausibel;Zielkonflikt 2 zur Expansion nachvollziehbar erläutert',
    fragetyp: 'text'
  });

  context.bewerteAntwortFrontend({
    fach: 'Unternehmensführung',
    frageId: 'UF-0005',
    antwort: 'Das Ziel, die Region zu stärken...',
    speichereInSheet: false
  });

  assert.ok(capturedPayload, 'UrlFetchApp.fetch wurde aufgerufen');
  const promptText = capturedPayload.messages[0].content;
  assert.ok(
    promptText.includes('Musterlösung und Beispiele dienen als fachliche Referenz'),
    'Prompt muss Regel zur Musterlösung als Referenz enthalten'
  );
  assert.ok(
    promptText.includes('Verlange nicht, dass die Nutzerantwort ein Beispiel aus der Musterlösung wörtlich oder inhaltlich identisch übernimmt'),
    'Prompt muss regeln, dass alternative fachlich korrekte Beispiele zulässig sind'
  );
});
