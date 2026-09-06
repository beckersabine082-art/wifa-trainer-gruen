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
    this.style = {};
    this.hidden = false;
    this.classList = {
      add: (...names) => names.forEach(name => this._addClass(name)),
      remove: (...names) => names.forEach(name => this._removeClass(name)),
      contains: name => this._classNames().includes(name)
    };
  }

  _classNames() {
    return String(this.className || '').split(/\s+/).filter(Boolean);
  }

  _addClass(name) {
    this.className = [...new Set([...this._classNames(), name])].join(' ');
  }

  _removeClass(name) {
    this.className = this._classNames().filter(existing => existing !== name).join(' ');
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

  set textContent(value) {
    this.childNodes = [];
    if (String(value || '')) this.appendChild(this.ownerDocument.createTextNode(value));
  }

  set innerHTML(value) {
    this.childNodes = [];
    const source = String(value || '');
    const tokens = source.match(/<\/?[a-z0-9-]+[^>]*>|[^<]+/gi) || [];
    const stack = [this];
    tokens.forEach(token => {
      if (token.startsWith('</')) {
        if (stack.length > 1) stack.pop();
        return;
      }

      if (token.startsWith('<')) {
        const tagMatch = token.match(/^<([a-z0-9-]+)/i);
        if (!tagMatch) return;
        const child = this.ownerDocument.createElement(tagMatch[1]);
        stack[stack.length - 1].appendChild(child);
        if (!token.endsWith('/>') && !['br', 'hr', 'img'].includes(tagMatch[1].toLowerCase())) stack.push(child);
        return;
      }

      stack[stack.length - 1].appendChild(this.ownerDocument.createTextNode(token));
    });
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      if (node.nodeType !== 1) return;
      const dataIndex = selector.match(/^\[data-word-index="(\d+)"\]$/);
      const matchesSelector = selector === '[data-word-index]'
        ? node.getAttribute('data-word-index') !== null
        : dataIndex
          ? node.getAttribute('data-word-index') === dataIndex[1]
          : selector.startsWith('.')
            ? node.classList.contains(selector.slice(1))
            : selector === '.lerntexte-text'
              ? node.classList.contains('lerntexte-text')
              : node.tagName.toLowerCase() === selector.toLowerCase();
      if (matchesSelector) matches.push(node);
      node.childNodes.forEach(visit);
    };
    this.childNodes.forEach(visit);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
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

class EventDocument extends MockDocument {
  constructor(elements = {}) {
    super();
    this.elements = elements;
    this.hidden = false;
    this.listeners = {};
  }

  getElementById(id) {
    return this.elements[id] || null;
  }

  addEventListener(type, listener) {
    (this.listeners[type] ||= new Set()).add(listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners[type]) this.listeners[type].delete(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners[event.type] || []) listener(event);
  }
}

class EventWindow {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, listener) {
    (this.listeners[type] ||= new Set()).add(listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners[type]) this.listeners[type].delete(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners[event.type] || []) listener(event);
  }
}

function createBlock2Context() {
  const sourceFiles = [
    '../js/podcast-dom-tokenize.js',
    '../js/podcast-time-to-word.js',
    '../js/podcast-visibility-sync.js',
    '../js/lerntexte.js'
  ];
  const root = new MockElement(null, 'div');
  const audio = new MockElement(null, 'audio');
  audio.currentTime = 0;
  audio.src = '';
  audio.duration = 120;
  audio.listeners = {};
  audio.addEventListener = function (type, listener) {
    (this.listeners[type] ||= new Set()).add(listener);
  };
  audio.removeEventListener = function (type, listener) {
    if (this.listeners[type]) this.listeners[type].delete(listener);
  };
  audio.dispatchEvent = function (event) {
    for (const listener of this.listeners[event.type] || []) listener(event);
  };
  audio.load = function () {};
  audio.pause = function () { this.paused = true; };
  audio.play = function () { return Promise.resolve(); };

  const status = new MockElement(null, 'div');
  const chapterLabel = new MockElement(null, 'strong');
  const pauseButton = new MockElement(null, 'button');
  const stopButton = new MockElement(null, 'button');
  const resumeButton = new MockElement(null, 'button');
  const restartButton = new MockElement(null, 'button');
  const elements = {
    lerntexteInhaltBereich: root,
    lerntexteAudioPlayer: audio,
    lerntexteAudioStatus: status,
    lerntexteAudioChapterLabel: chapterLabel,
    lerntexteAudioPauseBtn: pauseButton,
    lerntexteAudioStopBtn: stopButton,
    lerntextePilotResumeBtn: resumeButton,
    lerntextePilotRestartBtn: restartButton
  };
  const document = new EventDocument(elements);
  [root, audio, status, chapterLabel, pauseButton, stopButton, resumeButton, restartButton]
    .forEach(element => { element.ownerDocument = document; });
  const eventWindow = new EventWindow();
  const expectedHash = createHash('sha256').update('abc def ghi', 'utf8').digest('hex');
  const digestBytes = Uint8Array.from(expectedHash.match(/../g), byte => parseInt(byte, 16));
  const manifest = {
    lerntextHash: expectedHash,
    mp3Path: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3',
    jsonPath: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json',
    wortZeitmarken: [
      { wortIndex: 0, start: 0, end: 1 },
      { wortIndex: 1, start: 1, end: 2 },
      { wortIndex: 2, start: 2, end: 3 }
    ]
  };
  eventWindow.crypto = { subtle: { async digest() { return digestBytes.buffer; } } };
  eventWindow.lerntexteAudioVersionIstSynchron = (current, json, mp3) => current === json && json === mp3;
  eventWindow.lerntextePilotDependencies = {
    loadManifest: async () => manifest,
    loadMetadata: async () => ({ customMetadata: { lerntextHash: expectedHash } }),
    loadMp3Url: async () => 'https://example.test/pilot.mp3'
  };
  eventWindow.speechSynthesis = { speak() {} };

  const context = {
    window: eventWindow,
    document,
    navigator: {},
    escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    Promise,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    isFinite,
    console
  };
  const source = sourceFiles.map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n')
    + '\nwindow.__renderEntries = function(entries, fach) {'
    + 'lerntexteDaten = entries; lerntexteAktuellesFach = fach; lerntexteAktuellesKapitel = ""; lerntexteAnzeigen();'
    + '};';
  vm.runInNewContext(source, context);
  return { context, document, eventWindow, root, audio, status, manifest };
}

function block2PilotEntry() {
  return {
    fach: 'Recht',
    titel: 'Rechtssubjekte und Rechtsobjekte',
    lerntext: 'abc def ghi'
  };
}

function block2PlaylistItem(entry = block2PilotEntry()) {
  return { eintrag: entry, titel: entry.titel, text: entry.lerntext };
}

