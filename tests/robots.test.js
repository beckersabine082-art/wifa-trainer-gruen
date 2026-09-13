const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
// These sources are inserted into existing pages by the privacy sync scripts.
const privacyFragments = [
  'docs/analytics-privacy.html',
  'docs/usage-privacy.html',
];
const fragmentPaths = new Set(privacyFragments.map(file => path.join(root, file)));

// Scan all directories; exclude only local tooling and the two known fragments.
function htmlFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (['.git', 'node_modules'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    if (fragmentPaths.has(file)) return [];
    return entry.isDirectory() ? htmlFiles(file) : /\.html$/i.test(entry.name) ? [file] : [];
  });
}

const files = htmlFiles(root);
for (const script of ['tools/analytics/sync-privacy.cjs', 'tools/usage-sync-privacy.cjs']) {
  test(`${script} preserves a single page head and robots tag`, () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wifa-privacy-sync-'));
    try {
      fs.mkdirSync(path.join(temporaryRoot, 'docs'));
      for (const file of [...privacyFragments, 'index.html', 'datenschutz.html']) {
        fs.copyFileSync(path.join(root, file), path.join(temporaryRoot, file));
      }
      // Run twice to also catch accumulation on repeated synchronization.
      for (let run = 0; run < 2; run++) {
        execFileSync(process.execPath, [path.join(root, script)], {cwd: temporaryRoot});
        for (const file of ['index.html', 'datenschutz.html']) {
          const html = fs.readFileSync(path.join(temporaryRoot, file), 'utf8');
          assert.equal((html.match(/<head\b[^>]*>/gi) || []).length, 1, `${file}: one opening head`);
          assert.equal((html.match(/<\/head\s*>/gi) || []).length, 1, `${file}: one closing head`);
          const robots = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi) || [];
          assert.deepEqual(robots, ['<meta name="robots" content="noindex,nofollow">']);
          const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
          assert.ok(head?.[1].includes(robots[0]), `${file}: robots stays inside head`);
        }
      }
    } finally {
      assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(os.tmpdir()));
      fs.rmSync(temporaryRoot, {recursive: true, force: true});
    }
  });
}

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
