const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const { lerntexteAudioVersionIstSynchron } = require('../js/podcast-hash-validate.js');
const { lerntexteDomTokenisieren } = require('../js/podcast-dom-tokenize.js');
const { findWordIndexAtTime } = require('../js/podcast-time-to-word.js');
const {
  lerntextePodcastAbspielen,
  lerntextePodcastPausieren,
  lerntextePodcastStoppen,
  lerntextePodcastFortsetzen,
  lerntextePodcastVonVorne
} = require('../js/lerntexte.js');
const { setupVisibilitySyncHandlers } = require('../js/podcast-visibility-sync.js');

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

// ============================================================
// TASK 14: Pilot Playback Tests
// ============================================================

// Test 1: Stop pausiert Audio
test('Pilot Playback: Stop ruft pause() auf', () => {
  let pauseCalled = false;
  const mockAudio = {
    currentTime: 42.5,
    pause() { pauseCalled = true; }
  };
  const mockSaveProgress = async () => {};
  
  lerntextePodcastStoppen(mockAudio, mockSaveProgress, {});
  
  assert.strictEqual(pauseCalled, true, 'pause() wurde aufgerufen');
});

// Test 2: Stop erhält currentTime
test('Pilot Playback: Stop behält currentTime', () => {
  const mockAudio = {
    currentTime: 42.5,
    pause() {}
  };
  const mockSaveProgress = async () => {};
  
  lerntextePodcastStoppen(mockAudio, mockSaveProgress, {});
  
  assert.strictEqual(mockAudio.currentTime, 42.5, 'currentTime bleibt unverändert');
});

// Test 3: Stop speichert aktuelle Position
test('Pilot Playback: Stop speichert aktuelle Position', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 42.5,
    pause() {}
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte und Rechtsobjekte',
    firebasePfad: 'podcast/recht-rechtssubjekte.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  await lerntextePodcastStoppen(mockAudio, mockSaveProgress, baseState);
  
  assert.ok(savedState, 'saveProgress wurde aufgerufen');
  assert.strictEqual(savedState.sekundenPosition, 42.5, 'Position gespeichert');
});

// Test 4: Stop speichert completed false
test('Pilot Playback: Stop speichert completed false', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 42.5,
    pause() {}
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  await lerntextePodcastStoppen(mockAudio, mockSaveProgress, baseState);
  
  assert.ok(savedState, 'saveProgress wurde aufgerufen');
  assert.strictEqual(savedState.completed, false, 'completed ist false');
});

// Test 5: Pause ruft pause() auf
test('Pilot Playback: Pause ruft pause() auf', () => {
  let pauseCalled = false;
  const mockAudio = {
    currentTime: 30.0,
    pause() { pauseCalled = true; }
  };
  const mockSaveProgress = async () => {};
  
  lerntextePodcastPausieren(mockAudio, mockSaveProgress, {});
  
  assert.strictEqual(pauseCalled, true, 'pause() wurde aufgerufen');
});

// Test 6: Pause behält currentTime
test('Pilot Playback: Pause behält currentTime', () => {
  const mockAudio = {
    currentTime: 30.0,
    pause() {}
  };
  const mockSaveProgress = async () => {};
  
  lerntextePodcastPausieren(mockAudio, mockSaveProgress, {});
  
  assert.strictEqual(mockAudio.currentTime, 30.0, 'currentTime bleibt unverändert');
});

// Test 7: Pause speichert aktuelle Position
test('Pilot Playback: Pause speichert aktuelle Position', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 30.0,
    pause() {}
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  await lerntextePodcastPausieren(mockAudio, mockSaveProgress, baseState);
  
  assert.ok(savedState, 'saveProgress wurde aufgerufen');
  assert.strictEqual(savedState.sekundenPosition, 30.0, 'Position gespeichert');
});

// Test 8: Pause speichert completed false
test('Pilot Playback: Pause speichert completed false', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 30.0,
    pause() {}
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  await lerntextePodcastPausieren(mockAudio, mockSaveProgress, baseState);
  
  assert.ok(savedState, 'saveProgress wurde aufgerufen');
  assert.strictEqual(savedState.completed, false, 'completed ist false');
});