function configureBlock3Progress(fixture, progressData, uid = 'user-123') {
  const loadCalls = [];
  const saveCalls = [];
  fixture.eventWindow.aktuellerNutzer = uid;
  fixture.eventWindow.lerntextePodcastFortschrittLaden = async (user, fach) => {
    loadCalls.push([user, fach]);
    return { data: progressData };
  };
  fixture.eventWindow.lerntextePodcastFortschrittSpeichern = async state => {
    saveCalls.push(state);
    return { success: true };
  };
  return { loadCalls, saveCalls };
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

test('TASK 16 Block 2: realer Renderpfad tokenisiert nur den Pilot und erhält Formatierung', () => {
  const { context, root } = createBlock2Context();
  const pilot = Object.assign({}, block2PilotEntry(), {
    lerntext: 'Weitere Wörter.\nHINWEIS: Zweiter Absatz.'
  });

  context.window.__renderEntries([pilot], 'Recht');

  const textRoot = root.querySelector('.lerntexte-text');
  assert.ok(textRoot);
  assert.ok(textRoot.querySelector('p'));
  assert.ok(textRoot.querySelector('strong'));
  assert.ok(textRoot.querySelector('[data-word-index="0"]'));
  assert.strictEqual(textRoot.textContent.includes('Weitere Wörter.'), true);

  root.childNodes = [];
  context.window.__renderEntries([Object.assign({}, pilot, { titel: 'Vertragsarten' })], 'Recht');
  const legacyRoot = root.querySelector('.lerntexte-text');
  assert.ok(legacyRoot);
  assert.strictEqual(legacyRoot.querySelectorAll('[data-word-index]').length, 0);
});

test('TASK 16 Block 2: realer Pilotstart synchronisiert timeupdate, seeked und Gaps', async () => {
  const { context, root, audio, manifest } = createBlock2Context();
  const pilot = block2PilotEntry();
  context.window.__renderEntries([pilot], 'Recht');
  manifest.wortZeitmarken = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1, end: 2 },
    { wortIndex: 2, start: 2, end: 3 }
  ];

  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  audio.currentTime = 1.5;
  audio.dispatchEvent({ type: 'timeupdate' });
  assert.strictEqual(root.querySelector('[data-word-index="1"]').classList.contains('podcast-word-active'), true);
  assert.strictEqual(root.querySelector('[data-word-index="0"]').classList.contains('podcast-word-active'), false);

  audio.currentTime = 2.5;
  audio.dispatchEvent({ type: 'seeked' });
  assert.strictEqual(root.querySelector('[data-word-index="2"]').classList.contains('podcast-word-active'), true);

  manifest.wortZeitmarken = [
    { wortIndex: 0, start: 0, end: 1 },
    { wortIndex: 1, start: 1.5, end: 2 }
  ];
  audio.currentTime = 1.25;
  audio.dispatchEvent({ type: 'timeupdate' });
  assert.strictEqual(root.querySelectorAll('.podcast-word-active').length, 0);
});

test('TASK 16 Block 2: Visibility, pageshow und Cleanup verwenden den echten Session-Lifecycle', async () => {
  const { context, document, eventWindow, root, audio } = createBlock2Context();
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  const textRoot = root.querySelector('.lerntexte-text');

  audio.currentTime = 1.5;
  document.hidden = true;
  document.dispatchEvent({ type: 'visibilitychange' });
  assert.strictEqual(textRoot.querySelector('[data-word-index="0"]').classList.contains('podcast-word-active'), true);

  document.hidden = false;
  document.dispatchEvent({ type: 'visibilitychange' });
  assert.strictEqual(textRoot.querySelector('[data-word-index="1"]').classList.contains('podcast-word-active'), true);

  audio.currentTime = 2.5;
  eventWindow.dispatchEvent({ type: 'pageshow' });
  assert.strictEqual(textRoot.querySelector('[data-word-index="2"]').classList.contains('podcast-word-active'), true);

  const oldTimeupdateHandlers = new Set(audio.listeners.timeupdate);
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  for (const element of textRoot.querySelectorAll('.podcast-word-active')) element.classList.remove('podcast-word-active');
  for (const handler of oldTimeupdateHandlers) assert.strictEqual(audio.listeners.timeupdate.has(handler), false);
  audio.currentTime = 1.5;
  audio.dispatchEvent({ type: 'timeupdate' });
  assert.strictEqual(textRoot.querySelectorAll('.podcast-word-active').length, 1);
  assert.strictEqual((document.listeners.visibilitychange || new Set()).size, 1);
  assert.strictEqual((eventWindow.listeners.pageshow || new Set()).size, 1);
});

test('TASK 16 Block 2 Coverage: Pilot-Root und alte Session werden bei echtem Rerender verworfen', async () => {
  const { context, root, audio } = createBlock2Context();
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  const oldRoot = root.querySelector('.lerntexte-text');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  const oldText = oldRoot.textContent;
  const oldActiveCount = oldRoot.querySelectorAll('.podcast-word-active').length;

  context.window.__renderEntries([{
    fach: 'Recht',
    titel: 'Vertragsarten',
    lerntext: 'Legacy Text'
  }], 'Recht');
  audio.currentTime = 1.5;
  audio.dispatchEvent({ type: 'timeupdate' });

  assert.strictEqual(oldRoot.textContent, oldText);
  assert.strictEqual(oldRoot.querySelectorAll('.podcast-word-active').length, oldActiveCount);
  assert.strictEqual(root.querySelector('.lerntexte-text').querySelectorAll('[data-word-index]').length, 0);
});

test('TASK 16 Block 2 Coverage: initialer Resync nutzt die aktuelle Startposition', async () => {
  const { context, root, audio } = createBlock2Context();
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  audio.currentTime = 1.5;

  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);

  assert.strictEqual(root.querySelector('[data-word-index="1"]').classList.contains('podcast-word-active'), true);
});

test('TASK 16 Block 2 Coverage: seeked cleanup deaktiviert alte Handlerwirkung', async () => {
  const { context, root, audio } = createBlock2Context();
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  const textRoot = root.querySelector('.lerntexte-text');

  audio.currentTime = 2.5;
  audio.dispatchEvent({ type: 'seeked' });
  assert.strictEqual(textRoot.querySelector('[data-word-index="2"]').classList.contains('podcast-word-active'), true);

  audio.dispatchEvent({ type: 'ended' });
  for (const element of textRoot.querySelectorAll('.podcast-word-active')) element.classList.remove('podcast-word-active');
  audio.currentTime = 1.5;
  audio.dispatchEvent({ type: 'seeked' });
  assert.strictEqual(textRoot.querySelectorAll('.podcast-word-active').length, 0);
});

