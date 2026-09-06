const { getEncoding } = require('js-tiktoken');
const { sha256Lerntext } = require('./hash-paths.js');

let o200kEncoding;

function getTtsEncoding() {
  if (!o200kEncoding) {
    o200kEncoding = getEncoding('o200k_base');
  }
  return o200kEncoding;
}

function countTtsTokens(text) {
  return getTtsEncoding().encode(String(text || '')).length;
}

function auditPilotEntry({ lerntexte, fach, titel }) {
  const matches = (Array.isArray(lerntexte) ? lerntexte : []).filter(function(entry) {
    return String(entry && entry.fach || '').trim() === String(fach || '').trim() &&
      String(entry && entry.titel || '').trim() === String(titel || '').trim();
  });

  if (matches.length !== 1) {
    throw new Error('Pilot-Einheit muss exakt einmal gefunden werden');
  }

  const entry = matches[0];
  const lerntext = String(entry.lerntext || '');
  if (!lerntext.trim()) {
    throw new Error('Pilot-Einheit hat keinen lerntext');
  }

  const ttsTokenCount = countTtsTokens(lerntext);

  return {
    fach: String(fach || '').trim(),
    titel: String(titel || '').trim(),
    foundCount: matches.length,
    lerntextLength: lerntext.length,
    ttsTokenCount,
    lerntextHash: sha256Lerntext(lerntext),
    canGenerateWithoutChunking: ttsTokenCount <= 2000,
    sourceUsed: 'lerntext'
  };
}

module.exports = {
  auditPilotEntry,
  countTtsTokens,
  sha256Lerntext
};