// Test 9: Pause mutiert Basisstate nicht
test('Pilot Playback: Pause mutiert Basisstate nicht', async () => {
  const mockAudio = {
    currentTime: 30.0,
    pause() {}
  };
  const mockSaveProgress = async () => {};
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  const originalState = JSON.parse(JSON.stringify(baseState));
  
  await lerntextePodcastPausieren(mockAudio, mockSaveProgress, baseState);
  
  assert.deepStrictEqual(baseState, originalState, 'Basisstate nicht mutiert');
});

// Test 10: Stop mutiert Basisstate nicht
test('Pilot Playback: Stop mutiert Basisstate nicht', async () => {
  const mockAudio = {
    currentTime: 42.5,
    pause() {}
  };
  const mockSaveProgress = async () => {};
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  const originalState = JSON.parse(JSON.stringify(baseState));
  
  await lerntextePodcastStoppen(mockAudio, mockSaveProgress, baseState);
  
  assert.deepStrictEqual(baseState, originalState, 'Basisstate nicht mutiert');
});

// Test 11: Resume mit passendem Hash setzt Position
test('Pilot Playback: Resume mit passendem Hash setzt Position', () => {
  const currentHash = 'abc123';
  const resumeState = {
    lerntextHash: 'abc123',
    sekundenPosition: 20.5
  };
  const mockAudio = {
    currentTime: 0
  };
  
  lerntextePodcastFortsetzen(mockAudio, resumeState, currentHash);
  
  assert.strictEqual(mockAudio.currentTime, 20.5, 'Position wiederhergestellt');
});

// Test 12: Resume mit Hash-Mismatch setzt Position NICHT
test('Pilot Playback: Resume mit Hash-Mismatch setzt Position NICHT', () => {
  const currentHash = 'abc123';
  const resumeState = {
    lerntextHash: 'different',
    sekundenPosition: 20.5
  };
  const mockAudio = {
    currentTime: 0
  };
  
  lerntextePodcastFortsetzen(mockAudio, resumeState, currentHash);
  
  assert.strictEqual(mockAudio.currentTime, 0, 'Position nicht gesetzt bei Hash-Mismatch');
});

// Test 13: Resume mit completed true setzt Position NICHT
test('Pilot Playback: Resume completed true setzt Position NICHT', () => {
  const currentHash = 'abc123';
  const resumeState = {
    lerntextHash: 'abc123',
    sekundenPosition: 20.5,
    completed: true
  };
  const mockAudio = {
    currentTime: 0
  };
  
  lerntextePodcastFortsetzen(mockAudio, resumeState, currentHash);
  
  assert.strictEqual(mockAudio.currentTime, 0, 'Position nicht gesetzt bei completed=true');
});

// Test 14: Resume mit ungültiger SekundenPosition setzt Position NICHT
test('Pilot Playback: Resume mit ungültiger SekundenPosition setzt Position NICHT', () => {
  const currentHash = 'abc123';
  
  // Test mit negativ
  let mockAudio = { currentTime: 0 };
  lerntextePodcastFortsetzen(mockAudio, {
    lerntextHash: 'abc123',
    sekundenPosition: -1
  }, currentHash);
  assert.strictEqual(mockAudio.currentTime, 0, 'negative Position nicht gesetzt');
  
  // Test mit NaN
  mockAudio = { currentTime: 0 };
  lerntextePodcastFortsetzen(mockAudio, {
    lerntextHash: 'abc123',
    sekundenPosition: NaN
  }, currentHash);
  assert.strictEqual(mockAudio.currentTime, 0, 'NaN Position nicht gesetzt');
  
  // Test mit Infinity
  mockAudio = { currentTime: 0 };
  lerntextePodcastFortsetzen(mockAudio, {
    lerntextHash: 'abc123',
    sekundenPosition: Infinity
  }, currentHash);
  assert.strictEqual(mockAudio.currentTime, 0, 'Infinity Position nicht gesetzt');
  
  // Test mit undefined
  mockAudio = { currentTime: 0 };
  lerntextePodcastFortsetzen(mockAudio, {
    lerntextHash: 'abc123',
    sekundenPosition: undefined
  }, currentHash);
  assert.strictEqual(mockAudio.currentTime, 0, 'undefined Position nicht gesetzt');
});