test('TASK 16 Block 2 Coverage: visibilitychange cleanup deaktiviert alte Handlerwirkung', async () => {
  const { context, document, root, audio } = createBlock2Context();
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  const textRoot = root.querySelector('.lerntexte-text');

  document.hidden = false;
  audio.currentTime = 1.5;
  document.dispatchEvent({ type: 'visibilitychange' });
  assert.strictEqual(textRoot.querySelector('[data-word-index="1"]').classList.contains('podcast-word-active'), true);

  audio.dispatchEvent({ type: 'ended' });
  for (const element of textRoot.querySelectorAll('.podcast-word-active')) element.classList.remove('podcast-word-active');
  audio.currentTime = 2.5;
  document.dispatchEvent({ type: 'visibilitychange' });
  assert.strictEqual(textRoot.querySelectorAll('.podcast-word-active').length, 0);
});

test('TASK 16 Block 2 Coverage: pageshow cleanup deaktiviert alte Handlerwirkung', async () => {
  const { context, eventWindow, root, audio } = createBlock2Context();
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  const textRoot = root.querySelector('.lerntexte-text');

  audio.currentTime = 2.5;
  eventWindow.dispatchEvent({ type: 'pageshow' });
  assert.strictEqual(textRoot.querySelector('[data-word-index="2"]').classList.contains('podcast-word-active'), true);

  audio.dispatchEvent({ type: 'ended' });
  for (const element of textRoot.querySelectorAll('.podcast-word-active')) element.classList.remove('podcast-word-active');
  audio.currentTime = 1.5;
  eventWindow.dispatchEvent({ type: 'pageshow' });
  assert.strictEqual(textRoot.querySelectorAll('.podcast-word-active').length, 0);
});

test('TASK 16 Block 2 Coverage: erneuter Pilotstart erzeugt keine doppelte Handlerwirkung', async () => {
  const { context, document, eventWindow, root, audio } = createBlock2Context();
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  const textRoot = root.querySelector('.lerntexte-text');
  const target = textRoot.querySelector('[data-word-index="1"]');
  const originalAdd = target.classList.add;
  let additions = 0;
  target.classList.add = function (...names) {
    additions += 1;
    return originalAdd.apply(this, names);
  };

  const assertSingleResync = dispatch => {
    for (const element of textRoot.querySelectorAll('.podcast-word-active')) element.classList.remove('podcast-word-active');
    additions = 0;
    dispatch();
    assert.strictEqual(additions, 1);
  };

  audio.currentTime = 1.5;
  assertSingleResync(() => audio.dispatchEvent({ type: 'timeupdate' }));
  assertSingleResync(() => audio.dispatchEvent({ type: 'seeked' }));
  document.hidden = false;
  assertSingleResync(() => document.dispatchEvent({ type: 'visibilitychange' }));
  assertSingleResync(() => eventWindow.dispatchEvent({ type: 'pageshow' }));
});

test('TASK 16 Block 2 Coverage: natürliches Pilot-Ende bereinigt alle Karaoke-Listener', async () => {
  const { context, document, eventWindow, root, audio } = createBlock2Context();
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  const textRoot = root.querySelector('.lerntexte-text');

  audio.dispatchEvent({ type: 'ended' });
  for (const element of textRoot.querySelectorAll('.podcast-word-active')) element.classList.remove('podcast-word-active');
  audio.currentTime = 1.5;
  audio.dispatchEvent({ type: 'timeupdate' });
  audio.dispatchEvent({ type: 'seeked' });
  document.hidden = false;
  document.dispatchEvent({ type: 'visibilitychange' });
  eventWindow.dispatchEvent({ type: 'pageshow' });

  assert.strictEqual(textRoot.querySelectorAll('.podcast-word-active').length, 0);
  assert.strictEqual((document.listeners.visibilitychange || new Set()).size, 0);
  assert.strictEqual((eventWindow.listeners.pageshow || new Set()).size, 0);
});

