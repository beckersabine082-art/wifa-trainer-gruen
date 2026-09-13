const test = require('node:test');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {createPreviewServer} = require('./trainer-ui-preview.cjs');

test('evaluation automatically reveals highlighted source solution; every navigation mode clears the old result',async()=>{
  const server=createPreviewServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'msedge'})});
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',d=>d.dismiss());
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.previewReady);
    const grade=async()=>{
      await page.locator('#antwortInput').fill('Eine Vision beschreibt langfristige Ziele.');
      await page.locator('#btnAuswertungStarten').click();
      await page.waitForFunction(()=>!appIstBeschaeftigt);
    };
    await grade();
    assert.equal(await page.locator('#solutionBox').isVisible(),true,'automatic model solution');
    assert.equal(await page.getByRole('button',{name:'Musterlösung anzeigen',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Antwort leeren',exact:true}).count(),0);
    assert.equal(await page.locator('#bewertungskriterien').count(),0);
    assert.equal(await page.locator('#musterloesungText').innerText(),await page.evaluate(()=>previewQuestions[0].musterloesung));
    assert.deepEqual(await page.locator('.musterloesung-kriterium').allTextContents(),['langfristige Ziele','Nutzen für Kunden']);
    assert.deepEqual(await page.locator('.musterloesung-kriterium').first().evaluate(el=>({color:getComputedStyle(el).color,weight:getComputedStyle(el).fontWeight})),{color:'rgb(113, 54, 168)',weight:'700'});
    assert.match(await page.locator('#ergebnisText').innerText(),/Nutzen für Kunden wird noch nicht erklärt/);
    assert.ok(!(await page.locator('#resultBox').innerText()).includes('Für die volle Punktzahl fehlte noch:'));
    assert.equal(await page.locator('#btnVorherigeFrage').isVisible(),true);
    const cleared=async()=>{
      await page.waitForFunction(()=>!appIstBeschaeftigt);
      assert.equal(await page.locator('#antwortInput').inputValue(),'');
      assert.equal(await page.locator('#resultBox').isVisible(),false);
      assert.equal(await page.locator('#solutionBox').isVisible(),false);
      assert.equal(await page.locator('#musterloesungText').innerText(),'');
    };
    await page.locator('#btnVorherigeFrage').click(); await cleared();
    assert.equal(await page.evaluate(()=>aktuelleFrageId),'preview-3');
    await grade();
    await page.getByRole('button',{name:'Nächste Frage',exact:true}).click(); await cleared();
    assert.equal(await page.evaluate(()=>aktuelleFrageId),'preview-1');
    await grade();
    await page.locator('#trainerShuffleBtn').click(); await cleared();
    await grade();
    await page.getByRole('button',{name:'Nächste Frage',exact:true}).click(); await cleared();
    await grade();
    await page.locator('#btnVorherigeFrage').click(); await cleared();
    await page.evaluate(()=>{previewAttempts=[];});
    await page.locator('#trainerUnansweredBtn').click(); await cleared();
    await grade();
    await page.getByRole('button',{name:'Nächste Frage',exact:true}).click(); await cleared();
    await grade();
    await page.locator('#btnVorherigeFrage').click(); await cleared();
    assert.deepEqual(errors,[]);
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
