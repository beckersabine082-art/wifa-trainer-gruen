const assert = require('assert');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const buttonId = 'id="lerntexteAudioTestBtn"';

try {
  assert.ok(!html.includes(buttonId), 'Index.html still contains the visible test-audio button.');
  assert.ok(html.includes('id="lerntexteAudioPlayBtn"'), 'Normaler Wiedergabe-Button fehlt.');
  assert.ok(html.includes('id="lerntexteAudioPreviousBtn"'), 'Button für vorheriges Kapitel fehlt.');
  assert.ok(html.includes('id="lerntexteAudioReloadBtn"'), 'Button zum erneuten Laden des Kapitels fehlt.');
  assert.strictEqual((html.match(/>↻ Kapitel erneut laden<\/button>/g) || []).length, 1, 'Kapitel erneut laden muss genau einmal sichtbar sein.');
  assert.ok(html.includes('id="lerntexteAudioNextBtn"'), 'Button für nächstes Kapitel fehlt.');
  console.log('✓ Lerntexte audio UI test passed: visible test-audio button is absent.');
  process.exit(0);
} catch (error) {
  console.log('✗ Lerntexte audio UI test failed: ' + error.message);
  process.exit(1);
}