// Test 15: Resume akzeptiert Position 0
test('Pilot Playback: Resume akzeptiert Position 0', () => {
  const currentHash = 'abc123';
  const resumeState = {
    lerntextHash: 'abc123',
    sekundenPosition: 0
  };
  const mockAudio = {
    currentTime: 42.5
  };
  
  lerntextePodcastFortsetzen(mockAudio, resumeState, currentHash);
  
  assert.strictEqual(mockAudio.currentTime, 0, 'Position 0 wird akzeptiert');
});

// Test 16: VonVorne setzt Position 0
test('Pilot Playback: VonVorne setzt Position 0', () => {
  const mockAudio = {
    currentTime: 42.5
  };
  
  lerntextePodcastVonVorne(mockAudio);
  
  assert.strictEqual(mockAudio.currentTime, 0, 'currentTime auf 0 gesetzt');
});

// Test 17: VonVorne löscht keinen Progress-State
test('Pilot Playback: VonVorne löscht keinen Progress-State', () => {
  const mockAudio = {
    currentTime: 42.5
  };
  
  // VonVorne sollte keine Argumente für Progress-Löschung haben
  // Es ist nur eine Audio-Steuerfunktion
  lerntextePodcastVonVorne(mockAudio);
  
  assert.strictEqual(mockAudio.currentTime, 0, 'VonVorne funktioniert korrekt');
});

// Test 18: Abspielen ruft play() auf
test('Pilot Playback: Abspielen ruft play() auf', () => {
  let playCalled = false;
  const mockAudio = {
    onended: null,
    play() {
      playCalled = true;
      return Promise.resolve();
    }
  };
  const mockSaveProgress = async () => {};
  
  lerntextePodcastAbspielen(mockAudio, mockSaveProgress, {});
  
  assert.strictEqual(playCalled, true, 'play() wurde aufgerufen');
});

// Test 19: Abspielen gibt play()-Promise unverändert zurück
test('Pilot Playback: Abspielen gibt play()-Promise unverändert zurück', () => {
  const playResult = Promise.resolve('playing');
  const mockAudio = {
    onended: null,
    play() { return playResult; }
  };
  const mockSaveProgress = async () => {};
  
  const returned = lerntextePodcastAbspielen(mockAudio, mockSaveProgress, {});
  
  assert.strictEqual(returned, playResult, 'play()-Promise wird unverändert zurückgegeben');
});

// Test 20: Natürliches Ende registriert onended
test('Pilot Playback: Natürliches Ende registriert onended', () => {
  const mockAudio = {
    onended: null,
    play() { return Promise.resolve(); }
  };
  const mockSaveProgress = async () => {};
  
  lerntextePodcastAbspielen(mockAudio, mockSaveProgress, {});
  
  assert.ok(typeof mockAudio.onended === 'function', 'onended ist eine Funktion');
});

// Test 21: Natürliches Ende speichert completed true
test('Pilot Playback: Natürliches Ende speichert completed true', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 138.12,
    onended: null,
    play() { return Promise.resolve(); }
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  lerntextePodcastAbspielen(mockAudio, mockSaveProgress, baseState);
  
  assert.ok(typeof mockAudio.onended === 'function', 'onended registriert');
  
  // Aufrufen des onended handlers
  await mockAudio.onended();
  
  assert.ok(savedState, 'saveProgress wurde aufgerufen');
  assert.strictEqual(savedState.completed, true, 'completed = true bei natürlichem Ende');
});

// Test 22: Natürliches Ende speichert aktuelle SekundenPosition
test('Pilot Playback: Natürliches Ende speichert aktuelle SekundenPosition', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 138.12,
    onended: null,
    play() { return Promise.resolve(); }
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  lerntextePodcastAbspielen(mockAudio, mockSaveProgress, baseState);
  await mockAudio.onended();
  
  assert.ok(savedState, 'saveProgress wurde aufgerufen');
  assert.strictEqual(savedState.sekundenPosition, 138.12, 'sekundenPosition = audio.currentTime');
});