test('TASK 16 Block 3: Pilot lädt Progress erst nach Asset-Gate und Fortsetzen matched exakt', async () => {
  const fixture = createBlock2Context();
  const progress = configureBlock3Progress(fixture, [
    { nutzer: 'other', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte', firebasePfad: fixture.manifest.mp3Path, lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 11, wortIndex: 1, completed: false },
    { nutzer: 'user-123', fach: 'Recht', einheit: 'Andere Einheit', firebasePfad: fixture.manifest.mp3Path, lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 12, wortIndex: 1, completed: false },
    { nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte', firebasePfad: 'podcast/anderes.mp3', lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 13, wortIndex: 1, completed: false },
    { nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte', firebasePfad: fixture.manifest.mp3Path, lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 30, wortIndex: 1, completed: false }
  ]);
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  let playCount = 0;
  fixture.audio.play = () => { playCount += 1; return Promise.resolve(); };

  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);

  assert.deepStrictEqual(progress.loadCalls, [['user-123', 'Recht']]);
  assert.strictEqual(fixture.audio.currentTime, 0);
  await fixture.document.getElementById('lerntextePilotResumeBtn').onclick();
  assert.strictEqual(fixture.audio.currentTime, 30);
  assert.strictEqual(playCount, 2);
});

test('TASK 16 Block 3: alter Hash wird ignoriert und Sekunde 0 bleibt gültiger Resume-State', async () => {
  const fixture = createBlock2Context();
  configureBlock3Progress(fixture, [
    { nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte', firebasePfad: fixture.manifest.mp3Path, lerntextHash: 'old-hash', sekundenPosition: 30, wortIndex: 2, completed: false },
    { nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte', firebasePfad: fixture.manifest.mp3Path, lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 0, wortIndex: 0, completed: false }
  ]);
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  await fixture.document.getElementById('lerntextePilotResumeBtn').onclick();

  assert.strictEqual(fixture.audio.currentTime, 0);
});

test('TASK 16 Block 3: Pilot Pause und Stop speichern Position ohne Reset', async () => {
  const fixture = createBlock2Context();
  const progress = configureBlock3Progress(fixture, []);
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);

  fixture.audio.currentTime = 12.5;
  await fixture.document.getElementById('lerntexteAudioPauseBtn').onclick();
  assert.strictEqual(fixture.audio.currentTime, 12.5);
  assert.strictEqual(progress.saveCalls.at(-1).sekundenPosition, 12.5);
  assert.strictEqual(progress.saveCalls.at(-1).completed, false);

  fixture.audio.currentTime = 15;
  await fixture.document.getElementById('lerntexteAudioStopBtn').onclick();
  assert.strictEqual(fixture.audio.currentTime, 15);
  assert.strictEqual(progress.saveCalls.at(-1).sekundenPosition, 15);
  assert.strictEqual(progress.saveCalls.at(-1).completed, false);
});

test('TASK 16 Block 3: Gap speichert den letzten gültigen Wortindex statt -1', async () => {
  const fixture = createBlock2Context();
  const progress = configureBlock3Progress(fixture, []);
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  fixture.manifest.wortZeitmarken = [
    { wortIndex: 7, start: 0, end: 1 },
    { wortIndex: 8, start: 2, end: 3 }
  ];
  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  fixture.audio.currentTime = 0.5;
  fixture.audio.dispatchEvent({ type: 'timeupdate' });
  fixture.audio.currentTime = 1.5;
  fixture.audio.dispatchEvent({ type: 'timeupdate' });
  await fixture.document.getElementById('lerntexteAudioPauseBtn').onclick();

  assert.strictEqual(progress.saveCalls.at(-1).wortIndex, 7);
  assert.notStrictEqual(progress.saveCalls.at(-1).wortIndex, -1);
});

test('TASK 16 Block 3: Von vorne setzt 0, resynct sofort und löscht keinen Progress', async () => {
  const fixture = createBlock2Context();
  const progress = configureBlock3Progress(fixture, [
    { nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte', firebasePfad: fixture.manifest.mp3Path, lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 30, wortIndex: 2, completed: false }
  ]);
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  fixture.audio.currentTime = 2.5;
  await fixture.document.getElementById('lerntextePilotRestartBtn').onclick();

  assert.strictEqual(fixture.audio.currentTime, 0);
  assert.strictEqual(progress.saveCalls.length, 0);
});

test('TASK 16 Block 3: natürlicher Abschluss speichert vor Playlist-Weiterschaltung', async () => {
  const fixture = createBlock2Context();
  let resolveSave;
  let saveStarted = false;
  let legacyLoadStarted = false;
  fixture.eventWindow.aktuellerNutzer = 'user-123';
  fixture.eventWindow.lerntextePodcastFortschrittLaden = async () => ({ data: [] });
  fixture.eventWindow.lerntextePodcastFortschrittSpeichern = state => {
    saveStarted = state.completed === true;
    return new Promise(resolve => { resolveSave = resolve; });
  };
  fixture.eventWindow.lerntexteAudioDependencies = {
    loadUrl: async () => {
      legacyLoadStarted = true;
      return 'https://example.test/legacy.mp3';
    }
  };
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await fixture.context.window.lerntexteAudioPlaylistWeiter([
    block2PlaylistItem(),
    block2PlaylistItem({ fach: 'Recht', titel: 'Vertragsarten', lerntext: 'Legacy Text' })
  ], 0);
  fixture.audio.dispatchEvent({ type: 'ended' });
  await Promise.resolve();

  assert.strictEqual(saveStarted, true);
  assert.strictEqual(legacyLoadStarted, false);
  resolveSave({ success: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(legacyLoadStarted, true);
});

test('TASK 16 Block 2 Coverage: Nicht-Pilot erhält keine Karaoke-Listener', async () => {
  const { context, document, eventWindow, root, audio } = createBlock2Context();
  context.SpeechSynthesisUtterance = function () {};
  context.window.lerntexteAudioDependencies = {
    loadUrl: async () => { throw Object.assign(new Error('missing'), { code: 'storage/object-not-found' }); }
  };
  const legacy = { fach: 'Recht', titel: 'Vertragsarten', lerntext: 'Legacy Text' };
  context.window.__renderEntries([legacy], 'Recht');

  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem(legacy)], 0);

  assert.strictEqual(root.querySelector('.lerntexte-text').querySelectorAll('[data-word-index]').length, 0);
  assert.strictEqual((audio.listeners.timeupdate || new Set()).size, 0);
  assert.strictEqual((audio.listeners.seeked || new Set()).size, 0);
  assert.strictEqual((document.listeners.visibilitychange || new Set()).size, 0);
  assert.strictEqual((eventWindow.listeners.pageshow || new Set()).size, 0);
});

test('TASK 16 Block 2 Coverage: Mixed Playlist räumt Pilot vor Legacy auf', async () => {
  const { context, document, eventWindow, root, audio } = createBlock2Context();
  context.SpeechSynthesisUtterance = function () {};
  context.window.lerntexteAudioDependencies = {
    loadUrl: async () => { throw Object.assign(new Error('missing'), { code: 'storage/object-not-found' }); }
  };
  context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  audio.dispatchEvent({ type: 'ended' });

  const legacy = { fach: 'Recht', titel: 'Vertragsarten', lerntext: 'Legacy Text' };
  context.window.__renderEntries([legacy], 'Recht');
  await context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem(legacy)], 0);

  assert.strictEqual(root.querySelector('.lerntexte-text').querySelectorAll('[data-word-index]').length, 0);
  assert.strictEqual(audio.listeners.timeupdate.size, 0);
  assert.strictEqual(audio.listeners.seeked.size, 0);
  assert.strictEqual((document.listeners.visibilitychange || new Set()).size, 0);
  assert.strictEqual((eventWindow.listeners.pageshow || new Set()).size, 0);
});

test('TASK 16 Block 3 Coverage: Pilot bleibt ohne Auth sicher nutzbar', async () => {
  const fixture = createBlock2Context();
  let loadCalls = 0;
  let saveCalls = 0;
  fixture.eventWindow.aktuellerNutzer = null;
  fixture.eventWindow.lerntextePodcastFortschrittLaden = async () => { loadCalls += 1; return { data: [] }; };
  fixture.eventWindow.lerntextePodcastFortschrittSpeichern = async () => { saveCalls += 1; };
  fixture.eventWindow.__renderEntries([block2PilotEntry()], 'Recht');

  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);

  assert.strictEqual(loadCalls, 0);
  assert.strictEqual(saveCalls, 0);
  assert.strictEqual(fixture.audio.currentTime, 0);
});

test('TASK 16 Block 3 Coverage: Hash-Mismatch lädt keinen Progress', async () => {
  const fixture = createBlock2Context();
  let loadCalls = 0;
  fixture.eventWindow.aktuellerNutzer = 'user-123';
  fixture.eventWindow.lerntextePodcastFortschrittLaden = async () => { loadCalls += 1; return { data: [] }; };
  fixture.eventWindow.lerntextePodcastFortschrittSpeichern = async () => {};
  fixture.eventWindow.lerntexteAudioVersionIstSynchron = () => false;
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');

  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);

  assert.strictEqual(loadCalls, 0);
  assert.strictEqual(fixture.audio.src, '');
});

test('TASK 16 Block 3 Coverage: alter Hash wird weder gelöscht noch überschrieben', async () => {
  const fixture = createBlock2Context();
  const progress = configureBlock3Progress(fixture, [{
    nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte',
    firebasePfad: fixture.manifest.mp3Path, lerntextHash: 'old-hash', sekundenPosition: 30, wortIndex: 2, completed: false
  }]);
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');

  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  await fixture.document.getElementById('lerntextePilotResumeBtn').onclick();

  assert.strictEqual(fixture.audio.currentTime, 0);
  assert.strictEqual(progress.saveCalls.length, 0);
});

