// Pure validation and timeline helpers for continuous podcasts.
(function (root) {
  'use strict';

  const SHA256 = /^[a-f0-9]{64}$/;
  const SAMPLE_RATE = 22050;
  const IDENTITY_FIELDS = [
    'index', 'titel', 'hauptkapitel', 'hauptkapitelNr', 'unterkapitelNr',
    'lerntextHash', 'legacyMp3Path', 'legacyJsonPath'
  ];

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isSha256(value) {
    return typeof value === 'string' && SHA256.test(value);
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function nearlySameSampleTime(seconds, samples) {
    return isFiniteNumber(seconds) && Math.abs(seconds - samples / SAMPLE_RATE) <= 1 / SAMPLE_RATE;
  }

  function invalid(reason) {
    return { valid: false, reason: reason };
  }

  function podcastSlug(value) {
    return value.trim().toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizePodcastPrefix(prefix) {
    const value = String(prefix || 'podcast/').trim().replace(/\\/g, '/');
    if (!value.startsWith('podcast/') || value.startsWith('/') || value.includes('..') || value.includes('//')) {
      throw new TypeError('Podcast-Präfix ist ungültig');
    }
    return value.endsWith('/') ? value : value + '/';
  }

  function continuousPodcastPaths(fach, options) {
    if (typeof fach !== 'string' || !fach.trim()) throw new TypeError('Fach fehlt');
    const slug = podcastSlug(fach);
    if (!slug) throw new TypeError('Fach hat keinen gültigen Slug');
    const prefix = normalizePodcastPrefix(options && options.prefix);
    return {
      slug: slug,
      sidecarPath: prefix + 'continuous/' + slug + '.json',
      mp3Prefix: prefix + 'continuous/' + slug + '/'
    };
  }

  function validateContinuousBundle(input) {
    if (!isRecord(input)) return invalid('input');
    const { manifest, manifestHash, mp3Metadata, currentEntries, expectedFach, expectedMp3Prefix,
      expectedStoragePrefix } = input;
    let paths;
    try { paths = continuousPodcastPaths(expectedFach, expectedStoragePrefix ? { prefix: expectedStoragePrefix } : undefined); }
    catch { return invalid('subject'); }
    if (expectedMp3Prefix !== paths.mp3Prefix) return invalid('bundle-path');
    if (!isRecord(manifest) || ![1, 2].includes(manifest.schemaVersion) || manifest.fach !== expectedFach) {
      return invalid('schema');
    }
    const versioned = manifest.schemaVersion === 2;
    if (versioned && (typeof manifest.bundleVersion !== 'string' || !manifest.bundleVersion.trim())) {
      return invalid('bundle-version');
    }
    if (!isSha256(manifest.bundleHash) || !isSha256(manifestHash) ||
        manifest.mp3Path !== expectedMp3Prefix + manifest.bundleHash + '.mp3') {
      return invalid('bundle-path');
    }
    const metadata = isRecord(mp3Metadata) && mp3Metadata.customMetadata;
    if (!isRecord(metadata) || metadata.bundleHash !== manifest.bundleHash ||
        metadata.manifestHash !== manifestHash) {
      return invalid('metadata-hash');
    }
    const encoding = manifest.encoding;
    if (!isRecord(encoding) || encoding.container !== 'mp3' || encoding.codec !== 'mp3' ||
        encoding.bitrateKbps !== 96 || encoding.sampleRateHz !== SAMPLE_RATE ||
        encoding.channels !== 1 || encoding.pcmFormat !== 's16le') {
      return invalid('encoding');
    }
    if (!Number.isSafeInteger(manifest.sampleCount) || manifest.sampleCount <= 0 ||
        !nearlySameSampleTime(manifest.duration, manifest.sampleCount)) {
      return invalid('duration');
    }
    if (!Array.isArray(currentEntries) || currentEntries.length === 0 ||
        !Array.isArray(manifest.chapters) || manifest.chapters.length !== currentEntries.length) {
      return invalid('chapter-count');
    }

    let previousEndSample = 0;
    for (let index = 0; index < currentEntries.length; index += 1) {
      const chapter = manifest.chapters[index];
      const current = currentEntries[index];
      if (!isRecord(chapter) || !isRecord(current) || current.fach !== expectedFach ||
          IDENTITY_FIELDS.some(function (field) { return chapter[field] !== current[field]; }) ||
          chapter.index !== index || typeof chapter.hauptkapitelNr !== 'string' ||
          chapter.hauptkapitelNr.trim() === '' || typeof chapter.unterkapitelNr !== 'string' ||
          chapter.unterkapitelNr.trim() === '' || typeof chapter.titel !== 'string' ||
          chapter.titel.trim() === '' || typeof chapter.hauptkapitel !== 'string' ||
          chapter.hauptkapitel.trim() === '' || !isSha256(chapter.lerntextHash) ||
          typeof chapter.legacyMp3Path !== 'string' ||
          !/^podcast\/[a-z0-9-]+\.mp3$/.test(chapter.legacyMp3Path) ||
          typeof chapter.legacyJsonPath !== 'string' ||
          !/^podcast\/[a-z0-9-]+\.json$/.test(chapter.legacyJsonPath) ||
          chapter.legacyMp3Path.slice(0, -4) !== chapter.legacyJsonPath.slice(0, -5)) {
        return invalid('chapter-identity');
      }
      if (versioned && (typeof chapter.lerntextId !== 'string' || !chapter.lerntextId.trim() ||
          chapter.lerntextId !== current.lerntextId || typeof chapter.chapterKey !== 'string' ||
          !chapter.chapterKey.trim() || !['reused', 'regenerated'].includes(chapter.origin) ||
          !isSha256(chapter.segmentHash))) {
        return invalid('chapter-versioned-identity');
      }
      if (!Number.isSafeInteger(chapter.startSample) || !Number.isSafeInteger(chapter.endSample) ||
          chapter.startSample !== previousEndSample || chapter.endSample <= chapter.startSample ||
          chapter.endSample > manifest.sampleCount ||
          !nearlySameSampleTime(chapter.start, chapter.startSample) ||
          !nearlySameSampleTime(chapter.end, chapter.endSample)) {
        return invalid('chapter-timeline');
      }

      const marks = chapter.wortZeitmarken;
      const chapterDuration = (chapter.endSample - chapter.startSample) / SAMPLE_RATE;
      if (!Array.isArray(marks) || marks.length === 0) return invalid('word-marks');
      let previousStart = 0;
      let previousEnd = 0;
      for (let wordIndex = 0; wordIndex < marks.length; wordIndex += 1) {
        const mark = marks[wordIndex];
        if (!isRecord(mark) || mark.wortIndex !== wordIndex || typeof mark.wort !== 'string' ||
            mark.wort.trim() === '' || !isFiniteNumber(mark.start) || !isFiniteNumber(mark.end) ||
            mark.start < 0 || mark.end < mark.start || mark.start < previousStart ||
            mark.end < previousEnd || mark.end > chapterDuration + 0.001) {
          return invalid('word-marks');
        }
        previousStart = mark.start;
        previousEnd = mark.end;
      }
      previousEndSample = chapter.endSample;
    }
    if (previousEndSample !== manifest.sampleCount) return invalid('sample-count');
    if (versioned) {
      if (new Set(manifest.chapters.map(function (chapter) { return chapter.lerntextId; })).size !== manifest.chapters.length ||
          !Array.isArray(manifest.chapterGroups) || manifest.chapterGroups.length === 0) {
        return invalid('chapter-groups');
      }
      let nextIndex = 0;
      for (const group of manifest.chapterGroups) {
        if (!isRecord(group) || typeof group.chapterKey !== 'string' || !group.chapterKey.trim() ||
            typeof group.chapterNumber !== 'string' || !group.chapterNumber.trim() ||
            typeof group.chapterTitle !== 'string' || !group.chapterTitle.trim() ||
            group.startIndex !== nextIndex || !Number.isInteger(group.endIndex) || group.endIndex < group.startIndex ||
            group.endIndex >= manifest.chapters.length || !Array.isArray(group.lerntextIds)) {
          return invalid('chapter-groups');
        }
        const grouped = manifest.chapters.slice(group.startIndex, group.endIndex + 1);
        if (grouped.some(function (chapter) { return chapter.chapterKey !== group.chapterKey; }) ||
            JSON.stringify(group.lerntextIds) !== JSON.stringify(grouped.map(function (chapter) { return chapter.lerntextId; }))) {
          return invalid('chapter-groups');
        }
        nextIndex = group.endIndex + 1;
      }
      if (nextIndex !== manifest.chapters.length) return invalid('chapter-groups');
    }
    return { valid: true, reason: null };
  }

  function validateRechtBundle(input) {
    if (!isRecord(input)) return invalid('input');
    const currentEntries = Array.isArray(input.currentEntries)
      ? input.currentEntries.map(function (entry) {
        return isRecord(entry) && entry.fach === undefined ? { ...entry, fach: 'Recht' } : entry;
      }) : input.currentEntries;
    return validateContinuousBundle({
      ...input,
      expectedFach: 'Recht',
      expectedMp3Prefix: continuousPodcastPaths('Recht').mp3Prefix,
      currentEntries: currentEntries
    });
  }

  function chapterAt(manifest, index) {
    return isRecord(manifest) && Array.isArray(manifest.chapters) &&
      Number.isInteger(index) && index >= 0 && index < manifest.chapters.length
      ? manifest.chapters[index] : null;
  }

  function chapterIndexAtTime(manifest, time) {
    if (!isRecord(manifest) || !Array.isArray(manifest.chapters) ||
        manifest.chapters.length === 0 || !isFiniteNumber(time) || time < 0) return -1;
    const chapters = manifest.chapters;
    const final = chapters[chapters.length - 1];
    if (!isRecord(final) || !isFiniteNumber(final.end) || time > final.end) return -1;
    if (time === final.end) return chapters.length - 1;

    let low = 0;
    let high = chapters.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const chapter = chapters[middle];
      if (!isRecord(chapter) || !isFiniteNumber(chapter.start) || !isFiniteNumber(chapter.end)) return -1;
      if (time < chapter.start) high = middle - 1;
      else if (time >= chapter.end) low = middle + 1;
      else return middle;
    }
    return -1;
  }

  function chapterLocalTime(manifest, index, time) {
    const chapter = chapterAt(manifest, index);
    if (!isRecord(chapter) || !isFiniteNumber(chapter.start) ||
        !isFiniteNumber(chapter.end) || !isFiniteNumber(time)) return null;
    return Math.min(Math.max(time - chapter.start, 0), chapter.end - chapter.start);
  }

  function chapterSeekTarget(manifest, index, localSeconds) {
    const chapter = chapterAt(manifest, index);
    const offset = localSeconds === undefined ? 0 : localSeconds;
    if (!isRecord(chapter) || !isFiniteNumber(chapter.start) ||
        !isFiniteNumber(chapter.end) || !isFiniteNumber(offset)) return null;
    return chapter.start + Math.min(Math.max(offset, 0), chapter.end - chapter.start);
  }

  const api = {
    continuousPodcastPaths,
    validateContinuousBundle,
    chapterIndexAtTime,
    chapterLocalTime,
    chapterSeekTarget,
    validateRechtBundle,
    rechtChapterIndexAtTime: chapterIndexAtTime,
    rechtChapterLocalTime: chapterLocalTime,
    rechtChapterSeekTarget: chapterSeekTarget
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.podcastContinuous = api;
})(typeof window !== 'undefined' ? window : null);
