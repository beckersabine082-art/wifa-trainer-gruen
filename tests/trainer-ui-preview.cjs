// Local fixture preview: production UI/scripts, no login, external API or persistent writes.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname,'..');
const fixture = `
localStorage.setItem('hinweisGelesen','true');
document.getElementById('hinweisOverlay').style.display='none';
window.aktuellerNutzer = 'local-preview';
aktuellerTeilbereich = 'WQ'; aktuellesFach = 'BWL'; aktuellesThema = 'Unternehmensziele';
window.previewQuestions = [
  {id:'preview-1',frage:'Erläutern Sie Vision und Mission eines Unternehmens.',thema:aktuellesThema,
   musterloesung:'Eine Vision beschreibt langfristige Ziele. Die Mission erklärt den Nutzen für Kunden.',stichpunkte:'langfristige Ziele;Nutzen für Kunden'},
  {id:'preview-2',frage:'Was beeinflusst den Marktpreis?',thema:aktuellesThema,
   musterloesung:'Angebot & Nachfrage beeinflussen den Marktpreis.',stichpunkte:'Angebot & Nachfrage'},
  {id:'preview-3',frage:'Was bedeutet Wirtschaftlichkeit?',thema:aktuellesThema,
   musterloesung:'Wirtschaftlichkeit beschreibt das Verhältnis von Ertrag zu Aufwand.',stichpunkte:'Verhältnis von Ertrag zu Aufwand'}
].map((q,i)=>({...q,fragePosition:i+1,frageGesamt:3}));
window.previewAttempts = [];
window.loadAttemptsForCurrentUser = async()=>previewAttempts;
window.speichereWifaAttempt = async attempt=>{previewAttempts.push({...attempt,modul:'wifa-trainer'});};
window.apiGet = async(action,params)=>{
  if(action==='questionsForTopic') return {success:true,data:previewQuestions};
  if(action==='topics') return {success:true,data:[{thema:aktuellesThema,anzahl:3}]};
  if(action==='getProgress') return {success:true,data:null};
  if(action==='firstQuestion') return {success:true,data:previewQuestions[0]};
  if(action==='nextQuestion') return {success:true,data:previewQuestions[previewQuestions.findIndex(q=>q.id===params.currentId)+1] || {themaAbgeschlossen:true}};
  throw Error('Unerwartete Vorschau-Anfrage: '+action);
};
window.apiPost = async(action,params)=>{
  if(action==='saveProgress') return {success:true};
  if(action!=='bewerteAntwort') throw Error('Unerwartete Vorschau-Anfrage: '+action);
  const q=previewQuestions.find(q=>q.id===params.frageId);
  return {success:true,data:{punkte:1,maxPunkte:2,
    ergebnis:'Ein wichtiger Aspekt ist richtig. Der Nutzen für Kunden wird noch nicht erklärt.',
    musterloesung:q.musterloesung,erkannteKriterien:[q.stichpunkte.split(';')[0]],
    fehlendeKriterien:['Nutzen für Kunden','Dieses Kriterium steht nicht im Lösungstext']}};
};
document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
document.getElementById('trainerView').classList.add('active');
document.getElementById('trainerView').insertAdjacentHTML('afterbegin',
  '<p role="note" style="padding:12px;background:#f3eafa;border:1px solid #7136a8">Lokale UI-Vorschau mit Beispieldaten und simulierter Bewertung. Keine Anmeldung, keine API-Kosten, keine Speicherung außerhalb dieser Seite.</p>');
document.getElementById('anzeigeTeilbereich').textContent=aktuellerTeilbereich;
document.getElementById('anzeigeFach').textContent=aktuellesFach;
zeigeGeladeneFrage(previewQuestions[0],aktuellesThema);
document.getElementById('antwortInput').value='Eine Vision beschreibt langfristige Ziele.';
window.previewReady=true;
`;

function createPreviewServer() {
  return http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'");
    if(pathname==='/') {
      res.setHeader('Content-Type','text/html; charset=utf-8');
      const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
      return res.end(html+'<script src="/js/main.js"></script><script src="/js/trainer.js"></script><script src="/js/bewertung.js"></script><script src="/__fixture.js"></script>');
    }
    if(pathname==='/__fixture.js') {
      res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(fixture);
    }
    if(!['/js/main.js','/js/trainer.js','/js/bewertung.js','/css/style.css','/icon-192.png','/icon-512.png'].includes(pathname)) {res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',pathname.endsWith('.css')?'text/css':pathname.endsWith('.png')?'image/png':'text/javascript; charset=utf-8');
    res.end(fs.readFileSync(path.join(root,pathname.slice(1))));
  });
}
module.exports={createPreviewServer};
if(require.main===module) {
  const server=createPreviewServer();
  server.listen(0,'127.0.0.1',()=>console.log('Trainer-Vorschau: http://127.0.0.1:'+server.address().port));
}
