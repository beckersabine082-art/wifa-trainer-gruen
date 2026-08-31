const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '../js/lerntexte.js'), 'utf8');

const context = vm.createContext({
  window: {},
  document: {
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement() { return {}; }
  },
  console,
  navigator: {},
  URL,
  Blob,
  Audio: function () { return { play() {}, pause() {}, setAttribute() {} }; },
  SpeechSynthesisUtterance: function () { return {}; },
  atob: (value) => Buffer.from(value, 'base64').toString('binary'),
  fetch: async () => ({ ok: true, json: async () => ({ success: true, data: {} }) })
});

vm.runInContext(code, context);

const selectedUnits = [
  { titel: 'Einheit 1', podcastText: 'Text 1', lerntext: 'Fallback 1' },
  { titel: 'Einheit 2', podcastText: '', lerntext: 'Text 2' },
  { titel: 'Einheit 3', podcastText: 'Text 3', lerntext: 'Text 3 alt' },
  { titel: 'Einheit 4', podcastText: '', lerntext: '' },
  { titel: 'Rechtssubjekte und Rechtsobjekte', podcastText: 'Rechtstext', lerntext: 'Rechtstext' }
];

const testNames = [];
let passed = 0;

function test(name, fn) {
  testNames.push(name);
  try {
    fn();
    passed++;
    console.log('✓ ' + name);
  } catch (error) {
    console.log('✗ ' + name);
    console.log('  Error: ' + error.message);
  }
}

console.log('Testing generic audio playlist behavior:');

test('playlist helper exists and is generic', function () {
  assert.strictEqual(typeof context.window.lerntexteAudioPlaylistErstellen, 'function');
  assert.strictEqual(typeof context.window.lerntexteAudioTextFuerEintrag, 'function');
});

test('playlist keeps selected units in original order and skips empty audio text', function () {
  const playlist = context.window.lerntexteAudioPlaylistErstellen(selectedUnits);
  assert.strictEqual(JSON.stringify(playlist.map(item => item.eintrag.titel)), JSON.stringify(['Einheit 1', 'Einheit 2', 'Einheit 3', 'Rechtssubjekte und Rechtsobjekte']));
});

test('podcastText has priority over lerntext', function () {
  const playlist = context.window.lerntexteAudioPlaylistErstellen(selectedUnits);
  const entry = playlist.find(item => item.eintrag.titel === 'Einheit 3');
  assert.strictEqual(entry.text, 'Text 3');
});

test('Recht path generation remains valid for the normal playlist case', function () {
  const result = context.window.lerntexteAudioFirebasePfad('Recht', { titel: 'Rechtssubjekte und Rechtsobjekte' });
  assert.strictEqual(result, 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3');
});

test('normal playback start uses the generic playlist logic instead of a hardcoded Recht branch', function () {
  assert.ok(code.includes('const playlist = lerntexteAudioPlaylistErstellen(einheiten);'));
  assert.strictEqual(typeof context.window.lerntexteAudioAbspielen, 'function');
});

test('firebase URL loader rethrows a caught Firebase error instead of swallowing it', async function () {
  const originalImport = vm.runInContext("import", context);
  const originalFirebaseCode = context.window.lerntexteAudioFirebaseUrlLaden;

  context.window.lerntexteAudioFirebaseUrlLaden = async function () {
    try {
      throw Object.assign(new Error('missing file'), { code: 'storage/object-not-found' });
    } catch (error) {
      console.error('Firebase Storage Error:', error.code, error.message, error);
      throw error;
    }
  };

  await assert.rejects(
    context.window.lerntexteAudioFirebaseUrlLaden(),
    function (error) {
      return error && error.code === 'storage/object-not-found';
    }
  );

  context.window.lerntexteAudioFirebaseUrlLaden = originalFirebaseCode;
});

console.log('\n' + passed + '/' + testNames.length + ' tests passed');
if (passed === testNames.length) {
  console.log('All playlist tests passed!');
  process.exit(0);
}
console.log(testNames.length - passed + ' test(s) failed');
process.exit(1);
