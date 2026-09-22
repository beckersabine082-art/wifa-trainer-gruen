const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  chromium = null;
}

const root = path.resolve(__dirname, '..');

const guidedEntryTest = chromium ? test : test.skip;

guidedEntryTest('guided trainer entry keeps the trainer closed until the three choices are complete', async () => {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const files = {
      '/': ['text/html; charset=utf-8', 'index.html'],
      '/js/main.js': ['text/javascript; charset=utf-8', 'js/main.js'],
      '/js/trainer.js': ['text/javascript; charset=utf-8', 'js/trainer.js'],
      '/css/style.css': ['text/css', 'css/style.css']
    };
    if (!files[pathname]) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader('Content-Type', files[pathname][0]);
    const content = fs.readFileSync(path.join(root, files[pathname][1]));
    res.end(pathname === '/' ? content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '') : content);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : { channel: 'msedge' })
    });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    await page.addScriptTag({ url: origin + '/js/main.js' });
    await page.addScriptTag({ url: origin + '/js/trainer.js' });
    await page.evaluate(() => {
      window.apiGet = async (action) => action === 'topics'
        ? { success: true, data: [{ thema: 'Vertrag', anzahl: 2 }] }
        : { success: true, data: [] };
      window.aktuellerNutzer = 'fixture';
      aktuellerTeilbereich = '';
      aktuellesFach = '';
      aktuellesThema = '';
      ladeTrainerFortschritt = async () => null;
      ladeFrageAusFach = () => {};
      oeffneTrainerMitTeilbereich();
    });

    assert.equal(await page.locator('#trainerEinstiegsDialog').isVisible(), true);
    assert.equal(await page.locator('#trainerView').evaluate(view => view.classList.contains('active')), false);
    assert.equal(await page.locator('#trainerEinstiegsFortschritt').innerText(), '1 von 3 – Teilbereich');

    await page.selectOption('#trainerEinstiegsTeilbereich', 'WQ');
    assert.equal(await page.locator('#trainerEinstiegsFortschritt').innerText(), '2 von 3 – Fach');
    assert.deepEqual(await page.locator('#trainerEinstiegsFach option').evaluateAll(options => options.map(option => option.value)), ['', 'Recht', 'Steuern', 'Rechnungswesen', 'BWL', 'VWL', 'Unternehmensführung']);

    await page.selectOption('#trainerEinstiegsFach', 'Recht');
    await page.waitForFunction(() => document.querySelector('#trainerEinstiegsThema option[value="Vertrag"]'));
    assert.equal(await page.locator('#trainerEinstiegsFortschritt').innerText(), '3 von 3 – Thema');
    await page.selectOption('#trainerEinstiegsThema', 'Vertrag');
    assert.equal(await page.locator('#trainerEinstiegsStartBtn').isEnabled(), true);

    await page.locator('#trainerEinstiegsStartBtn').click();
    await page.waitForFunction(() => document.querySelector('#trainerEinstiegsDialog').hidden);
    assert.equal(await page.locator('#trainerView').evaluate(view => view.classList.contains('active')), true);
    assert.deepEqual(await page.evaluate(() => [aktuellerTeilbereich, aktuellesFach, aktuellesThema]), ['WQ', 'Recht', 'Vertrag']);
    assert.equal(await page.locator('#trainerAuswahlStartBtn').isHidden(), true);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
