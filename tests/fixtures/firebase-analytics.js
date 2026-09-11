// Deterministic LOCAL transport. This is NOT evidence of real Google ingestion.
let defaults = {}, id = '';
export function setConsent(value) {
  if (value.ad_storage !== 'denied') throw Error('Advertising must be denied');
}
export function setDefaultEventParameters(value) { defaults = value; }
export function initializeAnalytics(app, {config}) {
  if (config.send_page_view !== false || config.allow_google_signals !== false) throw Error('Unsafe SDK configuration');
  id = app.measurementId; return {};
}
export function logEvent(analytics, name, params) {
  // Deliberately deferred to exercise iframe teardown and queued-event cancellation.
  setTimeout(() => {
    if (!window['ga-disable-' + id]) fetch('/__collect', {method:'POST', body:JSON.stringify({name,params:{...defaults,...params}})});
  }, 100);
}
