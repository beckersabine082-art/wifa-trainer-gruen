// Explicitly authorized, one-time real SDK acceptance test. Loopback only; never deploy.
// Runs unmodified production analytics code except local eligibility and test-data labels.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
http.createServer((req,res) => {
  const url = new URL(req.url,'http://127.0.0.1:8091');
  url.pathname = url.pathname.replace(/^\/wifa-trainer-gruen\//, '/');
  const file = path.resolve(root,'.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep) || /(^|[\\/])\./.test(path.relative(root,file)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  let body = fs.readFileSync(file);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.mp3':'audio/mpeg'})[path.extname(file)] || 'text/plain');
  if (url.pathname === '/js/analytics-settings.js') body = body.toString().replace('enabled: false','enabled: true').replace('https://beckersabine082-art.github.io','http://127.0.0.1:8091');
  if (url.pathname === '/js/analytics-consent.js') body = body.toString().replace("'copyright.html'];", "'copyright.html', 'tests/analytics-live.html'];");
  if (url.pathname === '/analytics-frame.html') body = body.toString().replace('<script type="module"', '<script src="tests/analytics-network-observer.js"></script>\n<script type="module"');
  if (url.pathname === '/js/analytics-frame.js') body = body.toString().replace('send_page_view: false,', "debug_mode: true, traffic_type: 'internal', test_run_id: 'acceptance_20260911', send_page_view: false,").replace('/* Analytics unavailable: the trainer continues normally. */', "parent.document.getElementById('report').textContent += 'SDK start failed\\n';");
  res.end(body);
}).listen(8091,'127.0.0.1',()=>console.log('REAL Google SDK acceptance server: http://127.0.0.1:8091/wifa-trainer-gruen/tests/analytics-live.html ; test_run_id=acceptance_20260911'));
