/* Aggregate usage vocabulary and lifecycle. No network, storage or analytics dependency. */
(function () {
  'use strict';
  const subjects = {
    'Recht':'recht', 'Steuern':'steuern', 'Rechnungswesen':'rechnungswesen', 'BWL':'bwl', 'VWL':'vwl',
    'Unternehmensführung':'unternehmensfuehrung', 'Führung und Zusammenarbeit':'fuehrung_zusammenarbeit',
    'Betriebliches Management':'betriebliches_management', 'Logistik':'logistik', 'Marketing':'marketing',
    'Vertrieb':'vertrieb', 'Investition und Finanzierung':'investition_finanzierung',
    'Betriebliches Rechnungswesen und Controlling':'rechnungswesen_controlling', 'Finance Controlling':'finance_controlling'
  };
  const events = ['trainer_start','quiz_start','simulation_start','podcast_start','learning_text_open',
    'flashcards_start','glossary_open','formulas_open','progress_open','kilian_open','kilian_use'];
  const subjectEvents = events.slice(0, 6);
  const subjectIds = ['unknown', ...Object.values(subjects)];
  const views = {glossarView:'glossary_open',formelView:'formulas_open',kilianView:'kilian_open',
    lernstandView:'progress_open',lernstandPruefungView:'progress_open',lernstandQuizView:'progress_open',lernstandFehlerView:'progress_open'};
  window.WifaUsageSchema = Object.freeze({events:Object.freeze(events), subjects:Object.freeze(subjectIds),
    clean(value) {
      if (!value || Object.keys(value).sort().join(',') !== 'area,event,subject' || !events.includes(value.event) ||
          !subjectIds.includes(value.subject) || !['none','WQ','HQ'].includes(value.area) ||
          (value.event !== 'simulation_start' && value.area !== 'none') ||
          (!subjectEvents.includes(value.event) && value.subject !== 'unknown')) return null;
      return {event:value.event,subject:value.subject,area:value.area};
    }});
  window.createWifaUsageCore = function (transport) {
    let enabled = false, ticket = Object.freeze({}), lastView = '', lastContent = '';
    const runs = new Set(), audioStates = new WeakMap();
    const api = {
      setEnabled(value) {
        if (enabled === !!value) return;
        enabled = !!value; ticket = Object.freeze({}); runs.clear(); lastView = ''; lastContent = '';
      },
      captureTicket() { return enabled ? ticket : null; },
      isCurrent(value) { return enabled && value === ticket; },
      record(event, subject, area) {
        if (!enabled || !events.includes(event)) return;
        const subjectId = subjectEvents.includes(event) ? (Object.hasOwn(subjects, subject) ? subjects[subject] : 'unknown') : 'unknown';
        try { transport({event,subject:subjectId,area:event === 'simulation_start' && ['WQ','HQ'].includes(area) ? area : 'none'}); }
        catch (_) { /* Statistics must never interrupt learning. */ }
      },
      start(feature, subject) {
        if (!enabled || !['trainer','quiz'].includes(feature) || runs.has(feature)) return;
        runs.add(feature); api.record(feature + '_start', subject);
      },
      reset(feature) { runs.delete(feature); },
      view(id) {
        if (!enabled || typeof id !== 'string' || lastView === id) return;
        lastView = id; lastContent = '';
        if (Object.hasOwn(views, id)) api.record(views[id]);
      },
      content(subject, selection) {
        if (!enabled) return;
        // Selection is retained in this page's memory only, never sent or persisted.
        const key = JSON.stringify([subject, selection]);
        if (lastContent === key) return;
        lastContent = key; api.record('learning_text_open', subject);
      },
      audio(audio, subject, selection, usageTicket = api.captureTicket()) {
        if (!audio || typeof audio.addEventListener !== 'function') return;
        if (!api.isCurrent(usageTicket)) return;
        const key = JSON.stringify([subject,selection]);
        let state = audioStates.get(audio);
        if (state && state.key === key && state.ticket === usageTicket) return;
        if (state) state.cleanup();
        state = {key,ticket:usageTicket,started:false};
        audioStates.set(audio,state);
        const playing = () => {
          if (!api.isCurrent(state.ticket)) return;
          if (state.started) return;
          state.started = true; api.record('podcast_start',subject);
        };
        const emptied = () => { state.started = false; };
        audio.addEventListener('playing',playing); audio.addEventListener('emptied',emptied);
        state.cleanup = () => { audio.removeEventListener('playing',playing); audio.removeEventListener('emptied',emptied); };
      },
      restartAudio(audio) { const state = audioStates.get(audio); if (state) state.started = false; }
    };
    return api;
  };
  // This disabled instance makes every classic-script hook safe before Auth initializes.
  window.WifaUsage = window.createWifaUsageCore(event => window.WifaUsageEnqueue?.(event));
})();
