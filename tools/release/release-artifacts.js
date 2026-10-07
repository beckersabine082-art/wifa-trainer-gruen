'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readRevision(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return value.revision || value.revisionId || value.packageRevision || value.meta?.revision || value.meta?.revisionId || null;
}

function verifyReleaseArtifacts({ root, manifestPath }) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const required = (manifest.artifactInputs || []).filter(item => item.executionSource === true);
  if (required.length === 0) throw new Error('Keine verbindlichen Releaseartefakte konfiguriert.');
  const errors = [];
  const groups = new Set();

  for (const artifact of required) {
    groups.add(artifact.packageGroup);
    const absolute = path.resolve(root, artifact.path);
    if (!fs.existsSync(absolute)) {
      errors.push(`Fehlendes Artefakt: ${artifact.name} (${artifact.path})`);
      continue;
    }
    const actualHash = sha256File(absolute);
    if (actualHash !== String(artifact.sha256 || '').toLowerCase()) {
      errors.push(`Hashabweichung: ${artifact.name} erwartet ${artifact.sha256}, ist ${actualHash}`);
      continue;
    }
    const actualRevision = readRevision(absolute);
    if (actualRevision !== artifact.revision) {
      errors.push(`Revisionsabweichung: ${artifact.name} erwartet ${artifact.revision}, ist ${actualRevision}`);
    }
    if (artifact.onReleaseBranch !== true) {
      errors.push(`Artefakt ist nicht als Releasebestand markiert: ${artifact.name}`);
    }
  }

  if (groups.size !== 4) errors.push(`Paketgruppen: erwartet 4, ist ${groups.size}`);
  if (errors.length) throw new Error(errors.join('\n'));
  return { ok: true, packageGroups: groups.size, files: required.length, errors: [] };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..', '..');
  const report = verifyReleaseArtifacts({ root, manifestPath: path.join(root, 'PRODUCTION_MIGRATION_MANIFEST.json') });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

module.exports = { readRevision, sha256File, verifyReleaseArtifacts };
