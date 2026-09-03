const { tokenizeVisibleWords, decodeHtmlEntities } = require('./normalize-lerntext.js');

function comparisonKey(word) {
  return String(word || '')
    .normalize('NFC')
    .toLocaleLowerCase('de-DE')
    .replace(/-/g, '');
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

function validateWordTimestamp(transcriptIndex, rawWord, whisperWord) {
  const start = whisperWord.start;
  const end = whisperWord.end;

  if (
    typeof start !== 'number' ||
    !Number.isFinite(start) ||
    typeof end !== 'number' ||
    !Number.isFinite(end) ||
    end < start
  ) {
    throw new Error(
      'Ungültige Zeitmarke bei Transcript-Index ' +
        transcriptIndex +
        ' für "' +
        rawWord +
        '": start=' +
        start +
        ', end=' +
        end +
        ' ungültig'
    );
  }
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
  const deterministischeMatches = [];
  let lerntextIndex = 0;
  let lastStart = Number.NEGATIVE_INFINITY;
  let lastEnd = Number.NEGATIVE_INFINITY;

  for (let transcriptIndex = 0; transcriptIndex < transcriptWords.length; ) {
    const whisperWord = transcriptWords[transcriptIndex];

    if (!whisperWord || typeof whisperWord !== 'object') {
      throw new Error('Transcript-Index ' + transcriptIndex + ': Whisper-Wort ungültig');
    }

    const rawWord = String(whisperWord.wort ?? whisperWord.word ?? '');
    const tokenized = tokenizeForAlignment(rawWord);

    if (tokenized.length === 0) {
      transcriptIndex += 1;
      continue;
    }

    const directKey = comparisonKey(tokenized.join(''));
    let matchIndex = -1;
    let matchWord = null;
    let matchStart = whisperWord.start;
    let matchEnd = whisperWord.end;
    let lastConsumedIndex = transcriptIndex;
    let bridged = false;

    validateWordTimestamp(transcriptIndex, rawWord, whisperWord);

    if (lerntextIndex < kanonischeWorte.length && comparisonKey(kanonischeWorte[lerntextIndex]) === directKey) {
      matchIndex = lerntextIndex;
      matchWord = kanonischeWorte[matchIndex];
    } else {
      let mergedText = directKey;
      let visibleWordCount = tokenized.length;
      let mergedStart = whisperWord.start;
      let mergedEnd = whisperWord.end;

      for (let candidateIndex = transcriptIndex + 1; candidateIndex < transcriptWords.length && visibleWordCount < 3; candidateIndex++) {
        const candidateItem = transcriptWords[candidateIndex];
        if (!candidateItem || typeof candidateItem !== 'object') {
          throw new Error('Transcript-Index ' + candidateIndex + ': Whisper-Wort ungültig');
        }

        const candidateRawWord = String(candidateItem.wort ?? candidateItem.word ?? '');
        const candidateTokenized = tokenizeForAlignment(candidateRawWord);

        if (candidateTokenized.length === 0) {
          continue;
        }

        validateWordTimestamp(candidateIndex, candidateRawWord, candidateItem);
        mergedText += comparisonKey(candidateTokenized.join(''));
        visibleWordCount += candidateTokenized.length;
        lastConsumedIndex = candidateIndex;
        mergedEnd = candidateItem.end;

        if (lerntextIndex < kanonischeWorte.length && comparisonKey(kanonischeWorte[lerntextIndex]) === mergedText) {
          matchIndex = lerntextIndex;
          matchWord = kanonischeWorte[matchIndex];
          matchStart = mergedStart;
          matchEnd = mergedEnd;
          break;
        }
      }
    }

    if (matchIndex === -1 && tokenized.length === 1 && lerntextIndex >= 2 &&
        deterministischeMatches[lerntextIndex - 1] && deterministischeMatches[lerntextIndex - 2] &&
        lerntextIndex + 2 < kanonischeWorte.length) {
      const followingVisibleWords = [];

      for (let candidateIndex = transcriptIndex + 1; candidateIndex < transcriptWords.length && followingVisibleWords.length < 2; candidateIndex++) {
        const candidateItem = transcriptWords[candidateIndex];
        if (!candidateItem || typeof candidateItem !== 'object') {
          throw new Error('Transcript-Index ' + candidateIndex + ': Whisper-Wort ungültig');
        }

        const candidateRawWord = String(candidateItem.wort ?? candidateItem.word ?? '');
        const candidateTokenized = tokenizeForAlignment(candidateRawWord);
        if (candidateTokenized.length === 0) {
          continue;
        }

        followingVisibleWords.push({
          word: candidateItem,
          key: comparisonKey(candidateTokenized.join(''))
        });
      }

      if (followingVisibleWords.length === 2 &&
          followingVisibleWords[0].key === comparisonKey(kanonischeWorte[lerntextIndex + 1]) &&
          followingVisibleWords[1].key === comparisonKey(kanonischeWorte[lerntextIndex + 2])) {
        matchIndex = lerntextIndex;
        matchWord = kanonischeWorte[matchIndex];
        matchStart = whisperWord.start;
        matchEnd = whisperWord.end;
        lastConsumedIndex = transcriptIndex;
        bridged = true;
      }
    }

    if (matchIndex === -1) {
      throw new Error(
        'Transcript-Index ' + transcriptIndex + ': Whisper-Wort nicht deterministisch im Lerntext gefunden: ' + rawWord
      );
    }

    if (matchStart < lastStart) {
      throw new Error('Transcript-Index ' + transcriptIndex + ': start läuft rückwärts');
    }

    if (matchEnd < lastEnd) {
      throw new Error('Transcript-Index ' + transcriptIndex + ': end läuft rückwärts');
    }

    wortZeitmarken.push({
      wortIndex: matchIndex,
      wort: matchWord,
      start: matchStart,
      end: matchEnd
    });

    deterministischeMatches[matchIndex] = !bridged &&
      (comparisonKey(kanonischeWorte[lerntextIndex]) === directKey || lastConsumedIndex !== transcriptIndex);
    lastStart = Number(matchStart);
    lastEnd = Number(matchEnd);
    lerntextIndex += 1;
    transcriptIndex = lastConsumedIndex + 1;
  }

  return { wortZeitmarken };
}

module.exports = {
  alignTranscriptWordsToLerntext
};
