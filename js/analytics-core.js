/* Network-free analytics vocabulary and lifecycle. Never pass raw content to a transport. */
(function () {
  'use strict';
  const subjects = {
    'Recht': 'recht', 'Steuern': 'steuern', 'Rechnungswesen': 'rechnungswesen',
    'BWL': 'bwl', 'VWL': 'vwl', 'Unternehmensführung': 'unternehmensfuehrung',
    'Führung und Zusammenarbeit': 'fuehrung_zusammenarbeit', 'Betriebliches Management': 'betriebliches_management',
    'Logistik': 'logistik', 'Marketing': 'marketing', 'Vertrieb': 'vertrieb',
    'Investition und Finanzierung': 'investition_finanzierung',
    'Betriebliches Rechnungswesen und Controlling': 'rechnungswesen_controlling'
  };
  const views = {
    startView: ['start', null], trainerView: ['trainer', 'trainer'], quizView: ['quiz', 'quiz'],
    pruefungView: ['pruefung', 'exam'], lerntextePodcastView: ['lerntexte', 'learning_text'],
    glossarView: ['glossar', 'glossary'], formelView: ['formeln', 'formulas'],
    authView: ['anmeldung', null], wissenView: ['wissen', null], kilianView: ['kilian', null],
    lernstandView: ['lernstand', null], lernstandPruefungView: ['lernstand_pruefung', null],
    lernstandQuizView: ['lernstand_quiz', null], lernstandFehlerView: ['lernstand_fehler', null],
    impressumView: ['impressum', null], datenschutzView: ['datenschutz', null],
    nutzungsbedingungenView: ['nutzungsbedingungen', null], copyright: ['copyright', null]
  };
  const names = {trainer: 'training', quiz: 'quiz', exam: 'exam'};
  window.createWifaAnalyticsCore = function (transport) {
    let enabled = false, lastView = '', epoch = 0;
    const runs = new Map(), contents = new Map(), audioStates = new WeakMap(), audioErrors = new Map();
    function context(feature, subject, topic) {
      const subjectId = Object.hasOwn(subjects, subject) ? subjects[subject] : 'unknown';
      const catalog = window.WIFA_ANALYTICS_TOPICS || {};
      const key = subjectId + '|' + String(topic || '').normalize('NFC').trim();
      return {feature_id: feature, subject_id: subjectId,
        topic_id: Object.hasOwn(catalog, key) ? catalog[key] : 'unknown'};
    }
    function emit(name, params) {
      if (!enabled) return;
      try { transport(name, params); } catch (_) { /* Analytics must never break learning. */ }
    }
    const api = {
      setEnabled(value) {
        if (enabled === !!value) return;
        enabled = !!value; epoch++; lastView = ''; runs.clear(); contents.clear(); audioErrors.clear();
      },
      view(id) {
        if (!enabled || !Object.hasOwn(views, id) || lastView === id) return;
        lastView = id; contents.clear();
        const [view, feature] = views[id];
        emit('page_view', {view_id: view, page_title: 'WiFa – ' + view,
          page_location: 'https://beckersabine082-art.github.io/wifa-trainer-gruen/' + view,
          page_referrer: ''});
        if (feature) emit('feature_use', {feature_id: feature});
      },
      content(feature, subject, topic) {
        if (!enabled || !['trainer', 'quiz', 'exam', 'learning_text'].includes(feature)) return;
        const params = context(feature, subject, topic), key = JSON.stringify(params);
        if (contents.get(feature) === key) return;
        contents.set(feature, key); emit('content_view', params);
      },
      reset(feature) { runs.delete(feature); },
      start(feature, subject, topic) {
        if (!enabled || !Object.hasOwn(names, feature) || runs.has(feature)) return;
        const params = context(feature, subject, topic);
        runs.set(feature, {params, complete: false}); emit(names[feature] + '_start', params);
      },
      complete(feature) {
        const run = runs.get(feature);
        if (!enabled || !run || run.complete) return;
        run.complete = true; emit(names[feature] + '_complete', run.params);
      },
      audio(audio, subject, topic) {
        if (!audio || typeof audio.addEventListener !== 'function') return;
        const key = subject + '|' + topic;
        let state = audioStates.get(audio);
        if (state && state.key === key) return;
        if (state) state.cleanup();
        state = {key, epoch, started: false, marks: new Set(), errors: new Set()};
        audioStates.set(audio, state);
        const params = context('podcast', subject, topic);
        audioErrors.set(JSON.stringify(params), state.errors);
        const sync = () => {
          if (state.epoch !== epoch) {
            state.epoch = epoch; state.started = false; state.marks.clear(); state.errors.clear();
            audioErrors.set(JSON.stringify(params), state.errors);
          }
          return enabled;
        };
        const playing = () => {
          if (!sync() || state.started) return;
          state.started = true; emit('podcast_start', params);
        };
        const progress = (ended) => {
          if (!sync() || !state.started || audio.seeking || (!ended && audio.paused)) return;
          if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
          const percent = ended ? 100 : Math.min(99.999, audio.currentTime / audio.duration * 100);
          [25, 50, 75, 100].forEach(mark => {
            if (percent >= mark && !state.marks.has(mark)) {
              state.marks.add(mark); emit('podcast_progress', {...params, progress_percent: mark});
            }
          });
        };
        const error = () => { if (sync()) api.audioError(subject, topic, audio.error?.code); };
        const handlers = {playing, timeupdate: () => progress(false), ended: () => progress(true), error,
          emptied: () => api.restartAudio(audio)};
        Object.entries(handlers).forEach(([event, handler]) => audio.addEventListener(event, handler));
        state.cleanup = () => Object.entries(handlers).forEach(([event, handler]) => audio.removeEventListener(event, handler));
      },
      restartAudio(audio) {
        const state = audioStates.get(audio);
        if (state) { state.started = false; state.marks.clear(); state.errors.clear(); }
      },
      audioError(subject, topic, code) {
        const codes = {1: 'aborted', 2: 'network', 3: 'decode', 4: 'unsupported',
          NotAllowedError: 'not_allowed', NotSupportedError: 'unsupported', AbortError: 'aborted', asset_invalid: 'asset_invalid'};
        const safeCode = Object.hasOwn(codes, code) ? codes[code] : 'unknown';
        if (!enabled) return;
        const params = context('podcast', subject, topic), key = JSON.stringify(params);
        const seen = audioErrors.get(key) || new Set();
        if (seen.has(safeCode)) return;
        seen.add(safeCode); audioErrors.set(key, seen);
        emit('podcast_error', {...params, error_code: safeCode});
      }
    };
    return api;
  };
}());
