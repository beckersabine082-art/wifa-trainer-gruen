'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const { STAGING_PODCAST_PREFIX } = require('./hash-paths');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_STAGING_API_URL = 'https://script.google.com/macros/s/AKfycbwGFmFLFMfsRgOmLF-uwTH6xc8E_AaorV5AoiQLmXWzd4FZUdu92YT7SE8YVs2wLZ32_Q/exec';
const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
});

function injectStagingRuntime(html) {
  const marker = '<script>window.WIFA_PODCAST_STORAGE_PREFIX=' + JSON.stringify(STAGING_PODCAST_PREFIX)
    + ';window.WIFA_STAGING_PREVIEW=true;</script>\n';
  const anchor = '<script src="js/api.js"></script>';
  if (!String(html).includes(anchor)) throw new Error('Staging-Preview: API-Skriptanker fehlt');
  const directOpen = '<script>window.addEventListener("load",function(){setTimeout(function(){'
    + "window.requireAuth('lerntextePodcastView');"
    + '},0);});</script>\n';
  return String(html).replace(anchor, marker + anchor).replace('</body>', directOpen + '</body>');
}

function rewriteApiUrl(source, apiUrl) {
  const url = String(apiUrl || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) {
    throw new Error('Staging-Preview: gültige Apps-Script-Staging-URL erforderlich');
  }
  const pattern = /const API_BASE_URL = "[^"]+";/;
  if (!pattern.test(String(source))) throw new Error('Staging-Preview: API_BASE_URL fehlt');
  return String(source).replace(pattern, 'const API_BASE_URL = ' + JSON.stringify(url) + ';');
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(ROOT, relative);
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) throw new Error('Pfad außerhalb der Vorschau');
  return candidate;
}

function createServer({ apiUrl = DEFAULT_STAGING_API_URL } = {}) {
  rewriteApiUrl('const API_BASE_URL = "https://example.invalid";', apiUrl);
  return http.createServer((request, response) => {
    let filePath;
    try { filePath = safePath(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch (error) { response.writeHead(400).end(error.message); return; }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      let body = fs.readFileSync(filePath);
      const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
      if (relative === 'index.html') body = Buffer.from(injectStagingRuntime(body.toString('utf8')));
      if (relative === 'js/api.js') body = Buffer.from(rewriteApiUrl(body.toString('utf8'), apiUrl));
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500).end(error.message);
    }
  });
}

function cliValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const apiUrl = cliValue(argv, '--api-url') || process.env.PODCAST_LERNTEXTE_API_URL || DEFAULT_STAGING_API_URL;
  const port = Number(cliValue(argv, '--port') || process.env.PORT || 4181);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Ungültiger Port');
  createServer({ apiUrl }).listen(port, '127.0.0.1', () => {
    console.log('Podcast-Staging-Vorschau: http://127.0.0.1:' + port + '/');
  });
}

module.exports = { DEFAULT_STAGING_API_URL, createServer, injectStagingRuntime, rewriteApiUrl, safePath };
