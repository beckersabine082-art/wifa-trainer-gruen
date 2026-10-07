(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WifaPodcastStagingDiagnosticCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const SUBJECTS = Object.freeze([
    'VWL', 'BWL', 'Rechnungswesen', 'Recht', 'Steuern', 'Unternehmensführung',
    'Betriebliches Management', 'Investition und Finanzierung',
    'Betriebliches Rechnungswesen und Controlling', 'Logistik', 'Marketing', 'Vertrieb',
    'Führung und Zusammenarbeit'
  ]);

  function emptyReport(total) {
    return {
      pass: false,
      currentUser: false,
      idToken: false,
      sidecars: 0,
      bundles: 0,
      loadedmetadata: 0,
      durations: 0,
      chapterGroups: 0,
      total,
      results: [],
      structureEvidence: {},
      recht: null,
      failure: null,
      errors: []
    };
  }

  function finalize(report) {
    if (!report.currentUser || !report.idToken) {
      report.pass = false;
      report.summary = 'AUTH FAIL';
      report.failure = 'AUTH FAIL';
      return report;
    }
    report.pass = report.currentUser && report.idToken && report.errors.length === 0 &&
      report.sidecars === report.total && report.bundles === report.total &&
      report.loadedmetadata === report.total && report.durations === report.total;
    report.summary = `${report.sidecars}/${report.total} Sidecars | ${report.bundles}/${report.total} Bundles | ` +
      `${report.loadedmetadata}/${report.total} loadedmetadata | ${report.durations}/${report.total} duration > 0 | ` +
      `${report.pass ? 'PASS' : 'FAIL'}`;
    return report;
  }

  function recordFailure(report, row, subject, stage, error) {
    row.result = 'FAIL';
    row.failedStage = stage;
    report.errors.push(`${subject}: ${error.message}`);
    if (!report.failure) report.failure = `FAIL – ${subject} – ${stage}`;
  }

  function compareStructure(manifest, subject, numberEntries, orderManifest) {
    if (!manifest || manifest.schemaVersion !== 2 || manifest.fach !== subject ||
        !Array.isArray(manifest.chapters) || manifest.chapters.length === 0 ||
        !Array.isArray(manifest.chapterGroups) || manifest.chapterGroups.length === 0) {
      throw new Error('Kapitel-/Lerntextstruktur fehlt oder gehört zum falschen Fach.');
    }
    const ids = new Set();
    let nextIndex = 0;
    let previousEnd = 0;
    for (const group of manifest.chapterGroups) {
      if (!group || typeof group.chapterKey !== 'string' || !group.chapterKey ||
          typeof group.chapterNumber !== 'string' || !group.chapterNumber ||
          group.startIndex !== nextIndex || !Number.isInteger(group.endIndex) ||
          group.endIndex < group.startIndex || group.endIndex >= manifest.chapters.length ||
          !Array.isArray(group.lerntextIds)) {
        throw new Error('Kapitelgruppe ist inkonsistent.');
      }
      const grouped = manifest.chapters.slice(group.startIndex, group.endIndex + 1);
      if (grouped.length !== group.lerntextIds.length) throw new Error('Kapitelgruppe enthält nicht alle Lerntexte.');
      for (let position = 0; position < grouped.length; position += 1) {
        const chapter = grouped[position];
        if (!chapter || chapter.index !== group.startIndex + position ||
            chapter.chapterKey !== group.chapterKey || chapter.hauptkapitelNr !== group.chapterNumber ||
            typeof chapter.lerntextId !== 'string' || !chapter.lerntextId || ids.has(chapter.lerntextId) ||
            group.lerntextIds[position] !== chapter.lerntextId ||
            typeof chapter.titel !== 'string' || !chapter.titel.trim() ||
            !Number.isFinite(chapter.start) || !Number.isFinite(chapter.end) ||
            chapter.start !== previousEnd || chapter.end <= chapter.start) {
          throw new Error('Lerntextfolge oder sichtbare Nummerierung ist inkonsistent.');
        }
        ids.add(chapter.lerntextId);
        previousEnd = chapter.end;
      }
      nextIndex = group.endIndex + 1;
    }
    if (nextIndex !== manifest.chapters.length) throw new Error('Kapitelgruppen decken die Lerntexte nicht vollständig ab.');

    if (typeof numberEntries !== 'function') throw new Error('Kanonische Player-Nummerierung fehlt.');
    const numbered = numberEntries(manifest.chapters);
    if (!Array.isArray(numbered) || numbered.length !== manifest.chapters.length) {
      throw new Error('Kanonische Player-Nummerierung lieferte keine vollständige Folge.');
    }
    const orderSubject = Array.isArray(orderManifest?.subjects)
      ? orderManifest.subjects.find(item => item && item.fach === subject) : null;
    if (!orderSubject || !Array.isArray(orderSubject.chapters)) {
      throw new Error('Fach fehlt im finalen Lerntext-Reihenfolgemanifest.');
    }
    const expected = [];
    for (const chapter of orderSubject.chapters) {
      if (!chapter || typeof chapter.chapterNumber !== 'string' || !Array.isArray(chapter.entries)) {
        throw new Error('Finales Lerntext-Reihenfolgemanifest ist unvollständig.');
      }
      for (const entry of chapter.entries) {
        if (!entry || typeof entry.id !== 'string' || !Number.isInteger(entry.ordinalInChapter)) {
          throw new Error('Finale Lerntextposition ist ungültig.');
        }
        expected.push({ id: entry.id, visibleNumber: `${chapter.chapterNumber}.${entry.ordinalInChapter}` });
      }
    }
    const sidecarIds = manifest.chapters.map(item => item.lerntextId);
    const calculatedIds = numbered.map(item => item && item.lerntextId);
    const manifestIds = expected.map(item => item.id);
    const calculatedVisibleNumbers = numbered.map(item => String(item && item.sichtbareLerntextNr || ''));
    const expectedVisibleNumbers = expected.map(item => item.visibleNumber);
    let firstMismatch = null;
    const length = Math.max(sidecarIds.length, calculatedIds.length, manifestIds.length);
    for (let index = 0; index < length; index += 1) {
      if (sidecarIds[index] !== manifestIds[index] || calculatedIds[index] !== manifestIds[index] ||
          calculatedVisibleNumbers[index] !== expectedVisibleNumbers[index]) {
        firstMismatch = {
          position: index + 1,
          sidecarId: sidecarIds[index] || null,
          manifestId: manifestIds[index] || null,
          calculatedVisibleNumber: calculatedVisibleNumbers[index] || null,
          expectedVisibleNumber: expectedVisibleNumbers[index] || null
        };
        break;
      }
    }
    return {
      numbered,
      evidence: {
        sidecarIds,
        manifestIds,
        calculatedVisibleNumbers,
        expectedVisibleNumbers,
        firstMismatch,
        comparisonFunction: 'window.lerntexteSichtbareNummerierung',
        manifestSource: 'Lerntexte_Reihenfolge_Manifest.json'
      }
    };
  }

  function validateRechtNavigation(manifest, numbered, resolvePlaybackRange) {
    if (typeof resolvePlaybackRange !== 'function') throw new Error('Runtime-Auflösung für Wiedergabebereiche fehlt.');
    const firstGroup = manifest.chapterGroups[0];
    const first = manifest.chapters[0];
    const direct = manifest.chapters[1] || first;
    const all = resolvePlaybackRange(manifest, { mode: 'all' });
    const chapter = resolvePlaybackRange(manifest, { mode: 'chapter', chapterKey: firstGroup.chapterKey });
    const entry = resolvePlaybackRange(manifest, { mode: 'entry', lerntextId: direct.lerntextId });
    const firstNumbered = numbered.find(item => item && item.lerntextId === first.lerntextId);
    const numbering = numbered.length === manifest.chapters.length &&
      numbered.every(item => item && typeof item.sichtbareLerntextNr === 'string' && item.sichtbareLerntextNr.trim());
    const result = {
      chapterNavigation: false,
      allChapters: Boolean(all && all.startIndex === 0 && all.endIndex === manifest.chapters.length - 1 &&
        all.start === first.start),
      chapterOne: Boolean(chapter && chapter.startId === 'LZ-RE-51' && chapter.start === first.start &&
        firstNumbered?.sichtbareLerntextNr === '1.1' && first.titel === 'Anspruchsprüfung und Gutachtenstil'),
      singleEntry: Boolean(entry && entry.startId === direct.lerntextId && entry.start === direct.start),
      numbering,
      firstVisibleTitle: `${firstNumbered?.sichtbareLerntextNr || ''} ${first.titel}`.trim()
    };
    if (!result.allChapters || !result.chapterOne || !result.singleEntry || !result.numbering) {
      throw new Error('Recht-Navigation oder sichtbare Nummerierung ist inkonsistent.');
    }
    return result;
  }

  async function runPodcastStorageDiagnostic(options) {
    const subjects = Array.isArray(options?.subjects) ? options.subjects : [];
    const report = emptyReport(subjects.length);
    if (!options?.currentUser) {
      report.errors.push('Firebase currentUser fehlt.');
      return finalize(report);
    }
    report.currentUser = true;
    let token;
    try { token = await options.getIdToken(options.currentUser); }
    catch (error) { report.errors.push(`ID-Token: ${error.message}`); return finalize(report); }
    if (typeof token !== 'string' || !token.trim()) {
      report.errors.push('Firebase ID-Token fehlt.');
      return finalize(report);
    }
    report.idToken = true;
    const prefix = String(options.prefix || '');
    const version = String(options.version || '');
    if (!prefix.startsWith('podcast/staging/') || !version) {
      report.errors.push('Staging-Präfix oder Bundle-Version fehlt.');
      return finalize(report);
    }
    let orderManifest = options.orderManifest;
    if (!orderManifest && typeof options.loadOrderManifest === 'function') {
      try {
        orderManifest = await options.loadOrderManifest();
      } catch (error) {
        report.errors.push(`Lerntext-Reihenfolgemanifest: ${error.message}`);
        report.failure = 'FAIL – Diagnose – REIHENFOLGEMANIFEST';
      }
    }

    for (const subject of subjects) {
      const row = {
        subject,
        sidecar: 'FAIL',
        bundle: 'FAIL',
        loadedmetadata: 'FAIL',
        duration: null,
        version: '',
        result: 'FAIL'
      };
      let stage = 'PFAD';
      let paths;
      let manifest;
      try {
        paths = options.pathsForSubject(subject);
        if (!paths?.sidecarPath?.startsWith(prefix) || !paths?.mp3Prefix?.startsWith(prefix)) {
          throw new Error('Sidecar-/Bundlepfad liegt außerhalb des Stagingpräfixes.');
        }
        stage = 'SIDECAR';
        manifest = await options.loadSidecar(paths.sidecarPath);
        row.sidecar = 'PASS';
        report.sidecars += 1;
        row.version = typeof manifest?.bundleVersion === 'string' ? manifest.bundleVersion : '';
        stage = 'BUNDLE-VERSION';
        if (manifest?.bundleVersion !== version) throw new Error('Bundle-Version stimmt nicht.');
        if (typeof manifest.mp3Path !== 'string' || !manifest.mp3Path.startsWith(paths.mp3Prefix) ||
            manifest.mp3Path.startsWith('podcast/continuous/')) {
          throw new Error('Legacy- oder Fremdpräfix im MP3-Pfad.');
        }
      } catch (error) {
        recordFailure(report, row, subject, stage, error);
        report.results.push(row);
        continue;
      }

      stage = 'STRUKTUR';
      try {
        const comparison = compareStructure(manifest, subject, options.numberEntries, orderManifest);
        report.chapterGroups += manifest.chapterGroups.length;
        if (subject === 'Recht' || subject === 'VWL') {
          report.structureEvidence[subject] = comparison.evidence;
        }
        if (comparison.evidence.firstMismatch) {
          throw new Error(`Erste Abweichung an Position ${comparison.evidence.firstMismatch.position}.`);
        }
        if (subject === 'Recht') {
          report.recht = validateRechtNavigation(manifest, comparison.numbered, options.resolvePlaybackRange);
        }
      } catch (error) {
        recordFailure(report, row, subject, stage, error);
      }

      stage = 'BUNDLE';
      let bundle;
      try {
        bundle = await options.loadBundleMetadata(manifest.mp3Path);
        if (bundle?.contentType !== 'audio/mpeg' || !Number(bundle?.size)) throw new Error('MP3-Metadaten ungültig.');
        row.bundle = 'PASS';
        report.bundles += 1;
      } catch (error) {
        recordFailure(report, row, subject, stage, error);
        report.results.push(row);
        continue;
      }

      stage = 'LOADEDMETADATA';
      try {
        const audio = await options.loadAudioMetadata(manifest.mp3Path, bundle);
        if (!Number.isFinite(audio?.duration) || audio.duration <= 0 || Number(audio.readyState) < 1) {
          throw new Error('loadedmetadata ohne gültige Dauer.');
        }
        row.loadedmetadata = 'PASS';
        row.duration = audio.duration;
        report.loadedmetadata += 1;
        report.durations += 1;
      } catch (error) {
        recordFailure(report, row, subject, stage, error);
      }
      if (!row.failedStage) row.result = 'PASS';
      report.results.push(row);
    }
    if (report.recht) {
      report.recht.chapterNavigation = report.chapterGroups === Number(options.expectedChapterGroups);
      if (!report.recht.chapterNavigation) {
        const row = report.results.find(item => item.subject === 'Recht');
        if (row) {
          row.result = 'FAIL';
          row.failedStage = '48-KAPITEL-NAVIGATION';
        }
        report.errors.push(`Recht: Erwartet ${options.expectedChapterGroups} sichtbare Kapitel, gefunden ${report.chapterGroups}.`);
        if (!report.failure) report.failure = 'FAIL – Recht – 48-KAPITEL-NAVIGATION';
      }
    }
    return finalize(report);
  }

  return { SUBJECTS, runPodcastStorageDiagnostic };
});