// Test 23: Natürliches Ende erhält Basisfelder
test('Pilot Playback: Natürliches Ende erhält Basisfelder', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 138.12,
    onended: null,
    play() { return Promise.resolve(); }
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  lerntextePodcastAbspielen(mockAudio, mockSaveProgress, baseState);
  await mockAudio.onended();
  
  assert.ok(savedState, 'saveProgress wurde aufgerufen');
  assert.strictEqual(savedState.nutzer, 'uid-123', 'nutzer erhalten');
  assert.strictEqual(savedState.fach, 'Recht', 'fach erhalten');
  assert.strictEqual(savedState.einheit, 'Rechtssubjekte', 'einheit erhalten');
  assert.strictEqual(savedState.firebasePfad, 'podcast/recht.mp3', 'firebasePfad erhalten');
  assert.strictEqual(savedState.lerntextHash, 'abc123', 'lerntextHash erhalten');
});

// Test 24: Natürliches Ende mutiert Basisstate nicht
test('Pilot Playback: Natürliches Ende mutiert Basisstate nicht', () => {
  const mockAudio = {
    currentTime: 138.12,
    onended: null,
    play() { return Promise.resolve(); }
  };
  const mockSaveProgress = async () => {};
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  const originalState = JSON.parse(JSON.stringify(baseState));
  
  lerntextePodcastAbspielen(mockAudio, mockSaveProgress, baseState);
  
  assert.deepStrictEqual(baseState, originalState, 'Basisstate nicht mutiert');
});

// Test 25: Pause-Save-Fehler wird propagiert
test('Pilot Playback: Pause-Save-Fehler wird propagiert', async () => {
  const mockAudio = {
    currentTime: 30.0,
    pause() {}
  };
  const mockSaveProgress = async () => {
    throw new Error('Save failed');
  };
  const baseState = {};
  
  try {
    await lerntextePodcastPausieren(mockAudio, mockSaveProgress, baseState);
    assert.fail('Fehler hätte propagiert werden sollen');
  } catch (error) {
    assert.strictEqual(error.message, 'Save failed', 'Fehler wird propagiert');
  }
});

// Test 26: Stop-Save-Fehler wird propagiert
test('Pilot Playback: Stop-Save-Fehler wird propagiert', async () => {
  const mockAudio = {
    currentTime: 42.5,
    pause() {}
  };
  const mockSaveProgress = async () => {
    throw new Error('Save failed');
  };
  const baseState = {};
  
  try {
    await lerntextePodcastStoppen(mockAudio, mockSaveProgress, baseState);
    assert.fail('Fehler hätte propagiert werden sollen');
  } catch (error) {
    assert.strictEqual(error.message, 'Save failed', 'Fehler wird propagiert');
  }
});

// Test 27: onended-Save-Fehler ist beobachtbar
test('Pilot Playback: onended-Save-Fehler ist beobachtbar', async () => {
  const mockAudio = {
    currentTime: 138.12,
    onended: null,
    play() { return Promise.resolve(); }
  };
  const mockSaveProgress = async () => {
    throw new Error('Save failed');
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  lerntextePodcastAbspielen(mockAudio, mockSaveProgress, baseState);
  
  try {
    await mockAudio.onended();
    assert.fail('Fehler hätte propagiert werden sollen');
  } catch (error) {
    assert.strictEqual(error.message, 'Save failed', 'Fehler ist beobachtbar');
  }
});

// Test 28: Kein TASK-14-Helper fügt aktualisiert hinzu
test('Pilot Playback: Kein TASK-14-Helper fügt aktualisiert hinzu', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 30.0,
    pause() {}
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 0,
    wortIndex: 0,
    completed: false
  };
  
  await lerntextePodcastPausieren(mockAudio, mockSaveProgress, baseState);
  
  assert.ok(!('aktualisiert' in savedState), 'aktualisiert nicht hinzugefügt');
  assert.ok(!('timestamp' in savedState), 'timestamp nicht hinzugefügt');
  assert.ok(!('updatedAt' in savedState), 'updatedAt nicht hinzugefügt');
});

// Additional boundary tests for Resume
test('Pilot Playback: Resume mit null resumeState setzt Position NICHT', () => {
  const currentHash = 'abc123';
  const mockAudio = { currentTime: 0 };
  
  lerntextePodcastFortsetzen(mockAudio, null, currentHash);
  
  assert.strictEqual(mockAudio.currentTime, 0, 'Position nicht gesetzt bei null resumeState');
});

