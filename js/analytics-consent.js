(function () {
  'use strict';
  if (window.WifaAnalytics) return;
  const KEY = 'wifa.analytics.consent.v1', EXCLUDE = 'wifa.analytics.exclude.v1';
  const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  const settings = window.WIFA_ANALYTICS_SETTINGS || {};
  let frame = null, ready = false, pending = [], expiryTimer, memoryVeto = false;
  function read(key) { try { return window.localStorage.getItem(key); } catch (_) { return null; } }
  function decision() {
    try {
      const value = JSON.parse(read(KEY));
      const age = Date.now() - value.at;
      return typeof value.accepted === 'boolean' && Number.isFinite(age) && age >= 0 && age < MAX_AGE ? value : null;
    } catch (_) { return null; }
  }
  function authorized() {
    const pages = ['', 'index.html', 'datenschutz.html', 'impressum.html', 'nutzungsbedingungen.html', 'copyright.html'];
    return !memoryVeto && settings.enabled === true && /^G-[A-Z0-9]+$/.test(settings.measurementId || '') &&
      window.location.origin === settings.productionOrigin &&
      pages.some(page => window.location.pathname === settings.productionPath + page) &&
      read(EXCLUDE) !== 'true' && decision()?.accepted === true;
  }
  function clearCookies() {
    // Delete only this property's cookies, at our explicitly configured host/path.
    const names = ['_ga', '_ga_' + String(settings.measurementId || '').replace(/^G-/, '')];
    const host = window.location.hostname;
    for (const name of names) for (const path of ['/', settings.productionPath]) {
      for (const domain of ['', '; Domain=' + host, '; Domain=.' + host]) {
        document.cookie = name + '=; Max-Age=0; Path=' + path + domain + '; SameSite=Lax';
      }
    }
  }
  function stop() {
    ready = false; pending = []; core.setEnabled(false); clearTimeout(expiryTimer);
    if (frame) {
      // Disable synchronously BEFORE destroying SDK timers/listeners. No consent-denied ping.
      try { frame.contentWindow['ga-disable-' + settings.measurementId] = true; } catch (_) {}
      frame.remove(); frame = null;
    }
    clearCookies();
  }
  const core = window.createWifaAnalyticsCore((name, params) => {
    if (!authorized()) { stop(); return; }
    if (ready && frame?.contentWindow?.wifaLogEvent) frame.contentWindow.wifaLogEvent(name, params);
    else if (pending.length < 100) pending.push([name, params]);
  });
  function currentView() {
    const active = document.querySelector('.view.active');
    const pages = {'datenschutz.html':'datenschutzView', 'impressum.html':'impressumView',
      'nutzungsbedingungen.html':'nutzungsbedingungenView', 'copyright.html':'copyright'};
    core.view(active?.id || pages[window.location.pathname.split('/').pop()] || 'startView');
  }
  function refresh() {
    if (!authorized()) { stop(); return; }
    if (frame) return;
    core.setEnabled(true);
    frame = document.createElement('iframe');
    frame.hidden = true; frame.title = 'Freiwillige Nutzungsanalyse';
    frame.referrerPolicy = 'no-referrer';
    frame.src = new URL('analytics-frame.html', window.location.origin + settings.productionPath).href;
    document.body.appendChild(frame);
    scheduleExpiry();
    currentView();
  }
  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    if (!authorized()) { stop(); updateUI(); return; }
    // Browser timers overflow above 2^31-1 ms. Recheck daily, never shorten consent.
    const remaining = MAX_AGE - (Date.now() - decision().at);
    expiryTimer = setTimeout(scheduleExpiry, Math.min(86400000, remaining));
  }
  const dialog = document.createElement('dialog');
  dialog.id = 'analyticsDialog';
  dialog.setAttribute('aria-labelledby', 'analyticsHeading');
  dialog.innerHTML = '<h2 id="analyticsHeading">Freiwillige Nutzungsanalyse</h2>' +
    '<p>Mit deiner Zustimmung misst Google Analytics, welche Lernfunktionen, Fächer und Themen genutzt werden. ' +
    'Dabei entstehen pseudonyme Gerätekennungen in Cookies sowie technische Nutzungsdaten; eine Verarbeitung in den USA ist möglich. ' +
    'Namen, E-Mail-Adressen, Lernantworten und Konto-IDs übermitteln wir nicht an Analytics.</p>' +
    '<p>Ablehnen hat keine Nachteile. Du kannst deine Zustimmung hier jederzeit widerrufen. ' +
    '<a href="datenschutz.html#analytics">Datenschutzhinweise</a></p>' +
    '<p id="analyticsStatus" role="status"></p>' +
    '<div class="analytics-choices"><button type="button" id="analyticsAccept">Annehmen</button>' +
    '<button type="button" id="analyticsReject">Ablehnen / Widerrufen</button></div>' +
    '<p><label><input type="checkbox" id="analyticsExclude"> Diesen Browser dauerhaft von der Messung ausschließen (eigene Tests)</label></p>' +
    '<button type="button" id="analyticsClose">Schließen</button>';
  document.body.appendChild(dialog);
  const opener = document.createElement('button');
  opener.type = 'button'; opener.id = 'analyticsSettings'; opener.textContent = 'Datenschutz-Einstellungen';
  document.body.appendChild(opener);
  function updateUI() {
    document.getElementById('analyticsExclude').checked = read(EXCLUDE) === 'true';
    document.getElementById('analyticsStatus').textContent = read(EXCLUDE) === 'true'
      ? 'Dieser Browser ist von der Messung ausgeschlossen.'
      : authorized() ? 'Nutzungsanalyse ist erlaubt.' : 'Nutzungsanalyse ist aus.';
  }
  function choose(accepted) {
    memoryVeto = !accepted;
    try { window.localStorage.setItem(KEY, JSON.stringify({accepted: !!accepted, at: Date.now()})); }
    catch (_) { memoryVeto = true; stop(); updateUI(); document.getElementById('analyticsStatus').textContent = 'Analyse ist aus. Die Entscheidung konnte nicht gespeichert werden; bitte nach einem Neuladen erneut prüfen.'; return; }
    refresh(); updateUI(); dialog.close(); opener.focus();
  }
  function exclude(value) {
    try { window.localStorage.setItem(EXCLUDE, String(!!value)); } catch (_) { memoryVeto = true; stop(); updateUI(); return; }
    refresh(); updateUI();
  }
  window.WifaAnalytics = Object.assign(core, {choose, exclude, authorized,
    frameReady(source) {
      if (!authorized() || source !== frame?.contentWindow) return;
      ready = true;
      const events = pending; pending = [];
      for (const [name, params] of events) {
        if (!authorized() || !frame) break;
        source.wifaLogEvent(name, params);
      }
    }
  });
  opener.addEventListener('click', () => { updateUI(); dialog.showModal(); });
  document.getElementById('analyticsAccept').addEventListener('click', () => choose(true));
  document.getElementById('analyticsReject').addEventListener('click', () => choose(false));
  document.getElementById('analyticsClose').addEventListener('click', () => dialog.close());
  document.getElementById('analyticsExclude').addEventListener('change', event => exclude(event.target.checked));
  window.addEventListener('storage', () => { refresh(); updateUI(); });
  document.addEventListener('visibilitychange', () => { refresh(); updateUI(); });
  refresh(); updateUI();
  // No banner for an unconfigured installation; settings always remain reachable.
  if (settings.enabled && !decision() && read(EXCLUDE) !== 'true') dialog.showModal();
}());
