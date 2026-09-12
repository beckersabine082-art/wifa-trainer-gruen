const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sourcePath = 'backend/apps-script/Usage.gs';
const plain = value => JSON.parse(JSON.stringify(value));
const now = Date.parse('2026-09-12T12:00:00Z');
function token(overrides = {}) {
  const claims = {aud:'wifa-trainer-gruen', iss:'https://securetoken.google.com/wifa-trainer-gruen',
    sub:'private-uid', exp:now/1000+3600, iat:now/1000-30, auth_time:now/1000-60,
    email_verified:true, ...overrides};
  return [JSON.stringify({alg:'RS256',kid:'test-key'}), JSON.stringify(claims), 'signature'].map(x => Buffer.from(x).toString('base64url')).join('.');
}
function setup(options = {}) {
  const props = {USAGE_ENABLED:'true', USAGE_SPREADSHEET_ID:'private-sheet', USAGE_FIREBASE_WEB_API_KEY:'test-key'};
  const rows = [['date','counts']]; let locked = false;
  const calls = {fetch:0, flush:0, write:0, read:0, lock:0};
  const sheet = {
    getLastRow:() => rows.length,
    getRange(row, col, n, width) { return {
      getValues() { assert.ok(locked); calls.read++; return rows.slice(row-1,row-1+n).map(r => r.slice(col-1,col-1+width)); },
      setNumberFormat() { return this; },
      setValues(values) { assert.ok(locked); calls.write++; if (options.writeError) throw Error('secret write error'); values.forEach((r,i) => { rows[row-1+i] = [...r]; }); return this; }
    }; }
  };
  const file = {getSharingAccess:() => options.shared ? 'ANYONE':'PRIVATE', getEditors:() => options.editor ? ['other']:[],
    getViewers:() => [], getOwner:() => ({getEmail:()=>'owner@example.test'})};
  const ctx = {Date:class extends Date {constructor(...a) { super(...(a.length ? a : [now])); } static now(){return now;}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null, setProperty(k,v){props[k]=v;},setProperties(v){Object.assign(props,v);}})},
    LockService:{getScriptLock:()=>({tryLock(){calls.lock++; if(options.busy||locked) return false; locked=true;return true;},releaseLock(){assert.ok(locked);locked=false;}})},
    Utilities:{base64DecodeWebSafe:x=>Buffer.from(x,'base64url'),newBlob:b=>({getDataAsString:()=>b.toString('utf8')}),
      formatDate:()=> '2026-09-12'},
    UrlFetchApp:{fetch(url,args){ calls.fetch++; assert.match(url,/^https:\/\/identitytoolkit\.googleapis\.com\/v1\/accounts:lookup\?key=/);
      assert.deepEqual(Object.keys(JSON.parse(args.payload)),['idToken']); assert.equal(args.followRedirects,false);
      if(options.networkError) throw Error('private token and email');
      return {getResponseCode:()=>options.status||200,getContentText:()=>JSON.stringify(options.response || {users:[{
        localId:'private-uid',emailVerified:true,validSince:String(now/1000-120),customAttributes:JSON.stringify({usageAdmin:!!options.admin}), ...options.user
      }]})}; }},
    DriveApp:{Access:{PRIVATE:'PRIVATE'},getFileById:id=>{assert.equal(id,'private-sheet');return file;}},
    Session:{getEffectiveUser:()=>({getEmail:()=>'owner@example.test'})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getId:()=>options.sameSheet?'private-sheet':'learning-sheet'}),
      openById:id=>{assert.equal(id,'private-sheet');return {getSheetByName:name=>{assert.equal(name,'usageDaily');return sheet;}};},
      flush(){assert.ok(locked);calls.flush++;}}
  };
  assert.ok(fs.existsSync(sourcePath), 'secure usage backend must exist');
  vm.runInNewContext(fs.readFileSync(sourcePath,'utf8'),ctx);
  const record = (extra={}) => ctx.usageHandle_({action:'usageRecord',idToken:token(),events:[{event:'trainer_start',subject:'recht',area:'none'}],...extra});
  return {ctx,props,rows,calls,record,isLocked:()=>locked};
}
test('verified event writes only aggregate counters and no personal data',()=>{
  const h=setup(); assert.deepEqual(plain(h.record()),{success:true});
  assert.deepEqual(h.rows,[['date','counts'],['2026-09-12','{"trainer_start|recht|none":1}']]);
  assert.equal(h.calls.fetch,1); assert.equal(h.calls.flush,1); assert.equal(h.isLocked(),false);
  assert.doesNotMatch(JSON.stringify([h.rows,h.props]),/private-uid|example|signature|idToken|email|antwort/);
});
test('all main events have validated counters and dimensions',()=>{
  const h=setup();
  const events=['trainer_start','quiz_start','simulation_start','podcast_start','learning_text_open','flashcards_start','glossary_open','formulas_open','progress_open','kilian_open','kilian_use'];
  for (const event of events) assert.equal(h.record({events:[{event,subject:'unknown',area:event==='simulation_start'?'WQ':'none'}]}).success,true);
  const counts=JSON.parse(h.rows[1][1]); assert.equal(Object.keys(counts).length,11); assert.ok(Object.values(counts).every(x=>x===1));
});
test('invalid fields, arbitrary counts, dates, metadata and prototype keys never reach Google or Sheets',()=>{
  for (const extra of [{uid:'secret'}, {email:'private@test'}, {date:'2020-01-01'}, {answer:'secret'},
    {events:[{event:'trainer_start',subject:'recht',area:'none',count:999}]},
    {events:[{event:'__proto__',subject:'recht',area:'none'}]},
    {events:[{event:'trainer_start',subject:'mail@example.test',area:'none'}]},
    {events:[{event:'glossary_open',subject:'recht',area:'none'}]},
    {events:[{event:'trainer_start',subject:'recht',area:'HQ'}]},
    {events:[]},{events:Array(11).fill({event:'trainer_start',subject:'recht',area:'none'})}]) {
    const h=setup();assert.equal(h.record(extra).success,false);assert.equal(h.calls.fetch,0);assert.equal(h.calls.write,0);
  }
});
test('duplicate keys in one batch are rejected instead of amplified',()=>{
  const h=setup(), e={event:'trainer_start',subject:'recht',area:'none'};
  assert.equal(h.record({events:[e,e]}).success,false);assert.equal(h.calls.write,0);
});
test('missing, foreign, expired or malformed token is rejected before upstream lookup',()=>{
  for(const idToken of ['',null,'not-a-jwt',token({aud:'other-project'}),token({iss:'https://attacker'}),token({exp:now/1000}),token({iat:now/1000+999}),token({auth_time:now/1000+999}),token({sub:''})]){
    const h=setup();assert.equal(h.record({idToken}).success,false);assert.equal(h.calls.fetch,0);assert.equal(h.calls.write,0);
  }
});
test('upstream rejects a forged signature: untrusted JWT never authorizes writes',()=>{
  const h=setup({status:400});assert.equal(h.record().success,false);assert.equal(h.calls.write,0);
});
test('disabled, unverified, revoked, mismatched and missing accounts fail closed',()=>{
  for(const options of [{user:{disabled:true}},{user:{emailVerified:false}}, {user:{localId:'another'}},
    {user:{validSince:String(now/1000)}},{response:{users:[]}},{networkError:true}]){
    const h=setup(options); const result=h.record();assert.equal(result.success,false);assert.equal(h.calls.write,0);
    assert.doesNotMatch(JSON.stringify(result),/private|email|token|example/);
  }
});
test('only authoritative boolean usageAdmin claim permits reading; client claims cannot elevate',()=>{
  const h=setup();h.record();
  for (const extra of [{},{admin:true},{period:'365'},{idToken:token({usageAdmin:true})}]){
    const result=h.ctx.usageHandle_({action:'usageRead',idToken:token(),period:'7',...extra});assert.equal(result.success,false);assert.equal(result.data,undefined);
  }
  const a=setup({admin:true});a.record();const r=plain(a.ctx.usageHandle_({action:'usageRead',idToken:token(),period:'7'}));
  assert.equal(r.success,true);assert.equal(r.data.days.length,7);assert.equal(r.data.totals['trainer_start|recht|none'],1);
  assert.equal(r.data.days.at(-1).date,'2026-09-12');assert.deepEqual(r.data.days[0].counts,{});
  const s=setup({user:{customAttributes:'{"usageAdmin":"true"}'}}); assert.equal(s.ctx.usageHandle_({action:'usageRead',idToken:token(),period:'all'}).success,false);
});
test('global limit is persisted and checked before lookup, including rejected tokens',()=>{
  const h=setup({status:400});for(let i=0;i<35;i++) h.record();assert.equal(h.calls.fetch,30);assert.equal(h.calls.write,0);
  assert.equal(h.record().error,'rate_limited');
});
test('disabled/unconfigured/shared storage and lock failures do not expose or write data',()=>{
  for(const options of [{shared:true},{editor:true},{sameSheet:true},{busy:true},{writeError:true}]){
    const h=setup(options); assert.equal(h.record().success,false);assert.equal(h.isLocked(),false);
  }
  const h=setup();h.props.USAGE_ENABLED='false';assert.equal(h.record().error,'unavailable');assert.equal(h.calls.fetch,0);
});
test('repeated accepted writes increment same daily row and flush before unlocking',()=>{
  const h=setup(); for(let i=0;i<20;i++)assert.equal(h.record().success,true);
  assert.equal(h.rows.length,2);assert.equal(JSON.parse(h.rows[1][1])['trainer_start|recht|none'],20);assert.equal(h.calls.flush,20);
});
test('admin 30-day and all-time sums derive from daily rows, not user histories',()=>{
  const h=setup({admin:true});h.rows.push(['2026-08-01','{"trainer_start|recht|none":2}'],['2026-09-01','{"quiz_start|bwl|none":3}']);
  const read=period=>plain(h.ctx.usageHandle_({action:'usageRead',idToken:token(),period}));
  assert.equal(read('30').data.days.length,30);assert.deepEqual(read('30').data.totals,{'quiz_start|bwl|none':3});
  assert.deepEqual(read('all').data.totals,{'trainer_start|recht|none':2,'quiz_start|bwl|none':3});
});
test('daily admission ceiling, shared admin reads and corrupt counters fail closed',()=>{
  const h=setup();h.props.USAGE_ADMISSION=JSON.stringify({day:'2026-09-12',minute:Math.floor(now/60000),dayCount:3000,minuteCount:0});
  assert.equal(h.record().error,'rate_limited');assert.equal(h.calls.fetch,0);
  const shared=setup({admin:true,shared:true});assert.equal(shared.ctx.usageHandle_({action:'usageRead',idToken:token(),period:'all'}).success,false);
  const corrupt=setup({admin:true});corrupt.rows.push(['2026-09-12','{"trainer_start|recht|none":-1}']);
  assert.equal(corrupt.record().success,false);assert.equal(corrupt.calls.write,0);
});
test('POST routing protects both statistics routes and does not echo malformed bodies',()=>{
  const h=setup();
  h.ctx.ContentService={MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})};
  vm.runInNewContext(fs.readFileSync('backend/apps-script/Code.gs','utf8'),h.ctx);
  const post=body=>JSON.parse(h.ctx.doPost({postData:{contents:typeof body==='string'?body:JSON.stringify(body)}}).text);
  assert.equal(post({action:'usageRecord',idToken:token(),events:[{event:'quiz_start',subject:'recht',area:'none'}]}).success,true);
  assert.equal(post({action:'usageRead',idToken:token(),period:'all'}).error,'forbidden');
  assert.deepEqual(post('{"idToken":"private-token",'),{success:false,error:'invalid_request'});
  assert.equal(post({action:'setupUsageStatistics'}).success,false);
});
test('setup is private to the editor, idempotent and leaves collection disabled',()=>{
  const h=setup(); const originalRows=plain(h.rows);
  h.ctx.setupUsageStatistics_();h.ctx.setupUsageStatistics_();
  assert.equal(h.props.USAGE_ENABLED,'false');assert.equal(h.props.USAGE_SPREADSHEET_ID,'private-sheet');
  assert.deepEqual(h.rows,originalRows);assert.equal(h.isLocked(),false);
});
test('a competing request cannot enter the critical section or update stale state',()=>{
  const h=setup();let competing;
  const flush=h.ctx.SpreadsheetApp.flush;
  h.ctx.SpreadsheetApp.flush=()=>{competing=h.record();flush();};
  assert.equal(h.record().success,true);assert.equal(competing.success,false);
  assert.equal(JSON.parse(h.rows[1][1])['trainer_start|recht|none'],1);
});
test('visible editor setup is restricted to the actual bound workbook owner',()=>{
  const h=setup();assert.equal(typeof h.ctx.setupUsageStatistics,'function');
  h.ctx.SpreadsheetApp.getActiveSpreadsheet=()=>({getId:()=> 'learning-sheet',getOwner:()=>({getEmail:()=> 'owner@example.test'})});
  h.ctx.Session.getActiveUser=()=>({getEmail:()=> 'intruder@example.test'});
  assert.throws(()=>h.ctx.setupUsageStatistics());assert.equal(h.props.USAGE_ENABLED,'true');
  h.ctx.Session.getActiveUser=()=>({getEmail:()=> ''});assert.throws(()=>h.ctx.setupUsageStatistics());
  // Even execute-as-caller must not allow a different Google user to become the operator.
  h.ctx.Session.getActiveUser=()=>({getEmail:()=> 'intruder@example.test'});
  h.ctx.Session.getEffectiveUser=h.ctx.Session.getActiveUser;assert.throws(()=>h.ctx.setupUsageStatistics());
  h.ctx.Session.getActiveUser=()=>({getEmail:()=> 'owner@example.test'});
  h.ctx.Session.getEffectiveUser=h.ctx.Session.getActiveUser;h.ctx.setupUsageStatistics();assert.equal(h.props.USAGE_ENABLED,'false');
});