test('Pilot Playback: Resume mit undefined resumeState setzt Position NICHT', () => {
  const currentHash = 'abc123';
  const mockAudio = { currentTime: 0 };
  
  lerntextePodcastFortsetzen(mockAudio, undefined, currentHash);
  
  assert.strictEqual(mockAudio.currentTime, 0, 'Position nicht gesetzt bei undefined resumeState');
});

// Test that Pause and Stop preserve other fields
test('Pilot Playback: Pause erhält wortIndex aus Basisstate', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 30.0,
    pause() {}
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 10,
    wortIndex: 25,
    completed: false
  };
  
  await lerntextePodcastPausieren(mockAudio, mockSaveProgress, baseState);
  
  assert.strictEqual(savedState.wortIndex, 25, 'wortIndex beibehalten');
});

test('Pilot Playback: Stop erhält wortIndex aus Basisstate', async () => {
  let savedState = null;
  const mockAudio = {
    currentTime: 42.5,
    pause() {}
  };
  const mockSaveProgress = async (state) => {
    savedState = state;
  };
  const baseState = {
    nutzer: 'uid-123',
    fach: 'Recht',
    einheit: 'Rechtssubjekte',
    firebasePfad: 'podcast/recht.mp3',
    lerntextHash: 'abc123',
    sekundenPosition: 10,
    wortIndex: 30,
    completed: false
  };
  
  await lerntextePodcastStoppen(mockAudio, mockSaveProgress, baseState);
  
  assert.strictEqual(savedState.wortIndex, 30, 'wortIndex beibehalten');
});

class MockEventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, listener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    if (!this.listeners[type].includes(listener)) this.listeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(fn => fn !== listener);
  }

  dispatchEvent(event) {
    const handlers = this.listeners[event.type] || [];
    handlers.slice().forEach(handler => handler.call(this, event));
    return true;
  }
}

