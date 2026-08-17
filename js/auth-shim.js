// Lightweight shim so `requireAuth` is available before module loads.
window.requireAuth = function(target) {
  try {
    // If the real auth module is loaded, delegate to it
    if (window.authInitialized === true) {
      if (typeof window.requireAuthReal === 'function') return window.requireAuthReal(target);
    }
  } catch (e) {}
  // Fail closed: do NOT trust any global UID or verification flags here.
  // Remember desired target for later and show the auth view only.
  try { window.desiredView = target; } catch (e) {}
  try { if (typeof closeMainMenu === 'function') closeMainMenu(); } catch (e) {}
  if (typeof zeigeBereich === 'function') zeigeBereich('authView');
};

// Keep a pointer for the real implementation to replace
// The module `js/login.js` will set `window.requireAuthReal = requireAuth` and `window.authInitialized = true`.
