/* Local visual fixture only: node tests/usage-preview-server.cjs [port]. No live API/Auth. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const authFixture = `
const listeners = [];
export const auth = {currentUser:{uid:'fixture',emailVerified:true,getIdToken:async () => 'fixture-token'}};
export function onIdTokenChanged(_,callback) { listeners.push(callback); callback(); }
window.fixtureLogout = () => { auth.currentUser = null; listeners.forEach(callback => callback()); };
window.fixtureDeny = () => { window.fixtureDenied = true; listeners.forEach(callback => callback()); };
`;
const transportFixture = `
export async function usageRequest(body) {
  if (window.fixtureDenied) return {success:false,error:'forbidden'};
  const days = [
    {date:'2026-09-02',counts:{'trainer_start|recht|none':30,'quiz_start|recht|none':12}},
    {date:'2026-09-07',counts:{'trainer_start|recht|none':12,'quiz_start|recht|none':8,'podcast_start|recht|none':4}},
    {date:'2026-09-09',counts:{'trainer_start|rechnungswesen_controlling|none':22,'learning_text_open|finance_controlling|none':6}},
    {date:'2026-09-11',counts:{'flashcards_start|steuern|none':10,'simulation_start|unknown|HQ':5,'glossary_open|unknown|none':8}},
    {date:'2026-09-12',counts:{'podcast_start|recht|none':3,'formulas_open|unknown|none':3,'progress_open|unknown|none':6,'kilian_open|unknown|none':9,'kilian_use|unknown|none':5,'simulation_start|recht|WQ':4}}
  ];
  return {success:true,data:{today:'2026-09-12',period:body.period,days,totals:{}}};
}
`;
const files = {'/usage-statistics.html':['usage-statistics.html','text/html; charset=utf-8'],
  '/css/usage.css':['css/usage.css','text/css; charset=utf-8'],
  '/js/usage-core.js':['js/usage-core.js','text/javascript; charset=utf-8'],
  '/js/usage-dashboard.js':['js/usage-dashboard.js','text/javascript; charset=utf-8']};
http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://127.0.0.1').pathname;
  res.setHeader('Cache-Control','no-store');
  if (pathname === '/js/firebase-config.js' || pathname === '/js/usage-client.js' || pathname === '/js/api.js') {
    res.setHeader('Content-Type','text/javascript; charset=utf-8');
    res.end(pathname.endsWith('firebase-config.js') ? authFixture : pathname.endsWith('usage-client.js') ? transportFixture : ''); return;
  }
  const entry = files[pathname === '/' ? '/usage-statistics.html' : pathname];
  if (!entry) {res.writeHead(404);res.end('Not found');return;}
  let content = fs.readFileSync(path.join(root,entry[0]),'utf8');
  if (entry[0].endsWith('.html')) content = content.replace('<main>', '<main><p><strong>LOKALE TESTDATEN</strong> · <button onclick="fixtureLogout()">Fixture abmelden</button> <button onclick="fixtureDeny()">Fixture Zugriff verweigern</button></p>');
  res.setHeader('Content-Type',entry[1]); res.end(content);
}).listen(Number(process.argv[2]) || 8794,'127.0.0.1',() => console.log('Usage fixture: http://127.0.0.1:' + (Number(process.argv[2]) || 8794)));
