// This context is created only after opt-in and destroyed synchronously on withdrawal.
// The top-level app never loads gtag or Firebase Analytics; no access to Auth/Firestore here.
async function start() {
  if (window.parent === window || !window.parent.WifaAnalytics?.authorized()) return;
  const owner = window.parent.WifaAnalytics;
  const settings = window.parent.WIFA_ANALYTICS_SETTINGS;
  const allowed = () => window.parent.WifaAnalytics === owner && owner.authorized();
  const [{initializeApp}, sdk, {firebasePublicConfig}] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js'),
    import('./firebase-public-config.js')
  ]);
  if (!allowed()) return;
  // Defaults cover SDK-generated session_start/first_visit/user_engagement as well.
  const privacy = {
    send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
    page_location: 'https://beckersabine082-art.github.io/wifa-trainer-gruen/',
    page_referrer: '', page_title: 'WiFa Trainer', ignore_referrer: true,
    cookie_domain: window.location.hostname, cookie_path: '/wifa-trainer-gruen/',
    cookie_expires: 15552000, cookie_update: false, cookie_flags: 'SameSite=Lax;Secure'
  };
  sdk.setConsent({analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
  sdk.setDefaultEventParameters(privacy);
  const app = initializeApp({...firebasePublicConfig, measurementId: settings.measurementId});
  const analytics = sdk.initializeAnalytics(app, {config: privacy});
  window.wifaLogEvent = (name, params) => {
    if (!allowed()) return;
    sdk.logEvent(analytics, name, {...privacy, ...params});
  };
  owner.frameReady(window);
}
start().catch(() => { /* Analytics unavailable: the trainer continues normally. */ });
