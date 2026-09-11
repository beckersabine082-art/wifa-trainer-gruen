const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('js/analytics-frame.js','utf8').replaceAll('import(', 'load(');
async function run({permitted=true, revokeDuringLoad=false}={}) {
  const calls = [], imports = [];
  const owner = {authorized:()=>permitted, frameReady:()=>calls.push(['ready'])};
  const win = {parent:{WifaAnalytics:owner,WIFA_ANALYTICS_SETTINGS:{measurementId:'G-TEST'}}};
  const sdk = {
    setConsent:p=>calls.push(['consent',p]), setDefaultEventParameters:p=>calls.push(['defaults',p]),
    initializeAnalytics:(app,p)=>{calls.push(['initialize',app,p]); return {};},
    logEvent:(a,n,p)=>calls.push(['event',n,p])
  };
  win.location = {hostname:'example.test'};
  const load = async url => {
    imports.push(url);
    if (revokeDuringLoad) permitted=false;
    if (url.endsWith('firebase-app.js')) return {initializeApp:c=>c};
    if (url.endsWith('firebase-analytics.js')) return sdk;
    return {firebasePublicConfig:{projectId:'wifa-trainer-gruen'}};
  };
  vm.runInNewContext(source,{window:win,load});
  await new Promise(resolve=>setImmediate(resolve));
  return {calls,imports,win,revoke:()=>{permitted=false;}};
}
test('direct or nonconsenting frame loads no Firebase SDK', async()=>{
  const r=await run({permitted:false}); assert.equal(r.imports.length,0);
});
test('withdrawal during imports prevents SDK initialization and ready notification', async()=>{
  const r=await run({revokeDuringLoad:true}); assert.equal(r.calls.length,0);
});
test('one SDK with safe automatic defaults, no automatic pageview, no event after revoke', async()=>{
  const r=await run();
  assert.equal(r.calls.filter(c=>c[0]==='initialize').length,1);
  const defaults=r.calls.find(c=>c[0]==='defaults')[1];
  assert.equal(defaults.send_page_view,false); assert.equal(defaults.allow_google_signals,false);
  assert.equal(defaults.allow_ad_personalization_signals,false); assert.equal(defaults.page_referrer,'');
  assert.ok(!defaults.page_location.includes('?'));
  r.win.wifaLogEvent('page_view',{view_id:'start'}); r.revoke(); r.win.wifaLogEvent('page_view',{view_id:'quiz'});
  assert.equal(r.calls.filter(c=>c[0]==='event').length,1);
});
