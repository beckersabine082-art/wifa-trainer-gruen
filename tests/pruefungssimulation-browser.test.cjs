const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

test('all 24 local exams render in the real DOM and retain full model solutions through evaluation', async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/pruefungssimulation/katalog.json'), 'utf8'));
  const allowed = new Set(['/js/main.js', '/js/pruefungssimulation.js', '/css/style.css',
    '/data/pruefungssimulation/katalog.json', '/icon-192.png', '/icon-512.png']);
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        // Do not preload the unrelated learning-text podcast in this local test.
        .replace(/(<audio\b[^>]*?)\s+src="[^"]*"/gi, '$1');
      return res.end(html + '<script src="/js/main.js"></script><script src="/js/pruefungssimulation.js"></script>');
    }
    if (!allowed.has(pathname)) { res.statusCode = 404; return res.end(); }
    const mime = pathname.endsWith('.json') ? 'application/json' : pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.png') ? 'image/png' : 'text/javascript';
    res.setHeader('Content-Type', mime + '; charset=utf-8');
    res.end(fs.readFileSync(path.join(root, pathname.slice(1))));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : { channel: 'msedge' }) });
    const page = await browser.newPage();
    const errors = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') { externalRequests.push(url.hostname); return route.abort(); }
      return route.continue();
    });
    await page.addInitScript(() => {
      localStorage.setItem('hinweisGelesen', 'true');
      // The general statistics area is outside this isolated exam preview.
      window.updateStatAnzeige = () => {};
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    for (const unit of catalog.einheiten) {
      const rendered = await page.evaluate(async unit => {
        document.getElementById('pruefungTeilbereichSelect').value = unit.teilbereich;
        pruefungTeilbereichWaehlen();
        document.getElementById('pruefungSimulationSelect').value = unit.simulation;
        pruefungSimulationWaehlen();
        document.getElementById('pruefungFachSelect').value = unit.einheit;
        await ladePruefungSimulation();
        stoppePruefungTimer();
        return {
          text: document.getElementById('pruefungContainer').textContent,
          answers: [...document.querySelectorAll('.pruefung-antwort')].map(el => ({ solution: el.dataset.musterloesung, points: Number(el.dataset.punkte), question: el.dataset.frage }))
        };
      }, { teilbereich: unit.teilbereich, simulation: unit.simulation, einheit: unit.einheit });
      assert.equal(rendered.answers.length, unit.aufgaben.length, `${unit.teilbereich}/${unit.simulation}/${unit.einheit}: ${rendered.text.slice(0, 150)}`);
      for (let i = 0; i < unit.aufgaben.length; i++) {
        const row = unit.aufgaben[i];
        // HTML attribute parsing normalizes CRLF to LF; content must otherwise be exact.
        assert.equal(rendered.answers[i].solution, row.musterloesung.replace(/\r\n?/g, '\n'));
        assert.equal(rendered.answers[i].points, row.punkte);
        assert.equal(rendered.answers[i].question, row.frage.replace(/\r\n?/g, '\n'));
        assert.ok(rendered.text.replace(/\s+/g, ' ').includes(row.situation.replace(/\s+/g, ' ').trim()), `${unit.einheit} ${row.aufgabe}${row.teilaufgabe}: missing case situation`);
      }
      if (!unit.aufgaben.length) assert.match(rendered.text, /Keine Prüfung gefunden/);
    }
    // A corrected FMEA solution must be the same full text in the result view.
    const solution = catalog.einheiten.find(u => u.teilbereich === 'HQ' && u.simulation === '2' && u.einheit === 'HQ_A1').aufgaben.find(r => r.aufgabe === 5 && r.teilaufgabe === 'a');
    const displayed = await page.evaluate(row => {
      aktuellePruefungsDaten = [row];
      letztePruefungsAntworten = [{ ...row, antwort: 'Fehler 1 hat RPZ 900.' }];
      renderPruefungsAuswertung({ gesamtPunkte: 0, gesamtMaxPunkte: row.punkte, aufgaben: [{ aufgabe: row.aufgabe, teilaufgabe: row.teilaufgabe, punkte: 0, maxPunkte: row.punkte, ergebnis: 'Lokaler Darstellungstest' }] });
      togglePruefungsMusterloesung(0);
      const el = document.getElementById('pruefungMusterloesung-0');
      return { text: el.textContent, display: el.style.display };
    }, solution);
    assert.equal(displayed.display, 'block');
    assert.ok(displayed.text.includes(solution.musterloesung.replace(/\r\n?/g, '\n')));
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
