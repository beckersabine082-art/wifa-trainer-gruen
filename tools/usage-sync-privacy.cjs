// Sync only the aggregate notice. The existing GA notice and consent files remain untouched.
const fs=require('node:fs');
const fragment=fs.readFileSync('docs/usage-privacy.html','utf8').trim();
for(const file of ['index.html','datenschutz.html']) {
  let source=fs.readFileSync(file,'utf8');
  const existing=/<!-- Aggregate usage notice:[\s\S]*?<\/div>\s*<\/div>/;
  if(existing.test(source)) source=source.replace(existing,fragment);
  else {
    const ga=/(<!-- Identical addition[\s\S]*?<\/div>\s*<\/div>)/;
    if(!ga.test(source)) throw Error('Existing privacy boundary missing: '+file);
    source=source.replace(ga,match=>match+'\n\n'+fragment);
  }
  fs.writeFileSync(file,source);
}
