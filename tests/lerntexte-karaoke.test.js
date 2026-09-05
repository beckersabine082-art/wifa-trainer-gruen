const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const { lerntexteAudioVersionIstSynchron } = require('../js/podcast-hash-validate.js');
const { lerntexteDomTokenisieren } = require('../js/podcast-dom-tokenize.js');
const { findWordIndexAtTime } = require('../js/podcast-time-to-word.js');

class MockTextNode {
  constructor(ownerDocument, data) {
    this.ownerDocument = ownerDocument;
    this.nodeType = 3;
    this.data = data;
    this.parentNode = null;
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value);
  }
}

class MockElement {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.childNodes = [];
    this.attributes = {};
    this.parentNode = null;
    this.dataset = {};
  }

  appendChild(node) {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  replaceChild(replacement, oldNode) {
    const index = this.childNodes.indexOf(oldNode);
    if (index === -1) throw new Error('old child not found');
    replacement.parentNode = this;
    this.childNodes.splice(index, 1, ...replacement.childNodes);
    replacement.childNodes.forEach(node => {
      node.parentNode = this;
    });
    return oldNode;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'data-word-index') this.dataset.wordIndex = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  get textContent() {
    return this.childNodes.map(node => node.textContent).join('');
  }
}

class MockDocumentFragment extends MockElement {
  constructor(ownerDocument) {
    super(ownerDocument, '#document-fragment');
    this.nodeType = 11;
  }
}

class MockDocument {
  createElement(tagName) {
    return new MockElement(this, tagName);
  }

  createTextNode(data) {
    return new MockTextNode(this, data);
  }

  createDocumentFragment() {
    return new MockDocumentFragment(this);
  }
}

function element(document, tagName, ...children) {
  const node = document.createElement(tagName);
  children.forEach(child => node.appendChild(child));
  return node;
}

function text(document, value) {
  return document.createTextNode(value);
}

function descendants(root) {
  const result = [];
  const visit = node => {
    if (node.nodeType === 1) {
      result.push(node);
      node.childNodes.forEach(visit);
    }
  };
  visit(root);
  return result;
}

function wordSpans(root) {
  return descendants(root).filter(node => node.tagName === 'SPAN' && node.getAttribute('data-word-index') !== null);
}

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

test('DOM-Tokenisierung: einfache Wörter erhalten fortlaufende Indizes', () => {
  const document = new MockDocument();
  const root = element(document, 'div', text(document, 'Rechtssubjekte sind wichtig.'));
  const result = lerntexteDomTokenisieren(root);

  assert.deepStrictEqual(result.words.map(word => [word.wortIndex, word.text]), [
    [0, 'Rechtssubjekte'],
    [1, 'sind'],
    [2, 'wichtig']
  ]);
  assert.strictEqual(root.textContent, 'Rechtssubjekte sind wichtig.');
});

test('DOM-Tokenisierung: mehrere Text-Nodes teilen einen globalen Indexraum', () => {
  const document = new MockDocument();
  const strong = element(document, 'strong', text(document, 'Pflichten'));
  const root = element(document, 'p', text(document, 'Rechte und '), strong);
  const result = lerntexteDomTokenisieren(root);

  assert.deepStrictEqual(result.words.map(word => word.text), ['Rechte', 'und', 'Pflichten']);
  assert.deepStrictEqual(result.words.map(word => word.wortIndex), [0, 1, 2]);
  assert.strictEqual(descendants(root).some(node => node.tagName === 'STRONG'), true);
});

test('DOM-Tokenisierung: strong und em bleiben erhalten', () => {
  const document = new MockDocument();
  const strong = element(document, 'strong', text(document, 'Wichtig'));
  const em = element(document, 'em', text(document, 'richtig'));
  const root = element(document, 'div', strong, text(document, ' und '), em);

  lerntexteDomTokenisieren(root);

  assert.strictEqual(descendants(root).some(node => node.tagName === 'STRONG'), true);
  assert.strictEqual(descendants(root).some(node => node.tagName === 'EM'), true);
  assert.deepStrictEqual(wordSpans(root).map(span => span.textContent), ['Wichtig', 'und', 'richtig']);
});

test('DOM-Tokenisierung: Absätze, Überschrift, Liste und br bleiben erhalten', () => {
  const document = new MockDocument();
  const root = element(
    document,
    'div',
    element(document, 'h2', text(document, 'Überschrift')),
    element(document, 'p', text(document, 'Erster Absatz.')),
    element(document, 'br'),
    element(document, 'ul', element(document, 'li', text(document, 'Erster Punkt')), element(document, 'li', text(document, 'Zweiter Punkt')))
  );
  const before = root.textContent;

  const result = lerntexteDomTokenisieren(root);

  assert.strictEqual(root.textContent, before);
  assert.strictEqual(descendants(root).filter(node => node.tagName === 'H2').length, 1);
  assert.strictEqual(descendants(root).filter(node => node.tagName === 'P').length, 1);
  assert.strictEqual(descendants(root).filter(node => node.tagName === 'BR').length, 1);
  assert.strictEqual(descendants(root).filter(node => node.tagName === 'UL').length, 1);
  assert.strictEqual(descendants(root).filter(node => node.tagName === 'LI').length, 2);
  assert.deepStrictEqual(result.words.map(word => word.wortIndex), Array.from({ length: 7 }, (_, index) => index));
});

