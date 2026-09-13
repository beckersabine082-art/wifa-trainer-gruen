const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

// Real HTML/CSS, ES modules and DOM. Only the external data boundary is replaced.
test('Lernstand: visible row panel, exclusive toggle, resize and trainer handoff', async () => {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') || pathname.endsWith('.mjs') ? 'text/javascript' : 'text/html');
    if (pathname === '/js/firebase-config.js') return res.end(`
      export const auth = {currentUser: {uid:'test', emailVerified:true}}, db = {};
      export const collection = () => ({}), doc = () => ({}), setDoc = async () => {}, serverTimestamp = () => ({}), query = () => ({}), orderBy = () => ({});
      export const getDocs = async () => ({docs: [{id:'attempt-1',data:()=>({modul:'wifa-trainer',userId:'test',bereich:'WQ',fach:'Recht',thema:'Vertrag',frageId:'q-answered',questionKey:'wifa-trainer::WQ::Recht::Vertrag::q-answered',erreichtePunkte:0,maximalPunkte:10,status:'falsch'})}]});
    `);
    if (pathname === '/') {
      const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      return res.end(html + `<script>
        window.requests = [];
        window.faecherNachTeilbereich = {WQ:['Recht','Steuern','Rechnungswesen','BWL','VWL'], HQ:['Unternehmensführung','F&Z','Betriebliches Management','Letztes Fach']};
        window.apiGet = async (action, params) => {requests.push({action,params}); if(action === 'questionsForTopic' && !params.thema) return {success:true,data:[{id:'q-answered',thema:'Vertrag'}]}; if(action !== 'topics') throw Error('Unexpected request: '+action); return {success:true,data:[{thema:'Vertrag',anzahl:83},{thema:'Grundlagen',anzahl:12}]};};
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('lernstandView').classList.add('active');
      </script><script type="module">import {ladeWifaLernstand} from '/js/lernstand.js'; await ladeWifaLernstand(); window.ready = true;</script>`);
    }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {res.statusCode = 404; return res.end();}
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {channel:'msedge'})});
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.ready);
    const buttons = page.locator('.lernstand-topic-toggle');
    const panels = page.locator('.lernstand-topics-panel');
    const verify = async index => {
      assert.equal(await panels.count(), 1, 'exactly one panel exists');
      assert.equal(await panels.evaluate(p => p.hidden), false);
      assert.equal(await panels.isVisible(), true, 'panel must remain in the visible DOM');
      assert.match(await panels.innerText(), /Vertrag/);
      assert.equal(await buttons.nth(index).innerText(), 'Themen ausblenden');
      assert.equal(await page.locator('.lernstand-topic-toggle[aria-expanded="true"]').count(), 1);
      const visual = await page.evaluate(index => {
        const card = document.querySelectorAll('.lernstand-subject-list > .lernstand-subject')[index];
        const panel = document.querySelector('.lernstand-topics-panel');
        const head = getComputedStyle(card), detail = getComputedStyle(panel);
        const bridge = getComputedStyle(card, '::after');
        return {expanded:card.classList.contains('is-expanded'),headBg:head.backgroundImage,detailBg:detail.backgroundImage,
          headBorder:head.borderLeftColor,detailBorder:detail.borderLeftColor,bridge:bridge.content,
          bridgeHeight:parseFloat(bridge.height),gap:panel.getBoundingClientRect().top-card.getBoundingClientRect().bottom};
      }, index);
      assert.equal(visual.expanded, true, 'selected card has an expanded visual state');
      assert.equal(visual.headBg, visual.detailBg, 'card and expansion share the subject background');
      assert.equal(visual.headBorder, visual.detailBorder, 'subject accent continues into expansion');
      assert.notEqual(visual.bridge, 'none', 'card is visually connected to expansion');
      assert.ok(visual.bridgeHeight >= visual.gap, 'connection fills the grid gap');
      const layout = await page.evaluate(index => {
        const cards = [...document.querySelectorAll('.lernstand-subject-list > .lernstand-subject')];
        const rects = cards.map(c => c.getBoundingClientRect());
        const panel = document.querySelector('.lernstand-topics-panel');
        const p = panel.getBoundingClientRect();
        const row = rects.filter(r => Math.abs(r.top - rects[index].top) < 1);
        const next = rects.find(r => r.top > rects[index].top + 1);
        return {width:p.width, gridWidth:panel.parentElement.getBoundingClientRect().width, top:p.top, bottom:p.bottom, rowBottom:Math.max(...row.map(r=>r.bottom)), nextTop:next?.top, cardWidth:rects[index].width, rowHeights:row.map(r=>r.height)};
      }, index);
      assert.ok(Math.abs(layout.width-layout.gridWidth)<2, JSON.stringify(layout));
      assert.ok(layout.top >= layout.rowBottom && layout.top-layout.rowBottom < 40, JSON.stringify(layout));
      assert.ok(Math.max(...layout.rowHeights)-Math.min(...layout.rowHeights)<1, 'cards in a row have equal heights');
      if(layout.nextTop) assert.ok(layout.nextTop >= layout.bottom, JSON.stringify(layout));
    };
    await buttons.nth(0).click();
    // Wait for the old asynchronous positionPanel too: it removes the panel and throws.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await panels.filter({visible:true}).count(), 1, `visible panel after click; browser errors: ${errors.join('; ')}`);
    await verify(0);
    if (process.env.LERNSTAND_SCREENSHOT_DIR) await page.locator('.lernstand-subject-list').screenshot({path:path.join(process.env.LERNSTAND_SCREENSHOT_DIR,'lernstand-recht.png')});
    await buttons.nth(0).click();
    assert.equal(await panels.count(), 0);
    assert.equal(await buttons.nth(0).innerText(), 'Themen anzeigen');
    for (const index of [0,1,4,8]) {
      await buttons.nth(index).click(); await verify(index);
      if (index === 1 && process.env.LERNSTAND_SCREENSHOT_DIR) await page.locator('.lernstand-subject-list').screenshot({path:path.join(process.env.LERNSTAND_SCREENSHOT_DIR,'lernstand-steuern.png')});
    }
    for (const width of [1100,850,600,390,1440]) {
      await page.setViewportSize({width,height:1000});
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await verify(8);
      const topicColumns = await page.locator('.lernstand-topics-panel .lernstand-topics').evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length);
      assert.equal(topicColumns, width >= 1100 ? 3 : width >= 768 ? 2 : 1);
      await buttons.nth(1).click(); await verify(1);
      await buttons.nth(8).click(); await verify(8);
    }
    // Container-only resizing must also reposition the panel (no window resize event).
    for (const [width, columns] of [[1080,4],[810,3],[540,2],[260,1]]) {
      await page.locator('.lernstand-subject-list').evaluate((grid,width) => grid.style.width = width+'px', width);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      assert.equal(await page.locator('.lernstand-subject-list').evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length), columns);
      await verify(8);
      await buttons.nth(0).click(); await verify(0);
      await buttons.nth(8).click(); await verify(8);
    }
    await page.locator('.lernstand-subject-list').evaluate(grid => grid.style.width = '');
    assert.deepEqual(await page.evaluate(() => [...new Set(requests.map(r=>r.action))]), ['topics','questionsForTopic']);
    await buttons.nth(0).click();
    const practice = page.locator('.lernstand-theme-btn').first();
    assert.ok(await practice.evaluate(b => b.getBoundingClientRect().width < b.closest('.lernstand-topic').getBoundingClientRect().width * .8));
    // Load the real classic scripts: main.js uses global lexical let bindings,
    // which are deliberately different from properties on window.
    await page.addScriptTag({url:'/js/main.js'});
    await page.addScriptTag({url:'/js/trainer.js'});
    await page.addScriptTag({url:'/js/bewertung.js'});
    await page.evaluate(() => {
      window.aktuellerNutzer = 'test';
      window.apiPost = async () => ({success:true});
      window.apiGet = async (action, params) => {
        requests.push({action,params});
        if (action === 'questionsForTopic') return {success:true,data:[{id:'q-answered',thema:params.thema || 'Vertrag',frage:'Already answered',musterloesung:'Test'},{id:'q-first',thema:params.thema || 'Vertrag',frage:'Browser-Testfrage',musterloesung:'Test',maximalPunkte:10}]};
        throw Error('Unexpected trainer request: '+action);
      };
    });
    const dialogs = [];
    page.on('dialog', async dialog => {dialogs.push(dialog.message()); await dialog.dismiss();});
    await practice.click();
    await page.waitForFunction(() => document.getElementById('trainerUnansweredBtn').textContent.includes('AKTIV'), undefined, {timeout:5000}).catch(error => {throw new Error(error.message + '; dialogs: '+dialogs.join(';')+'; errors: '+errors.join(';'));});
    assert.deepEqual(await page.evaluate(() => [aktuellerTeilbereich,aktuellesFach,aktuellesThema]), ['WQ','Recht','Vertrag']);
    assert.equal(await page.locator('#trainerView').evaluate(v=>v.classList.contains('active')), true);
    assert.match(await page.locator('#frageText').innerText(), /Browser-Testfrage/);
    assert.deepEqual(dialogs, []);
    assert.equal(await page.evaluate(() => requests.filter(r=>r.action === 'topics').length), 9);
    assert.deepEqual(await page.evaluate(() => requests.filter(r=>r.action !== 'topics')), [{action:'questionsForTopic',params:{fach:'Recht'}},{action:'questionsForTopic',params:{fach:'Recht',thema:'Vertrag'}}]);
    // Re-enter Lernstand while the existing trainer mode is still active, reload,
    // then start a different subject. The button must start, rather than toggle off.
    await page.evaluate(async () => {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('lernstandView').classList.add('active');
      const trainerApi = window.apiGet;
      window.apiGet = async (action,params) => action === 'topics'
        ? {success:true,data:[{thema:'Vertrag',anzahl:83}]} : trainerApi(action,params);
      await ladeWifaLernstand();
    });
    assert.equal(await panels.count(), 0);
    await buttons.nth(1).click();
    await practice.click();
    await page.waitForFunction(() => !appIstBeschaeftigt && document.getElementById('trainerUnansweredBtn').textContent.includes('AKTIV'));
    assert.deepEqual(await page.evaluate(() => [aktuellerTeilbereich,aktuellesFach,aktuellesThema]), ['WQ','Steuern','Vertrag']);
    assert.equal(await page.locator('#fachSelect').inputValue(), 'Steuern');
    assert.equal(await page.locator('#themaSelect').inputValue(), 'Vertrag');
    assert.deepEqual(await page.evaluate(() => requests.filter(r=>r.action === 'questionsForTopic').map(r=>r.params.fach)), ['Recht','Recht','Recht','Steuern']);
    assert.deepEqual(errors, []);
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