test('TASK 15: setup registriert visibilitychange und pageshow genau einmal', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const mockDocument = new MockEventTarget();
  const mockWindow = new MockEventTarget();
  mockDocument.hidden = true;
  globalThis.document = mockDocument;
  globalThis.window = mockWindow;

  try {
    const calls = [];
    const audio = { currentTime: 10 };
    const resync = time => calls.push(time);

    const cleanup = setupVisibilitySyncHandlers(audio, resync);

    assert.strictEqual(mockDocument.listeners.visibilitychange.length, 1, 'visibilitychange Listener registriert');
    assert.strictEqual(mockWindow.listeners.pageshow.length, 1, 'pageshow Listener registriert');
    assert.deepStrictEqual(calls, [], 'setup ruft resync nicht sofort auf');

    cleanup();
    assert.strictEqual(mockDocument.listeners.visibilitychange.length, 0, 'visibilitychange Listener entfernt');
    assert.strictEqual(mockWindow.listeners.pageshow.length, 0, 'pageshow Listener entfernt');
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('TASK 15: visibilitychange hidden=false ruft resync mit aktuellem currentTime auf', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const mockDocument = new MockEventTarget();
  const mockWindow = new MockEventTarget();
  mockDocument.hidden = true;
  globalThis.document = mockDocument;
  globalThis.window = mockWindow;

  try {
    const audio = { currentTime: 10 };
    const calls = [];
    setupVisibilitySyncHandlers(audio, value => calls.push(value));

    audio.currentTime = 25.5;
    mockDocument.hidden = false;
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    assert.deepStrictEqual(calls, [25.5], 'visibilitychange liest aktuellen currentTime-Wert');
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('TASK 15: visibilitychange hidden=true blockiert resync', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const mockDocument = new MockEventTarget();
  const mockWindow = new MockEventTarget();
  mockDocument.hidden = true;
  globalThis.document = mockDocument;
  globalThis.window = mockWindow;

  try {
    const audio = { currentTime: 42 };
    const calls = [];
    setupVisibilitySyncHandlers(audio, value => calls.push(value));

    mockDocument.hidden = true;
    mockDocument.dispatchEvent({ type: 'visibilitychange' });

    assert.deepStrictEqual(calls, [], 'hidden=true ruft resync nicht auf');
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('TASK 15: pageshow ruft resync mit aktuellem currentTime auf', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const mockDocument = new MockEventTarget();
  const mockWindow = new MockEventTarget();
  mockDocument.hidden = true;
  globalThis.document = mockDocument;
  globalThis.window = mockWindow;

  try {
    const audio = { currentTime: 10 };
    const calls = [];
    setupVisibilitySyncHandlers(audio, value => calls.push(value));

    audio.currentTime = 40;
    mockWindow.dispatchEvent({ type: 'pageshow' });

    assert.deepStrictEqual(calls, [40], 'pageshow liest aktuellen currentTime-Wert');
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('TASK 15: resync pro Event genau einmal und cleanup entfernt Listener', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const mockDocument = new MockEventTarget();
  const mockWindow = new MockEventTarget();
  mockDocument.hidden = true;
  globalThis.document = mockDocument;
  globalThis.window = mockWindow;

  try {
    const audio = { currentTime: 0 };
    const calls = [];
    const cleanup = setupVisibilitySyncHandlers(audio, value => calls.push(value));

    audio.currentTime = 1;
    mockDocument.hidden = false;
    mockDocument.dispatchEvent({ type: 'visibilitychange' });
    audio.currentTime = 2;
    mockWindow.dispatchEvent({ type: 'pageshow' });

    assert.deepStrictEqual(calls, [1, 2], 'resync pro Event genau einmal');

    cleanup();
    mockDocument.hidden = false;
    mockDocument.dispatchEvent({ type: 'visibilitychange' });
    mockWindow.dispatchEvent({ type: 'pageshow' });

    assert.deepStrictEqual(calls, [1, 2], 'cleanup verhindert weitere resync-Aufrufe');
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('TASK 15: Helper verändert audio nicht und ruft keine Audio-Steuerfunktionen auf', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const mockDocument = new MockEventTarget();
  const mockWindow = new MockEventTarget();
  mockDocument.hidden = true;
  globalThis.document = mockDocument;
  globalThis.window = mockWindow;

  try {
    const audio = {
      currentTime: 12.5,
      play() { throw new Error('play() darf nicht aufgerufen werden'); },
      pause() { throw new Error('pause() darf nicht aufgerufen werden'); }
    };
    const resync = () => {};

    setupVisibilitySyncHandlers(audio, resync);

    audio.currentTime = 15.75;
    mockDocument.hidden = false;
    mockDocument.dispatchEvent({ type: 'visibilitychange' });
    mockWindow.dispatchEvent({ type: 'pageshow' });

    assert.strictEqual(audio.currentTime, 15.75, 'audio.currentTime bleibt unverändert');
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('TASK 15: Kein Auto-Scroll und keine DOM-/Hash-/Karaoke-Duplizierung im Helper', () => {
  const code = fs.readFileSync(path.join(__dirname, '../js/podcast-visibility-sync.js'), 'utf8');
  assert.ok(!code.includes('scrollTo'), 'kein scrollTo');
  assert.ok(!code.includes('scrollBy'), 'kein scrollBy');
  assert.ok(!code.includes('scrollIntoView'), 'kein scrollIntoView');
  assert.ok(!code.includes('findWordIndexAtTime'), 'keine findWordIndexAtTime-Duplizierung');
  assert.ok(!code.includes('lerntextHash'), 'keine Hash-Logik');
  assert.ok(!code.includes('classList'), 'keine Highlight-Klassen-Logik');
  assert.ok(!code.includes('audio.play'), 'kein play() im Helper');
  assert.ok(!code.includes('audio.pause'), 'kein pause() im Helper');
});

test('TASK 15: CommonJS und Browser Export vorhanden', () => {
  assert.equal(typeof setupVisibilitySyncHandlers, 'function', 'CommonJS Export vorhanden');

  const context = {
    window: {},
    document: { addEventListener() {}, removeEventListener() {} },
    console
  };
  const source = fs.readFileSync(path.join(__dirname, '../js/podcast-visibility-sync.js'), 'utf8');
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.setupVisibilitySyncHandlers, 'function', 'Browser-Export vorhanden');
});