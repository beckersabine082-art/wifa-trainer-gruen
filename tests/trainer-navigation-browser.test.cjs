const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');

test('real trainer buttons: circular navigation, shuffle backtracking and persisted unanswered path', async () => {
  const server = http.createServer((req,res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') {
      res.setHeader('Content-Type','text/html; charset=utf-8');
      return res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
    }
    if (!['/js/main.js','/js/trainer.js','/css/style.css'].includes(pathname)) {res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',pathname.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');
    res.end(fs.readFileSync(path.join(root,pathname.slice(1))));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {channel:'msedge'})});
    const page = await browser.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.route('**/*',route=>route.request().url().startsWith(origin+'/') ? route.continue() : route.abort());
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.dismiss());
    await page.goto(origin);
    await page.addScriptTag({url:origin+'/js/main.js'});
    await page.addScriptTag({url:origin+'/js/trainer.js'});
    await page.evaluate(()=>{
      window.aktuellerNutzer='fixture';
      aktuellerTeilbereich='WQ'; aktuellesFach='Recht'; aktuellesThema='Vertrag';
      window.fixtureQuestions=Array.from({length:6},(_,i)=>({id:`Q${i+1}`,frage:`Browserfrage ${i+1}`,thema:'Vertrag',fragePosition:i+1,frageGesamt:6}));
      window.fixtureAttempts=[]; window.fixtureCalls=[];
      window.loadAttemptsForCurrentUser=async()=>fixtureAttempts;
      window.apiPost=async()=>({success:true});
      window.apiGet=async(action,params)=>{
        fixtureCalls.push({action,params});
        if(action==='questionsForTopic') return {success:true,data:fixtureQuestions};
        if(action==='nextQuestion') return {success:true,data:fixtureQuestions[fixtureQuestions.findIndex(q=>q.id===params.currentId)+1] || {themaAbgeschlossen:true}};
        throw Error('Unexpected API: '+action);
      };
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      document.getElementById('trainerView').classList.add('active');
      zeigeGeladeneFrage(fixtureQuestions[5],'Vertrag');
    });
    const next=page.getByRole('button',{name:'Nächste Frage',exact:true});
    const prev=page.locator('#btnVorherigeFrage');
    const id=()=>page.evaluate(()=>aktuelleFrageId);
    const idle=()=>page.waitForFunction(()=>!appIstBeschaeftigt);
    await next.click(); await idle(); assert.equal(await id(),'Q1');
    await prev.click(); await idle(); assert.equal(await id(),'Q6');
    await page.locator('#trainerShuffleBtn').click(); await idle();
    const first=await id();
    assert.equal(await prev.isDisabled(),true);
    await page.evaluate(()=>{setzeAppBeschaeftigt(true);setzeAppBeschaeftigt(false);});
    assert.equal(await prev.isDisabled(),true,'busy completion preserves the history boundary');
    await next.click(); const second=await id();
    await next.click(); const third=await id();
    await prev.click(); assert.equal(await id(),second);
    await next.click(); assert.ok(![first,second,third].includes(await id()));
    const position=(await id()).slice(1);
    assert.match(await page.locator('#frageText').innerText(),new RegExp(`Frage ${position} von 6`));
    await page.evaluate(()=>{fixtureAttempts=[{modul:'wifa-trainer',fach:'Recht',thema:'Vertrag',frageId:'Q2',erreichtePunkte:0}];});
    await page.locator('#trainerUnansweredBtn').click(); await idle();
    assert.equal(await id(),'Q1');
    assert.equal(await page.evaluate(()=>trainerShuffleAktiv),false);
    await next.click(); await idle(); assert.equal(await id(),'Q3');
    await next.click(); await idle(); assert.equal(await id(),'Q4');
    await prev.click(); assert.equal(await id(),'Q3');
    await prev.click(); assert.equal(await id(),'Q1');
    assert.equal(await prev.isDisabled(),true);
    await page.evaluate(()=>{fixtureAttempts=fixtureQuestions.map(q=>({modul:'wifa-trainer',fach:'Recht',thema:'Vertrag',frageId:q.id,erreichtePunkte:0}));});
    await next.click(); await idle();
    assert.equal(await page.locator('#trainerUnansweredBtn').isDisabled(),true);
    assert.match(await page.locator('#trainerUnansweredBtn').innerText(),/Alle Fragen/);
    await page.evaluate(()=>{setzeAppBeschaeftigt(true);setzeAppBeschaeftigt(false);});
    assert.equal(await page.locator('#trainerUnansweredBtn').isDisabled(),true);
    assert.deepEqual(errors,[]);
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