test('TASK 16 Block 3 Coverage: Fortsetzen resynct Karaoke sofort ohne Event', async () => {
  const fixture = createBlock2Context();
  configureBlock3Progress(fixture, [{
    nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte',
    firebasePfad: fixture.manifest.mp3Path, lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 2.5, wortIndex: 2, completed: false
  }]);
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  await fixture.document.getElementById('lerntextePilotResumeBtn').onclick();

  assert.strictEqual(fixture.audio.currentTime, 2.5);
  assert.strictEqual(fixture.root.querySelector('[data-word-index="2"]').classList.contains('podcast-word-active'), true);
});

test('TASK 16 Block 3 Coverage: completed Resume überspringt Pilot zur nächsten Einheit', async () => {
  const fixture = createBlock2Context();
  let playCount = 0;
  let legacyStarted = false;
  configureBlock3Progress(fixture, [{
    nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte',
    firebasePfad: fixture.manifest.mp3Path, lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 30, wortIndex: 2, completed: true
  }]);
  fixture.eventWindow.lerntexteAudioDependencies = {
    loadUrl: async () => { legacyStarted = true; return 'https://example.test/legacy.mp3'; }
  };
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  fixture.audio.play = () => { playCount += 1; return Promise.resolve(); };
  const legacy = { fach: 'Recht', titel: 'Vertragsarten', lerntext: 'Legacy Text' };

  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem(), block2PlaylistItem(legacy)], 0);
  await fixture.document.getElementById('lerntextePilotResumeBtn').onclick();

  assert.strictEqual(legacyStarted, true);
  assert.strictEqual(playCount, 2);
  assert.strictEqual(fixture.audio.currentTime, 0);
});

test('TASK 16 Block 3 Coverage: completed Resume ohne nächste Einheit zeigt Status', async () => {
  const fixture = createBlock2Context();
  configureBlock3Progress(fixture, [{
    nutzer: 'user-123', fach: 'Recht', einheit: 'Rechtssubjekte und Rechtsobjekte',
    firebasePfad: fixture.manifest.mp3Path, lerntextHash: fixture.manifest.lerntextHash, sekundenPosition: 30, wortIndex: 2, completed: true
  }]);
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  await fixture.document.getElementById('lerntextePilotResumeBtn').onclick();

  assert.match(fixture.status.textContent, /abgeschlossen|Von vorne/i);
  assert.strictEqual(fixture.audio.currentTime, 0);
});

test('TASK 16 Block 3 Coverage: Save-Fehler bei Pause bleibt sicher', async () => {
  const fixture = createBlock2Context();
  fixture.eventWindow.aktuellerNutzer = 'user-123';
  fixture.eventWindow.lerntextePodcastFortschrittLaden = async () => ({ data: [] });
  fixture.eventWindow.lerntextePodcastFortschrittSpeichern = async () => { throw new Error('save failed'); };
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  fixture.audio.currentTime = 12.5;

  await fixture.document.getElementById('lerntexteAudioPauseBtn').onclick();

  assert.strictEqual(fixture.audio.currentTime, 12.5);
  assert.strictEqual(fixture.context.window.speechSynthesis.speakCalled, undefined);
  assert.match(fixture.status.textContent, /Fortschritt|save/i);
});

test('TASK 16 Block 3 Coverage: Save-Fehler bei Stop bleibt sicher', async () => {
  const fixture = createBlock2Context();
  fixture.eventWindow.aktuellerNutzer = 'user-123';
  fixture.eventWindow.lerntextePodcastFortschrittLaden = async () => ({ data: [] });
  fixture.eventWindow.lerntextePodcastFortschrittSpeichern = async () => { throw new Error('save failed'); };
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');
  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);
  fixture.audio.currentTime = 15;

  fixture.document.getElementById('lerntexteAudioStopBtn').onclick();
  await new Promise(resolve => setImmediate(resolve));

  assert.strictEqual(fixture.audio.currentTime, 15);
  assert.strictEqual(fixture.context.window.speechSynthesis.speakCalled, undefined);
  assert.match(fixture.status.textContent, /Fortschritt|save/i);
});

test('TASK 16 Block 3 Coverage: Load-Fehler lässt Pilot normal von vorne laufen', async () => {
  const fixture = createBlock2Context();
  fixture.eventWindow.aktuellerNutzer = 'user-123';
  fixture.eventWindow.lerntextePodcastFortschrittLaden = async () => { throw new Error('load failed'); };
  fixture.eventWindow.lerntextePodcastFortschrittSpeichern = async () => {};
  fixture.context.window.__renderEntries([block2PilotEntry()], 'Recht');

  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem()], 0);

  assert.strictEqual(fixture.audio.currentTime, 0);
  assert.strictEqual(fixture.context.window.speechSynthesis.speakCalled, undefined);
});

test('TASK 16 Block 3 Coverage: Nicht-Pilot verwendet keine Progress-API', async () => {
  const fixture = createBlock2Context();
  let loadCalls = 0;
  let saveCalls = 0;
  fixture.context.SpeechSynthesisUtterance = function () {};
  fixture.eventWindow.speechSynthesis.pause = () => {};
  fixture.eventWindow.speechSynthesis.resume = () => {};
  fixture.eventWindow.speechSynthesis.cancel = () => {};
  fixture.eventWindow.aktuellerNutzer = 'user-123';
  fixture.eventWindow.lerntextePodcastFortschrittLaden = async () => { loadCalls += 1; return { data: [] }; };
  fixture.eventWindow.lerntextePodcastFortschrittSpeichern = async () => { saveCalls += 1; };
  fixture.eventWindow.lerntexteAudioDependencies = {
    loadUrl: async () => { throw Object.assign(new Error('missing'), { code: 'storage/object-not-found' }); }
  };
  const legacy = { fach: 'Recht', titel: 'Vertragsarten', lerntext: 'Legacy Text' };
  fixture.context.window.__renderEntries([legacy], 'Recht');

  await fixture.context.window.lerntexteAudioPlaylistWeiter([block2PlaylistItem(legacy)], 0);
  await fixture.context.lerntexteAudioPausieren();
  fixture.context.lerntexteAudioStoppen();

  assert.strictEqual(loadCalls, 0);
  assert.strictEqual(saveCalls, 0);
});

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

// ============================================================
// TASK 16 phase A pilot integration tests
// ============================================================

const { createHash } = require('node:crypto');

function readBrowserScriptOrder() {
  const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  return [...source.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1].split('?')[0]);
}

