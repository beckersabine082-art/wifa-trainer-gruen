import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQuestionKey,
  countAttemptedQuestions,
  countFullPointQuestions,
  summarizeQuestionCatalog,
  summarizeTopicQuestions
} from '../js/lernstand-progress.mjs';

test('Frage ohne Attempt -> Noch nie beantwortet', () => {
  const questions = [
    { bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1', frage: 'Erste Frage' },
    { bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q2', frage: 'Zweite Frage' }
  ];

  const summaries = summarizeTopicQuestions(questions, [
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q2' }), frageId: 'Q2', fach: 'Recht', thema: 'Vertrag', bereich: 'WQ' }
  ]);

  assert.equal(summaries[0].attemptCount, 0);
  assert.equal(summaries[0].isUnanswered, true);
  assert.match(summaries[0].statusLabel, /Noch nie beantwortet/i);
  assert.equal(summaries[1].attemptCount, 1);
});

test('Frage mit genau einem 0-Punkte-Attempt ist beantwortet und nicht noch nie beantwortet', () => {
  const questions = [{ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q7', frage: 'Frage 7' }];
  const attempts = [{ questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q7' }), erreichtePunkte: 0, maximalePunkte: 10, status: 'falsch' }];

  const summaries = summarizeTopicQuestions(questions, attempts);

  assert.equal(summaries[0].attemptCount, 1);
  assert.equal(summaries[0].isUnanswered, false);
  assert.match(summaries[0].statusLabel, /1× beantwortet/i);
});

test('Frage mit 4 Attempts aus mehreren Sessions zählt als 4 beantwortet', () => {
  const question = { bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q27', frage: 'Frage 27' };
  const attempts = [
    { questionKey: buildQuestionKey({ ...question }), erreichtePunkte: 4, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ ...question }), erreichtePunkte: 2, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ ...question }), erreichtePunkte: 0, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ ...question }), erreichtePunkte: 10, maximalePunkte: 10 }
  ];

  const [summary] = summarizeTopicQuestions([question], attempts);

  assert.equal(summary.attemptCount, 4);
  assert.equal(summary.statusLabel, '4× beantwortet');
});

test('Frage wurde nur geöffnet, ohne echten Attempt, bleibt 0 Bearbeitungen', () => {
  const question = { bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q18', frage: 'Frage 18' };
  const attempts = [{ questionKey: 'wifa-trainer::WQ::Recht::Vertrag::Q17', frageId: 'Q17', fach: 'Recht', thema: 'Vertrag', bereich: 'WQ' }];

  const [summary] = summarizeTopicQuestions([question], attempts);

  assert.equal(summary.attemptCount, 0);
  assert.equal(summary.isUnanswered, true);
});

test('Thema mit 83 Fragen: 67 beantwortet => 67 von 83 und 16 noch nie beantwortet', () => {
  const questions = Array.from({ length: 83 }, (_, index) => ({
    bereich: 'WQ',
    fach: 'Recht',
    thema: 'Vertrag',
    frageId: `Q${index + 1}`,
    frage: `Frage ${index + 1}`
  }));

  const attempts = questions.slice(0, 67).map((question, index) => ({
    questionKey: buildQuestionKey(question),
    frageId: question.frageId,
    fach: question.fach,
    thema: question.thema,
    bereich: question.bereich,
    erreichtePunkte: index % 2 === 0 ? 1 : 0,
    maximalePunkte: 10
  }));

  const summary = summarizeQuestionCatalog({
    questions,
    attempts,
    fach: 'Recht',
    thema: 'Vertrag',
    bereich: 'WQ'
  });

  assert.equal(summary.totalQuestions, 83);
  assert.equal(summary.answeredQuestions, 67);
  assert.equal(summary.unansweredQuestions, 16);
  assert.equal(summary.header, '67 von 83 Fragen mindestens einmal beantwortet');
  assert.equal(summary.emptyText, '16 noch nie beantwortet');
});

test('Fehlerhafte beantwortete Frage bleibt in der Fehleranalyse und zählt als beantwortet', () => {
  const question = { bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q40', frage: 'Frage 40' };
  const attempts = [{
    questionKey: buildQuestionKey(question),
    frageId: 'Q40',
    fach: 'Recht',
    thema: 'Vertrag',
    bereich: 'WQ',
    erreichtePunkte: 0,
    maximalePunkte: 10,
    status: 'falsch'
  }];

  const summaries = summarizeTopicQuestions([question], attempts);

  assert.equal(summaries[0].attemptCount, 1);
  assert.equal(summaries[0].isUnanswered, false);
  assert.match(summaries[0].statusLabel, /1× beantwortet/i);
});

test('Keine offenen Fragen dokumentiert den Abschlussstatus', () => {
  const questions = [{ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1', frage: 'Frage 1' }];
  const attempts = [{ questionKey: buildQuestionKey({ ...questions[0] }), erreichtePunkte: 10, maximalePunkte: 10 }];

  const summary = summarizeQuestionCatalog({ questions, attempts, fach: 'Recht', thema: 'Vertrag', bereich: 'WQ' });

  assert.equal(summary.unansweredQuestions, 0);
  assert.equal(summary.openListText, 'Alle Fragen wurden mindestens einmal beantwortet.');
});

test('countAttemptedQuestions zählt alle gespeicherten Attempts unabhängig von Session', () => {
  const attempts = [
    { questionKey: 'wifa-trainer::WQ::Recht::Vertrag::Q12', frageId: 'Q12', fach: 'Recht', thema: 'Vertrag', bereich: 'WQ' },
    { questionKey: 'wifa-trainer::WQ::Recht::Vertrag::Q12', frageId: 'Q12', fach: 'Recht', thema: 'Vertrag', bereich: 'WQ', timestamp: { toMillis: () => 1000 } },
    { questionKey: 'wifa-trainer::WQ::Recht::Vertrag::Q12', frageId: 'Q12', fach: 'Recht', thema: 'Vertrag', bereich: 'WQ', timestamp: { toMillis: () => 2000 } },
    { questionKey: 'wifa-trainer::WQ::Recht::Vertrag::Q18', frageId: 'Q18', fach: 'Recht', thema: 'Vertrag', bereich: 'WQ' }
  ];

  const counts = countAttemptedQuestions(attempts);

  assert.equal(counts.get('wifa-trainer::WQ::Recht::Vertrag::Q12'), 3);
  assert.equal(counts.get('wifa-trainer::WQ::Recht::Vertrag::Q18'), 1);
});

test('volle Punktzahl: 20 von 83 Fragen mit mindestens einem perfekten Attempt → 24%', () => {
  const totalQuestions = 83;
  const attempts = [
    // Q1-Q20: perfekt
    ...Array.from({ length: 20 }, (_, i) => ({
      questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: `Q${i + 1}` }),
      erreichtePunkte: 10,
      maximalePunkte: 10
    })),
    // Q21-Q40: teilweise
    ...Array.from({ length: 20 }, (_, i) => ({
      questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: `Q${i + 21}` }),
      erreichtePunkte: 5,
      maximalePunkte: 10
    })),
    // Q41-Q60: falsch
    ...Array.from({ length: 20 }, (_, i) => ({
      questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: `Q${i + 41}` }),
      erreichtePunkte: 0,
      maximalePunkte: 10
    }))
  ];

  const result = countFullPointQuestions(attempts, totalQuestions);

  assert.equal(result.count, 20);
  assert.equal(result.percentage, 24);
});

