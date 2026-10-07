'use strict';

const { validatePromotionManifest } = require('./podcast-promotion');

const PROTECTED_SHEETS = Object.freeze(['NutzerFortschritt', 'PodcastFortschritt', 'Nutzerkonten', 'Analytics']);

function classifyExpectedWrite({ actual, expectedOld, finalValue }) {
  if (actual === expectedOld) return 'PATCH';
  if (actual === finalValue) return 'SKIP_FINAL';
  return 'CONFLICT';
}

function buildDryRunSummary({ manifest, trainerPackage, quizPackage, flashcardPackage,
  learningTextPackage, podcastPromotion, liveEvidence }) {
  if (!liveEvidence || liveEvidence.unknownConflicts !== 0) {
    throw new Error(`Dry-Run enthält unbekannte Konflikte: ${liveEvidence?.unknownConflicts ?? 'unbekannt'}.`);
  }
  if (liveEvidence.trainerMetadataMatches !== true) {
    throw new Error('Produktive Trainer-Metadaten stimmen nicht mit dem freigegebenen Soll überein.');
  }
  const trainerRecords = trainerPackage.records || [];
  const quizChanges = quizPackage.changes || [];
  const quizCreates = quizChanges.filter(item => String(item.action).toLowerCase() === 'create');
  const quizUpdates = quizChanges.filter(item => String(item.action).toLowerCase() === 'update');
  const flashcardChanges = flashcardPackage.changes || [];
  const textChanges = (learningTextPackage.records || []).filter(item => Array.isArray(item.writes) && item.writes.length);
  const podcast = validatePromotionManifest(podcastPromotion);
  const counts = {
    trainerContentIds: trainerRecords.length,
    trainerContentCells: trainerRecords.reduce((sum, item) => sum + (item.writeColumns || []).length, 0),
    trainerMetadataWrites: 0,
    quizCreateRows: quizCreates.length,
    quizCreateCells: quizCreates.reduce((sum, item) => sum + Object.keys(item.writeFields || {}).length, 0),
    quizUpdateRows: quizUpdates.length,
    quizUpdateCells: quizUpdates.reduce((sum, item) => sum + Object.keys(item.writeFields || {}).length, 0),
    flashcardOverlayRows: flashcardChanges.length,
    learningTextRows: textChanges.length,
    learningTextCells: textChanges.reduce((sum, item) => sum + item.writes.length, 0),
    podcastObjects: podcast.objects,
    unknownConflicts: liveEvidence.unknownConflicts,
    userDataWrites: 0
  };
  const expected = manifest.operations;
  const assertions = [
    [counts.trainerContentCells, expected.trainerContent.changedCells, 'Trainerzellen'],
    [counts.quizCreateRows, expected.quiz.createRows, 'Quiz-Neuanlagen'],
    [counts.quizUpdateRows, expected.quiz.updateRows, 'Quiz-Updates'],
    [counts.quizUpdateCells, expected.quiz.updateCells, 'Quiz-Updatezellen'],
    [counts.learningTextCells, expected.learningTexts.physicalWriteCells, 'Lerntextzellen'],
    [counts.podcastObjects, expected.podcast.sourceObjects, 'Podcastobjekte']
  ];
  for (const [actual, wanted, label] of assertions) {
    if (actual !== wanted) throw new Error(`${label}: Manifest ${wanted}, Paket ${actual}.`);
  }
  if (counts.quizCreateCells !== 742 || counts.flashcardOverlayRows !== 38 || counts.learningTextRows !== 260) {
    throw new Error('Paketbilanz weicht von der freigegebenen Releasebilanz ab.');
  }
  return {
    schemaVersion: 1,
    releaseId: manifest.releaseId,
    mode: 'READ_ONLY_PATCH_PLAN',
    generatedFromVersionedArtifacts: true,
    counts,
    protectedSheets: [...PROTECTED_SHEETS],
    trainerMetadata: { mode: 'SKIP_IDENTICAL', existingRowsPreserved: true },
    writes: {
      trainerContent: trainerRecords.map(item => ({ id: item.id, sheet: item.sourceSheet, columns: item.writeColumns })),
      quizCreates: quizCreates.map(item => ({ id: item.id, quizKey: item.quizKey, fields: Object.keys(item.writeFields || {}) })),
      quizUpdates: quizUpdates.map(item => ({ id: item.id, quizKey: item.quizKey, fields: Object.keys(item.writeFields || {}) })),
      flashcardOverlay: flashcardChanges.map(item => ({ id: item.id, kind: item.kind, fields: Object.keys(item.fieldsToWrite || {}) })),
      learningTexts: textChanges.map(item => ({ id: item.id, fields: item.writes.map(write => write.field) })),
      podcast: podcastPromotion.objects.map(item => ({ sourcePath: item.sourcePath, targetPath: item.targetPath, sourceGeneration: item.sourceGeneration }))
    }
  };
}

module.exports = { PROTECTED_SHEETS, buildDryRunSummary, classifyExpectedWrite };
