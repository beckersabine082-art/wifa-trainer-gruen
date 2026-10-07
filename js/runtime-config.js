(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root) return;
  root.WifaRuntimeConfig = api;
  try {
    const config = api.resolveRuntimeConfig(root.WIFA_RELEASE_ENVIRONMENT);
    root.WIFA_PODCAST_STORAGE_PREFIX = config.podcastPrefix;
    root.WIFA_PODCAST_BUNDLE_VERSION = config.podcastVersion;
    root.WIFA_RUNTIME_CONFIGURATION = Object.freeze(config);
  } catch (error) {
    delete root.WIFA_PODCAST_STORAGE_PREFIX;
    delete root.WIFA_PODCAST_BUNDLE_VERSION;
    root.WIFA_RUNTIME_CONFIGURATION_ERROR = error.message;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const CONFIG = Object.freeze({
    STAGING: Object.freeze({
      environment: 'STAGING',
      podcastVersion: 'WIFA-PODCAST-STAGING-LZREV2-20261004-v1',
      podcastPrefix: 'podcast/staging/lerntext-rev2/'
    }),
    PRODUCTION: Object.freeze({
      environment: 'PRODUCTION',
      podcastVersion: 'WIFA-PODCAST-PROD-LZREV2-20261007-v1',
      podcastPrefix: 'podcast/production/lerntext-rev2/WIFA-PODCAST-PROD-LZREV2-20261007-v1/'
    })
  });

  function resolveRuntimeConfig(environment) {
    const selected = String(environment || '').trim().toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(CONFIG, selected)) {
      throw new Error('Ungültige oder fehlende Runtime-Umgebung; Podcastzugriff verweigert.');
    }
    return { ...CONFIG[selected] };
  }

  return { CONFIG, resolveRuntimeConfig };
});
