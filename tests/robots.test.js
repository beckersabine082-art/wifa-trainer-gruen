const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

// Include root, docs, tests and future subdirectories; skip local tooling only.
function htmlFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (['.git', 'node_modules'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : /\.html$/i.test(entry.name) ? [file] : [];
  });
}

const files = htmlFiles(root);
test('the repository contains HTML pages to check', () => {
  assert.ok(files.length > 0);
});

for (const file of files) {
  test(`${path.relative(root, file)} excludes indexing and link following`, () => {
    // Comments and raw-text elements must not satisfy the protection check.
    const html = fs.readFileSync(file, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|title|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
    assert.ok(head, 'An explicit head element is required');
    const robots = [];
    for (const tag of head[1].match(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) || []) {
      const attrs = {};
      for (const match of tag.matchAll(/([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
        attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
      }
      if (attrs.name?.toLowerCase() === 'robots') robots.push(attrs);
    }
    assert.equal(robots.length, 1, 'Exactly one robots meta tag must exist in head');
    assert.equal(robots[0].content, 'noindex,nofollow');
  });
}
