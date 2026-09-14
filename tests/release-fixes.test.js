const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = file => fs.readFileSync(file, 'utf8');
function backend() {
  const props = {USAGE_FIREBASE_WEB_API_KEY:'fixture-key'};
  const calls = [];
  const c = {console, PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;}})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    Utilities:{formatDate:()=> '2026-09-13',base64DecodeWebSafe:s=>Buffer.from(s,'base64url'),newBlob:b=>({getDataAsString:()=>b.toString()})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},
    UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.includes('accounts:lookup') ? {users:[{localId:'owner',emailVerified:true,validSince:'0'}]} : {choices:[{message:{content:'{"erfuellt":[],"nicht_erfuellt":["K1"]}'}}]})};}}};
  vm.createContext(c);vm.runInContext(read('backend/apps-script/Usage.gs'),c);vm.runInContext(read('backend/apps-script/Code.gs'),c);
  const now=Math.floor(Date.now()/1000);
  const token=[{alg:'RS256',kid:'fixture'},{sub:'owner',aud:'wifa-trainer-gruen',iss:'https://securetoken.google.com/wifa-trainer-gruen',iat:now-10,auth_time:now-20,exp:now+3600},'signature'].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
  c.getFrontendSheetNames=()=>['Recht','BWL'];
  return {c,calls,props,token,post:body=>c.doPost({postData:{contents:JSON.stringify(body)}})};
}
test('all private and AI routes reject absent tokens; private GET and old TTS stay closed',()=>{
  const h=backend();
  for(const action of ['getLernstand','getProgress','getPodcastProgress','saveProgress','savePodcastProgress','speichereLernstand','bewerteAntwort','frageKilian','bewertePruefung']) {
    const r=h.post({action});assert.equal(r.success,false,action);
    assert.equal(r.error,'unauthenticated',action);
  }
  h.c.generatePodcastAudioTestPayload_=()=>{throw Error('TTS reached');};
  for(const action of ['getLernstand','getProgress','getPodcastProgress','podcastAudioTest']) assert.equal(h.c.doGet({parameter:{action,dryRun:'1'}}).success,false);
  assert.equal(h.calls.length,0);
});
test('verified UID alone selects every private read/write; public sheet writes are disabled',()=>{
  const h=backend(),seen=[];
  h.c.getLernstandFrontend=uid=>(seen.push(uid),[]);
  h.c.getProgressForKey_=uid=>(seen.push(uid),null);
  h.c.getPodcastProgress=uid=>(seen.push(uid),[]);
  h.c.upsertProgressForKey_=uid=>(seen.push(uid),{});
  h.c.savePodcastProgress=state=>(seen.push(state.nutzer),{});
  h.c.speichereLernstandFrontend=uid=>seen.push(uid);
  for(const action of ['getLernstand','getProgress','getPodcastProgress','saveProgress','savePodcastProgress','speichereLernstand']) {
    assert.equal(h.post({action,idToken:h.token,nutzer:'victim',bereich:'trainer',fach:'Recht',frageId:'1'}).success,true,action);
  }
  assert.deepEqual(seen,Array(6).fill('owner'));
  h.c.bewerteAntwortFrontend=p=>{assert.equal(p.speichereInSheet,false);return {};};
  assert.equal(h.post({action:'bewerteAntwort',idToken:h.token,fach:'Recht',frageId:'1',antwort:'Text',speichereInSheet:true}).success,true);
});
test('invalid Google token verdict fails closed and never reaches storage',()=>{
  const h=backend();h.c.UrlFetchApp.fetch=()=>({getResponseCode:()=>401});
  h.c.getLernstandFrontend=()=>{throw Error('storage reached');};
  assert.equal(h.post({action:'getLernstand',idToken:h.token}).error,'unauthenticated');
});
test('public question routes cannot select private spreadsheet tabs',()=>{
  const h=backend();h.c.getFrontendSheetNames=()=>['Recht'];
  h.c.getQuestionById=()=>{throw Error('private tab read');};
  assert.equal(h.c.doGet({parameter:{action:'questionById',fach:'NutzerFortschritt',frageId:'victim'}}).error,'invalid_request');
  assert.equal(h.post({action:'bewerteAntwort',idToken:h.token,fach:'NutzerFortschritt',frageId:'victim',antwort:'Text'}).error,'invalid_request');
});
test('AI action whitespace cannot bypass its budget; an exam reserves each possible model call',()=>{
  const h=backend();h.c.frageKilianFrontend=()=>({antwort:'ok'});
  const state={day:'2026-09-13',minute:Math.floor(Date.now()/60000),dayCount:1000,minuteCount:0};
  h.props.LEARNING_AI_ADMISSION=JSON.stringify(state);
  assert.equal(h.post({action:' frageKilian ',idToken:h.token,frage:'Text'}).error,'rate_limited');
  h.props.LEARNING_AI_ADMISSION=JSON.stringify({...state,dayCount:999});
  const item={frage:'Q',antwort:'A',stichpunkte:'K',maxPunkte:1};
  assert.equal(h.post({action:'bewertePruefung',idToken:h.token,daten:[item,item]}).error,'rate_limited');
  assert.equal(h.calls.length,0);
});
test('valid diagram is evaluated with image and description and stores its description without schema changes',async()=>{
  const h=backend();h.c.getQuestionById=()=>({id:'1',frage:'Zeichnen',musterloesung:'Nutzen für Kunden',stichpunkte:'Nutzen für Kunden',fragetyp:'diagramm'});
  h.c.UrlFetchApp.fetch=(url,options)=>{h.calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({choices:[{message:{content:'{"erfuellt":["K1"],"nicht_erfuellt":[]}'}}]})};};
  const result=h.c.bewerteAntwortFrontend({fach:'BWL',frageId:'1',antwort:'Beschreibung',skizze:'data:image/png;base64,YQ==',speichereInSheet:false});
  assert.equal(result.punkte,1);assert.equal(h.calls.length,1);
  const message=JSON.parse(h.calls[0].options.payload).messages[0].content;
  assert.equal(message[1].type,'image_url');assert.ok(message[0].text.includes('Beschreibung'));assert.ok(message[0].text.includes('keines ersetzt das andere'));
  let saved;const c={window:{},auth:{currentUser:{uid:'owner',emailVerified:true}},db:{},collection:()=>({}),doc:()=>({id:'new-id'}),serverTimestamp:()=>0,setDoc:async(ref,data)=>{saved=data;}};
  vm.createContext(c);vm.runInContext(read('js/lernstand.js').replace(/^import[\s\S]*?from\s*'[^']+';/gm,'').replace(/export /g,''),c);
  await c.speichereWifaAttempt({bereich:'WQ',fach:'BWL',thema:'Diagramm',frageId:'1',antwort:'Beschreibung',erreichtePunkte:result.punkte,maximalePunkte:result.maxPunkte});
  assert.equal(saved.antwort,'Beschreibung');assert.equal(saved.maximalPunkte,1);assert.equal(saved.userId,'owner');
});
test('protected browser calls send current tokens in POST body and fail closed on auth changes',async()=>{
  const calls=[];const user={uid:'owner',emailVerified:true,getIdToken:async()=> 'verified-token'};
  const c={URL,fixtureAuth:{currentUser:user,authStateReady:async()=>{}},window:{},fetch:async(url,options)=>(calls.push({url,options}),{ok:true,json:async()=>({success:true})})};
  vm.createContext(c);vm.runInContext(read('js/api.js').replace("await import('./firebase-config.js')",'({auth:fixtureAuth})'),c);
  await c.apiGet('getProgress',{nutzer:'victim',fach:'Recht'});
  await c.bewertePruefungsAntworten([{antwort:'fixture'}]);
  for(const call of calls){assert.equal(call.options.method,'POST');assert.equal(JSON.parse(call.options.body).idToken,'verified-token');assert.ok(!call.url.includes('verified-token'));assert.equal(call.options.referrerPolicy,'no-referrer');}
  c.fixtureAuth.currentUser=null;await assert.rejects(c.apiPost('frageKilian',{frage:'test'}));
  c.fixtureAuth.currentUser=user;user.getIdToken=async()=>{c.fixtureAuth.currentUser=null;return 'old';};
  await assert.rejects(c.apiPost('frageKilian',{frage:'test'}));assert.equal(calls.length,2);
  user.getIdToken=async()=> 'verified-token';c.fixtureAuth.currentUser=user;
  c.fetch=async()=>({ok:true,json:async()=>{c.fixtureAuth.currentUser=null;return {success:true,data:'old-user-data'};}});
  await assert.rejects(c.apiPost('getLernstand'));
});
test('fallback also rejects a later negation of repeated words in the same sentence',()=>{
  const h=backend();const answer='Nutzen für Kunden und für viele andere Personen ist wichtig, aber es gibt keinen Nutzen für Kunden';
  assert.equal(h.c.fallbackErkenneLexikalischVerpassteKriterien_(answer,['Nutzen für Kunden'],['K1'],['K1']).erkannteZusaetzlich.length,0);
});
test('AI sizes and durable global budget bound requests without retaining identities',()=>{
  const h=backend();h.c.frageKilianFrontend=()=>({antwort:'ok'});
  assert.equal(h.post({action:'frageKilian',idToken:h.token,frage:'x'.repeat(20001)}).success,false);
  let limited=false;
  for(let i=0;i<130;i++) { const r=h.post({action:'frageKilian',idToken:h.token,frage:'Frage'});if(r.error==='rate_limited'){limited=true;break;} }
  assert.equal(limited,true);assert.doesNotMatch(JSON.stringify(h.props),/owner|victim|signature|idToken/);
});
test('user-controlled Sheet strings are literal text, never cross-sheet formulas',()=>{
  const h=backend(),writes=[];
  const sheet={getDataRange:()=>({getValues:()=>[['header']]}),appendRow:row=>writes.push(row),getRange:()=>({setValues:rows=>writes.push(...rows)})};
  h.c.ensureNutzerFortschrittSheet_=()=>sheet;h.c.ensurePodcastFortschrittSheet_=()=>sheet;h.c.getSheetByNameSafe_=()=>sheet;
  const formula='=NutzerFortschritt!A2';
  h.c.upsertProgressForKey_('owner','trainer','Recht','__ALL__',formula);
  h.c.savePodcastProgress({nutzer:'owner',fach:formula,einheit:'E',firebasePfad:'podcast/x.mp3',lerntextHash:'h',sekundenPosition:0,wortIndex:0,completed:false});
  h.c.speichereLernstandFrontend('owner','WQ','Recht','T','1',0,1,'falsch',formula);
  assert.equal(writes.length,3);
  for(const row of writes) {assert.ok(!row.some(value=>typeof value==='string' && value.startsWith('=')));assert.ok(row.includes("'"+formula));}
});
test('text fallback: positive, negated, contradictory and nicht-nur answers in both modes',()=>{
  for(const [answer,points] of [['Nutzen für Kunden.',1],['Kein Nutzen für Kunden.',0],['Nutzen für Kunden. Es gibt keinen Nutzen für Kunden.',0],['Kein Nutzen für Kunden. Nutzen für Kunden.',0],['Nicht nur Nutzen für Kunden, sondern auch für Mitarbeiter.',1]]) {
    const h=backend();h.c.getQuestionById=()=>({id:'1',frage:'Ziel?',musterloesung:'Kunden profitieren.',stichpunkte:'Nutzen für Kunden',fragetyp:'text'});
    assert.equal(h.c.bewerteAntwortFrontend({fach:'BWL',frageId:'1',antwort:answer,speichereInSheet:false}).punkte,points,answer);
    assert.equal(h.c.bewertePruefungFrontend([{frage:'Ziel?',musterloesung:'Kunden profitieren.',stichpunkte:'Nutzen für Kunden',maxPunkte:1,antwort:answer}]).gesamtPunkte,points,answer);
  }
});
test('both modes apply the same exact-model-answer shortcut and reject non-answers',()=>{
  const h=backend();h.c.getQuestionById=()=>({id:'1',frage:'Ziel?',musterloesung:'Kunden profitieren.',stichpunkte:'Nutzen für Kunden',fragetyp:'text'});
  for(const [antwort,punkte] of [['Kunden profitieren.',1],['keine Ahnung',0]]) {
    assert.equal(h.c.bewerteAntwortFrontend({fach:'BWL',frageId:'1',antwort,speichereInSheet:false}).punkte,punkte);
    assert.equal(h.c.bewertePruefungFrontend([{frage:'Ziel?',musterloesung:'Kunden profitieren.',stichpunkte:'Nutzen für Kunden',maxPunkte:1,antwort}]).gesamtPunkte,punkte);
  }
  assert.equal(h.calls.length,0);
});
test('diagram requires both inputs and cannot override an AI rejection with text fallback',()=>{
  const h=backend();h.c.getQuestionById=()=>({id:'1',frage:'Zeichnen und begründen.',musterloesung:'Nutzen für Kunden',stichpunkte:'Nutzen für Kunden',fragetyp:'diagramm'});
  for(const [antwort,skizze] of [['','data:image/png;base64,YQ=='],['Nutzen für Kunden',''],['Nutzen für Kunden','data:image/png;base64,YQ==']]) {
    const before=h.calls.length;
    assert.equal(h.c.bewerteAntwortFrontend({fach:'BWL',frageId:'1',antwort,skizze,speichereInSheet:false}).punkte,0);
    assert.equal(h.c.bewertePruefungFrontend([{frage:'Zeichnen und begründen.',fragetyp:'diagramm',stichpunkte:'Nutzen für Kunden',maxPunkte:1,antwort,skizze}]).gesamtPunkte,0);
    assert.equal(h.calls.length-before,antwort&&skizze?2:0);
  }
});