test('volle Punktzahl: mehrere perfekte Attempts derselben Frage zählen nur einmal', () => {
  const attempts = [
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1' }), erreichtePunkte: 10, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1' }), erreichtePunkte: 10, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1' }), erreichtePunkte: 10, maximalePunkte: 10 }
  ];

  const result = countFullPointQuestions(attempts, 10);

  assert.equal(result.count, 1);
  assert.equal(result.percentage, 10);
});

test('volle Punktzahl: perfekt + später schlechter Attempt bleibt gezählt', () => {
  const attempts = [
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1' }), erreichtePunkte: 10, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1' }), erreichtePunkte: 5, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1' }), erreichtePunkte: 0, maximalePunkte: 10 }
  ];

  const result = countFullPointQuestions(attempts, 20);

  assert.equal(result.count, 1);
  assert.equal(result.percentage, 5);
});

test('volle Punktzahl: nur Fragen mit erreichtePunkte > 0 AND === maximalePunkte zählen', () => {
  const attempts = [
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q1' }), erreichtePunkte: 10, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q2' }), erreichtePunkte: 0, maximalePunkte: 10 },
    { questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: 'Q3' }), erreichtePunkte: 10, maximalePunkte: 20 }
  ];

  const result = countFullPointQuestions(attempts, 10);

  assert.equal(result.count, 1);
  assert.equal(result.percentage, 10);
});

test('volle Punktzahl: leere Attempts-Liste ergibt 0%', () => {
  const result = countFullPointQuestions([], 50);

  assert.equal(result.count, 0);
  assert.equal(result.percentage, 0);
});

test('summarizeQuestionCatalog enthält fullPointPercentage', () => {
  const questions = Array.from({ length: 100 }, (_, i) => ({
    bereich: 'WQ',
    fach: 'Recht',
    thema: 'Vertrag',
    frageId: `Q${i + 1}`,
    frage: `Frage ${i + 1}`
  }));

  const attempts = [
    ...Array.from({ length: 30 }, (_, i) => ({
      questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: `Q${i + 1}` }),
      erreichtePunkte: 10,
      maximalePunkte: 10
    })),
    ...Array.from({ length: 50 }, (_, i) => ({
      questionKey: buildQuestionKey({ bereich: 'WQ', fach: 'Recht', thema: 'Vertrag', frageId: `Q${i + 31}` }),
      erreichtePunkte: 5,
      maximalePunkte: 10
    }))
  ];

  const summary = summarizeQuestionCatalog({ questions, attempts, fach: 'Recht', thema: 'Vertrag', bereich: 'WQ' });

  assert.equal(summary.fullPointCount, 30);
  assert.equal(summary.fullPointPercentage, 30);
});

test('volle Punktzahl akzeptiert das aktuelle Firestore-Feld maximalPunkte', () => {
  assert.deepEqual(countFullPointQuestions([{questionKey:'q',erreichtePunkte:3,maximalPunkte:3}], 2), {count:1,percentage:50});
});
