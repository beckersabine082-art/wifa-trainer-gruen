const assert = require('node:assert/strict');
const test = require('node:test');

const { lerntexteDomTokenisieren } = require('../js/podcast-dom-tokenize.js');

let steuerAbkuerzungen = {};
try {
  steuerAbkuerzungen = require('../js/steuer-abkuerzungen.js');
} catch (error) {
  if (!error || error.code !== 'MODULE_NOT_FOUND') throw error;
}

const erklaereSteuerAbkuerzungen = steuerAbkuerzungen.erklaereSteuerAbkuerzungen;
const STEUER_ABKUERZUNGEN = steuerAbkuerzungen.STEUER_ABKUERZUNGEN || [];

class TextNode {
  constructor(ownerDocument, data) {
    this.ownerDocument = ownerDocument;
    this.nodeType = 3;
    this.data = String(data);
    this.parentNode = null;
  }

  get textContent() {
    return this.data;
  }
}

class Element {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.childNodes = [];
    this.attributes = {};
    this.className = '';
  }

  appendChild(node) {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  insertBefore(node, referenceNode) {
    node.parentNode = this;
    if (!referenceNode) {
      this.childNodes.push(node);
      return node;
    }
    const index = this.childNodes.indexOf(referenceNode);
    if (index < 0) throw new Error('reference child not found');
    this.childNodes.splice(index, 0, node);
    return node;
  }

  replaceChild(replacement, oldNode) {
    const index = this.childNodes.indexOf(oldNode);
    if (index < 0) throw new Error('old child not found');
    const children = replacement.nodeType === 11 ? replacement.childNodes : [replacement];
    this.childNodes.splice(index, 1, ...children);
    children.forEach(child => { child.parentNode = this; });
    return oldNode;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  get textContent() {
    return this.childNodes.map(node => node.textContent).join('');
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      if (!node || node.nodeType !== 1) return;
      const matchesSelector = selector === '[data-word-index]'
        ? node.getAttribute('data-word-index') !== null
        : selector === '.lerntexte-abkuerzung-erklaerung'
          ? String(node.className).split(/\s+/).includes('lerntexte-abkuerzung-erklaerung')
          : false;
      if (matchesSelector) matches.push(node);
      node.childNodes.forEach(visit);
    };
    this.childNodes.forEach(visit);
    return matches;
  }
}

class Fragment extends Element {
  constructor(ownerDocument) {
    super(ownerDocument, '#document-fragment');
    this.nodeType = 11;
  }
}

class Document {
  createElement(tagName) {
    return new Element(this, tagName);
  }

  createTextNode(data) {
    return new TextNode(this, data);
  }

  createDocumentFragment() {
    return new Fragment(this);
  }
}

function tokenisierterText(source) {
  const document = new Document();
  const root = document.createElement('div');
  root.appendChild(document.createTextNode(source));
  const tokenisierung = lerntexteDomTokenisieren(root);
  return { root, tokenisierung };
}

function erklaerungen(root) {
  return root.querySelectorAll('.lerntexte-abkuerzung-erklaerung').map(node => node.textContent);
}

test('Das geprüfte Steuern-Verzeichnis weist für jeden Eintrag eine amtliche Quelle aus', () => {
  assert.ok(STEUER_ABKUERZUNGEN.length > 0);
  assert.ok(STEUER_ABKUERZUNGEN.every(eintrag => /^https:\/\//.test(eintrag.quelle || '')));
});

test('Steuern: Steuerart und Gesetz werden beim ersten Auftreten getrennt erklärt', () => {
  assert.equal(typeof erklaereSteuerAbkuerzungen, 'function');
  const { root, tokenisierung } = tokenisierterText('ESt und EStG. ESt bleibt von EStG zu unterscheiden.');
  const vorherigeWoerter = tokenisierung.words.map(word => word.text);

  erklaereSteuerAbkuerzungen(root, 'Steuern');

  assert.equal(
    root.textContent,
    'ESt (Einkommensteuer) und EStG (Einkommensteuergesetz). ESt bleibt von EStG zu unterscheiden.'
  );
  assert.deepEqual(erklaerungen(root), [' (Einkommensteuer)', ' (Einkommensteuergesetz)']);
  assert.deepEqual(
    root.querySelectorAll('[data-word-index]').map(node => node.textContent),
    vorherigeWoerter
  );
});

test('Steuern: Satzzeichen bleiben hinter der sichtbaren Erläuterung erhalten', () => {
  assert.equal(typeof erklaereSteuerAbkuerzungen, 'function');
  const { root } = tokenisierterText('AO, USt-IdNr. und ZM; danach AO erneut.');

  erklaereSteuerAbkuerzungen(root, 'Steuern');

  assert.equal(
    root.textContent,
    'AO (Abgabenordnung), USt-IdNr. (Umsatzsteuer-Identifikationsnummer) und ZM (Zusammenfassende Meldung); danach AO erneut.'
  );
});

test('Steuern: nur eigenständige Kürzel werden erklärt, keine Präfixe zusammengesetzter Wörter', () => {
  const source = 'Ein BMF-Schreiben erläutert das EU-Recht. Danach folgen BMF und EU.';
  const { root } = tokenisierterText(source);

  erklaereSteuerAbkuerzungen(root, 'Steuern');

  assert.equal(
    root.textContent,
    'Ein BMF-Schreiben erläutert das EU-Recht. Danach folgen BMF (Bundesministerium der Finanzen) und EU (Europäische Union).'
  );
  assert.deepEqual(
    root.querySelectorAll('[data-word-index]').map(node => node.textContent),
    ['Ein', 'BMF-Schreiben', 'erläutert', 'das', 'EU-Recht', 'Danach', 'folgen', 'BMF', 'und', 'EU']
  );
});

test('Andere Fächer und mehrdeutige Kurzformen werden nicht verändert', () => {
  assert.equal(typeof erklaereSteuerAbkuerzungen, 'function');
  const recht = tokenisierterText('AO und EStG').root;
  const steuern = tokenisierterText('AG, KG und UG').root;

  erklaereSteuerAbkuerzungen(recht, 'Recht');
  erklaereSteuerAbkuerzungen(steuern, 'Steuern');

  assert.equal(recht.textContent, 'AO und EStG');
  assert.equal(steuern.textContent, 'AG, KG und UG');
  assert.deepEqual(erklaerungen(recht), []);
  assert.deepEqual(erklaerungen(steuern), []);
});

test('Erklärung und erneute Tokenisierung erzeugen keine Duplikate oder neuen Wortindizes', () => {
  assert.equal(typeof erklaereSteuerAbkuerzungen, 'function');
  const { root } = tokenisierterText('AO gilt neben dem EStG.');
  const indizesVorher = root.querySelectorAll('[data-word-index]').map(node => node.getAttribute('data-word-index'));

  erklaereSteuerAbkuerzungen(root, 'Steuern');
  erklaereSteuerAbkuerzungen(root, 'Steuern');
  const zweiteTokenisierung = lerntexteDomTokenisieren(root);

  assert.deepEqual(erklaerungen(root), [' (Abgabenordnung)', ' (Einkommensteuergesetz)']);
  assert.ok(root.querySelectorAll('.lerntexte-abkuerzung-erklaerung')
    .every(node => node.getAttribute('data-podcast-ignore') === 'true'));
  assert.deepEqual(zweiteTokenisierung.words, []);
  assert.deepEqual(
    root.querySelectorAll('[data-word-index]').map(node => node.getAttribute('data-word-index')),
    indizesVorher
  );
});
