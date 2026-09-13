const test=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createPreviewServer}=require('./trainer-ui-preview.cjs');

for(const action of ['back','next','no-open','save-failure','stale-list']) test(`error navigation is immediate with delayed persistence: ${action}`,async()=>{
  const server=createPreviewServer();
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.previewReady);
    await page.evaluate(()=>{
      wiederholungsKontext={key:'BWL::preview-1',fach:'BWL',frageId:'preview-1',thema:aktuellesThema,bereich:'WQ'};
      window.events=[];
      window.speichereWifaAttempt=()=>{events.push('save');return new Promise((resolve,reject)=>{window.finishSave=resolve;window.failSave=reject;});};
      window.ermittleNaechstenOffenenFehler=()=>{events.push('list');return new Promise(resolve=>{window.finishList=(empty=false)=>resolve(empty?{hasOtherOpenError:false,currentIsOpen:false}:{hasOtherOpenError:true,nextEntry:{latestAttempt:{frageId:'preview-2'}}});});};
      window.oeffneWiederholungAusAttempt=async()=>{events.push('next');wiederholungsKontext=null;zeigeGeladeneFrage(previewQuestions[1],aktuellesThema);};
      window.oeffneLernstandBereich=()=>events.push('back');
    });
    await page.locator('#btnAuswertungStarten').click();
    await page.waitForFunction(()=>events.includes('save'));
    assert.equal(await page.locator('#solutionBox').isVisible(),true);
    assert.equal(await page.locator('#wiederholungNavBox').isVisible(),true,'navigation must not wait for saving or reloading errors');
    for(const id of ['btnNaechsterOffenerFehler','btnZurueckZurFehleranalyse']) {
      assert.equal(await page.locator('#'+id).isEnabled(),true);
      assert.equal(await page.locator('#'+id).evaluate(el=>getComputedStyle(el).opacity),'1');
    }
    assert.deepEqual(await page.evaluate(()=>events),['save']);
    if(action==='stale-list') {
      await page.evaluate(()=>finishSave());
      await page.waitForFunction(()=>events.includes('list'));
      assert.equal(await page.locator('#btnZurueckZurFehleranalyse').isEnabled(),true);
      await page.locator('#btnZurueckZurFehleranalyse').click();
      await page.waitForFunction(()=>events.includes('back'));
      await page.evaluate(()=>{verbirgWiederholungsNavigation();finishList();});
      await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));
      assert.equal(await page.locator('#wiederholungNavBox').isVisible(),false,'late response cannot reopen navigation');
    } else {
      const button=['next','no-open'].includes(action)?'btnNaechsterOffenerFehler':'btnZurueckZurFehleranalyse';
      await page.locator('#'+button).click();
      assert.deepEqual(await page.evaluate(()=>events),['save'],'navigation cannot race persistence');
      if(action==='save-failure') {
        await page.evaluate(()=>failSave(new Error('offline')));
        await page.waitForFunction(()=>!appIstBeschaeftigt);
        assert.deepEqual(await page.evaluate(()=>events),['save']);
        assert.match(await page.locator('#ladeStatus').innerText(),/offline/);
      } else {
        await page.evaluate(()=>finishSave());
        if(['next','no-open'].includes(action)) {
          await page.waitForFunction(()=>events.includes('list'));
          await page.evaluate(empty=>finishList(empty),action==='no-open');
        }
        if(action==='no-open') {
          await page.waitForFunction(()=>!appIstBeschaeftigt);
          assert.equal(await page.locator('#btnNaechsterOffenerFehler').isVisible(),false);
          assert.equal(await page.locator('#btnZurueckZurFehleranalyse').isEnabled(),true);
        } else await page.waitForFunction(action=>events.includes(action),action);
        assert.equal(await page.evaluate(()=>events.filter(e=>e==='save').length),1);
      }
    }
  } finally {await browser.close();await new Promise(r=>server.close(r));}
});
