const assert = require('assert');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const buttonId = 'id="lerntexteAudioTestBtn"';

try {
  assert.ok(!html.includes(buttonId), 'Index.html still contains the visible test-audio button.');
  console.log('✓ Lerntexte audio UI test passed: visible test-audio button is absent.');
  process.exit(0);
} catch (error) {
  console.log('✗ Lerntexte audio UI test failed: ' + error.message);
  process.exit(1);
}
