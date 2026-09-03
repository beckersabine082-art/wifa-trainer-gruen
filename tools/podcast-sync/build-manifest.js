const fs = require('fs');
const path = require('path');

const { tokenizeVisibleWords } = require('./normalize-lerntext.js');
const { sha256Lerntext, podcastPaths } = require('./hash-paths.js');

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(fieldName + ' darf nicht leer sein');
  }
}

function validateUpdatedAt(updatedAt) {
  requireNonEmptyString(updatedAt, 'updatedAt');
  if (!Number.isFinite(Date.parse(updatedAt))) {
    throw new Error('updatedAt muss ein gültiges ISO-Datum sein');
  }
}

function validateManifestShape(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest ungültig');
  }
  requireNonEmptyString(manifest.fach, 'fach');
  requireNonEmptyString(manifest.titel, 'titel');
  requireNonEmptyString(manifest.lerntextHash, 'lerntextHash');
  requireNonEmptyString(manifest.mp3Path, 'mp3Path');
  requireNonEmptyString(manifest.jsonPath, 'jsonPath');
  validateUpdatedAt(manifest.updatedAt);
  if (!Array.isArray(manifest.wortZeitmarken)) {
    throw new Error('wortZeitmarken muss ein Array sein');
  }
  manifest.wortZeitmarken.forEach(function(mark, index) {
    if (!mark || typeof mark !== 'object') {
      throw new Error('wortZeitmarke ' + index + ' ungültig');
    }
    if (!Number.isInteger(mark.wortIndex) || mark.wortIndex !== index) {
      throw new Error('wortIndex bei Marke ' + index + ' ungültig');
    }
    requireNonEmptyString(mark.wort, 'wort bei Marke ' + index);
    if (typeof mark.start !== 'number' || !Number.isFinite(mark.start) ||
        typeof mark.end !== 'number' || !Number.isFinite(mark.end) ||
        mark.end < mark.start) {
      throw new Error('Zeitmarke bei Marke ' + index + ' ungültig');
    }
    if (index > 0 && (mark.start < manifest.wortZeitmarken[index - 1].start ||
        mark.end < manifest.wortZeitmarken[index - 1].end)) {
      throw new Error('Zeitverlauf bei Marke ' + index + ' läuft rückwärts');
    }
  });
}

function buildPodcastManifest({ fach, titel, lerntext, lerntextHash, wortZeitmarken, updatedAt }) {
  requireNonEmptyString(fach, 'fach');
  requireNonEmptyString(titel, 'titel');
  if (typeof lerntext !== 'string' || lerntext.trim() === '') {
    throw new Error('lerntext darf nicht leer sein');
  }
  requireNonEmptyString(lerntextHash, 'lerntextHash');
  if (lerntextHash !== sha256Lerntext(lerntext)) {
    throw new Error('lerntextHash stimmt nicht mit dem RAW lerntext überein');
  }
  validateUpdatedAt(updatedAt);

  const canonicalWords = tokenizeVisibleWords(lerntext);
  if (!Array.isArray(wortZeitmarken) || wortZeitmarken.length !== canonicalWords.length) {
    throw new Error('wortZeitmarken-Coverage stimmt nicht mit dem Lerntext überein');
  }

  const copiedMarks = wortZeitmarken.map(function(mark, index) {
    if (!mark || typeof mark !== 'object') {
      throw new Error('wortZeitmarke ' + index + ' ungültig');
    }
    if (!Number.isInteger(mark.wortIndex) || mark.wortIndex !== index) {
      throw new Error('wortIndex bei Marke ' + index + ' ungültig');
    }
    if (mark.wort !== canonicalWords[index]) {
      throw new Error('Kanonisches Wort bei Marke ' + index + ' stimmt nicht überein');
    }
    if (typeof mark.start !== 'number' || !Number.isFinite(mark.start) ||
        typeof mark.end !== 'number' || !Number.isFinite(mark.end) ||
        mark.end < mark.start) {
      throw new Error('Zeitmarke bei Marke ' + index + ' ungültig');
    }
    if (index > 0 && (mark.start < wortZeitmarken[index - 1].start ||
        mark.end < wortZeitmarken[index - 1].end)) {
      throw new Error('Zeitverlauf bei Marke ' + index + ' läuft rückwärts');
    }
    return {
      wortIndex: mark.wortIndex,
      wort: mark.wort,
      start: mark.start,
      end: mark.end
    };
  });

  const paths = podcastPaths(fach, titel);
  return {
    fach,
    titel,
    lerntextHash,
    mp3Path: paths.mp3Path,
    jsonPath: paths.jsonPath,
    wortZeitmarken: copiedMarks,
    updatedAt
  };
}

function writePodcastManifest({ outputPath, manifest }) {
  requireNonEmptyString(outputPath, 'outputPath');
  validateManifestShape(manifest);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
  return outputPath;
}

module.exports = { buildPodcastManifest, writePodcastManifest };