const assert = require('assert');

const { alignTranscriptWordsToLerntext } = require('../tools/podcast-sync/align-words.js');

function test(name, fn) {
  try {
    fn();
    console.log('✓ ' + name);
  } catch (error) {
    console.log('✗ ' + name);
    console.log('  Error: ' + error.message);
    process.exitCode = 1;
  }
}

// A) EXAKTE WORTREIHENFOLGE

test('A: exakte Wortreihenfolge wird 1:1 aligned', function() {
  const lerntext = 'Rechtssubjekte und Rechtsobjekte sind wichtig.';
  const transcriptWords = [
    { wort: 'Rechtssubjekte', start: 0, end: 1 },
    { wort: 'und', start: 1, end: 1.5 },
    { wort: 'Rechtsobjekte', start: 1.5, end: 2.5 },
    { wort: 'sind', start: 2.5, end: 3 },
    { wort: 'wichtig', start: 3, end: 4 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);

  assert.strictEqual(result.wortZeitmarken.length, 5);
  assert.deepStrictEqual(result.wortZeitmarken[0], {
    wortIndex: 0,
    wort: 'Rechtssubjekte',
    start: 0,
    end: 1
  });
  assert.strictEqual(result.wortZeitmarken[result.wortZeitmarken.length - 1].wortIndex, 4);
});

// B) SATZZEICHEN

test('B: Satzzeichen sind keine Wörter und dürfen nicht aus dem Alignment fallen', function() {
  const lerntext = 'Rechtssubjekte. Rechtsobjekte, Sicherheiten!';
  const transcriptWords = [
    { wort: 'Rechtssubjekte', start: 0, end: 1 },
    { wort: 'Rechtsobjekte', start: 1.5, end: 2.5 },
    { wort: 'Sicherheiten', start: 2.8, end: 3.7 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wortIndex), [0, 1, 2]);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wort), ['Rechtssubjekte', 'Rechtsobjekte', 'Sicherheiten']);
});

// C) HTML / FORMATIERUNG

test('C: HTML-Tags und br erzeugen keine Word-Metadaten', function() {
  const lerntext = '<strong>Kernidee</strong><br>Rechtssubjekte und Rechtsobjekte';
  const transcriptWords = [
    { wort: 'Kernidee', start: 0, end: 1 },
    { wort: 'Rechtssubjekte', start: 1, end: 2 },
    { wort: 'und', start: 2, end: 2.5 },
    { wort: 'Rechtsobjekte', start: 2.5, end: 3.5 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wort), ['Kernidee', 'Rechtssubjekte', 'und', 'Rechtsobjekte']);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wortIndex), [0, 1, 2, 3]);
});

// D) CASE

test('D: Case-Unterschiede verhindern kein Alignment, aber Lerntextwort bleibt kanonisch', function() {
  const lerntext = 'Unternehmen Recht';
  const transcriptWords = [
    { wort: 'unternehmen', start: 0, end: 1 },
    { wort: 'recht', start: 1, end: 2 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wort), ['Unternehmen', 'Recht']);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wortIndex), [0, 1]);
});

// E) UMLAUTE / UNICODE

test('E: Unicode/Umlaute und NFC/NFD-Normalisierung werden korrekt behandelt', function() {
  const lerntext = 'Änderung Größe Bücher';
  const transcriptWords = [
    { wort: 'A\u0308nderung', start: 0, end: 1 },
    { wort: 'Gro\u0308ße', start: 1, end: 2 },
    { wort: 'Bu\u0308cher', start: 2, end: 3 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wort), ['Änderung', 'Größe', 'Bücher']);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wortIndex), [0, 1, 2]);
});

// F) BINDSTRICH / APOSTROPH

test('F: Bindestrich und Apostroph innerhalb von Wörtern bleiben Teil des Wortes', function() {
  const lerntext = "Manager's Kosten-Nutzen-Analyse";
  const transcriptWords = [
    { wort: "Manager's", start: 0, end: 1 },
    { wort: 'Kosten-Nutzen-Analyse', start: 1, end: 2 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wort), ["Manager's", 'Kosten-Nutzen-Analyse']);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => item.wortIndex), [0, 1]);
});

// G) ZEITEN

test('G: start/end werden exakt übernommen', function() {
  const lerntext = 'Rechtssubjekte und Rechtsobjekte';
  const transcriptWords = [
    { wort: 'Rechtssubjekte', start: 1.25, end: 2.5 },
    { wort: 'und', start: 2.5, end: 2.75 },
    { wort: 'Rechtsobjekte', start: 3.125, end: 4.875 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => ({ start: item.start, end: item.end })), [
    { start: 1.25, end: 2.5 },
    { start: 2.5, end: 2.75 },
    { start: 3.125, end: 4.875 }
  ]);
});

