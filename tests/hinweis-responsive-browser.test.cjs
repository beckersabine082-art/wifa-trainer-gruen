const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const servedFiles = new Set(['/index.html', '/css/style.css', '/js/main.js']);

function createServer() {
  return http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!servedFiles.has(pathname)) {
      res.statusCode = 404;
      return res.end();
    }

    const filePath = path.join(root, pathname.slice(1));
    res.setHeader('Content-Type', pathname.endsWith('.css')
      ? 'text/css; charset=utf-8'
      : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(filePath));
  });
}

async function openHintPage(browser, origin, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(origin + '/index.html');
  await page.addScriptTag({ url: origin + '/js/main.js' });
  await page.evaluate(() => {
    localStorage.removeItem('hinweisGelesen');
    initialisiereHinweis();
  });
  return page;
}

async function readHintLayout(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('hinweisOverlay');
    const dialog = overlay?.firstElementChild;
    const content = dialog?.querySelector('.hinweis-dialog__content');
    const footer = dialog?.querySelector('.hinweis-dialog__footer');
    const button = document.getElementById('hinweisButton');
    const rect = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { top: value.top, bottom: value.bottom, height: value.height };
    };

    return {
      viewport: { width: innerWidth, height: innerHeight },
      dialog: rect(dialog),
      content: content ? {
        rect: rect(content),
        clientHeight: content.clientHeight,
        scrollHeight: content.scrollHeight,
        overflowY: getComputedStyle(content).overflowY,
        text: content.innerText.replace(/\s+/g, ' ').trim(),
      } : null,
      footer: rect(footer),
      button: rect(button),
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyClass: document.body.className,
      overlayOverflow: getComputedStyle(overlay).overflow,
    };
  });
}

test('usage notice keeps its footer reachable in portrait and landscape phone viewports', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : { channel: 'msedge' }),
  });

  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const viewport of [{ width: 375, height: 667 }, { width: 667, height: 375 }]) {
      const page = await openHintPage(browser, origin, viewport);
      const layout = await readHintLayout(page);

      assert.ok(layout.content, `content area exists at ${viewport.width}x${viewport.height}`);
      assert.equal(layout.content.text, 'Die Musterlösungen dienen nur als Vorschläge. Es sind auch andere fachlich korrekte Antworten möglich. Das Bewertungssystem bietet lediglich eine Orientierung und stellt keine verbindliche Bewertung im Sinne einer Prüfung dar. Die Inhalte des WiFa Trainers basieren auf eigener Lernaufbereitung, fachlicher Prüfungsvorbereitung sowie verschiedenen Lern- und Unterrichtsmaterialien aus kaufmännischen Weiterbildungen. Alle Inhalte wurden für Lernzwecke didaktisch überarbeitet und stellen keine offiziellen Musterlösungen dar. Alle genannten Marken, Prüfungsbezeichnungen und Institutionen bleiben Eigentum der jeweiligen Rechteinhaber. Dieser Hinweis zur Nutzung ersetzt nicht die verbindlichen Nutzungsbedingungen und auch nicht die Datenschutzerklärung.');
      assert.ok(layout.dialog.top >= 0, `dialog starts inside viewport at ${viewport.width}x${viewport.height}`);
      assert.ok(layout.dialog.bottom <= layout.viewport.height, `dialog fits viewport at ${viewport.width}x${viewport.height}`);
      assert.ok(layout.footer.bottom <= layout.viewport.height, `footer fits viewport at ${viewport.width}x${viewport.height}`);
      assert.ok(layout.button.bottom <= layout.viewport.height, `button fits viewport at ${viewport.width}x${viewport.height}`);

      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('usage notice locks the page and scrolls only its content area', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : { channel: 'msedge' }),
  });

  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await openHintPage(browser, origin, { width: 667, height: 375 });
    const layout = await readHintLayout(page);

    assert.equal(layout.bodyOverflow, 'hidden');
    assert.match(layout.bodyClass, /(^|\s)hinweis-open(\s|$)/);
    assert.equal(layout.overlayOverflow, 'hidden');
    assert.equal(layout.content.overflowY, 'auto');
    assert.ok(layout.content.scrollHeight > layout.content.clientHeight, 'content has an independent scroll range');

    const contentBox = await page.locator('.hinweis-dialog__content').evaluate(element => {
      const value = element.getBoundingClientRect();
      return { x: value.left + value.width / 2, y: value.top + value.height / 2 };
    });
    await page.mouse.move(contentBox.x, contentBox.y);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(50);

    const scrollPositions = await page.evaluate(() => ({
      page: window.scrollY,
      content: document.querySelector('.hinweis-dialog__content').scrollTop,
    }));
    assert.equal(scrollPositions.page, 0);
    assert.ok(scrollPositions.content > 0, 'wheel input scrolls the dialog content');

    await page.locator('#hinweisCheckbox').check();
    await page.locator('#hinweisButton').click();
    const closed = await page.evaluate(() => ({
      overlay: getComputedStyle(document.getElementById('hinweisOverlay')).display,
      bodyClass: document.body.className,
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyPosition: getComputedStyle(document.body).position,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
    }));
    assert.equal(closed.overlay, 'none');
    assert.doesNotMatch(closed.bodyClass, /(^|\s)hinweis-open(\s|$)/);
    assert.equal(closed.bodyOverflow, 'visible');
    assert.notEqual(closed.bodyPosition, 'fixed');
    assert.equal(closed.htmlOverflow, 'visible');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
