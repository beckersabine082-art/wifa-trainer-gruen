const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const excludedDirectories = new Set(['.git', 'docs', 'node_modules', 'tests', 'tools']);

function publicHtmlFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name)
        ? []
        : publicHtmlFiles(path.join(directory, entry.name));
    }

    if (!/\.html$/i.test(entry.name) || /^test-/i.test(entry.name) || entry.name === 'usage-statistics.html') {
      return [];
    }

    return [path.join(directory, entry.name)];
  });
}

test('normal website pages do not link to the administration statistics', () => {
  const links = [];

  for (const file of publicHtmlFiles(root)) {
    const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const anchor of html.match(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) || []) {
      const href = anchor.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const target = (href?.[1] ?? href?.[2] ?? href?.[3] ?? '').replace(/^\.\//, '').split(/[?#]/, 1)[0];
      if (target === 'usage-statistics.html' || target === '/usage-statistics.html') {
        links.push(`${path.relative(root, file)}: ${anchor}`);
      }
    }
  }

  assert.deepEqual(links, []);
});
