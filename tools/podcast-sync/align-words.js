const { tokenizeVisibleWords, decodeHtmlEntities } = require('./normalize-lerntext.js');

function normalizeComparableWord(word) {
  return String(word || '')
    .normalize('NFC')
    .toLocaleLowerCase('de-DE');
}

function prepareTextForTokenize(text) {
  let cleaned = String(text || '');

  cleaned = cleaned.replace(/<br\s*\/?>/gi, ' ');
  cleaned = cleaned.replace(/<\/?(p|div|li|h[1-6]|article|section|blockquote)>/gi, ' ');
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  cleaned = decodeHtmlEntities(cleaned);
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/[\t\u00A0]+/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

function tokenizeForAlignment(text) {
  const prepared = prepareTextForTokenize(text);
  return tokenizeVisibleWords(prepared.normalize('NFC'));
}

function alignTranscriptWordsToLerntext(lerntext, transcriptWords) {
  if (typeof lerntext !== 'string' || lerntext.trim() === '') {
    throw new Error('lerntext leer');
  }

  if (!Array.isArray(transcriptWords) || transcriptWords.length === 0) {
    throw new Error('transcriptWords leer');
  }

  const kanonischeWorte = tokenizeForAlignment(lerntext);
  if (kanonischeWorte.length === 0) {
    throw new Error('lerntext enthält keine sichtbaren Wörter');
  }

  const wortZeitmarken = [];
  let lerntextIndex = 0;
  let lastStart = Number.NEGATIVE_INFINITY;
  let lastEnd = Number.NEGATIVE_INFINITY;

  for (let transcriptIndex = 0; transcriptIndex < transcriptWords.length; transcriptIndex++) {
    const whisperWord = transcriptWords[transcriptIndex];

    if (!whisperWord || typeof whisperWord !== 'object') {
      throw new Error('Transcript-Index ' + transcriptIndex + ': Whisper-Wort ungültig');
    }

    const rawWord = String(whisperWord.wort ?? whisperWord.word ?? '');
    const tokenized = tokenizeForAlignment(rawWord);

    if (tokenized.length === 0) {
      throw new Error(
        'Transcript-Index ' + transcriptIndex + ': Whisper-Wort nicht tokenisierbar: ' + JSON.stringify(rawWord)
      );
    }

    let matchIndex = -1;
    const targetKey = normalizeComparableWord(tokenized[0]);

    for (; lerntextIndex < kanonischeWorte.length; lerntextIndex++) {
      if (normalizeComparableWord(kanonischeWorte[lerntextIndex]) === targetKey) {
        matchIndex = lerntextIndex;
        break;
      }
    }

    if (matchIndex === -1) {
      throw new Error(
        'Transcript-Index ' + transcriptIndex + ': Whisper-Wort nicht deterministisch im Lerntext gefunden: ' + rawWord
      );
    }

    const start = whisperWord.start;
    const end = whisperWord.end;

    if (
      typeof start !== 'undefined' &&
      typeof end !== 'undefined' &&
      Number(start) > Number(end)
    ) {
      throw new Error('Transcript-Index ' + transcriptIndex + ': start/end inkonsistent');
    }

    if (Number.isFinite(start) && start < lastStart) {
      throw new Error('Transcript-Index ' + transcriptIndex + ': start läuft rückwärts');
    }

    if (Number.isFinite(end) && Number.isFinite(lastEnd) && end < lastEnd) {
      throw new Error('Transcript-Index ' + transcriptIndex + ': end läuft rückwärts');
    }

    const matchWord = kanonischeWorte[matchIndex];
    wortZeitmarken.push({
      wortIndex: matchIndex,
      wort: matchWord,
      start: start,
      end: end
    });

    lastStart = Number.isFinite(start) ? Number(start) : lastStart;
    lastEnd = Number.isFinite(end) ? Number(end) : lastEnd;
    lerntextIndex += 1;
  }

  return { wortZeitmarken };
}

module.exports = {
  alignTranscriptWordsToLerntext
};