test('DOM-Tokenisierung: Satzzeichen, Hyphen, Apostrophe und Unicode bleiben korrekt', () => {
  const document = new MockDocument();
  const source = "Rechte, Pflichten; öffentlich-rechtliche Müller\'s Müller’s. Übertragung Größe Bücher!";
  const root = element(document, 'div', text(document, source));
  const result = lerntexteDomTokenisieren(root);

  assert.deepStrictEqual(result.words.map(word => word.text), [
    'Rechte', 'Pflichten', 'öffentlich-rechtliche', "Müller's", 'Müller’s',
    'Übertragung', 'Größe', 'Bücher'
  ]);
  assert.strictEqual(root.textContent, source);
});

test('DOM-Tokenisierung: Paragraphenzeichen ist kein Wort und 90a bleibt ein Wort', () => {
  const document = new MockDocument();
  const root = element(document, 'p', text(document, '§ 90a BGB'));
  const result = lerntexteDomTokenisieren(root);

  assert.deepStrictEqual(result.words.map(word => word.text), ['90a', 'BGB']);
  assert.strictEqual(wordSpans(root).some(span => span.textContent === '§'), false);
});

test('DOM-Tokenisierung: Wortindizes sind exakt 0..n-1 ohne Duplikate', () => {
  const document = new MockDocument();
  const root = element(document, 'div', text(document, 'Ein zwei drei vier.'));

  lerntexteDomTokenisieren(root);

  const indices = wordSpans(root).map(span => Number(span.dataset.wordIndex));
  assert.deepStrictEqual(indices, [0, 1, 2, 3]);
  assert.strictEqual(new Set(indices).size, indices.length);
});

test('DOM-Tokenisierung: zweiter Aufruf erzeugt keine verschachtelten Wort-Spans', () => {
  const document = new MockDocument();
  const root = element(document, 'div', text(document, 'Ein Wort.'));

  const first = lerntexteDomTokenisieren(root);
  const second = lerntexteDomTokenisieren(root);

  assert.strictEqual(wordSpans(root).length, 2);
  assert.deepStrictEqual(second.words, []);
  assert.strictEqual(wordSpans(root).some(span => wordSpans(span).some(child => child !== span)), false);
  assert.deepStrictEqual(first.words.map(word => word.text), ['Ein', 'Wort']);
});

test('DOM-Tokenisierung: SCRIPT und STYLE werden nicht tokenisiert', () => {
  const document = new MockDocument();
  const script = element(document, 'script', text(document, 'var nichtTokenisieren = true;'));
  const style = element(document, 'style', text(document, '.klasse { color: red; }'));
  const root = element(document, 'div', script, style, text(document, 'Sichtbar.'));

  const result = lerntexteDomTokenisieren(root);

  assert.deepStrictEqual(result.words.map(word => word.text), ['Sichtbar']);
  assert.strictEqual(wordSpans(script).length, 0);
  assert.strictEqual(wordSpans(style).length, 0);
});

test('DOM-Tokenisierung: CommonJS exportiert eine Funktion', () => {
  assert.equal(typeof lerntexteDomTokenisieren, 'function');
});

test('DOM-Tokenisierung: Browser-Export wird über VM exponiert', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/podcast-dom-tokenize.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);

  assert.equal(typeof context.window.lerntexteDomTokenisieren, 'function');
});

test('DOM-Tokenisierung: realistischer Lerntext bleibt fachlich unverändert', () => {
  const document = new MockDocument();
  const root = element(
    document,
    'article',
    element(document, 'h1', text(document, 'Rechtssubjekte und Rechtsobjekte')),
    element(document, 'p', text(document, 'Rechtssubjekte sind Träger von Rechten und Pflichten.')),
    element(document, 'p', element(document, 'strong', text(document, 'Wichtig:')), text(document, ' Größe und Übertragung beachten.'))
  );
  const before = root.textContent;

  lerntexteDomTokenisieren(root);

  assert.strictEqual(root.textContent, before);
});

// TASK 13: currentTime → Wortindex Mapping
test('Time-to-Word: Wort am Anfang (t=0.5 => 0)', () => {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 }
  ];

  const idx = findWordIndexAtTime(timestamps, 0.5);
  assert.strictEqual(idx, 0, 'Wort 0 gefunden');
});

test('Time-to-Word: Grenze gehört nächstem Wort (start <= t < end)', () => {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 }
  ];

  const idx = findWordIndexAtTime(timestamps, 1.0);
  assert.strictEqual(idx, 1, 'Grenze gehört nächstem Wort (t=1.0 => 1)');
});

test('Time-to-Word: Wort in Mitte (t=2.5 => 2)', () => {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 },
    { wortIndex: 2, start: 2, end: 3 }
  ];

  const idx = findWordIndexAtTime(timestamps, 2.5);
  assert.strictEqual(idx, 2, 'Wort 2 gefunden');
});

