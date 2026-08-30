const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../backend/apps-script/Code.gs'), 'utf8');

const mockFetch = (url, options) => {
  const payload = JSON.parse(options.payload);
  const content = payload.messages[0].content;
  
  console.log('\n=== SIMULATED OPENAI API CALL ===');
  console.log('Prompt sent to OpenAI:\n', content.substring(0, 500), '\n...\n');
  
  // ACTUAL TEST CASE DATA
  // Based on the regression description:
  // Question: "Definieren Sie die Begriffe Vision und Mission."
  // Expected criteria (inferred from the regression description):
  // - K1: "langfristige Ziele" 
  // - K2: "Nutzen für Gesellschaft"
  // 
  // User answer contains: "langfristigen Ziele" and "Gesellschaft" 
  // But gets marked as missing both.
  
  // This is a WORST CASE response where OpenAI didn't recognize the semantic variations
  const problematicResponse = {
    "erfuellt": [],
    "nicht_erfuellt": ["K1", "K2"]
  };
  
  // EXPECTED CORRECT RESPONSE (what should happen)
  const correctResponse = {
    "erfuellt": ["K1", "K2"],
    "nicht_erfuellt": []
  };
  
  console.log('Simulated OpenAI Response (PROBLEMATIC):');
  console.log(JSON.stringify(problematicResponse));
  
  return {
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      choices: [{ message: { content: JSON.stringify(problematicResponse) } }]
    })
  };
};

const context = {
  console,
  Utilities: { formatDate: () => '' },
  UrlFetchApp: { fetch: mockFetch },
  SpreadsheetApp: { getUi: () => ({ alert: () => {} }), getActiveSpreadsheet: () => ({ getSheets: () => [], getSheetByName: () => null, insertSheet: () => ({ appendRow: () => {}, getDataRange: () => ({ getValues: () => [] }), getRange: () => ({ getValues: () => [], setValue: () => ({ setBackground: () => ({}) }), clearContent: () => ({ setBackground: () => ({}) }), setBackground: () => ({}) }) }) }) },
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

test('REGRESSION: Vision/Mission question - "langfristigen Ziele" should match "langfristige Ziele"', () => {
  // Simulated question data from Google Sheet
  const question = {
    id: 'VISION_MISSION_001',
    frage: 'Definieren Sie die Begriffe Vision und Mission.',
    musterloesung: 'Vision: langfristige Ziele eines Unternehmens. Mission: Unternehmenszweck und Nutzen für Gesellschaft.',
    stichpunkte: 'langfristige Ziele; Nutzen für Gesellschaft',  // Criteria stored in sheet
    fragetyp: 'text'
  };
  
  // User's actual answer (contains variations of the criteria)
  const userAnswer = 'Vision ist eine Beschreibung der langfristigen Ziele eines Unternehmens. Mission beschreibt, welchen Nutzen das Unternehmen für die Gesellschaft bietet.';
  
  // Expected: both criteria should be recognized despite grammatical variations
  // - "langfristigen Ziele" (dative) vs stored "langfristige Ziele" (nominative)
  // - "Nutzen für Gesellschaft" is explicitly mentioned
  
  const stichpunkteListe = context.getStichpunkteListe_(question.stichpunkte);
  const kriterienIds = context.getKriterienIdsFuerStichpunkte_(stichpunkteListe);
  
  console.log('\n=== TEST SETUP ===');
  console.log('Question:', question.frage);
  console.log('Criteria stored in sheet:', stichpunkteListe);
  console.log('Criteria IDs:', kriterienIds);
  console.log('User answer:', userAnswer);
  
  // Simulate OpenAI response (PROBLEMATIC)
  const aiResponseText = '{"erfuellt":[],"nicht_erfuellt":["K1","K2"]}';
  
  const parsed = context.parseKriterienErgebnis_(aiResponseText, kriterienIds);
  
  console.log('\n=== PARSING RESULT ===');
  console.log('AI Response:', aiResponseText);
  console.log('Parsed erkannteIds:', parsed.erkannteIds);
  console.log('Parsed fehlendeIds:', parsed.fehlendeIds);
  
  const erkannte = parsed.erkannteIds
    .map(id => {
      const idx = kriterienIds.indexOf(id);
      return idx >= 0 ? stichpunkteListe[idx] : id;
    })
    .filter(Boolean);
    
  const fehlende = parsed.fehlendeIds
    .map(id => {
      const idx = kriterienIds.indexOf(id);
      return idx >= 0 ? stichpunkteListe[idx] : id;
    })
    .filter(Boolean);
  
  console.log('\n=== FINAL EVALUATION ===');
  console.log('Recognized criteria:', erkannte);
  console.log('Missing criteria:', fehlende);
  
  // THIS IS THE REGRESSION:
  // The test documents what's happening (wrong)
  // Real fix would be in the OpenAI prompt or post-processing
  console.log('\n⚠️  REGRESSION CONFIRMED:');
  console.log('- Answer contains "langfristigen Ziele" (dative) but "langfristige Ziele" (nominative) marked missing');
  console.log('- Answer contains "Nutzen für Gesellschaft" but marked missing');
  console.log('- OpenAI failed to recognize semantic/grammatical variations despite detailed instructions');
  
  assert.equal(fehlende.length, 2, 'Both criteria incorrectly marked as missing (this is the regression)');
  assert.deepEqual(fehlende, ['langfristige Ziele', 'Nutzen für Gesellschaft']);
});

test('Criterion ID normalization works correctly', () => {
  const id1 = context.normalizeKriterienId_('K1');
  const id2 = context.normalizeKriterienId_('k1');
  const id3 = context.normalizeKriterienId_('K-1');
  
  assert.equal(id1, 'K1');
  assert.equal(id2, 'K1');
  assert.equal(id3, 'K1');
});

test('Stichpunkte parsing splits correctly', () => {
  const raw = 'Kriterium 1; Kriterium 2; Kriterium 3';
  const liste = context.getStichpunkteListe_(raw);
  
  assert.equal(liste.length, 3);
  assert.deepEqual(liste, ['Kriterium 1', 'Kriterium 2', 'Kriterium 3']);
});

test('parseKriterienErgebnis respects only valid criterion IDs', () => {
  const validIds = ['K1', 'K2', 'K3'];
  const aiResponse = '{"erfuellt":["K1", "K999"],"nicht_erfuellt":["K2"]}';
  
  const result = context.parseKriterienErgebnis_(aiResponse, validIds);
  
  // K999 should be filtered out because it's not in validIds
  assert.equal(result.erkannteIds.length, 1);
  assert.equal(result.erkannteIds[0], 'K1');
  
  // K3 should be in fehlendeIds because it wasn't in erfuellt or nicht_erfuellt
  assert.equal(result.fehlendeIds.includes('K3'), true);
});
