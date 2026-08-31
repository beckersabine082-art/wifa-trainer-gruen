const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Read the lerntexte.js file
const lerntexteCode = fs.readFileSync(path.join(__dirname, '../js/lerntexte.js'), 'utf8');

// Create a context with minimal window object
const context = vm.createContext({
  window: {},
  console: console,
  document: {
    getElementById: function() { return null; }
  }
});

// Run the lerntexte.js code in the VM
vm.runInContext(lerntexteCode, context);

// Extract functions from context
const lerntexteAudioSlug = context.window.lerntexteAudioSlug;
const lerntexteAudioFirebasePfad = context.window.lerntexteAudioFirebasePfad;

// Test counter
let testCount = 0;
let passedCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passedCount++;
    console.log('✓ ' + name);
  } catch (error) {
    console.log('✗ ' + name);
    console.log('  Error: ' + error.message);
  }
}

// Tests for lerntexteAudioSlug
console.log('\nTesting lerntexteAudioSlug:');
test('lerntexteAudioSlug should exist', function() {
  assert.strictEqual(typeof lerntexteAudioSlug, 'function');
});

test('should convert "Recht" to "recht"', function() {
  assert.strictEqual(lerntexteAudioSlug('Recht'), 'recht');
});

test('should convert "Marketing" to "marketing"', function() {
  assert.strictEqual(lerntexteAudioSlug('Marketing'), 'marketing');
});

test('should convert ä to ae', function() {
  assert.strictEqual(lerntexteAudioSlug('Äpfel'), 'aepfel');
});

test('should convert ö to oe', function() {
  assert.strictEqual(lerntexteAudioSlug('Öl'), 'oel');
});

test('should convert ü to ue', function() {
  assert.strictEqual(lerntexteAudioSlug('Überblick'), 'ueberblick');
});

test('should convert ß to ss', function() {
  assert.strictEqual(lerntexteAudioSlug('Größe'), 'groesse');
});

test('should replace spaces with hyphens', function() {
  assert.strictEqual(lerntexteAudioSlug('Rechtssubjekte und Rechtsobjekte'), 'rechtssubjekte-und-rechtsobjekte');
});

test('should handle hyphens', function() {
  assert.strictEqual(lerntexteAudioSlug('Hello-World'), 'hello-world');
});

test('should remove special characters', function() {
  assert.strictEqual(lerntexteAudioSlug('Test & Special'), 'test-special');
});

test('should consolidate double hyphens', function() {
  assert.strictEqual(lerntexteAudioSlug('Test  --  Value'), 'test-value');
});

test('should remove hyphens from start and end', function() {
  assert.strictEqual(lerntexteAudioSlug('-test-'), 'test');
});

test('should trim whitespace', function() {
  assert.strictEqual(lerntexteAudioSlug('  test  '), 'test');
});

test('should handle complex case with umlauts and spaces', function() {
  assert.strictEqual(lerntexteAudioSlug('Übergeordnete Themen & Inhalte'), 'uebergeordnete-themen-inhalte');
});

// Tests for lerntexteAudioFirebasePfad
console.log('\nTesting lerntexteAudioFirebasePfad:');
test('lerntexteAudioFirebasePfad should exist', function() {
  assert.strictEqual(typeof lerntexteAudioFirebasePfad, 'function');
});

test('should generate correct path for Recht subject', function() {
  const eintrag = { titel: 'Rechtssubjekte und Rechtsobjekte' };
  const result = lerntexteAudioFirebasePfad('Recht', eintrag);
  assert.strictEqual(result, 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3');
});

test('should handle umlauts in subject', function() {
  const eintrag = { titel: 'Überblick' };
  const result = lerntexteAudioFirebasePfad('Bücher', eintrag);
  assert.strictEqual(result, 'podcast/buecher-ueberblick.mp3');
});

test('should generate format podcast/fach-titel.mp3', function() {
  const eintrag = { titel: 'Test Title' };
  const result = lerntexteAudioFirebasePfad('Test Fach', eintrag);
  assert.match(result, /^podcast\/[a-z0-9\-]+\.mp3$/);
});

// Summary
console.log('\n' + passedCount + '/' + testCount + ' tests passed');
if (passedCount === testCount) {
  console.log('All tests passed!');
  process.exit(0);
} else {
  console.log(testCount - passedCount + ' test(s) failed');
  process.exit(1);
}