function createBrowserPilotContext({ manifest, metadata, digestBytes, validator } = {}) {
  const source = [
    '../js/podcast-time-to-word.js',
    '../js/podcast-visibility-sync.js',
    '../js/lerntexte.js'
  ].map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
  const calls = [];
  const status = { textContent: '' };
  const audio = {
    currentTime: 0,
    src: '',
    listeners: {},
    addEventListener(type, listener) {
      (this.listeners[type] ||= new Set()).add(listener);
    },
    removeEventListener(type, listener) {
      if (this.listeners[type]) this.listeners[type].delete(listener);
    },
    dispatchEvent(event) {
      for (const listener of this.listeners[event.type] || []) listener(event);
    },
    load() {},
    play() {
      calls.push('play');
      return Promise.resolve();
    }
  };
  const fakeDigestBytes = digestBytes || Uint8Array.from({ length: 32 }, (_, index) => index);
  const listeners = {};
  const addListener = (type, listener) => (listeners[type] ||= new Set()).add(listener);
  const removeListener = (type, listener) => listeners[type] && listeners[type].delete(listener);
  const context = {
    Promise,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    isFinite,
    navigator: {},
    document: {
      addEventListener: addListener,
      removeEventListener: removeListener,
      getElementById(id) {
        if (id === 'lerntexteAudioPlayer') return audio;
        if (id === 'lerntexteAudioStatus') return status;
        return null;
      }
    },
    window: {
      addEventListener: addListener,
      removeEventListener: removeListener,
      crypto: {
        subtle: {
          async digest() {
            calls.push('digest');
            return fakeDigestBytes.buffer;
          }
        }
      },
      lerntextePilotDependencies: {
        loadManifest: async () => { calls.push('manifest'); return manifest; },
        loadMetadata: async () => { calls.push('metadata'); return metadata; },
        loadMp3Url: async () => { calls.push('mp3-url'); return 'https://example.test/pilot.mp3'; }
      },
      lerntexteAudioVersionIstSynchron: validator || ((currentHash, jsonHash, mp3Hash) => {
        calls.push('hash');
        return currentHash === jsonHash && jsonHash === mp3Hash;
      }),
      speechSynthesis: { speak() { calls.push('speech'); } }
    }
  };

  vm.runInNewContext(source, context);
  return { context, calls, status, audio };
}

function browserPilotEntry() {
  return {
    fach: 'Recht',
    titel: 'Rechtssubjekte und Rechtsobjekte',
    lerntext: 'abc'
  };
}

function browserPilotManifest(hash, overrides = {}) {
  return Object.assign({
    lerntextHash: hash,
    mp3Path: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3',
    jsonPath: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json',
    wortZeitmarken: []
  }, overrides);
}

test('Pilot Integration: exakter Fach/Titel match für Recht – Rechtssubjekte und Rechtsobjekte', () => {
  const { lerntexteIstPilotEinheit } = require('../js/lerntexte.js');

  assert.strictEqual(lerntexteIstPilotEinheit('Recht', 'Rechtssubjekte und Rechtsobjekte'), true);
  assert.strictEqual(lerntexteIstPilotEinheit('Recht', 'Rechtsobjekte'), false);
  assert.strictEqual(lerntexteIstPilotEinheit('Steuern', 'Rechtssubjekte und Rechtsobjekte'), false);
  assert.strictEqual(lerntexteIstPilotEinheit('Recht', 'Rechtssubjekte und Rechtsobjekte '), false);
});

test('Pilot Integration: SHA-256 basiert nur auf rohem lerntext und ignoriert podcastText', async () => {
  const { lerntextePilotHash } = require('../js/lerntexte.js');
  const plain = 'Rechtssubjekte sind Träger von Rechten und Pflichten.';
  const expected = createHash('sha256').update(plain, 'utf8').digest('hex');

  assert.strictEqual(await lerntextePilotHash(plain), expected);
  assert.strictEqual(await lerntextePilotHash(plain, 'anderer podcastText'), expected);
  assert.notStrictEqual(await lerntextePilotHash(plain, 'anderer podcastText'), createHash('sha256').update('anderer podcastText', 'utf8').digest('hex'));
});

test('Pilot Integration: Browser-WebCrypto liefert für abc den bekannten SHA-256-String', async () => {
  const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const digestBytes = Uint8Array.from(expected.match(/../g), byte => parseInt(byte, 16));
  const { context } = createBrowserPilotContext({ digestBytes });

  const result = await context.window.lerntextePilotHash('abc');

  assert.equal(typeof result, 'string');
  assert.match(result, /^[0-9a-f]{64}$/);
  assert.strictEqual(result, expected);
});

test('Pilot Integration: Helper-Scripts vor lerntexte.js geladen', () => {
  const order = readBrowserScriptOrder();
  const indexLerntexte = order.indexOf('js/lerntexte.js');
  assert.notStrictEqual(indexLerntexte, -1, 'lerntexte.js vorhanden');
  assert.ok(indexLerntexte > order.indexOf('js/podcast-hash-validate.js'), 'hash-helper vor lerntexte.js');
  assert.ok(indexLerntexte > order.indexOf('js/podcast-dom-tokenize.js'), 'tokenizer-helper vor lerntexte.js');
  assert.ok(indexLerntexte > order.indexOf('js/podcast-time-to-word.js'), 'time-to-word-helper vor lerntexte.js');
  assert.ok(indexLerntexte > order.indexOf('js/podcast-visibility-sync.js'), 'visibility-helper vor lerntexte.js');
});

test('Pilot Integration: realer Playlist-Flow lädt Assets und gated play über Triple-Hash', async () => {
  const { lerntexteAudioPlaylistWeiter } = require('../js/lerntexte.js');
  assert.equal(typeof lerntexteAudioPlaylistWeiter, 'function', 'realer Playlist-Einstieg muss testbar sein');

  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalSpeechSynth = global.speechSynthesis;
  const calls = [];
  const audio = {
    currentTime: 0,
    duration: 120,
    listeners: {},
    addEventListener(type, listener) {
      (this.listeners[type] ||= new Set()).add(listener);
    },
    removeEventListener(type, listener) {
      if (this.listeners[type]) this.listeners[type].delete(listener);
    },
    play() {
      calls.push('play');
      return Promise.resolve();
    },
    load() {}
  };
  const status = { textContent: '' };
  const currentHash = createHash('sha256').update('Pilot lerntext', 'utf8').digest('hex');
  const manifest = {
    lerntextHash: currentHash,
    mp3Path: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3',
    jsonPath: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json',
    wortZeitmarken: []
  };

  global.window = {
    lerntextePilotDependencies: {
      loadManifest() {
        calls.push('manifest');
        return Promise.resolve(manifest);
      },
      loadMetadata() {
        calls.push('metadata');
        return Promise.resolve({ customMetadata: { lerntextHash: currentHash } });
      },
      loadMp3Url() {
        calls.push('mp3-url');
        return Promise.resolve('https://example.test/pilot.mp3');
      }
    },
    lerntexteAudioVersionIstSynchron(currentHash, jsonHash, mp3Hash) {
      calls.push('hash');
      return currentHash === jsonHash && jsonHash === mp3Hash;
    },
    speechSynthesis: { speak() { calls.push('speech'); } }
  };
  global.document = {
    getElementById(id) {
      if (id === 'lerntexteAudioPlayer') return audio;
      if (id === 'lerntexteAudioStatus') return status;
      return null;
    }
  };
  global.speechSynthesis = global.window.speechSynthesis;

  try {
    await lerntexteAudioPlaylistWeiter([{
      eintrag: {
        fach: 'Recht',
        titel: 'Rechtssubjekte und Rechtsobjekte',
        lerntext: 'Pilot lerntext'
      },
      titel: 'Rechtssubjekte und Rechtsobjekte',
      text: 'Pilot lerntext'
    }], 0);

    assert.deepStrictEqual(calls.slice(0, 5), ['manifest', 'metadata', 'mp3-url', 'hash', 'play'], status.textContent);
    assert.strictEqual(audio.src, 'https://example.test/pilot.mp3');
    assert.strictEqual(calls.includes('speech'), false);
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.speechSynthesis = originalSpeechSynth;
  }
});

