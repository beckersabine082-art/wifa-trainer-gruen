const fs = require('node:fs');
const read = name => JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`, 'utf8'));
const rubricCorrections = () => ['audit-hq-kriterien','audit-wq-kriterien','audit-rewe-kriterien'].flatMap(read);
const allCorrections = () => [...read('pruefungssimulation-audit-korrekturen'), ...rubricCorrections()];
module.exports = { rubricCorrections, allCorrections };
