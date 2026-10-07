const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { sha256File, verifyReleaseArtifacts } = require('../tools/release/release-artifacts');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'PRODUCTION_MIGRATION_MANIFEST.json');

test('all mandatory release packages exist on the branch and match their pinned SHA-256', () => {
  const report = verifyReleaseArtifacts({ root: ROOT, manifestPath: MANIFEST });
  assert.equal(report.ok, true);
  assert.equal(report.packageGroups, 4);
  assert.equal(report.files, 5);
  assert.deepEqual(report.errors, []);
});

test('release gate fails closed when a mandatory package is missing', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wifa-release-missing-'));
  const manifestPath = path.join(temp, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ artifactInputs: [{ name: 'missing', packageGroup: 'trainer', executionSource: true, path: 'package.json', sha256: '0'.repeat(64), revision: 'R1' }] }));
  assert.throws(() => verifyReleaseArtifacts({ root: temp, manifestPath }), /Fehlendes Artefakt/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('release gate fails closed when a mandatory package hash changes', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wifa-release-tamper-'));
  const packagePath = path.join(temp, 'package.json');
  const manifestPath = path.join(temp, 'manifest.json');
  fs.writeFileSync(packagePath, '{"revision":"R1"}\n');
  fs.writeFileSync(manifestPath, JSON.stringify({ artifactInputs: [{ name: 'tampered', packageGroup: 'trainer', executionSource: true, path: 'package.json', sha256: sha256File(packagePath), revision: 'R1' }] }));
  fs.appendFileSync(packagePath, 'tamper');
  assert.throws(() => verifyReleaseArtifacts({ root: temp, manifestPath }), /Hashabweichung/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('only versioned release paths may be marked as execution sources', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const executable = manifest.artifactInputs.filter(item => item.executionSource);
  assert.ok(executable.length > 0);
  for (const item of executable) {
    assert.match(item.path, /^release\/WIFA-GESAMT-PROD-20261007-RC1\/packages\//);
    assert.equal(item.onReleaseBranch, true);
    assert.equal(typeof item.revision, 'string');
    assert.ok(item.revision.length > 0);
  }
});