function assertInvalidTimestamp(whisperWord) {
  assert.throws(function() {
    alignTranscriptWordsToLerntext('Rechtssubjekte und Rechtsobjekte', [whisperWord]);
  }, function(error) {
    return !!error && /Transcript-Index\s*0/i.test(error.message)
      && /Rechtssubjekte/i.test(error.message)
      && /(start|end)/i.test(error.message)
      && /(ungültig|invalid)/i.test(error.message);
  });
}

// H) INVALID TIMESTAMPS

test('H1: NaN start wird als ungültige Zeitmarke verworfen', function() {
  assertInvalidTimestamp({ wort: 'Rechtssubjekte', start: Number.NaN, end: 1 });
});

test('H2: Infinity end wird als ungültige Zeitmarke verworfen', function() {
  assertInvalidTimestamp({ wort: 'Rechtssubjekte', start: 0, end: Infinity });
});

test('H3: String start wird als ungültige Zeitmarke verworfen', function() {
  assertInvalidTimestamp({ wort: 'Rechtssubjekte', start: '1.5', end: 2 });
});

test('H4: String end wird als ungültige Zeitmarke verworfen', function() {
  assertInvalidTimestamp({ wort: 'Rechtssubjekte', start: 1, end: '2' });
});

test('H5: end < start bleibt ein klarer Fehler', function() {
  assert.throws(function() {
    alignTranscriptWordsToLerntext('Rechtssubjekte und Rechtsobjekte', [{ wort: 'Rechtssubjekte', start: 2, end: 1 }]);
  }, /Transcript-Index\s*0|start\/end|end\s*<\s*start|inkonsistent/i);
});

test('H6: gültige Dezimalwerte werden exakt beibehalten', function() {
  const lerntext = 'Rechtssubjekte und Rechtsobjekte';
  const transcriptWords = [
    { wort: 'Rechtssubjekte', start: 1.234567, end: 2.345678 },
    { wort: 'und', start: 2.345678, end: 3.456789 },
    { wort: 'Rechtsobjekte', start: 3.456789, end: 4.567891 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.deepStrictEqual(result.wortZeitmarken.map(item => ({ start: item.start, end: item.end })), [
    { start: 1.234567, end: 2.345678 },
    { start: 2.345678, end: 3.456789 },
    { start: 3.456789, end: 4.567891 }
  ]);
});

// I) MONOTONIE

test('I: Wortindizes und Zeitwerte laufen monoton', function() {
  const lerntext = 'Rechtssubjekte und Rechtsobjekte';
  const transcriptWords = [
    { wort: 'Rechtssubjekte', start: 0, end: 1 },
    { wort: 'und', start: 1, end: 2 },
    { wort: 'Rechtsobjekte', start: 2, end: 3 }
  ];

  const result = alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  assert.ok(result.wortZeitmarken.every((entry, index, arr) => index === 0 || arr[index - 1].wortIndex < entry.wortIndex));
  assert.ok(result.wortZeitmarken.every((entry, index, arr) => index === 0 || arr[index - 1].end <= entry.start || arr[index - 1].end <= entry.end));
  assert.ok(result.wortZeitmarken.every(entry => entry.start <= entry.end));
});

// J) LEERE INPUTS

test('I: Leere Lerntexte und leere transcriptWords Arrays sind klare Fehler', function() {
  assert.throws(function() {
    alignTranscriptWordsToLerntext('', [{ wort: 'abc', start: 0, end: 1 }]);
  }, /lerntext|leer/i);

  assert.throws(function() {
    alignTranscriptWordsToLerntext('Rechtssubjekte und', []);
  }, /transcriptWords|leer/i);
});

// K) NICHT MATCHBARES WORT

test('K: Nicht matchbares Whisper-Wort blockiert Alignment mit Transcript-Index', function() {
  const lerntext = 'Rechtssubjekte und';
  const transcriptWords = [
    { wort: 'Rechtssubjekte', start: 0, end: 1 },
    { wort: 'definitely-unknown', start: 1, end: 2 }
  ];

  assert.throws(function() {
    alignTranscriptWordsToLerntext(lerntext, transcriptWords);
  }, /Transcript-Index|1|definitely-unknown/i);
});

console.log('Total tests: 16');
