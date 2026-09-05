const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const { lerntexteAudioVersionIstSynchron } = require('../js/podcast-hash-validate.js');

const hash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

test('Hash-Validierung: drei identische Hashes sind synchron', () => {
  assert.strictEqual(lerntexteAudioVersionIstSynchron(hash, hash, hash), true);
});

test('Hash-Validierung: current/json Mismatch blockiert', () => {
  assert.strictEqual(lerntexteAudioVersionIstSynchron(hash, 'a'.repeat(64), hash), false);
});

test('Hash-Validierung: json/mp3 Mismatch blockiert', () => {
  assert.strictEqual(lerntexteAudioVersionIstSynchron(hash, hash, 'b'.repeat(64)), false);
});

test('Hash-Validierung: current/mp3 Mismatch blockiert', () => {
  assert.strictEqual(lerntexteAudioVersionIstSynchron(hash, 'b'.repeat(64), hash), false);
});

test('Hash-Validierung: fehlende Hashes blockieren', () => {
  for (const position of [0, 1, 2]) {
    const values = [hash, hash, hash];
    values[position] = undefined;
    assert.strictEqual(lerntexteAudioVersionIstSynchron(...values), false);
  }
});

test('Hash-Validierung: null blockiert', () => {
  for (const position of [0, 1, 2]) {
    const values = [hash, hash, hash];
    values[position] = null;
    assert.strictEqual(lerntexteAudioVersionIstSynchron(...values), false);
  }
});

test('Hash-Validierung: leere und whitespace-only Strings blockieren', () => {
  for (const invalidHash of ['', '   ']) {
    for (const position of [0, 1, 2]) {
      const values = [hash, hash, hash];
      values[position] = invalidHash;
      assert.strictEqual(lerntexteAudioVersionIstSynchron(...values), false);
    }
  }
});

test('Hash-Validierung: Nicht-Strings blockieren', () => {
  for (const invalidHash of [42, {}, [], true]) {
    for (const position of [0, 1, 2]) {
      const values = [hash, hash, hash];
      values[position] = invalidHash;
      assert.strictEqual(lerntexteAudioVersionIstSynchron(...values), false);
    }
  }
});

test('Hash-Validierung: Case- und Whitespace-Manipulationen bleiben unterschiedlich', () => {
  assert.strictEqual(lerntexteAudioVersionIstSynchron(hash, hash.toUpperCase(), hash), false);
  assert.strictEqual(lerntexteAudioVersionIstSynchron(hash, ` ${hash}`, hash), false);
});

test('Hash-Validierung: CommonJS exportiert eine Funktion', () => {
  assert.equal(typeof lerntexteAudioVersionIstSynchron, 'function');
});

test('Hash-Validierung: Browser-Export wird über VM exponiert', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/podcast-hash-validate.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);

  assert.equal(typeof context.window.lerntexteAudioVersionIstSynchron, 'function');
});