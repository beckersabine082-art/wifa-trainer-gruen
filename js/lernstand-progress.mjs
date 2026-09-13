export function buildQuestionKey({ bereich, fach, thema, frageId }) {
  return ['wifa-trainer', String(bereich || '').trim(), String(fach || '').trim(), String(thema || '').trim(), String(frageId || '').trim()].join('::');
}

export function countAttemptedQuestions(attempts) {
  const counts = new Map();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    if (!attempt || !attempt.questionKey) continue;
    const key = String(attempt.questionKey).trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

export function summarizeTopicQuestions(questions, attempts) {
  const questionCounts = countAttemptedQuestions(attempts);

  return (Array.isArray(questions) ? questions : []).map((question) => {
    const frageId = String(question?.frageId || question?.id || '').trim();
    const key = buildQuestionKey({
      bereich: String(question?.bereich || '').trim(),
      fach: String(question?.fach || '').trim(),
      thema: String(question?.thema || '').trim(),
      frageId
    });
    const attemptCount = questionCounts.get(key) || 0;
    const isUnanswered = attemptCount === 0;
    const statusLabel = isUnanswered ? 'Noch nie beantwortet' : `${attemptCount}× beantwortet`;

    return {
      ...question,
      frageId,
      questionKey: key,
      attemptCount,
      isUnanswered,
      statusLabel
    };
  });
}

export function countFullPointQuestions(attempts, totalQuestions) {
  const fullPointKeys = new Set();

  for (const attempt of Array.isArray(attempts) ? attempts : []) {
    if (!attempt || !attempt.questionKey) continue;
    const key = String(attempt.questionKey).trim();
    if (!key) continue;
    const erreicht = Number(attempt.erreichtePunkte || 0);
    const maximal = Number(attempt.maximalPunkte ?? attempt.maximalePunkte ?? 0);
    if (erreicht > 0 && erreicht === maximal) {
      fullPointKeys.add(key);
    }
  }

  const count = fullPointKeys.size;
  const percentage = totalQuestions > 0 ? Math.round((count / totalQuestions) * 100) : 0;
  return { count, percentage };
}

export function summarizeQuestionCatalog({ questions, attempts, fach, thema, bereich }) {
  const topicQuestions = summarizeTopicQuestions(questions, attempts);
  const answeredQuestions = topicQuestions.filter((question) => !question.isUnanswered).length;
  const unansweredQuestions = topicQuestions.length - answeredQuestions;
  const fullPointStats = countFullPointQuestions(attempts, topicQuestions.length);

  return {
    totalQuestions: topicQuestions.length,
    answeredQuestions,
    unansweredQuestions,
    fullPointCount: fullPointStats.count,
    fullPointPercentage: fullPointStats.percentage,
    header: `${answeredQuestions} von ${topicQuestions.length} Fragen mindestens einmal beantwortet`,
    emptyText: `${unansweredQuestions} noch nie beantwortet`,
    openListText: unansweredQuestions === 0 ? 'Alle Fragen wurden mindestens einmal beantwortet.' : `${unansweredQuestions} noch nie beantwortet`,
    questions: topicQuestions
  };
}