test('Pilot Integration: realer Playlist-Flow blockiert bei Hash-Mismatch play und speech', async () => {
  const { lerntexteAudioPlaylistWeiter } = require('../js/lerntexte.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalSpeechSynth = global.speechSynthesis;
  let playCalled = false;
  let speechCalled = false;
  const status = { textContent: '' };
  const audio = { load() {}, play() { playCalled = true; return Promise.resolve(); } };
  const manifest = {
    lerntextHash: 'manifest-hash',
    mp3Path: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3',
    jsonPath: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json',
    wortZeitmarken: []
  };

  global.window = {
    lerntextePilotDependencies: {
      loadManifest: async () => manifest,
      loadMetadata: async () => ({ customMetadata: { lerntextHash: 'different' } }),
      loadMp3Url: async () => 'https://example.test/pilot.mp3'
    },
    lerntexteAudioVersionIstSynchron: () => false,
    speechSynthesis: { speak() { speechCalled = true; } }
  };
  global.document = {
    getElementById(id) {
      if (id === 'lerntexteAudioPlayer') return audio;
      if (id === 'lerntexteAudioStatus') return status;
      return null;
    }
  };
  global.speechSynthesis = global.window.speechSynthesis;

  try {
    await lerntexteAudioPlaylistWeiter([{
      eintrag: { fach: 'Recht', titel: 'Rechtssubjekte und Rechtsobjekte', lerntext: 'Pilot lerntext' },
      titel: 'Rechtssubjekte und Rechtsobjekte',
      text: 'Pilot lerntext'
    }], 0);

    assert.strictEqual(playCalled, false);
    assert.strictEqual(speechCalled, false);
    assert.strictEqual(status.textContent, 'Podcast muss aktualisiert werden.');
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.speechSynthesis = originalSpeechSynth;
  }
});

test('Pilot Integration: realer Playlist-Flow blockiert bei Asset-Fehler speech', async () => {
  const { lerntexteAudioPlaylistWeiter } = require('../js/lerntexte.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalSpeechSynth = global.speechSynthesis;
  let playCalled = false;
  let speechCalled = false;
  const status = { textContent: '' };
  const audio = { load() {}, play() { playCalled = true; return Promise.resolve(); } };
  global.window = {
    lerntextePilotDependencies: {
      loadManifest: async () => { throw Object.assign(new Error('missing'), { code: 'storage/object-not-found' }); },
      loadMetadata: async () => ({ customMetadata: { lerntextHash: 'unused' } }),
      loadMp3Url: async () => 'https://example.test/pilot.mp3'
    },
    speechSynthesis: { speak() { speechCalled = true; } }
  };
  global.document = {
    getElementById(id) {
      if (id === 'lerntexteAudioPlayer') return audio;
      if (id === 'lerntexteAudioStatus') return status;
      return null;
    }
  };
  global.speechSynthesis = global.window.speechSynthesis;

  try {
    await lerntexteAudioPlaylistWeiter([{
      eintrag: { fach: 'Recht', titel: 'Rechtssubjekte und Rechtsobjekte', lerntext: 'Pilot lerntext' },
      titel: 'Rechtssubjekte und Rechtsobjekte',
      text: 'Pilot lerntext'
    }], 0);

    assert.strictEqual(playCalled, false);
    assert.strictEqual(speechCalled, false);
    assert.strictEqual(status.textContent, 'Podcast konnte nicht geladen werden.');
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.speechSynthesis = originalSpeechSynth;
  }
});

test('Pilot Integration: Nicht-Pilot behält Speech-Fallback bei object-not-found', async () => {
  const { lerntexteAudioPlaylistWeiter } = require('../js/lerntexte.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalSpeechSynth = global.speechSynthesis;
  const originalUtterance = global.SpeechSynthesisUtterance;
  let speechCalled = false;
  const audio = { load() {}, play() { throw new Error('Audio darf im Fallback nicht spielen'); } };
  global.window = {
    lerntexteAudioDependencies: {
      loadUrl: async () => { throw Object.assign(new Error('missing'), { code: 'storage/object-not-found' }); }
    },
    speechSynthesis: { speak() { speechCalled = true; } }
  };
  global.SpeechSynthesisUtterance = function () {};
  global.document = {
    getElementById(id) {
      if (id === 'lerntexteAudioPlayer') return audio;
      return null;
    }
  };
  global.speechSynthesis = global.window.speechSynthesis;

  try {
    await lerntexteAudioPlaylistWeiter([{
      eintrag: { fach: 'Recht', titel: 'Andere Rechtseinheit', lerntext: 'Legacy lerntext' },
      titel: 'Andere Rechtseinheit',
      text: 'Legacy lerntext'
    }], 0);

    assert.strictEqual(speechCalled, true);
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.speechSynthesis = originalSpeechSynth;
    global.SpeechSynthesisUtterance = originalUtterance;
  }
});

test('Pilot Integration: Triple-Hash-Mismatch blockiert play und speech', async () => {
  const { lerntextePilotAudioStarten } = require('../js/lerntexte.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalSpeechSynth = global.speechSynthesis;
  let playCalled = false;
  let speechCalled = false;

  const audio = {
    currentTime: 12,
    src: '',
    play() {
      playCalled = true;
      return Promise.resolve();
    }
  };

  global.window = { speechSynthesis: { speak() { speechCalled = true; } } };
  global.document = {
    getElementById(id) {
      if (id === 'lerntexteAudioPlayer') return audio;
      return null;
    }
  };
  global.speechSynthesis = global.window.speechSynthesis;

  try {
    await lerntextePilotAudioStarten({
      fach: 'Recht',
      titel: 'Rechtssubjekte und Rechtsobjekte',
      lerntext: 'Rechtssubjekte sind Träger von Rechten und Pflichten.',
      firebasePfad: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3'
    }, {
      lerntextHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      mp3Path: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3',
      jsonPath: 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json',
      wortZeitmarken: [{ wortIndex: 0, start: 0, end: 1 }]
    }, {
      customMetadata: { lerntextHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }
    }, { currentTime: 12 });

    assert.strictEqual(playCalled, false, 'play() darf bei Hash-Mismatch nicht aufgerufen werden');
    assert.strictEqual(speechCalled, false, 'speechSynthesis.speak() darf bei Pilot-Fehler nicht aufgerufen werden');
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.speechSynthesis = originalSpeechSynth;
  }
});

test('Pilot Integration: Pilot-Asset-Fehler blockiert speechSynthesis', async () => {
  const { lerntextePilotAudioStarten } = require('../js/lerntexte.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalSpeechSynth = global.speechSynthesis;
  let speechCalled = false;
  let statusText = '';

  const audio = {
    currentTime: 5,
    src: '',
    listeners: {},
    addEventListener(type, listener) {
      (this.listeners[type] ||= new Set()).add(listener);
    },
    removeEventListener(type, listener) {
      if (this.listeners[type]) this.listeners[type].delete(listener);
    },
    listeners: {},
    addEventListener(type, listener) {
      (this.listeners[type] ||= new Set()).add(listener);
    },
    removeEventListener(type, listener) {
      if (this.listeners[type]) this.listeners[type].delete(listener);
    },
    dispatchEvent(event) {
      for (const listener of this.listeners[event.type] || []) listener(event);
    },
    play() { return Promise.resolve(); }
  };

  global.window = { speechSynthesis: { speak() { speechCalled = true; } } };
  global.document = {
    getElementById(id) {
      if (id === 'lerntexteAudioPlayer') return audio;
      if (id === 'lerntexteAudioStatus') return { textContent: '' };
      return null;
    }
  };
  global.speechSynthesis = global.window.speechSynthesis;

  try {
    await lerntextePilotAudioStarten({
      fach: 'Recht',
      titel: 'Rechtssubjekte und Rechtsobjekte',
      lerntext: 'Rechtssubjekte sind Träger von Rechten und Pflichten.'
    }, null, null, { currentTime: 5 });

    assert.strictEqual(speechCalled, false, 'speechSynthesis.speak() darf bei Asset-Fehler nicht aufgerufen werden');
    assert.ok(global.document.getElementById('lerntexteAudioStatus') !== null, 'Status-Element muss existieren');
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.speechSynthesis = originalSpeechSynth;
  }
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

test('Pilot Integration: Browser-WebCrypto validiert den realen Playlist-Flow vor play', async () => {
  const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const digestBytes = Uint8Array.from(expected.match(/../g), byte => parseInt(byte, 16));
  const { context, calls, audio } = createBrowserPilotContext({
    digestBytes,
    manifest: browserPilotManifest(expected),
    metadata: { customMetadata: { lerntextHash: expected } },
    validator(currentHash, jsonHash, mp3Hash) {
      calls.push('hash');
      assert.equal(typeof currentHash, 'string');
      return currentHash === jsonHash && jsonHash === mp3Hash;
    }
  });

  await context.window.lerntexteAudioPlaylistWeiter([{
    eintrag: browserPilotEntry(),
    titel: browserPilotEntry().titel,
    text: 'abc'
  }], 0);

  assert.deepStrictEqual(calls, ['manifest', 'metadata', 'mp3-url', 'digest', 'hash', 'play']);
  assert.strictEqual(audio.src, 'https://example.test/pilot.mp3');
  assert.strictEqual(calls.includes('speech'), false);
});

for (const [name, overrides] of [
  ['falschem MP3-Pfad', { mp3Path: 'podcast/anderes.mp3' }],
  ['fehlenden Wortzeitmarken', { wortZeitmarken: undefined }],
  ['fehlendem Metadata-Hash', null]
]) {
  test(`Pilot Integration: Browser-Schemafehler ${name} blockiert play und speech`, async () => {
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const digestBytes = Uint8Array.from(expected.match(/../g), byte => parseInt(byte, 16));
    const { context, calls, status, audio } = createBrowserPilotContext({
      digestBytes,
      manifest: browserPilotManifest(expected, overrides || {}),
      metadata: overrides === null ? {} : { customMetadata: { lerntextHash: expected } }
    });

    await context.window.lerntexteAudioPlaylistWeiter([{
      eintrag: browserPilotEntry(),
      titel: browserPilotEntry().titel,
      text: 'abc'
    }], 0);

    assert.strictEqual(calls.includes('play'), false);
    assert.strictEqual(calls.includes('speech'), false);
    assert.ok(status.textContent.length > 0);
    assert.strictEqual(audio.src, '');
  });
}

test('Pilot Integration: öffentliche Audio-API ignoriert ungeprüften validationOverride', async () => {
  const { lerntextePilotAudioStarten } = require('../js/lerntexte.js');
  const originalDocument = global.document;
  const originalWindow = global.window;
  let playCalled = false;
  const audio = {
    play() {
      playCalled = true;
      return Promise.resolve();
    }
  };

  global.window = { speechSynthesis: { speak() {} } };
  global.document = {
    getElementById(id) {
      if (id === 'lerntexteAudioPlayer') return audio;
      return null;
    }
  };

  try {
    await lerntextePilotAudioStarten(
      browserPilotEntry(),
      browserPilotManifest('manifest-hash'),
      { customMetadata: { lerntextHash: 'metadata-hash' } },
      null,
      { valid: true, currentHash: 'gefälscht' }
    );

    assert.strictEqual(playCalled, false);
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
  }
});

test('Pilot Integration: realer Playlist-Flow blockiert falschen Manifest-jsonPath', async () => {
  const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const digestBytes = Uint8Array.from(expected.match(/../g), byte => parseInt(byte, 16));
  const { context, calls, status, audio } = createBrowserPilotContext({
    digestBytes,
    manifest: browserPilotManifest(expected, { jsonPath: 'podcast/falsch.json' }),
    metadata: { customMetadata: { lerntextHash: expected } }
  });

  await context.window.lerntexteAudioPlaylistWeiter([{
    eintrag: browserPilotEntry(),
    titel: browserPilotEntry().titel,
    text: 'abc'
  }], 0);

  assert.strictEqual(calls.includes('play'), false);
  assert.strictEqual(calls.includes('speech'), false);
  assert.ok(status.textContent.length > 0);
  assert.strictEqual(audio.src, '');
});