function setupVisibilitySyncHandlers(audio, resync) {
  function syncOnVisibilityChange() {
    if (typeof document !== 'undefined' && document.hidden === false) {
      resync(audio.currentTime);
    }
  }

  function syncOnPageShow() {
    resync(audio.currentTime);
  }

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', syncOnVisibilityChange);
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pageshow', syncOnPageShow);
  }

  return function cleanup() {
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', syncOnVisibilityChange);
    }

    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('pageshow', syncOnPageShow);
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setupVisibilitySyncHandlers
  };
}

if (typeof window !== 'undefined') {
  window.setupVisibilitySyncHandlers = setupVisibilitySyncHandlers;
}
