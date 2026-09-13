# Lernstand transfer implementation plan

Goal: Merge the requested learning-progress UI from the local podcast workspace into feature/aggregate-usage-statistics.
Source: User request in this task, 2026-09-13.
Constraints: Preserve uncommitted diagnostics and performance tests. No commits, pushes, resets, podcast/audio changes or formula replacement.

- [x] Compare source deltas and preserve current files in a temporary backup.
- [x] Transfer accordion/progress modules and their tests; transfer only Lernstand CSS and cache versions.
- [x] Merge renderSubject and accordion binding into current lernstand.js, preserving latest-attempt aggregation, labels, empty values and diagnostics. Exclude unused fan-out loader.
- [x] Port only unanswered-mode trainer dependencies needed by the topic button; retain existing analytics, grading, shuffle and clear-answer behavior.
- [x] Adapt existing assertions to separated card/panel output without weakening numerical expectations; run syntax, regression and real browser accordion/handoff tests.
- [x] Review full diff and report scope and remaining limitations. No integration actions.

## Verified transfer decisions

Relevant source files: js/lernstand.js, js/lernstand-accordion.mjs, js/lernstand-progress.mjs, css/style.css, index.html, js/trainer.js, tests/lernstand-browser.test.cjs, tests/lernstand-progress.test.mjs, tests/learning-progress-resume.test.js.

The target debug function and point aggregation were retained. Topic performance uses the existing latest selection, not the source renderer's all-attempt aggregation. Existing nine performance tests retain their numerical expectations; only DOM harness/selectors were adapted. Full-points retains the ever-perfect unique-question definition and supports the target maximalPunkte field plus the source's maximalePunkte field.

Only the source's current Lernstand CSS diff was applied. Unused loadTopicQuestionMap/renderUnansweredQuestions code and its retry/concurrency test were excluded because the requested render path has no questionsForTopic fan-out. The no-fan-out load test and browser test were transferred. Unrelated old analytics removals, trainer shuffle/history changes, error-analysis expansion, podcast and audio differences were excluded. Trainer unanswered dependencies were selectively adapted, with a separate button preserving Antwort leeren.

Validation: 47 tests passed, including the real Edge browser test with fixture data at the external Firebase/API boundary. Browser assertions cover exclusive synchronous accordion, L connector, equal row heights, responsive 3/2/1 topic columns, container resizing, compact button and repeated real trainer handoff including a zero-point answered question. Node syntax checks and git diff --check pass. Real account values were not verified by these tests. No commits, pushes or resets.
