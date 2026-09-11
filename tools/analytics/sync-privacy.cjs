// Keep the standalone and in-app privacy statement identical.
const fs = require('node:fs');
const fragment = fs.readFileSync('docs/analytics-privacy.html','utf8').trim();
for (const file of ['datenschutz.html','index.html']) {
  let source = fs.readFileSync(file,'utf8');
  if (source.includes('id="analytics"')) {
    source = source.replace(/<!-- Identical addition[\s\S]*?<\/div>\s*<\/div>/, fragment);
  } else {
    const section = /(<h2 class="section-title">14\.[\s\S]*?<\/div>\s*<\/div>)/;
    if (!section.test(source)) throw Error('Privacy section missing: ' + file);
    source = source.replace(section, '$1\n\n' + fragment);
  }
  source = source.replace('Personenbezogene Daten werden nur verarbeitet, soweit dies für die Bereitstellung der Website, Nutzerkonten, Lernfunktionen, Sicherheit sowie KI-gestützte Funktionen erforderlich ist.',
    'Personenbezogene Daten werden für die Bereitstellung der Website, Nutzerkonten, Lernfunktionen, Sicherheit und KI-gestützte Funktionen sowie nach gesonderter Einwilligung für die unten erläuterte Nutzungsanalyse verarbeitet.');
  fs.writeFileSync(file,source);
}
