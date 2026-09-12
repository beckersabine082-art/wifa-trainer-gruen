const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load(file, extras = {}) {
  const context = vm.createContext({ window: {}, Map, WeakMap, Set, URL, Date, ...extras });
  if (file !== 'usage-core.js') vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'usage-core.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(/export function /g, 'function ');
  vm.runInContext(source, context);
  return context;
}
const plain = value => JSON.parse(JSON.stringify(value));
function core() {
  const events = [];
  const env = load('usage-core.js');
  const api = env.window.createWifaUsageCore(event => events.push(plain(event)));
  api.setEnabled(true);
  return {api, events};
}
test('core uses only fixed dimensions and meaningful feature lifecycles', () => {
  const {api, events} = core();
  api.start('trainer', 'Recht'); api.start('trainer', 'Steuern');
  api.reset('trainer'); api.start('trainer', 'Private free text');
  api.record('simulation_start', 'Finance Controlling', 'HQ');
  api.record('kilian_use', 'Private free text', 'HQ');
  api.record('unlisted_event', 'Recht');
  assert.deepEqual(events, [
    {event:'trainer_start',subject:'recht',area:'none'},
    {event:'trainer_start',subject:'unknown',area:'none'},
    {event:'simulation_start',subject:'finance_controlling',area:'HQ'},
    {event:'kilian_use',subject:'unknown',area:'none'}]);
});
test('repeated view render is ignored, actual navigation and content selection counted', () => {
  const {api, events} = core();
  api.view('glossarView'); api.view('glossarView'); api.view('trainerView'); api.view('glossarView');
  api.content('Recht', 'selection-1'); api.content('Recht', 'selection-1');
  api.view('startView'); api.content('Recht', 'selection-1');
  assert.deepEqual(events.map(e => e.event), ['glossary_open','glossary_open','learning_text_open','learning_text_open']);
});
test('audio listeners bind once and pause/resume does not recount; restart/load does', () => {
  const {api, events} = core();
  const audio = new EventTarget();
  api.audio(audio, 'Recht', 'chapter'); api.audio(audio, 'Recht', 'chapter');
  audio.dispatchEvent(new Event('playing')); audio.dispatchEvent(new Event('playing'));
  api.restartAudio(audio); audio.dispatchEvent(new Event('playing'));
  audio.dispatchEvent(new Event('emptied')); audio.dispatchEvent(new Event('playing'));
  api.audio(audio, 'Steuern', 'other'); audio.dispatchEvent(new Event('playing'));
  assert.equal(events.length, 4); assert.equal(events[3].subject, 'steuern');
  api.setEnabled(false); audio.dispatchEvent(new Event('emptied')); audio.dispatchEvent(new Event('playing'));
  assert.equal(events.length, 4);
});
test('opaque lifecycle tickets reject work begun before login or by a previous account', () => {
  const {api,events} = core();
  const before = api.captureTicket(); assert.equal(api.isCurrent(before),true);
  const audio = new EventTarget(); api.audio(audio,'Recht','chapter',before);
  api.setEnabled(false); const anonymous = api.captureTicket(); api.setEnabled(true);
  assert.equal(api.isCurrent(before),false); assert.equal(api.isCurrent(anonymous),false);
  audio.dispatchEvent(new Event('playing')); assert.equal(events.length,0);
  api.audio(audio,'Recht','chapter',api.captureTicket()); audio.dispatchEvent(new Event('playing'));
  assert.equal(events.length,1);
});
function client(options = {}) {
  let now = 0; const sent = []; let user = {uid:'one',emailVerified:true,getIdToken:async () => 'token'};
  const context = load('usage-client.js');
  const api = context.createUsageClient({getUser:() => user, now:() => now,
    send:async body => {sent.push(plain(body)); return {success:true};}, ...options});
  api.accountChanged(user);
  return {api,sent,tick:value => {now = value;},user:value => {user = value;api.accountChanged(value);}};
}
const signal = {event:'trainer_start',subject:'recht',area:'none'};
test('client batches unique keys, enforces 60 seconds for any flush and never retries', async () => {
  const {api,sent,tick} = client();
  api.enqueue(signal); api.enqueue(signal);
  await api.flush(); assert.equal(sent.length,0);
  tick(60000); await api.flush(); assert.equal(sent.length,1); assert.equal(sent[0].events.length,1);
  api.enqueue(signal); await api.flush(); assert.equal(sent.length,1);
  tick(119999); await api.flush(); assert.equal(sent.length,1);
  tick(120000); await api.flush(); assert.equal(sent.length,2);
  tick(180000); await api.flush(); assert.equal(sent.length,2);
});
test('client ignores prelogin and clears batches at logout or account change', async () => {
  const {api,sent,tick,user} = client();
  api.enqueue(signal); user(null); api.enqueue(signal);
  tick(60000); await api.flush(); assert.equal(sent.length,0);
  user({uid:'two',emailVerified:true,getIdToken:async () => 'two-token'});
  await api.flush(); assert.equal(sent.length,0);
  api.enqueue(signal); tick(120000); await api.flush(); assert.equal(sent[0].idToken,'two-token');
  user({uid:'three',emailVerified:false}); api.enqueue(signal); tick(180000); await api.flush();
  assert.equal(sent.length,1);
});
test('confirmed email on the same signed-in account enables usage on token change without reload', () => {
  let tokenCallback;
  const user = {uid:'same',emailVerified:false};
  const ctx = load('usage-client.js', {auth:{currentUser:user},window:{location:new URL('https://beckersabine082-art.github.io/wifa-trainer-gruen/')},
    onIdTokenChanged:(_,callback) => {tokenCallback=callback;},
    onAuthStateChanged:(_,callback) => callback(user),
    document:{addEventListener(){}},setInterval(){}});
  assert.equal(typeof tokenCallback,'function');
  let events = [];
  ctx.window.WifaUsageEnqueue = event => events.push(plain(event));
  tokenCallback(user); ctx.window.WifaUsage.start('trainer','Recht'); assert.equal(events.length,0);
  user.emailVerified=true; tokenCallback(user); ctx.window.WifaUsage.start('trainer','Recht');
  assert.equal(events.length,1);
  tokenCallback(user); ctx.window.WifaUsage.start('trainer','Recht'); assert.equal(events.length,1);
});
test('same UID logout and re-login invalidates an in-flight token generation', async () => {
  let release;
  const {api,sent,tick,user} = client();
  const account = {uid:'same',emailVerified:true,getIdToken:() => new Promise(resolve => {release=resolve;})};
  user(account); api.enqueue(signal); tick(60000); const pending=api.flush();
  user(null); user(account); release('old-token'); await pending; assert.equal(sent.length,0);
});
test('logout while token is pending cancels dispatch and failure is dropped', async () => {
  let release; const {api,sent,tick,user} = client();
  user({uid:'pending',emailVerified:true,getIdToken:() => new Promise(resolve => {release = resolve;})});
  api.enqueue(signal); tick(60000); const pending = api.flush();
  user(null); release('old-token'); await pending; assert.equal(sent.length,0);
  let calls = 0; const failed = client({send:async () => {calls++;throw Error('offline');}});
  failed.api.enqueue(signal); failed.tick(60000); await failed.api.flush();
  failed.tick(120000); await failed.api.flush(); assert.equal(calls,1);
});
test('queue accepts at most ten unique sanitized keys without extra metadata', async () => {
  const {api,sent,tick} = client();
  for (const subject of ['unknown','recht','steuern','rechnungswesen','bwl','vwl','unternehmensfuehrung','logistik','marketing','vertrieb','finance_controlling']) api.enqueue({...signal,subject});
  api.enqueue({...signal, uid:'private'}); api.enqueue({...signal,event:'private'});
  tick(60000); await api.flush(); assert.equal(sent[0].events.length,10);
  assert.equal(JSON.stringify(sent).includes('private'),false);
});
test('production gate excludes previews, local hosts and query strings do not enter request', () => {
  const ctx = load('usage-client.js');
  assert.equal(ctx.usageProductionLocation(new URL('https://beckersabine082-art.github.io/wifa-trainer-gruen/?x=secret')), true);
  for (const url of ['http://localhost/wifa-trainer-gruen/','https://beckersabine082-art.github.io/preview/','https://evil.example/wifa-trainer-gruen/']) assert.equal(ctx.usageProductionLocation(new URL(url)),false);
});
test('dashboard aggregates events and subjects, fills days and rejects unsupported periods', () => {
  const ctx = load('usage-dashboard.js');
  const result = plain(ctx.usageSummary({today:'2026-09-12',period:'7',days:[{date:'2026-09-12',counts:{'trainer_start|recht|none':3,'quiz_start|recht|none':2,'simulation_start|unknown|HQ':1}}],totals:{}}, '7'));
  assert.equal(result.days.length,7); assert.equal(result.days[0].total,0); assert.equal(result.total,6);
  assert.equal(result.subjects.recht,5); assert.equal(result.features.trainer_start,3); assert.equal(result.areas.HQ,1);
  assert.equal(result.subjectFeatures.recht.trainer_start,3); assert.equal(result.subjectFeatures.recht.quiz_start,2);
  assert.throws(() => ctx.usageSummary({today:'2026-09-12',days:[]},'bad'));
});
test('learning hooks keep usage independent of analytics and only count successful card/answer loads', async () => {
  const events = [], elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id,{value:id === 'kartenFachSelect' ? 'Recht' : 'Question',style:{},textContent:'',innerHTML:''}); return elements.get(id); };
  const context = vm.createContext({window:{WifaUsage:{captureTicket:() => 1,isCurrent:() => true,record:(...args) => events.push(args)}},document:{getElementById:element},
    karteikartenDaten:[], aktuelleKartenIndex:0, alert:() => {}, formatKilianAntwort:text => text});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','wissensdatenbank.js'),'utf8'),context);
  context.karteikartenAudioStoppen = () => {}; context.zeigeAktuelleKarte = () => {};
  context.apiGet = async () => ({success:true,data:[]});
  await context.ladeKarteikarten(); assert.equal(events.length,0);
  context.apiGet = async () => ({success:true,data:[{frage:'private'}]});
  await context.ladeKarteikarten(); assert.deepEqual(events.shift(),['flashcards_start','Recht']);
  context.apiPost = async () => ({success:false});
  await context.frageKilian(); await context.frageKilianBubble(); assert.equal(events.length,0);
  context.apiPost = async () => ({success:true,data:{antwort:'private'}});
  await context.frageKilian(); await context.frageKilianBubble();
  assert.deepEqual(events,[['kilian_use'],['kilian_use']]);
  context.toggleKilianBubble(); context.toggleKilianBubble();
  assert.deepEqual(events.at(-1),['kilian_open']); assert.equal(events.length,3);
});
test('card and Kilian responses started by a previous or unconfirmed account never become new-account usage', async () => {
  const {api,events} = core();
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id,{value:id === 'kartenFachSelect' ? 'Recht' : 'Question',style:{},textContent:'',innerHTML:''}); return elements.get(id); };
  const context = vm.createContext({window:{WifaUsage:api},document:{getElementById:element},
    karteikartenDaten:[],aktuelleKartenIndex:0,alert:() => {},formatKilianAntwort:text => text});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','wissensdatenbank.js'),'utf8'),context);
  context.karteikartenAudioStoppen=() => {}; context.zeigeAktuelleKarte=() => {};
  for (const action of ['ladeKarteikarten','frageKilian','frageKilianBubble']) {
    for (const prelogin of [false,true]) {
      if (prelogin) api.setEnabled(false);
      let resolve;
      context.apiGet=context.apiPost=() => new Promise(done => {resolve=done;});
      const pending=context[action](); api.setEnabled(false); api.setEnabled(true);
      resolve({success:true,data:action === 'ladeKarteikarten' ? [{frage:'private'}] : {antwort:'private'}});
      await pending; assert.equal(events.length,0,action);
    }
  }
});
test('learning-text fetch and podcast validation keep their original lifecycle through awaits', async () => {
  const {api,events} = core();
  const audio = new EventTarget(); audio.play = async () => audio.dispatchEvent(new Event('playing'));
  const nodes = new Map();
  const node = id => {
    if (id === 'lerntexteAudioPlayer') return audio;
    if (!nodes.has(id)) nodes.set(id,{value:'',style:{},textContent:'',innerHTML:'',appendChild(){}});
    return nodes.get(id);
  };
  const context = vm.createContext({window:{WifaUsage:api},document:{getElementById:node,querySelectorAll:() => [],
    createElement:() => ({style:{},appendChild(){}})}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','lerntexte.js'),'utf8'),context);
  for (const name of ['lerntexteAudioStoppen','lerntexteAudioProgressZuruecksetzen','lerntexteBaueKapitelDropdown',
    'lerntextePilotKaraokeAufraeumen','lerntextePilotKaraokeEinrichten','lerntextePilotButtonsVerdrahten']) context[name]=() => {};
  context.lerntexteFormatiereText=text => text;
  let release;
  context.apiGet=() => new Promise(resolve => {release=resolve;});
  const textPending=context.lerntexteFachWaehlen('Recht'); api.setEnabled(false);api.setEnabled(true);
  release({success:true,data:[{fach:'Recht',titel:'chapter',lerntext:'private',hauptkapitelNr:'1'}]}); await textPending;
  assert.equal(events.length,0);
  context.lerntextePilotAssetValidieren=() => new Promise(resolve => {release=resolve;});
  context.lerntextePilotProgressLaden=async () => {};
  const audioPending=context.lerntextePilotAudioStarten({fach:'Recht',titel:'chapter'},{},{},null);
  api.setEnabled(false);api.setEnabled(true);release({valid:true,currentHash:'hash'});await audioPending;
  assert.equal(events.length,0);
  // An explicit new request in the new session is counted normally.
  context.lerntextePilotAssetValidieren=async () => ({valid:true,currentHash:'hash'});
  await context.lerntextePilotAudioStarten({fach:'Recht',titel:'chapter'},{},{},null);
  assert.equal(events.length,1);assert.equal(events[0].event,'podcast_start');
});
test('transport puts token only in POST body and omits credentials and referrer', async () => {
  let captured;
  const ctx = load('usage-client.js',{API_BASE_URL:'https://example.test/api',fetch:async (...args) => {captured=args;return {ok:true,json:async () => ({success:true})};}});
  await ctx.usageRequest({action:'usageRead',idToken:'secret',period:'7'});
  assert.equal(captured[0],'https://example.test/api'); assert.equal(captured[1].referrerPolicy,'no-referrer');
  assert.equal(captured[1].credentials,'omit'); assert.equal(captured[1].method,'POST');
  assert.equal(JSON.parse(captured[1].body).idToken,'secret');
});
test('dashboard uses server denial and removes previous results on logout', async () => {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id,{value:'7',textContent:'',hidden:false,disabled:false,style:{},children:[],
      replaceChildren(){this.children=[];}, append(...items){this.children.push(...items);}, addEventListener(){}});
    return elements.get(id);
  }
  let authCallback, allowed = true;
  const auth = {currentUser:{uid:'admin',emailVerified:true,getIdToken:async () => 'token'}};
  const ctx = load('usage-dashboard.js',{auth,onIdTokenChanged:(_,callback) => {authCallback=callback;},
    document:{getElementById:element,createElement:tag => ({tag,style:{},children:[],append(...items){this.children.push(...items);}})},
    usageRequest:async () => allowed ? {success:true,data:{today:'2026-09-12',days:[{date:'2026-09-12',counts:{'trainer_start|recht|none':3}}]}} : {success:false,error:'forbidden'}});
  await authCallback(); assert.equal(element('usageResults').hidden,false); assert.equal(element('usageTotal').textContent,'3');
  allowed=false; await authCallback(); assert.equal(element('usageResults').hidden,true);
  assert.match(element('usageStatus').textContent,/keine Statistikberechtigung/);
  auth.currentUser=null; await authCallback();
  assert.equal(element('usageFeatures').children.length,0); assert.equal(element('usageTotal').textContent,'0');
});
