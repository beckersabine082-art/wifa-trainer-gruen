const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/pruefungssimulation.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values);
    }
  };
}

function findStoredRun(storage) {
  const entry = Object.entries(storage.snapshot()).find(([key]) => /pruefung/i.test(key));
  assert.ok(entry, 'kein gespeicherter Prüfungslauf gefunden');
  return JSON.parse(entry[1]);
}

function createHarness({ clock = { value: 1_000_000 }, storage = createStorage(), fields = [] } = {}) {
  const elements = new Map();
  const intervals = new Map();
  let nextIntervalId = 1;

  function element(id) {
    if (!elements.has(id)) {
      const created = {
        id,
        innerHTML: '',
        textContent: '',
        style: {},
        disabled: false,
        options: [],
        selectedIndex: 0,
        addEventListener() {},
        appendChild(child) { this.options.push(child); },
        querySelectorAll() { return []; }
      };
      let value = '';
      Object.defineProperty(created, 'value', {
        configurable: true,
        get() { return value; },
        set(nextValue) {
          value = String(nextValue ?? '');
          const index = this.options.findIndex(option => String(option.value) === value);
          if (index >= 0) this.selectedIndex = index;
        }
      });
      elements.set(id, created);
    }
    return elements.get(id);
  }

  const document = {
    getElementById: element,
    createElement() {
      return { value: '', textContent: '', dataset: {} };
    },
    querySelectorAll(selector) {
      if (selector.includes('textarea.pruefung-antwort')) return fields;
      if (selector.includes('#pruefungContainer textarea, #pruefungContainer input')) return fields;
      if (selector.includes('#pruefungContainer button')) return [];
      if (selector.includes('.skizzen-canvas')) return [];
      return [];
    }
  };

  const context = {
    console,
    window: {},
    document,
    sessionStorage: storage,
    localStorage: storage,
    Date: { now: () => clock.value },
    setInterval(callback) {
      const id = nextIntervalId++;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    setTimeout,
    clearTimeout,
    alert() {},
    confirm: () => true,
    escapeHtml: String,
    sanitizeAufgabenHtml: value => String(value ?? ''),
    pruefungTimerInterval: null,
    pruefungRestzeitSekunden: 0,
    aktuellePruefungsDaten: [],
    letztePruefungsAntworten: []
  };

  vm.createContext(context);
  vm.runInContext(source, context);

  return {
    context,
    elements,
    runIntervals() {
      for (const callback of [...intervals.values()]) callback();
    }
  };
}

function examContext(teilbereich) {
  return { teilbereich, simulation: '1', einheit: teilbereich === 'WQ' ? 'VWL/BWL' : 'HQ_A1' };
}

test('Prüfungstimer bietet keinen sichtbaren Stop-/Pause-Weg mehr', () => {
  assert.doesNotMatch(indexHtml, /onclick="stoppePruefungTimer\(\)"/);
  assert.doesNotMatch(indexHtml, />\s*Timer stoppen\s*</);
});

test('gestartete WQ- und HQ-Prüfungen speichern eine absolute Endzeit', () => {
  for (const teilbereich of ['WQ', 'HQ']) {
    const harness = createHarness();
    harness.context.startePruefungTimer(5, examContext(teilbereich));
    const lauf = findStoredRun(harness.context.sessionStorage);

    assert.equal(lauf.teilbereich, teilbereich);
    assert.equal(lauf.endTime, 1_300_000);
    assert.equal(harness.elements.get('pruefungTimerText').textContent, '05:00');
  }
});

test('Reload eines laufenden WQ- oder HQ-Laufs setzt die Restzeit nicht zurück', () => {
  for (const teilbereich of ['WQ', 'HQ']) {
    const storage = createStorage();
    const first = createHarness({ storage });
    first.context.startePruefungTimer(5, examContext(teilbereich));

    const clock = { value: 1_120_000 };
    const reloaded = createHarness({ storage, clock });
    reloaded.context.startePruefungTimer(5, examContext(teilbereich));

    assert.equal(reloaded.elements.get('pruefungTimerText').textContent, '03:00');
  }
});

test('Timerende bei 00:00 sperrt Eingaben und startet die Auswertung genau einmal', async () => {
  const clock = { value: 1_000_000 };
  const textarea = { value: 'Antwort', disabled: false, style: {}, dataset: {}, closest: () => null };
  const harness = createHarness({ clock, fields: [textarea] });
  let evaluations = 0;
  harness.context.bewertePruefungsAntworten = async () => {
    evaluations++;
    return { success: true, data: { aufgaben: [] } };
  };
  harness.context.renderPruefungsAuswertung = () => {};
  harness.context.erstellePruefungsSpeicherPayload = () => null;

  harness.context.startePruefungTimer(1, examContext('WQ'));
  clock.value = 1_060_000;
  harness.runIntervals();
  harness.runIntervals();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(harness.elements.get('pruefungTimerText').textContent, '00:00');
  assert.equal(textarea.disabled, true);
  assert.equal(evaluations, 1);
});

test('manuelle Abgabe verwendet denselben einmaligen Auswertungsweg und sperrt Antworten', async () => {
  const textarea = { value: 'Antwort', disabled: false, style: {}, dataset: {}, closest: () => null };
  const harness = createHarness({ fields: [textarea] });
  let evaluations = 0;
  harness.context.bewertePruefungsAntworten = async () => {
    evaluations++;
    return { success: true, data: { aufgaben: [] } };
  };
  harness.context.renderPruefungsAuswertung = () => {};
  harness.context.erstellePruefungsSpeicherPayload = () => null;
  vm.runInContext('pruefungIstAktiv = true', harness.context);

  harness.context.pruefungManuellAbgeben();
  harness.context.pruefungManuellAbgeben();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(textarea.disabled, true);
  assert.equal(evaluations, 1);
});

test('abgelaufener gespeicherter Lauf wird beim erneuten Laden sofort ausgewertet', async () => {
  const storage = createStorage();
  const first = createHarness({ storage });
  first.context.startePruefungTimer(5, examContext('HQ'));

  const textarea = { value: 'Gespeicherte Antwort', disabled: false, style: {}, dataset: {}, closest: () => null };
  const reloaded = createHarness({
    storage,
    clock: { value: 1_400_000 },
    fields: [textarea]
  });
  let evaluations = 0;
  reloaded.context.bewertePruefungsAntworten = async () => {
    evaluations++;
    return { success: true, data: { aufgaben: [] } };
  };
  reloaded.context.renderPruefungsAuswertung = () => {};
  reloaded.context.erstellePruefungsSpeicherPayload = () => null;

  reloaded.context.startePruefungTimer(5, examContext('HQ'));
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(textarea.disabled, true);
  assert.equal(evaluations, 1);
});

test('Reload stellt gespeicherte Antworten wieder her und lässt sie bis zum Ablauf bearbeiten', async () => {
  const storage = createStorage();
  const first = createHarness({ storage });
  first.context.startePruefungTimer(5, examContext('WQ'));
  const lauf = findStoredRun(storage);
  lauf.antworten = [{ index: 0, value: 'Vor dem Reload eingegeben' }];
  storage.setItem('wifa.pruefung.lauf.v1', JSON.stringify(lauf));

  const listeners = {};
  const textarea = {
    value: '',
    disabled: false,
    style: {},
    dataset: {
      index: '0',
      simulationId: 'WQ_VWL_SIM_1',
      aufgabe: '1',
      teilaufgabe: 'a',
      fach: 'VWL/BWL',
      thema: 'Markt',
      fragetyp: 'text',
      punkte: '5',
      frage: 'Frage',
      musterloesung: 'Lösung',
      stichpunkte: 'Kriterium'
    },
    closest: () => null,
    addEventListener(name, callback) { listeners[name] = callback; }
  };
  const reloaded = createHarness({
    storage,
    clock: { value: 1_120_000 },
    fields: [textarea]
  });
  let fetches = 0;
  reloaded.context.fetch = async () => { fetches++; return ({
    ok: true,
    json: async () => ({
      einheiten: [{
        teilbereich: 'WQ',
        simulation: '1',
        einheit: 'VWL/BWL',
        aufgaben: [{
          simulationId: 'WQ_VWL_SIM_1',
          aufgabe: 1,
          teilaufgabe: 'a',
          fach: 'VWL/BWL',
          thema: 'Markt',
          fragetyp: 'text',
          frage: 'Frage',
          musterloesung: 'Lösung',
          stichpunkte: 'Kriterium',
          punkte: 5,
          situation: 'Situation'
        }]
      }]
    })
  }); };

  await reloaded.context.stelleLaufendePruefungWiederHer();
  assert.equal(textarea.value, 'Vor dem Reload eingegeben');
  assert.equal(textarea.disabled, false);
  textarea.value = 'Nach dem Reload geändert';
  listeners.input();
  assert.equal(findStoredRun(storage).antworten[0].value, 'Nach dem Reload geändert');
});
