// Local review server. --analytics-test replaces Firebase Analytics with a LOCAL test double.
// No events go to Google. Never deploy this server or tests as a measurement endpoint.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd(), testMode = process.argv.includes('--analytics-test');
const events = [];
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8080');
  res.setHeader('Cache-Control','no-store');
  if (testMode && url.pathname === '/__collect') {
    let body=''; req.on('data', chunk => body += chunk); req.on('end', () => {
      events.push(JSON.parse(body)); res.end('ok');
    }); return;
  }
  if (testMode && url.pathname === '/__events') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(events)); return; }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep) || /(^|[\\/])\./.test(path.relative(root,file)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.statusCode=404; res.end(); return;
  }
  const ext = path.extname(file);
  res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.mp3':'audio/mpeg'})[ext] || 'text/plain');
  let body = fs.readFileSync(file);
  if (testMode && url.pathname === '/js/analytics-settings.js') body = 'window.WIFA_ANALYTICS_SETTINGS={enabled:true,measurementId:"G-LOCALTEST",productionOrigin:"http://127.0.0.1:8080",productionPath:"/"};';
  if (testMode && url.pathname === '/js/analytics-consent.js') body = body.toString().replace("'copyright.html'];", "'copyright.html', 'tests/analytics-browser.html'];");
  if (testMode && url.pathname === '/js/analytics-frame.js') body = body.toString().replaceAll('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js', '../tests/fixtures/firebase-app.js').replaceAll('https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js', '../tests/fixtures/firebase-analytics.js');
  res.end(body);
}).listen(8080,'127.0.0.1',()=>console.log('Local server :8080; Analytics test double: ' + testMode));