test('Time-to-Word: Vor erstem Wort => -1', () => {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 }
  ];

  const idx = findWordIndexAtTime(timestamps, -0.5);
  assert.strictEqual(idx, -1, 'Zeit vor erstem Wort');
});

test('Time-to-Word: Nach letztem Wort => -1', () => {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 }
  ];

  const idx = findWordIndexAtTime(timestamps, 2.5);
  assert.strictEqual(idx, -1, 'Zeit nach letztem Wort');
});

test('Time-to-Word: Lücke in Daten => -1', () => {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1.5, end: 2 }
  ];

  const idx = findWordIndexAtTime(timestamps, 1.25);
  assert.strictEqual(idx, -1, 'Zeit liegt in Lücke (1.0 bis 1.5)');
});

test('Time-to-Word: Wortindex-Feld nicht Array-Position (100, 200)', () => {
  const timestamps = [
    { wortIndex: 100, start: 0, end: 1 },
    { wortIndex: 200, start: 1, end: 2 }
  ];

  const idx0 = findWordIndexAtTime(timestamps, 0.5);
  const idx1 = findWordIndexAtTime(timestamps, 1.5);
  assert.strictEqual(idx0, 100, 'wortIndex ist 100, nicht Position 0');
  assert.strictEqual(idx1, 200, 'wortIndex ist 200, nicht Position 1');
});

test('Time-to-Word: Binäre Suche (1000 Marker, t=500.5 => 500)', () => {
  const timestamps = [];
  for (let i = 0; i < 1000; i++) {
    timestamps.push({
      wortIndex: i,
      start: i,
      end: i + 1
    });
  }

  const idx = findWordIndexAtTime(timestamps, 500.5);
  assert.strictEqual(idx, 500, 'binäre Suche findet Marker 500 in 1000 Elementen');
});

test('Time-to-Word: Realistischer Pilot-Wert (t=19.5 => 36)', () => {
  const timestamps = [
    { wortIndex: 36, start: 19.040000915527344, end: 19.760000228881836 }
  ];

  const idx = findWordIndexAtTime(timestamps, 19.5);
  assert.strictEqual(idx, 36, 'Pilot-Wert bei t=19.5');
});

test('Time-to-Word: Pilot-Grenze ausgeschlossen (t=19.760000228881836 => -1)', () => {
  const timestamps = [
    { wortIndex: 36, start: 19.040000915527344, end: 19.760000228881836 }
  ];

  const idx = findWordIndexAtTime(timestamps, 19.760000228881836);
  assert.strictEqual(idx, -1, 'Grenze am end ist ausgeschlossen (end nicht inklusiv)');
});

test('Time-to-Word: Ungültig - wortZeitmarken ist kein Array => -1', () => {
  assert.strictEqual(findWordIndexAtTime(null, 0.5), -1);
  assert.strictEqual(findWordIndexAtTime(undefined, 0.5), -1);
  assert.strictEqual(findWordIndexAtTime({}, 0.5), -1);
  assert.strictEqual(findWordIndexAtTime('not-array', 0.5), -1);
});

test('Time-to-Word: Ungültig - leeres Array => -1', () => {
  assert.strictEqual(findWordIndexAtTime([], 0.5), -1);
});

test('Time-to-Word: Ungültig - currentTime ist kein Number => -1', () => {
  const timestamps = [{ wortIndex: 0, start: 0, end: 1 }];
  assert.strictEqual(findWordIndexAtTime(timestamps, null), -1);
  assert.strictEqual(findWordIndexAtTime(timestamps, undefined), -1);
  assert.strictEqual(findWordIndexAtTime(timestamps, 'not-number'), -1);
});

test('Time-to-Word: Ungültig - currentTime ist NaN => -1', () => {
  const timestamps = [{ wortIndex: 0, start: 0, end: 1 }];
  assert.strictEqual(findWordIndexAtTime(timestamps, NaN), -1);
});

test('Time-to-Word: Ungültig - currentTime ist Infinity => -1', () => {
  const timestamps = [{ wortIndex: 0, start: 0, end: 1 }];
  assert.strictEqual(findWordIndexAtTime(timestamps, Infinity), -1);
  assert.strictEqual(findWordIndexAtTime(timestamps, -Infinity), -1);
});

test('Time-to-Word: Input nicht mutiert', () => {
  const timestamps = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 }
  ];
  const original = JSON.stringify(timestamps);

  findWordIndexAtTime(timestamps, 0.5);

  assert.strictEqual(JSON.stringify(timestamps), original, 'Array nicht mutiert');
});

test('Time-to-Word: CommonJS exportiert findWordIndexAtTime', () => {
  assert.equal(typeof findWordIndexAtTime, 'function');
});

test('Time-to-Word: Browser-Export exponiert window.findWordIndexAtTime', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/podcast-time-to-word.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context);

  assert.equal(typeof context.window.findWordIndexAtTime, 'function');
});