test('exam drawing-only tasks accept a correct sketch without an unrequested description',()=>{
  const h=backend();
  h.c.UrlFetchApp.fetch=(url,options)=>{h.calls.push({url,options});return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({choices:[{message:{content:'{"erfuellt":["K1"],"nicht_erfuellt":[]}'}}]})};};
  const row={frage:'Stellen Sie die Kurven grafisch dar und beschriften Sie die Achsen.',fragetyp:'diagramm',stichpunkte:'Kurven und Achsen',maxPunkte:6,antwort:'',skizze:'data:image/png;base64,YQ=='};
  assert.equal(h.c.bewertePruefungFrontend([row]).gesamtPunkte,6);
  assert.equal(h.calls.length,1);
  assert.match(JSON.parse(h.calls[0].options.payload).messages[0].content[0].text,/keine zusätzliche schriftliche/);
  assert.equal(h.c.bewertePruefungFrontend([{...row,frage:'Zeichnen und erläutern Sie die Kurven.'}]).gesamtPunkte,0);
});
test('gap maximum counts actual fields, preserving normalized data-answer solutions',()=>{
  const c={};vm.createContext(c);vm.runInContext(read('js/bewertung.js'),c);
  const inputs=[' A ','b'].map((value,i)=>({value,getAttribute:()=>['a','B'][i]}));
  const r=c.bewerteLueckentext(inputs,'a',1);assert.equal(r.punkte,2);assert.equal(r.maxPunkte,2);
  inputs[1].value='';assert.equal(c.bewerteLueckentext(inputs,'a',1).punkte,1);
});
test('Kilian escapes raw HTML while retaining simple formatting',()=>{
  const c={window:{addEventListener(){}},document:{addEventListener(){}}};vm.createContext(c);vm.runInContext(read('js/main.js'),c);
  const r=c.formatKilianAntwort('### Titel\n**fett**\n- <img src=x onerror="alert(1)">');
  assert.ok(r.includes('<h3>Titel</h3>'));assert.ok(r.includes('<strong>fett</strong>'));assert.ok(r.includes('• '));
  assert.ok(r.includes('&lt;img'));assert.ok(!r.includes('<img'));
});
test('Kilian formula content escapes HTML before creating formula markup',()=>{
  const c={window:{addEventListener(){}},document:{addEventListener(){}}};vm.createContext(c);vm.runInContext(read('js/main.js'),c);
  const r=c.formatKilianAntwort(String.raw`\[\text{<img src=x onerror="window.bad=1">}\]`);
  assert.ok(r.includes('&lt;img'));
  assert.ok(!r.includes('<img'));
});
test('Kilian renders display fractions and text commands without exposing LaTeX delimiters',()=>{
  const c={window:{addEventListener(){}},document:{addEventListener(){}}};vm.createContext(c);vm.runInContext(read('js/main.js'),c);
  const answer=String.raw`\[\text{Verschuldungskoeffizient} = \frac{\text{Fremdkapital}}{\text{Eigenkapital}}\]`;
  const rendered=c.formatKilianAntwort(answer);
  assert.ok(rendered.includes('formula-display'));
  assert.ok(rendered.includes('formula-fraction'));
  assert.ok(rendered.includes('Verschuldungskoeffizient'));
  assert.ok(rendered.includes('Fremdkapital'));
  assert.ok(rendered.includes('Eigenkapital'));
  assert.doesNotMatch(rendered,/\\(?:frac|text)|\\\[|\\\]/);
});
test('Kilian renders mixed inline and display formulas with operators powers indices and percentages',()=>{
  const c={window:{addEventListener(){}},document:{addEventListener(){}}};vm.createContext(c);vm.runInContext(read('js/main.js'),c);
  const answer=[
    String.raw`Der ROI ist \(ROI = \frac{\text{Gewinn}}{\text{Gesamtkapital}} \cdot 100\%\).`,
    String.raw`\[K(x) = K_f + k_v \cdot x\]`,
    String.raw`\[\mathrm{KW} = \sum_{t=0}^{n} \frac{Z_t}{(1+i)^t}\]`
  ].join('\n');
  const rendered=c.formatKilianAntwort(answer);
  assert.ok(rendered.includes('formula-inline'));
  assert.ok((rendered.match(/formula-display/g)||[]).length>=2);
  assert.ok(rendered.includes('·'));
  assert.ok(rendered.includes('%'));
  assert.ok(rendered.includes('∑'));
  assert.ok(rendered.includes('<sup>t</sup>'));
  assert.ok(rendered.includes('<sub>f</sub>'));
  assert.ok(rendered.includes('<sub>t=0</sub>'));
  assert.doesNotMatch(rendered,/\\(?:frac|text|mathrm|sum)|\\[\\()\[\]]/);
});
test('Kilian uses a readable safe fallback for unsupported formula commands',()=>{
  const c={window:{addEventListener(){}},document:{addEventListener(){}}};vm.createContext(c);vm.runInContext(read('js/main.js'),c);
  const rendered=c.formatKilianAntwort(String.raw`Unbekannt: \(\unsupported{Wert} + \frac{1}{2}\)`);
  assert.ok(rendered.includes('formula-fallback'));
  assert.ok(rendered.includes('Wert'));
  assert.ok(rendered.includes('1'));
  assert.ok(rendered.includes('2'));
  assert.doesNotMatch(rendered,/\\[a-zA-Z]+/);
});
function kilianContext({frage,apiPost}={}) {
  const elements={
    kilianInput:{value:frage ?? 'Normale Frage',textContent:'',innerHTML:''},
    kilianStatus:{textContent:''},
    kilianAntwort:{textContent:'',innerHTML:''},
    kilianBubbleInput:{value:''},
    kilianBubbleStatus:{textContent:''},
    kilianBubbleAntwort:{textContent:'',innerHTML:''},
    kilianBubbleFenster:{style:{display:'none'}}
  };
  const calls=[];
  const context={
    console,
    window:{WifaUsage:{captureTicket:()=>null,isCurrent:()=>true,record:()=>{}}},
    document:{getElementById:id=>elements[id]},
    formatKilianAntwort:text=>text,
    apiPost:apiPost || (async(action,payload)=>(calls.push({action,payload}),{success:true,data:{antwort:'Antwort'}})),
    alert:()=>{}
  };
  vm.createContext(context);vm.runInContext(read('js/wissensdatenbank.js'),context);
  return {context,elements,calls};
}
test('Kilian sends normal, long and formula questions through the same Enter path',async()=>{
  const frage=String.raw`Bitte erkläre mir ROI = \frac{Gewinn}{Gesamtkapital} und nenne ein Beispiel. ${'Weitere Details '.repeat(100)}`;
  const h=kilianContext({frage});let prevented=false;
  await h.context.behandleKilianEingabe({key:'Enter',shiftKey:false,preventDefault:()=>{prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].action,'frageKilian');
  assert.equal(h.calls[0].payload.frage,frage.trim());
});
test('Kilian keeps Shift+Enter as a textarea line break',()=>{
  const h=kilianContext();let prevented=false;
  const result=h.context.behandleKilianEingabe({key:'Enter',shiftKey:true,preventDefault:()=>{prevented=true;}});
  assert.equal(result,undefined);
  assert.equal(prevented,false);
  assert.equal(h.calls.length,0);
});
test('Kilian does not submit empty input on Enter',async()=>{
  const h=kilianContext({frage:' \n\t'});let prevented=false;
  await h.context.behandleKilianEingabe({key:'Enter',shiftKey:false,preventDefault:()=>{prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(h.calls.length,0);
});
test('Kilian ignores repeated sends while the first request is running',async()=>{
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const h=kilianContext({apiPost:async(action,payload)=>(h.calls.push({action,payload}),pending)});
  const first=h.context.frageKilian();
  const second=h.context.frageKilian();
  await Promise.resolve();
  assert.equal(h.calls.length,1);
  release({success:true,data:{antwort:'Antwort'}});
  await Promise.all([first,second]);
  assert.equal(h.calls.length,1);
});
test('exam displayed and stored status uses exact 50 percent threshold',async()=>{
  const el={style:{},innerHTML:''};const writes=[];
  const c={window:{},document:{getElementById:()=>el},auth:{currentUser:{uid:'owner',emailVerified:true}},db:{},doc:()=>({id:'id'}),collection:()=>({}),serverTimestamp:()=>0,writeBatch:()=>({set:(r,v)=>writes.push(v),commit:async()=>{}})};
  vm.createContext(c);vm.runInContext(read('js/pruefungssimulation.js'),c);
  vm.runInContext(read('js/pruefungslernstand.js').replace(/^import[\s\S]*?from\s*'[^']+';/gm,'').replace(/export /g,''),c);
  for(const [points,status] of [[99,'nicht_bestanden'],[100,'bestanden']]) {
    c.renderPruefungsAuswertung({gesamtPunkte:points,gesamtMaxPunkte:200,aufgaben:[]});
    assert.equal(el.innerHTML.includes('NICHT BESTANDEN'),points===99);
    await c.speicherePruefungsAttempt({teilbereich:'WQ',simulation:'1',einheit:'Recht',gesamtPunkte:points,gesamtMaxPunkte:200,tasks:[{aufgabe:'1',punkte:points,maxPunkte:200}]});
    assert.equal(writes.at(-2).status,status);
  }
});
