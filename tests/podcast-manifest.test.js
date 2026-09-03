const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sha256Lerntext, podcastPaths } = require('../tools/podcast-sync/hash-paths.js');
const { tokenizeVisibleWords } = require('../tools/podcast-sync/normalize-lerntext.js');
const { buildPodcastManifest, writePodcastManifest } = require('../tools/podcast-sync/build-manifest.js');

let testCount = 0;
let passedCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passedCount++;
    console.log('PASS ' + name);
  } catch (error) {
    console.log('FAIL ' + name);
    console.log('  ' + error.message);
    process.exitCode = 1;
  }
}

const fach = 'Recht';
const titel = 'Rechtssubjekte und Rechtsobjekte';
const lerntext = 'Rechtssubjekte und Rechtsobjekte';
const lerntextHash = sha256Lerntext(lerntext);
const updatedAt = '2026-09-03T08:00:00.000Z';
const validMarks = [
  { wortIndex: 0, wort: 'Rechtssubjekte', start: 0, end: 0.8 },
  { wortIndex: 1, wort: 'und', start: 0.8, end: 1.1 },
  { wortIndex: 2, wort: 'Rechtsobjekte', start: 1.1, end: 2.2 }
];

function validInput(overrides) {
  return Object.assign({ fach, titel, lerntext, lerntextHash, wortZeitmarken: validMarks, updatedAt }, overrides);
}

function assertBuildFails(overrides, message) {
  assert.throws(function() {
    buildPodcastManifest(validInput(overrides));
  }, undefined, message);
}

test('gültiges Manifest enthält alle erwarteten Daten', function() {
  const manifest = buildPodcastManifest(validInput());
  assert.strictEqual(manifest.fach, fach);
  assert.strictEqual(manifest.titel, titel);
  assert.strictEqual(manifest.lerntextHash, lerntextHash);
  assert.deepStrictEqual(manifest, Object.assign({}, manifest, {
    mp3Path: podcastPaths(fach, titel).mp3Path,
    jsonPath: podcastPaths(fach, titel).jsonPath
  }));
  assert.strictEqual(manifest.mp3Path, 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3');
  assert.strictEqual(manifest.jsonPath, 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json');
  assert.strictEqual(manifest.updatedAt, updatedAt);
  assert.deepStrictEqual(manifest.wortZeitmarken, validMarks);
});

test('podcastText wird nicht benötigt', function() {
  const manifest = buildPodcastManifest(validInput());
  assert.strictEqual(manifest.podcastText, undefined);
});

test('falscher lerntextHash wird blockiert', function() {
  assertBuildFails({ lerntextHash: '0'.repeat(64) }, 'falscher Hash');
});

test('zu wenige oder zu viele Zeitmarken werden blockiert', function() {
  assertBuildFails({ wortZeitmarken: validMarks.slice(0, 2) }, 'zu wenige Zeitmarken');
  assertBuildFails({ wortZeitmarken: validMarks.concat({ wortIndex: 3, wort: 'extra', start: 2.2, end: 3 }) }, 'zu viele Zeitmarken');
});

test('Wortindizes müssen lückenlos und in Reihenfolge sein', function() {
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark, index) { return Object.assign({}, mark, { wortIndex: index === 2 ? 3 : mark.wortIndex }); }) }, 'Indexlücke');
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark, index) { return Object.assign({}, mark, { wortIndex: index === 2 ? 1 : mark.wortIndex }); }) }, 'doppelter Index');
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return Object.assign({}, mark, { wortIndex: mark.wortIndex + 1 }); }) }, 'falscher Startindex');
});

test('kanonische Wörter müssen exakt übereinstimmen', function() {
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return Object.assign({}, mark); }).map(function(mark) { return mark.wortIndex === 1 ? Object.assign(mark, { wort: 'Rechtsobjekt' }) : mark; }) }, 'falsches Wort');
});

test('Timestamp-Typen und Werte werden validiert', function() {
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return mark.wortIndex === 0 ? Object.assign({}, mark, { start: '0' }) : mark; }) }, 'start String');
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return mark.wortIndex === 0 ? Object.assign({}, mark, { end: '0.8' }) : mark; }) }, 'end String');
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return mark.wortIndex === 0 ? Object.assign({}, mark, { start: NaN }) : mark; }) }, 'NaN');
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return mark.wortIndex === 0 ? Object.assign({}, mark, { end: Infinity }) : mark; }) }, 'Infinity');
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return mark.wortIndex === 0 ? Object.assign({}, mark, { end: -1 }) : mark; }) }, 'end vor start');
});

test('Zeitverlauf darf nicht rückwärts laufen', function() {
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return mark.wortIndex === 2 ? Object.assign({}, mark, { start: 0.7 }) : mark; }) }, 'rückwärts laufender Start');
  assertBuildFails({ wortZeitmarken: validMarks.map(function(mark) { return mark.wortIndex === 1 ? Object.assign({}, mark, { end: 0.7 }) : mark; }) }, 'rückwärts laufendes Ende');
});

test('updatedAt muss ein nichtleeres gültiges ISO-Datum sein', function() {
  assert.strictEqual(buildPodcastManifest(validInput()).updatedAt, updatedAt);
  assertBuildFails({ updatedAt: '' }, 'leeres updatedAt');
  assertBuildFails({ updatedAt: 'kein Datum' }, 'ungültiges updatedAt');
});

test('Input-Zeitmarken werden nicht mutiert', function() {
  const input = JSON.parse(JSON.stringify(validMarks));
  buildPodcastManifest(validInput({ wortZeitmarken: input }));
  assert.deepStrictEqual(input, validMarks);
});

test('writePodcastManifest schreibt parsebares UTF-8 JSON', function() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-manifest-'));
  try {
    const outputPath = path.join(temporaryDirectory, 'nested', 'manifest.json');
    const manifest = buildPodcastManifest(validInput());
    const result = writePodcastManifest({ outputPath, manifest });
    assert.strictEqual(result, outputPath);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), manifest);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

console.log('\n' + passedCount + '/' + testCount + ' tests passed');
