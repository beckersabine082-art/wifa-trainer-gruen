const test = require('node:test');
const assert = require('node:assert/strict');

const {
  lerntexteSichtbareNummerierung,
  lerntexteSichtbarerTitel
} = require('../js/lerntexte.js');

test('sichtbare Lerntextnummern folgen der finalen Reihenfolge innerhalb jedes Kapitels', () => {
  const entries = [
    { id: 'LZ-RE-01', hauptkapitelNr: '1', hauptkapitel: 'BGB Allgemeiner Teil', titel: 'Historisch eins', unterkapitelNr: '1.4', reihenfolgeFach: 2, reihenfolgeKapitel: 2 },
    { id: 'LZ-RE-51', hauptkapitelNr: '1', hauptkapitel: 'BGB Allgemeiner Teil', titel: 'Anspruchsprüfung und Gutachtenstil', unterkapitelNr: '1.4', reihenfolgeFach: 1, reihenfolgeKapitel: 5 },
    { id: 'LZ-RE-05', hauptkapitelNr: '2', hauptkapitel: 'BGB Schuldrecht', titel: 'Schuldverhältnisse', unterkapitelNr: '2.5', reihenfolgeFach: 3, reihenfolgeKapitel: 1 }
  ];

  const numbered = lerntexteSichtbareNummerierung(entries);

  assert.deepEqual(numbered.map(entry => entry.id), ['LZ-RE-51', 'LZ-RE-01', 'LZ-RE-05']);
  assert.deepEqual(numbered.map(entry => entry.sichtbareLerntextNr), ['1.1', '1.2', '2.1']);
  assert.equal(lerntexteSichtbarerTitel(numbered[0]), '1.1 Anspruchsprüfung und Gutachtenstil');
  assert.equal(entries[1].unterkapitelNr, '1.4', 'historische Quelldaten bleiben unverändert');
});

test('Kapitelnummerierung bleibt pro Fach und Kapitel lückenlos und eindeutig', () => {
  const entries = [
    { id: 'A-2', fach: 'A', chapterKey: 'kapitel-a-1', hauptkapitelNr: '1', hauptkapitel: 'Eins', titel: 'Zwei', reihenfolgeFach: 2 },
    { id: 'A-1', fach: 'A', chapterKey: 'kapitel-a-1', hauptkapitelNr: '1', hauptkapitel: 'Eins', titel: 'Eins', reihenfolgeFach: 1 },
    { id: 'A-3', fach: 'A', chapterKey: 'kapitel-a-2', hauptkapitelNr: '2', hauptkapitel: 'Zwei', titel: 'Drei', reihenfolgeFach: 3 },
    { id: 'B-1', fach: 'B', chapterKey: 'kapitel-b-1', hauptkapitelNr: '1', hauptkapitel: 'Eins', titel: 'Vier', reihenfolgeFach: 1 }
  ];

  const numbered = lerntexteSichtbareNummerierung(entries);

  assert.deepEqual(numbered.map(entry => entry.sichtbareLerntextNr), ['1.1', '1.2', '2.1', '1.1']);
  assert.equal(new Set(numbered.map(entry => entry.fach + ':' + entry.sichtbareLerntextNr)).size, 4);
});
