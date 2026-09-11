// Maintainer-only: regenerate the checked-in allowlist from the public learning catalog.
// No browser-time requests, no user records, no Analytics writes.
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const apiSource = fs.readFileSync('js/api.js', 'utf8');
const base = apiSource.match(/const API_BASE_URL = "([^"]+)"/)[1];
const context = {window: {}, Set, Map, WeakMap};
vm.runInNewContext(fs.readFileSync('js/analytics-core.js', 'utf8'), context);
const rows = {};
const core = context.window.createWifaAnalyticsCore((name, p) => { if (name === 'training_start') rows.current = p.subject_id; });
core.setEnabled(true);
const subjects = ['Recht','Steuern','Rechnungswesen','BWL','VWL','Unternehmensführung',
  'Führung und Zusammenarbeit','Betriebliches Management','Logistik','Marketing','Vertrieb',
  'Investition und Finanzierung','Betriebliches Rechnungswesen und Controlling'];
async function main() {
  const catalog = {};
  for (const subject of subjects) {
    core.reset('trainer'); core.start('trainer', subject);
    const id = rows.current;
    const results = await Promise.all(['topics','getLerntexte'].map(async action => {
      const url = new URL(base); url.searchParams.set('action', action); url.searchParams.set('fach', subject);
      const res = await fetch(url, {signal: AbortSignal.timeout(60000)});
      if (!res.ok) throw Error('Catalog HTTP ' + res.status);
      const result = await res.json();
      if (!result.success || !Array.isArray(result.data)) throw Error('Catalog unavailable: ' + subject);
      return result.data.flatMap(row => typeof row === 'string' ? [row] : [row.thema, row.titel, row.hauptkapitel]).filter(Boolean);
    }));
    for (const label of results.flat()) {
      const text = String(label).normalize('NFC').trim();
      if (text.includes('@') || /https?:/.test(text)) throw Error('Review catalog label before export');
      const key = id + '|' + text;
      catalog[key] = id + '_' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
    }
    console.log(subject + ': catalog loaded');
  }
  const sorted = Object.fromEntries(Object.entries(catalog).sort(([a],[b]) => a.localeCompare(b)));
  fs.writeFileSync('js/analytics-topics.js', '// Fixed public curriculum allowlist. Generated 2026-09-10; review changes before release.\nwindow.WIFA_ANALYTICS_TOPICS = Object.freeze(' + JSON.stringify(sorted, null, 2) + ');\n');
  console.log(Object.keys(sorted).length + ' fixed topic aliases written.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
