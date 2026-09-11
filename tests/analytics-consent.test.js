const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function boot({origin = 'https://beckersabine082-art.github.io', pathname='/wifa-trainer-gruen/', consent, blocked = false} = {}) {
  const storage = new Map(consent ? [['wifa.analytics.consent.v1', JSON.stringify(consent)]] : []);
  const frames = [], elements = new Map(), timers = [];
  class Element extends EventTarget {
    hidden = false; textContent = ''; children = []; style = {}; checked = false;
    appendChild(el) { this.children.push(el); if (el.tag === 'iframe') frames.push(el); return el; }
    setAttribute() {} focus() {} showModal() { this.open = true; } close() { this.open = false; }
    remove() { this.removed = true; }
  }
  const doc = Object.assign(new EventTarget(), {
    body: new Element(), cookie: '',
    createElement(tag) { const el = new Element(); el.tag = tag; return el; },
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    querySelector() { return {id:'startView'}; }
  });
  const win = Object.assign(new EventTarget(), {
    location: {origin, pathname, hostname: new URL(origin).hostname},
    WIFA_ANALYTICS_SETTINGS: {enabled:true, measurementId:'G-TEST123', productionOrigin:'https://beckersabine082-art.github.io', productionPath:'/wifa-trainer-gruen/'},
    localStorage: {getItem:k => storage.get(k) || null, setItem(k,v) {if (blocked) throw Error(); storage.set(k,v);}},
  });
  const ctx = {window:win, document:doc, Date, Set, Map, WeakMap, URL, setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;}, clearTimeout:()=>{}};
  vm.runInNewContext(fs.readFileSync('js/analytics-core.js','utf8'),ctx);
  vm.runInNewContext(fs.readFileSync('js/analytics-consent.js','utf8'),ctx);
  return {win, doc, frames, storage, elements, timers};
}
test('no iframe before consent or after refusal; grant creates only one; revoke destroys it', () => {
  const b = boot(); assert.equal(b.frames.length,0);
  b.win.WifaAnalytics.choose(false); assert.equal(b.frames.length,0);
  b.win.WifaAnalytics.choose(true); b.win.WifaAnalytics.choose(true);
  assert.equal(b.frames.length,1);
  b.win.WifaAnalytics.choose(false); assert.equal(b.frames[0].removed,true);
  assert.equal(b.win.WifaAnalytics.authorized(), false);
});
test('localhost, absent configuration, storage failure and test exclusion fail closed', () => {
  for (const opts of [{origin:'http://localhost:8080'}, {blocked:true}]) {
    const b = boot(opts); b.win.WifaAnalytics.choose(true); assert.equal(b.frames.length,0);
  }
  const b = boot(); b.win.WIFA_ANALYTICS_SETTINGS.enabled = false;
  b.win.WifaAnalytics.choose(true); assert.equal(b.frames.length,0);
  const c = boot(); c.win.WifaAnalytics.exclude(true); c.win.WifaAnalytics.choose(true);
  assert.equal(c.frames.length,0);
});
test('expired and future consent never loads analytics; persisted current consent does', () => {
  for (const at of [0, Date.now()+100000]) {
    assert.equal(boot({consent:{accepted:true, at}}).frames.length,0);
  }
  assert.equal(boot({consent:{accepted:true, at:Date.now()}}).frames.length,1);
});
test('cross-tab revocation invalidates transport immediately', () => {
  const b = boot(); b.win.WifaAnalytics.choose(true);
  b.storage.set('wifa.analytics.consent.v1', JSON.stringify({accepted:false,at:Date.now()}));
  b.win.dispatchEvent(new Event('storage'));
  assert.equal(b.frames[0].removed,true);
  assert.equal(b.win.WifaAnalytics.authorized(),false);
});
test('expiry timer fits browser range and reschedules without removing valid consent', () => {
  const b = boot(); b.win.WifaAnalytics.choose(true);
  assert.ok(b.timers[0].ms > 0 && b.timers[0].ms <= 2147483647);
  b.timers[0].fn();
  assert.equal(b.frames[0].removed, undefined);
  assert.equal(b.timers.length,2);
});
test('failed persistence must never undo a withdrawal on the next refresh', () => {
  const b = boot({consent:{accepted:true,at:Date.now()}, blocked:true});
  assert.equal(b.frames.length,1);
  b.win.WifaAnalytics.choose(false);
  b.win.dispatchEvent(new Event('storage'));
  assert.equal(b.win.WifaAnalytics.authorized(),false);
  assert.equal(b.frames.length,1);
});
test('published test and preview pages are excluded even on the production host', () => {
  const b=boot({pathname:'/wifa-trainer-gruen/tests/analytics-browser.html'});
  b.win.WifaAnalytics.choose(true); assert.equal(b.frames.length,0);
});
