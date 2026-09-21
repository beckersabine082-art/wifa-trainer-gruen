const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function render(text,criteria) {
  const c={window:{addEventListener(){}},document:{addEventListener(){}}};
  vm.createContext(c);
  vm.runInContext(read('js/main.js'),c);
  vm.runInContext(read('js/bewertung.js'),c);
  return c.hebeStichpunkteHervor(text,criteria);
}
test('solution highlights existing criteria, preserving source wording and excluding absent criteria',()=>{
  const text='Eine Vision beschreibt langfristige Ziele. Die Mission erklärt den Nutzen für Kunden.';
  const html=render(text,['langfristige Ziele','Nutzen für Kunden','nicht im Lösungstext']);
  assert.equal(html,'Eine Vision beschreibt <strong class="musterloesung-kriterium">langfristige Ziele</strong>. Die Mission erklärt den <strong class="musterloesung-kriterium">Nutzen für Kunden</strong>.');
  assert.equal(html.replace(/<[^>]+>/g,''),text);
});
test('highlighting escapes source HTML and matches ampersands without modifying generated markup',()=>{
  const html=render('<img src=x onerror=alert(1)> Angebot & Nachfrage strong',['Angebot & Nachfrage','strong']);
  assert.ok(html.startsWith('&lt;img'));
  assert.ok(html.includes('<strong class="musterloesung-kriterium">Angebot &amp; Nachfrage</strong>'));
  assert.ok(html.endsWith('<strong class="musterloesung-kriterium">strong</strong>'));
  assert.equal((html.match(/class="musterloesung-kriterium"/g)||[]).length,2);
});
test('overlapping and repeated criteria produce one highlight per source occurrence',()=>{
  const html=render('Langfristige Ziele, langfristige Ziele.',['Ziele','langfristige Ziele','langfristige Ziele']);
  assert.equal((html.match(/<strong /g)||[]).length,2);
  assert.equal(html.replace(/<[^>]+>/g,''),'Langfristige Ziele, langfristige Ziele.');
});
test('semantic criterion wording highlights inflected and reordered solution wording',()=>{
  const html=render(
    'Arbeitnehmer leisten weisungsgebundene Arbeit und sind regelmäßig in den Betrieb eingegliedert.',
    ['Eingliederung in den Betrieb']
  );
  assert.match(html,/regelmäßig in den Betrieb eingegliedert/);
  assert.equal((html.match(/class="musterloesung-kriterium"/g)||[]).length,1);
});
test('trainer no longer contains manual solution, clear-answer or separate criteria controls',()=>{
  const html=read('index.html');
  for(const id of ['btnMusterloesungAnzeigen','btnAntwortLeeren','bewertungskriterien']) assert.ok(!html.includes(`id="${id}"`),id);
  assert.ok(html.includes('id="btnVorherigeFrage"'));
  assert.ok(html.includes('id="trainerUnansweredBtn"'));
});
