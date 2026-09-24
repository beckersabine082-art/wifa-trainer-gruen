// Ansicht "Lerntexte & Podcast"

const lerntexteFaecher = [
  "Führung und Zusammenarbeit",
  "Rechnungswesen",
  "Recht",
  "Steuern",
  "BWL",
  "VWL",
  "Unternehmensführung",
  "Betriebliches Management",
  "Logistik",
  "Marketing",
  "Vertrieb",
  "Betriebliches Rechnungswesen und Controlling",
  "Investition und Finanzierung"
];

let lerntexteFaecherAufgebaut = false;
let lerntexteAktuellesFach = "";
let lerntexteAktuellesKapitel = "";
let lerntexteDaten = [];

let lerntexteAudioAktiv = false;
let lerntexteAudioPausiert = false;
let lerntexteAudioGeneration = 0;
let lerntexteAudioChunks = [];
let lerntexteAudioChunkIndex = 0;
let lerntexteAudioProgressTotal = 0;
let lerntexteAudioProgressCompleted = 0;
let lerntexteAudioProgressCurrent = 0;
let lerntexteAudioCurrentChunkLength = 0;
let lerntexteAudioCurrentUtterance = null;
let lerntexteAudioTestAudio = null;
let lerntexteAudioTestCurrentUrl = "";
let lerntexteAudioTestHash = "";
let lerntexteAudioTestKapitelAktiv = false;
let lerntexteAudioPlaylist = [];
let lerntexteAudioPlaylistIndex = 0;
let lerntexteAudioQuelle = "";
let lerntexteAudioSessionId = 0;
let lerntexteAudioLoadController = null;
let lerntexteAudioPrefetch = null;
let lerntexteAudioLetztePosition = 0;
let lerntexteAudioFehler = false;
let lerntexteAudioLaedt = false;
let lerntextePilotTextRoot = null;
let lerntextePilotManifestState = null;
let lerntextePilotAudio = null;
let lerntextePilotKaraokeCleanup = null;
let lerntextePilotUid = null;
let lerntextePilotCurrentHash = "";
let lerntextePilotEntry = null;
let lerntextePilotResumeState = null;
let lerntextePilotCompletedState = null;
let lerntextePilotLastValidWordIndex = 0;
let lerntextePilotTextRoots = {};
let lerntexteContinuousState = null;
let lerntexteContinuousFallbackAktiv = false;
let lerntexteAudioMediaSessionPositionAktiv = false;
const lerntexteContinuousManifestPath = 'podcast/continuous/recht.json';
const lerntexteAudioTestStatischeQuelle = "https://beckersabine082-art.github.io/wifa-trainer-gruen/audio/podcast/recht-rechtssubjekte-rechtsobjekte.mp3";

function lerntexteContinuousIstRecht() {
  return String(lerntexteAktuellesFach || '').trim() === 'Recht';
}

function lerntexteContinuousHelper(name) {
  if (typeof window === 'undefined') return null;
  if (typeof window[name] === 'function') return window[name];
  return window.podcastContinuous && typeof window.podcastContinuous[name] === 'function'
    ? window.podcastContinuous[name]
    : null;
}

function lerntexteIstPilotEinheit(fach, titel) {
  return String(fach || "").trim() !== "" && String(titel || "").trim() !== "";
}

function lerntextePilotTextFuerEintrag(eintrag) {
  if (!eintrag) return "";
  const lerntext = eintrag && Object.prototype.hasOwnProperty.call(eintrag, 'lerntext') ? String(eintrag.lerntext || "") : "";
  return lerntext;
}

async function lerntextePilotHash(text) {
  const source = String(text == null ? "" : text);

  if (typeof require === 'function') {
    try {
      const crypto = require('node:crypto');
      return crypto.createHash('sha256').update(source, 'utf8').digest('hex');
    } catch (error) {
      // Node fallback below.
    }
  }

  const cryptoApi = (typeof window !== 'undefined' && window.crypto && window.crypto.subtle)
    || (typeof crypto !== 'undefined' && crypto.subtle);

  if (cryptoApi && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const buffer = await cryptoApi.digest('SHA-256', encoder.encode(source));
    return Array.from(new Uint8Array(buffer)).map(function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  const fallback = source ? Array.from(source).reduce(function (hashValue, char) {
    return ((hashValue * 31) + char.charCodeAt(0)) >>> 0;
  }, 0).toString(16) : '0';

  return fallback.length === 64 ? fallback : fallback;
}

async function lerntextePilotManifest(eintrag) {
  const fach = String(eintrag && eintrag.fach || lerntexteAktuellesFach || "");
  const titel = String(eintrag && eintrag.titel || "");
  const paths = lerntextePodcastPfade(fach, eintrag);
  const currentHash = await lerntextePilotHash(lerntextePilotTextFuerEintrag(eintrag));
  return {
    fach: fach,
    titel: titel,
    mp3Path: paths.mp3Path,
    jsonPath: paths.jsonPath,
    lerntextHash: currentHash,
    wortZeitmarken: []
  };
}

function lerntextePilotStatus(text) {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const statusNode = document.getElementById('lerntexteAudioStatus');
  if (statusNode) {
    statusNode.textContent = text;
  }
}

function lerntexteAudioSessionIstAktuell(sessionId) {
  return sessionId === lerntexteAudioSessionId;
}

function lerntexteAudioSessionPruefen(sessionId) {
  if (typeof sessionId !== 'number' || lerntexteAudioSessionIstAktuell(sessionId)) return;
  const error = new Error('Veraltete Podcast-Session.');
  error.code = 'podcast/session-stale';
  throw error;
}

function lerntexteAudioIstVeralteterFehler(error) {
  return Boolean(error && (error.code === 'podcast/session-stale' || error.name === 'AbortError'));
}

function lerntexteAudioPrefetchVerwerfen() {
  const prefetch = lerntexteAudioPrefetch;
  lerntexteAudioPrefetch = null;
  if (prefetch && prefetch.controller && typeof prefetch.controller.abort === 'function') {
    prefetch.controller.abort();
  }
}

function lerntexteAudioPrefetchIstAktuell(prefetch) {
  return Boolean(
    prefetch
    && lerntexteAudioPrefetch === prefetch
    && lerntexteAudioSessionIstAktuell(prefetch.sessionId)
    && lerntexteAudioPlaylist === prefetch.playlist
    && lerntexteAudioPlaylistIndex === prefetch.sourceIndex
    && lerntexteAudioPlaylist[prefetch.targetIndex] === prefetch.item
  );
}

function lerntexteAudioPrefetchNehmen(targetIndex, sessionId) {
  const prefetch = lerntexteAudioPrefetch;
  const usable = Boolean(
    prefetch
    && prefetch.state === 'ready'
    && prefetch.sessionId === sessionId
    && prefetch.playlist === lerntexteAudioPlaylist
    && prefetch.targetIndex === targetIndex
    && prefetch.item === lerntexteAudioPlaylist[targetIndex]
    && prefetch.assets
    && prefetch.assets.manifest
    && prefetch.assets.mp3Metadata
    && typeof prefetch.assets.mp3Url === 'string'
    && prefetch.assets.mp3Url
  );

  lerntexteAudioPrefetch = null;
  if (!usable) {
    if (prefetch && prefetch.controller && typeof prefetch.controller.abort === 'function') {
      prefetch.controller.abort();
    }
    return null;
  }
  return prefetch;
}

function lerntexteAudioNaechstesKapitelVorbereiten(sessionId) {
  if (lerntexteContinuousState) return Promise.resolve(null);
  if (!lerntexteAudioSessionIstAktuell(sessionId)) return Promise.resolve(null);
  const sourceIndex = lerntexteAudioPlaylistIndex;
  const targetIndex = sourceIndex + 1;
  if (targetIndex >= lerntexteAudioPlaylist.length) {
    lerntexteAudioPrefetchVerwerfen();
    return Promise.resolve(null);
  }

  const playlist = lerntexteAudioPlaylist;
  const item = playlist[targetIndex];
  if (!item || !item.eintrag) return Promise.resolve(null);
  if (lerntexteAudioPrefetch
    && lerntexteAudioPrefetch.sessionId === sessionId
    && lerntexteAudioPrefetch.playlist === playlist
    && lerntexteAudioPrefetch.targetIndex === targetIndex
    && lerntexteAudioPrefetch.item === item) {
    return lerntexteAudioPrefetch.promise || Promise.resolve(lerntexteAudioPrefetch);
  }

  lerntexteAudioPrefetchVerwerfen();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const prefetch = {
    sessionId: sessionId,
    playlist: playlist,
    sourceIndex: sourceIndex,
    targetIndex: targetIndex,
    item: item,
    controller: controller,
    state: 'pending',
    assets: null,
    progress: null,
    currentHash: '',
    promise: null
  };
  lerntexteAudioPrefetch = prefetch;

  prefetch.promise = (async function () {
    const signal = controller ? controller.signal : undefined;
    const assets = await lerntextePilotAssetsLaden(item.eintrag, sessionId, signal);
    if (!lerntexteAudioPrefetchIstAktuell(prefetch)) return null;
    const validation = await lerntextePilotAssetValidieren(item.eintrag, assets.manifest, assets.mp3Metadata, sessionId);
    if (!lerntexteAudioPrefetchIstAktuell(prefetch)) return null;
    if (!validation.valid) {
      if (lerntexteAudioPrefetch === prefetch) lerntexteAudioPrefetch = null;
      return null;
    }
    const progress = await lerntextePilotProgressLaden(item.eintrag, validation.currentHash, sessionId, { silent: true });
    if (!lerntexteAudioPrefetchIstAktuell(prefetch)) return null;
    prefetch.assets = assets;
    prefetch.progress = progress;
    prefetch.currentHash = validation.currentHash;
    prefetch.state = 'ready';
    return prefetch;
  })().catch(function () {
    if (lerntexteAudioPrefetch === prefetch) lerntexteAudioPrefetch = null;
    return null;
  });
  return prefetch.promise;
}

function lerntexteAudioSessionInvalidieren() {
  lerntexteAudioPrefetchVerwerfen();
  const previousSessionId = lerntexteAudioSessionId;
  lerntextePilotKaraokeAufraeumen(previousSessionId);
  if (lerntexteAudioLoadController && typeof lerntexteAudioLoadController.abort === 'function') {
    lerntexteAudioLoadController.abort();
  }
  lerntexteAudioLoadController = null;
  lerntexteAudioLaedt = false;
  return ++lerntexteAudioSessionId;
}

async function lerntextePilotAssetsLaden(eintrag, sessionId, signal) {
  const fach = String(eintrag && eintrag.fach || lerntexteAktuellesFach || "");
  const paths = lerntextePodcastPfade(fach, eintrag);
  if (typeof window !== 'undefined' && window.lerntextePilotDependencies) {
    const dependencies = window.lerntextePilotDependencies;
    const results = await Promise.all([
      dependencies.loadManifest(paths.jsonPath, signal),
      dependencies.loadMetadata(paths.mp3Path, signal),
      dependencies.loadMp3Url(paths.mp3Path, signal)
    ]);
    lerntexteAudioSessionPruefen(sessionId);
    return {
      manifest: results[0],
      mp3Metadata: results[1],
      mp3Url: results[2]
    };
  }

  const modules = await Promise.all([
    import('./firebase-config.js'),
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js')
  ]);
  const firebase = modules[0];
  const storageModule = modules[1];
  const storageRef = firebase.ref(firebase.storage, paths.mp3Path);
  const jsonRef = firebase.ref(firebase.storage, paths.jsonPath);
  lerntexteAudioSessionPruefen(sessionId);
  const manifestPromise = firebase.getDownloadURL(jsonRef).then(async function (manifestUrl) {
    lerntexteAudioSessionPruefen(sessionId);
    const manifestResponse = await fetch(manifestUrl, signal ? { signal: signal } : undefined);
    lerntexteAudioSessionPruefen(sessionId);
    if (!manifestResponse.ok) {
      throw new Error('Podcast-Manifest konnte nicht geladen werden.');
    }
    return manifestResponse.json();
  });
  const results = await Promise.all([
    manifestPromise,
    storageModule.getMetadata(storageRef),
    firebase.getDownloadURL(storageRef)
  ]);
  lerntexteAudioSessionPruefen(sessionId);

  return {
    manifest: results[0],
    mp3Metadata: results[1],
    mp3Url: results[2]
  };
}

function lerntexteContinuousKannVersuchen() {
  if (!lerntexteContinuousIstRecht() || lerntexteContinuousFallbackAktiv) return false;
  if (!lerntexteContinuousHelper('validateRechtBundle')
    || !lerntexteContinuousHelper('rechtChapterIndexAtTime')
    || !lerntexteContinuousHelper('rechtChapterLocalTime')
    || !lerntexteContinuousHelper('rechtChapterSeekTarget')) return false;

  if (typeof window !== 'undefined' && window.lerntextePilotDependencies) {
    return typeof window.lerntextePilotDependencies.loadBundleManifest === 'function';
  }
  return true;
}

async function lerntexteContinuousAssetsLaden(sessionId, signal) {
  if (typeof window !== 'undefined' && window.lerntextePilotDependencies) {
    const dependencies = window.lerntextePilotDependencies;
    if (typeof dependencies.loadBundleManifest !== 'function') {
      const unavailable = new Error('Recht-Bundle ist nicht verfügbar.');
      unavailable.code = 'podcast/bundle-unavailable';
      throw unavailable;
    }
    const loaded = await dependencies.loadBundleManifest(lerntexteContinuousManifestPath, signal);
    lerntexteAudioSessionPruefen(sessionId);
    const manifest = loaded && loaded.manifest ? loaded.manifest : loaded;
    const manifestHash = String(loaded && loaded.manifestHash || '');
    if (!manifest || typeof manifest.mp3Path !== 'string') {
      throw new Error('Recht-Bundle-Sidecar ist ungültig.');
    }
    const results = await Promise.all([
      dependencies.loadMetadata(manifest.mp3Path, signal),
      dependencies.loadMp3Url(manifest.mp3Path, signal)
    ]);
    lerntexteAudioSessionPruefen(sessionId);
    return { manifest: manifest, manifestHash: manifestHash, mp3Metadata: results[0], mp3Url: results[1] };
  }

  const modules = await Promise.all([
    import('./firebase-config.js'),
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js')
  ]);
  const firebase = modules[0];
  const storageModule = modules[1];
  const sidecarRef = firebase.ref(firebase.storage, lerntexteContinuousManifestPath);
  const sidecarUrl = await firebase.getDownloadURL(sidecarRef);
  lerntexteAudioSessionPruefen(sessionId);
  const response = await fetch(sidecarUrl, signal ? { signal: signal } : undefined);
  lerntexteAudioSessionPruefen(sessionId);
  if (!response.ok) throw new Error('Recht-Bundle-Sidecar konnte nicht geladen werden.');
  const manifestText = await response.text();
  const manifestHash = await lerntextePilotHash(manifestText);
  lerntexteAudioSessionPruefen(sessionId);
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    throw new Error('Recht-Bundle-Sidecar ist kein gültiges JSON.');
  }
  const mp3Ref = firebase.ref(firebase.storage, manifest.mp3Path);
  const results = await Promise.all([
    storageModule.getMetadata(mp3Ref),
    firebase.getDownloadURL(mp3Ref)
  ]);
  lerntexteAudioSessionPruefen(sessionId);
  return { manifest: manifest, manifestHash: manifestHash, mp3Metadata: results[0], mp3Url: results[1] };
}

async function lerntexteContinuousAktuelleEintraege(sessionId) {
  const entries = await Promise.all(lerntexteDaten.map(async function (entry, index) {
    const paths = lerntextePodcastPfade(entry.fach, entry);
    const lerntextHash = await lerntextePilotHash(lerntextePilotTextFuerEintrag(entry));
    return {
      index: index,
      titel: String(entry.titel || ''),
      hauptkapitel: String(entry.hauptkapitel || ''),
      hauptkapitelNr: String(entry.hauptkapitelNr || ''),
      unterkapitelNr: String(entry.unterkapitelNr || ''),
      lerntextHash: lerntextHash,
      legacyMp3Path: paths.mp3Path,
      legacyJsonPath: paths.jsonPath
    };
  }));
  lerntexteAudioSessionPruefen(sessionId);
  return entries;
}

async function lerntexteContinuousAssetsValidieren(assets, sessionId) {
  const validator = lerntexteContinuousHelper('validateRechtBundle');
  if (!validator) return { valid: false, reason: 'Recht-Bundle-Prüfung fehlt.' };
  const currentEntries = await lerntexteContinuousAktuelleEintraege(sessionId);
  const result = validator({
    manifest: assets.manifest,
    manifestHash: assets.manifestHash,
    mp3Metadata: assets.mp3Metadata,
    currentEntries: currentEntries
  });
  return result && typeof result === 'object' ? result : { valid: false, reason: 'Recht-Bundle-Prüfung ist ungültig.' };
}

function lerntextePilotHashValidator() {
  if (typeof window !== 'undefined' && typeof window.lerntexteAudioVersionIstSynchron === 'function') {
    return window.lerntexteAudioVersionIstSynchron;
  }

  if (typeof require === 'function') {
    try {
      const validatorModule = require('./podcast-hash-validate.js');
      if (validatorModule && typeof validatorModule.lerntexteAudioVersionIstSynchron === 'function') {
        return validatorModule.lerntexteAudioVersionIstSynchron;
      }
    } catch (error) {
      // Fallback below.
    }
  }

  return function (currentHash, jsonHash, mp3Hash) {
    const hashes = [currentHash, jsonHash, mp3Hash];
    return hashes.every(function (hash) {
      return typeof hash === 'string' && hash.length > 0 && /\S/.test(hash);
    }) && currentHash === jsonHash && jsonHash === mp3Hash;
  };
}

async function lerntextePilotAssetValidieren(eintrag, manifest, mp3Metadata, sessionId) {
  if (!eintrag || !lerntexteIstPilotEinheit(eintrag.fach, eintrag.titel)) {
    return { valid: false, reason: 'Nicht-Pilot-Einheit' };
  }

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, reason: 'Podcast muss aktualisiert werden.' };
  }

  if (typeof manifest.lerntextHash !== 'string' || !manifest.lerntextHash.trim()) {
    return { valid: false, reason: 'Podcast muss aktualisiert werden.' };
  }

  const paths = lerntextePodcastPfade(eintrag.fach, eintrag);
  if (typeof manifest.mp3Path !== 'string' || manifest.mp3Path !== paths.mp3Path) {
    return { valid: false, reason: 'Podcast muss aktualisiert werden.' };
  }

  if (typeof manifest.jsonPath !== 'string' || manifest.jsonPath !== paths.jsonPath) {
    return { valid: false, reason: 'Podcast muss aktualisiert werden.' };
  }

  if (!Array.isArray(manifest.wortZeitmarken)) {
    return { valid: false, reason: 'Podcast muss aktualisiert werden.' };
  }

  const currentHash = await lerntextePilotHash(lerntextePilotTextFuerEintrag(eintrag));
  lerntexteAudioSessionPruefen(sessionId);
  if (!mp3Metadata || !mp3Metadata.customMetadata || typeof mp3Metadata.customMetadata.lerntextHash !== 'string') {
    return { valid: false, reason: 'Podcast muss aktualisiert werden.' };
  }

  const hashValidator = lerntextePilotHashValidator();
  if (!hashValidator(currentHash, manifest.lerntextHash, mp3Metadata.customMetadata.lerntextHash)) {
    return { valid: false, reason: 'Podcast muss aktualisiert werden.' };
  }

  return { valid: true, reason: '', currentHash: currentHash };
}

async function lerntextePilotAudioStartenValidiert(eintrag, manifest, mp3Metadata, resumeState, validation, usageTicket = window.WifaUsage?.captureTicket(), options) {
  options = options || {};
  const sessionId = typeof options.sessionId === 'number' ? options.sessionId : lerntexteAudioSessionId;
  lerntexteAudioSessionPruefen(sessionId);
  if (!validation.valid) {
    lerntextePilotStatus(validation.reason || 'Podcast muss aktualisiert werden.');
    return false;
  }

  const audioElement = typeof document !== 'undefined' && document.getElementById ? document.getElementById('lerntexteAudioPlayer') : null;
  if (!audioElement) {
    lerntextePilotStatus('Podcast muss aktualisiert werden.');
    return false;
  }

  const progress = Object.prototype.hasOwnProperty.call(options, 'progress')
    ? options.progress
    : await lerntextePilotProgressLaden(eintrag, validation.currentHash, sessionId);
  lerntexteAudioSessionPruefen(sessionId);
  const textRoot = options.textRoot || lerntextePilotTextRoot;
  lerntextePilotKaraokeAufraeumen(sessionId);
  lerntextePilotEntry = eintrag;
  lerntextePilotCurrentHash = validation.currentHash;
  lerntextePilotUid = progress.uid;
  lerntextePilotResumeState = progress.resumeState;
  lerntextePilotCompletedState = progress.completedState;
  lerntextePilotLastValidWordIndex = 0;

  let startPosition = null;
  if (typeof options.startPosition === 'number' && isFinite(options.startPosition) && options.startPosition >= 0) {
    startPosition = options.startPosition;
  } else if (resumeState && resumeState.lerntextHash === validation.currentHash && resumeState.completed !== true) {
    const explicitPosition = Number(resumeState.sekundenPosition);
    if (isFinite(explicitPosition) && explicitPosition >= 0) startPosition = explicitPosition;
  } else if (progress.resumeState) {
    const savedPosition = Number(progress.resumeState.sekundenPosition);
    if (isFinite(savedPosition) && savedPosition >= 0) startPosition = savedPosition;
  }

  lerntexteAudioAktiv = true;
  lerntexteAudioPausiert = false;
  lerntexteAudioFehler = false;
  lerntexteAudioLaedt = false;
  lerntexteAudioQuelle = 'firebase';
  lerntextePilotKaraokeEinrichten(audioElement, manifest, textRoot, usageTicket, sessionId, startPosition);
  lerntextePilotButtonsVerdrahten();

  if (typeof options.mp3Url === 'string' && options.mp3Url) {
    audioElement.src = options.mp3Url;
    if (typeof audioElement.load === 'function') audioElement.load();
  }
  lerntexteAudioSessionPruefen(sessionId);
  if (lerntexteAudioFehler) return false;
  if (startPosition !== null) {
    try {
      audioElement.currentTime = startPosition;
    } catch (error) {
      // loadedmetadata aktualisiert die gewünschte Position bei Bedarf erneut.
    }
    lerntexteAudioLetztePosition = startPosition;
  } else {
    lerntexteAudioLetztePosition = 0;
  }
  resyncPilotHighlight(audioElement.currentTime);
  lerntexteAudioProgressVomPlayer(audioElement);
  lerntexteAudioSteuerungAktualisieren();

  if (typeof audioElement.play === 'function') {
    window.WifaAnalytics?.audio(audioElement, eintrag.fach, eintrag.titel);
    window.WifaUsage?.audio(audioElement, eintrag.fach, eintrag.titel, usageTicket);
    try {
      await audioElement.play();
      lerntexteAudioSessionPruefen(sessionId);
      if (lerntexteAudioFehler) return false;
      lerntextePilotStatus('Audio läuft: ' + (lerntexteAudioPlaylistIndex + 1) + ' von ' + lerntexteAudioPlaylist.length + ' – ' + (eintrag.titel || 'Lerneinheit'));
      return true;
    } catch (error) {
      if (!lerntexteAudioSessionIstAktuell(sessionId)) return false;
      window.WifaAnalytics?.audioError(eintrag.fach, eintrag.titel, error?.name);
      lerntextePilotStatus('Podcast konnte nicht gestartet werden. Kapitel erneut laden oder wechseln.');
      lerntexteAudioPrefetchVerwerfen();
      lerntexteAudioFehler = true;
      lerntexteAudioAktiv = false;
      lerntexteAudioSteuerungAktualisieren();
      lerntexteAudioMediaSessionAktualisieren();
      return false;
    }
  }

  return true;
}

async function lerntextePilotAudioStarten(eintrag, manifest, mp3Metadata, resumeState) {
  const usageTicket = window.WifaUsage?.captureTicket();
  const sessionId = lerntexteAudioSessionId;
  const validation = await lerntextePilotAssetValidieren(eintrag, manifest, mp3Metadata, sessionId);
  lerntexteAudioSessionPruefen(sessionId);
  return lerntextePilotAudioStartenValidiert(eintrag, manifest, mp3Metadata, resumeState, validation, usageTicket);
}

function lerntextePilotKaraokeAufraeumen(expectedSessionId) {
  if (typeof expectedSessionId === 'number' && !lerntexteAudioSessionIstAktuell(expectedSessionId)) return false;
  if (typeof lerntextePilotKaraokeCleanup === 'function') {
    lerntextePilotKaraokeCleanup();
  }

  lerntextePilotKaraokeCleanup = null;
  lerntextePilotTextRoot = null;
  lerntextePilotManifestState = null;
  lerntextePilotAudio = null;
  lerntexteContinuousState = null;
  lerntextePilotUid = null;
  lerntextePilotCurrentHash = "";
  lerntextePilotEntry = null;
  lerntextePilotResumeState = null;
  lerntextePilotCompletedState = null;
  lerntextePilotLastValidWordIndex = 0;
  const resumeButton = lerntexteElement('lerntextePilotResumeBtn');
  const restartButton = lerntexteElement('lerntextePilotRestartBtn');
  if (resumeButton) {
    resumeButton.hidden = true;
    resumeButton.onclick = null;
  }
  if (restartButton) {
    restartButton.hidden = true;
    restartButton.onclick = null;
  }
  return true;
}

async function lerntextePilotNatürlichBeenden(usageTicket, sessionId) {
  if (!lerntexteAudioSessionIstAktuell(sessionId)) return false;
  lerntexteAudioLetztePosition = Number(lerntextePilotAudio && lerntextePilotAudio.currentTime) || lerntexteAudioLetztePosition;
  lerntextePilotProgressSpeichern(true, { sessionId: sessionId, showError: false }).catch(function () {});
  lerntexteAudioAktiv = false;
  lerntexteAudioPausiert = false;
  lerntexteAudioFehler = false;
  const nextIndex = lerntexteAudioPlaylistIndex + 1;
  lerntextePilotKaraokeAufraeumen(sessionId);
  if (nextIndex >= lerntexteAudioPlaylist.length) {
    lerntexteAudioPrefetchVerwerfen();
    lerntexteAudioProgressSet(100, lerntexteAudioZeitFormat(lerntexteAudioLetztePosition) + ' / ' + lerntexteAudioZeitFormat(lerntexteAudioLetztePosition));
    lerntextePilotStatus('Alle Lerneinheiten wurden abgespielt.');
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioKapitelsteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
    return true;
  }
  return lerntexteAudioKapitelLaden(nextIndex, { usageTicket: usageTicket, saveCurrent: false, usePrefetch: true });
}

function lerntextePilotKaraokeEinrichten(audio, manifest, textRoot, usageTicket = window.WifaUsage?.captureTicket(), sessionId = lerntexteAudioSessionId, initialPosition) {
  lerntextePilotAudio = audio;
  lerntextePilotManifestState = manifest;
  lerntextePilotTextRoot = textRoot;
  let endedHandled = false;
  let mediaErrorHandled = false;
  let pendingStartPosition = typeof initialPosition === 'number' && isFinite(initialPosition) && initialPosition >= 0
    ? initialPosition
    : null;

  const resync = function (time) {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    resyncPilotHighlight(time, textRoot, manifest);
  };
  const timeupdateHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    if (typeof audio.currentTime === 'number' && isFinite(audio.currentTime)) {
      lerntexteAudioLetztePosition = Math.max(0, audio.currentTime);
    }
    resync(audio.currentTime);
    lerntexteAudioProgressVomPlayer(audio);
  };
  const seekedHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    resync(audio.currentTime);
    lerntexteAudioProgressVomPlayer(audio);
  };
  const metadataHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    if (pendingStartPosition !== null) {
      try {
        audio.currentTime = pendingStartPosition;
        lerntexteAudioLetztePosition = pendingStartPosition;
        pendingStartPosition = null;
      } catch (error) {
        // Browser kann die Position erst mit weiteren Metadaten akzeptieren.
      }
    }
    lerntexteAudioProgressVomPlayer(audio);
  };
  const waitingHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId) || lerntexteAudioFehler) return;
    lerntextePilotStatus('Podcast wird geladen …');
  };
  const stalledHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId) || mediaErrorHandled) return;
    lerntextePilotStatus('Podcast lädt ungewöhnlich lange. Kapitel erneut laden oder wechseln.');
    lerntexteAudioKapitelsteuerungAktualisieren();
  };
  const playingHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    lerntexteAudioFehler = false;
    lerntexteAudioAktiv = true;
    lerntexteAudioPausiert = false;
    lerntexteAudioLaedt = false;
    const item = lerntexteAudioPlaylist[lerntexteAudioPlaylistIndex];
    lerntextePilotStatus('Audio läuft: ' + (lerntexteAudioPlaylistIndex + 1) + ' von ' + lerntexteAudioPlaylist.length + ' – ' + (item && item.titel || 'Lerneinheit'));
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
    lerntexteAudioNaechstesKapitelVorbereiten(sessionId);
  };
  const errorHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId) || mediaErrorHandled) return;
    mediaErrorHandled = true;
    if (typeof audio.currentTime === 'number' && isFinite(audio.currentTime)) {
      lerntexteAudioLetztePosition = Math.max(0, audio.currentTime);
    }
    lerntexteAudioPrefetchVerwerfen();
    lerntexteAudioFehler = true;
    lerntexteAudioAktiv = false;
    lerntexteAudioPausiert = false;
    lerntexteAudioLaedt = false;
    const mediaCode = audio.error && audio.error.code ? 'media_' + audio.error.code : 'media_error';
    window.WifaAnalytics?.audioError(lerntextePilotEntry && lerntextePilotEntry.fach, lerntextePilotEntry && lerntextePilotEntry.titel, mediaCode);
    lerntextePilotStatus('Podcast-Mediafehler. Kapitel erneut laden oder wechseln.');
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
  };
  const endedHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId) || endedHandled) return;
    endedHandled = true;
    lerntextePilotNatürlichBeenden(usageTicket, sessionId).catch(function (error) {
      if (lerntexteAudioSessionIstAktuell(sessionId) && !lerntexteAudioIstVeralteterFehler(error)) {
        lerntextePilotStatus('Podcast konnte nicht abgeschlossen werden. Kapitel erneut laden oder wechseln.');
      }
    });
  };

  audio.addEventListener('timeupdate', timeupdateHandler);
  audio.addEventListener('seeked', seekedHandler);
  audio.addEventListener('loadedmetadata', metadataHandler);
  audio.addEventListener('durationchange', metadataHandler);
  audio.addEventListener('waiting', waitingHandler);
  audio.addEventListener('stalled', stalledHandler);
  audio.addEventListener('playing', playingHandler);
  audio.addEventListener('error', errorHandler);
  audio.addEventListener('ended', endedHandler);

  const visibilityCleanup = typeof window !== 'undefined' && typeof window.setupVisibilitySyncHandlers === 'function'
    ? window.setupVisibilitySyncHandlers(audio, resync)
    : function () {};

  lerntextePilotKaraokeCleanup = function () {
    audio.removeEventListener('timeupdate', timeupdateHandler);
    audio.removeEventListener('seeked', seekedHandler);
    audio.removeEventListener('loadedmetadata', metadataHandler);
    audio.removeEventListener('durationchange', metadataHandler);
    audio.removeEventListener('waiting', waitingHandler);
    audio.removeEventListener('stalled', stalledHandler);
    audio.removeEventListener('playing', playingHandler);
    audio.removeEventListener('error', errorHandler);
    audio.removeEventListener('ended', endedHandler);
    visibilityCleanup();
  };

  resync(audio.currentTime);
}

function lerntexteContinuousHighlightLoeschen(textRoot) {
  if (!textRoot || !textRoot.querySelectorAll) return;
  textRoot.querySelectorAll('[data-word-index]').forEach(function (element) {
    element.classList.remove('podcast-word-spoken');
    element.classList.remove('podcast-word-active');
  });
}

function lerntexteContinuousFortschrittState(index, localTime, completed) {
  if (!lerntexteContinuousState || !lerntexteContinuousState.manifest) return null;
  const chapter = lerntexteContinuousState.manifest.chapters[index];
  const item = lerntexteAudioPlaylist[index];
  if (!chapter || !item || !item.eintrag) return null;
  const duration = Math.max(0, Number(chapter.end) - Number(chapter.start));
  const position = Math.max(0, Math.min(duration, Number(localTime) || 0));
  const marks = Array.isArray(chapter.wortZeitmarken) ? chapter.wortZeitmarken : [];
  const finalWordIndex = marks.length ? Number(marks[marks.length - 1].wortIndex) || 0 : 0;
  return {
    nutzer: lerntextePilotUid,
    fach: 'Recht',
    einheit: item.eintrag.titel || '',
    firebasePfad: chapter.legacyMp3Path,
    lerntextHash: chapter.lerntextHash,
    sekundenPosition: position,
    wortIndex: completed === true ? finalWordIndex : Math.max(0, Number(lerntextePilotLastValidWordIndex) || 0),
    completed: completed === true
  };
}

function lerntexteContinuousFortschrittSpeichern(index, localTime, completed) {
  const state = lerntexteContinuousFortschrittState(index, localTime, completed);
  if (!state || !state.nutzer) return Promise.resolve(false);
  return lerntextePilotFortschrittSpeichern(state).then(function () { return true; }).catch(function () { return false; });
}

function lerntexteContinuousAnsichtSynchronisieren(entry) {
  if (!entry) return;
  const mainChapter = String(entry.hauptkapitelNr || '');
  if (lerntexteAktuellesKapitel && lerntexteAktuellesKapitel !== mainChapter) {
    lerntexteAktuellesKapitel = mainChapter;
    const select = lerntexteElement('lerntexteKapitelSelect');
    if (select) select.value = mainChapter;
    lerntexteInhaltRendern(undefined, { trackUsage: false });
  }
}

function lerntexteContinuousKapitelAktivieren(index) {
  if (!lerntexteContinuousState || !lerntexteContinuousState.manifest) return false;
  const chapter = lerntexteContinuousState.manifest.chapters[index];
  const item = lerntexteAudioPlaylist[index];
  if (!chapter || !item || !item.eintrag) return false;

  const previousRoot = lerntextePilotTextRoot;
  if (lerntexteContinuousState.chapterIndex !== index) {
    lerntexteContinuousHighlightLoeschen(previousRoot);
    lerntextePilotLastValidWordIndex = 0;
  }
  lerntexteContinuousState.chapterIndex = index;
  lerntexteAudioPlaylistIndex = index;
  lerntexteContinuousAnsichtSynchronisieren(item.eintrag);
  const key = String(item.eintrag.fach) + '\u0000' + String(item.eintrag.titel);
  item.textRoot = lerntextePilotTextRoots[key] || item.textRoot || null;
  lerntextePilotTextRoot = item.textRoot;
  lerntextePilotManifestState = chapter;
  lerntextePilotEntry = item.eintrag;
  lerntextePilotCurrentHash = chapter.lerntextHash;
  const label = lerntexteElement('lerntexteAudioChapterLabel');
  if (label) label.textContent = item.titel || 'Lerneinheit';
  lerntexteAudioKapitelsteuerungAktualisieren();
  return true;
}

function lerntexteContinuousProgressAktualisieren(audio) {
  if (!lerntexteContinuousState || !audio) return;
  const index = lerntexteContinuousState.chapterIndex;
  const chapter = lerntexteContinuousState.manifest.chapters[index];
  const localTimeFor = lerntexteContinuousHelper('rechtChapterLocalTime');
  if (!chapter || !localTimeFor) return;
  const localTime = localTimeFor(lerntexteContinuousState.manifest, index, Number(audio.currentTime));
  if (localTime === null) return;
  const duration = Math.max(0, Number(chapter.end) - Number(chapter.start));
  const percent = duration > 0 ? (localTime / duration) * 100 : 0;
  lerntexteAudioProgressSet(percent, lerntexteAudioZeitFormat(localTime) + ' / ' + lerntexteAudioZeitFormat(duration));
}

function lerntexteContinuousSynchronisieren(time, options) {
  options = options || {};
  if (!lerntexteContinuousState || !lerntexteContinuousState.manifest) return -1;
  const indexAtTime = lerntexteContinuousHelper('rechtChapterIndexAtTime');
  const localTimeFor = lerntexteContinuousHelper('rechtChapterLocalTime');
  if (!indexAtTime || !localTimeFor) return -1;
  const currentTime = Number(time);
  const nextIndex = indexAtTime(lerntexteContinuousState.manifest, currentTime);
  if (nextIndex < 0) return -1;
  const previousIndex = lerntexteContinuousState.chapterIndex;
  const manual = options.manual === true || lerntexteContinuousState.seeking === true || lerntexteContinuousState.ignoreCompletion === true;
  if (previousIndex >= 0 && nextIndex > previousIndex && !manual) {
    for (let index = previousIndex; index < nextIndex; index += 1) {
      const chapter = lerntexteContinuousState.manifest.chapters[index];
      lerntexteContinuousFortschrittSpeichern(index, Number(chapter.end) - Number(chapter.start), true);
    }
  }
  lerntexteContinuousKapitelAktivieren(nextIndex);
  const localTime = localTimeFor(lerntexteContinuousState.manifest, nextIndex, currentTime);
  resyncPilotHighlight(localTime, lerntextePilotTextRoot, lerntextePilotManifestState);
  lerntexteContinuousProgressAktualisieren(lerntextePilotAudio);
  if (previousIndex !== nextIndex) {
    const item = lerntexteAudioPlaylist[nextIndex];
    lerntextePilotStatus('Audio läuft: ' + (nextIndex + 1) + ' von ' + lerntexteAudioPlaylist.length + ' – ' + (item && item.titel || 'Lerneinheit'));
    lerntexteAudioMediaSessionAktualisieren();
  }
  lerntexteContinuousState.lastTime = currentTime;
  return nextIndex;
}

function lerntexteContinuousIndexRekonstruieren() {
  if (!lerntexteContinuousState || !lerntextePilotAudio) return -1;
  if (typeof lerntexteContinuousState.pendingStartPosition === 'number'
      && isFinite(lerntexteContinuousState.pendingStartPosition)) {
    return lerntexteContinuousState.chapterIndex;
  }
  const indexAtTime = lerntexteContinuousHelper('rechtChapterIndexAtTime');
  const currentTime = Number(lerntextePilotAudio.currentTime);
  if (!indexAtTime || !isFinite(currentTime)) return lerntexteContinuousState.chapterIndex;
  const actualIndex = indexAtTime(lerntexteContinuousState.manifest, currentTime);
  if (actualIndex < 0) return lerntexteContinuousState.chapterIndex;
  if (actualIndex !== lerntexteContinuousState.chapterIndex) {
    return lerntexteContinuousSynchronisieren(currentTime);
  }
  return actualIndex;
}

function lerntexteContinuousKapitelSpringen(targetIndex, localSeconds) {
  if (!lerntexteContinuousState || !lerntextePilotAudio) return Promise.resolve(false);
  const seekTarget = lerntexteContinuousHelper('rechtChapterSeekTarget');
  const target = seekTarget && seekTarget(lerntexteContinuousState.manifest, targetIndex, localSeconds || 0);
  if (target === null || target === undefined) return Promise.resolve(false);

  const reconstructedIndex = lerntexteContinuousIndexRekonstruieren();
  const previousIndex = reconstructedIndex >= 0 ? reconstructedIndex : lerntexteContinuousState.chapterIndex;
  const indexAtTime = lerntexteContinuousHelper('rechtChapterIndexAtTime');
  const destinationIndex = indexAtTime ? indexAtTime(lerntexteContinuousState.manifest, target) : targetIndex;
  if (destinationIndex >= 0 && destinationIndex !== previousIndex && lerntextePilotAudio.ended !== true) {
    const localTimeFor = lerntexteContinuousHelper('rechtChapterLocalTime');
    const previousLocalTime = localTimeFor && localTimeFor(
      lerntexteContinuousState.manifest,
      previousIndex,
      Number(lerntextePilotAudio.currentTime)
    );
    if (previousLocalTime !== null && previousLocalTime !== undefined) {
      lerntexteContinuousFortschrittSpeichern(previousIndex, previousLocalTime, false);
    }
  }

  lerntexteContinuousState.pendingStartPosition = target;
  lerntexteContinuousState.ignoreCompletion = true;
  let appliedImmediately = false;
  try {
    lerntextePilotAudio.currentTime = target;
    appliedImmediately = true;
  } catch (error) {
    const canDeferUntilMetadata = typeof lerntextePilotAudio.readyState !== 'number' || lerntextePilotAudio.readyState < 1;
    if (!canDeferUntilMetadata) {
      lerntexteContinuousState.pendingStartPosition = null;
      lerntexteContinuousState.ignoreCompletion = false;
      return Promise.resolve(false);
    }
  }
  if (appliedImmediately && typeof lerntextePilotAudio.readyState === 'number' && lerntextePilotAudio.readyState >= 1) {
    lerntexteContinuousState.pendingStartPosition = null;
  }
  lerntexteContinuousSynchronisieren(target, { manual: true });
  lerntexteContinuousState.ignoreCompletion = false;
  lerntexteAudioMediaSessionAktualisieren();
  return Promise.resolve(true);
}

function lerntexteContinuousKaraokeEinrichten(audio, usageTicket, sessionId, initialPosition) {
  lerntextePilotAudio = audio;
  let endedHandled = false;
  let mediaErrorHandled = false;
  if (lerntexteContinuousState) {
    lerntexteContinuousState.pendingStartPosition = typeof initialPosition === 'number' && isFinite(initialPosition) && initialPosition >= 0
      ? initialPosition
      : null;
  }

  const resync = function (time, options) {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    lerntexteContinuousSynchronisieren(time, options);
  };
  const timeupdateHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    if (typeof audio.currentTime === 'number' && isFinite(audio.currentTime)) {
      lerntexteAudioLetztePosition = Math.max(0, audio.currentTime);
    }
    resync(audio.currentTime);
  };
  const seekingHandler = function () {
    if (lerntexteContinuousState) lerntexteContinuousState.seeking = true;
  };
  const seekedHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    resync(audio.currentTime, { manual: true });
    if (lerntexteContinuousState) {
      lerntexteContinuousState.pendingStartPosition = null;
      lerntexteContinuousState.seeking = false;
      lerntexteContinuousState.ignoreCompletion = false;
    }
    lerntexteAudioMediaSessionAktualisieren();
  };
  const metadataHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    const pendingStartPosition = lerntexteContinuousState
      && typeof lerntexteContinuousState.pendingStartPosition === 'number'
      && isFinite(lerntexteContinuousState.pendingStartPosition)
      ? lerntexteContinuousState.pendingStartPosition
      : null;
    if (pendingStartPosition !== null) {
      try {
        audio.currentTime = pendingStartPosition;
        lerntexteAudioLetztePosition = pendingStartPosition;
        if (lerntexteContinuousState) lerntexteContinuousState.pendingStartPosition = null;
      } catch (error) {
        // Browser akzeptiert den Seek spätestens beim nächsten Metadatenereignis.
      }
    }
    resync(audio.currentTime, { manual: true });
  };
  const waitingHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId) || lerntexteAudioFehler) return;
    lerntextePilotStatus('Podcast wird geladen …');
  };
  const stalledHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId) || mediaErrorHandled) return;
    lerntextePilotStatus('Podcast lädt ungewöhnlich lange. Kapitel erneut laden oder wechseln.');
  };
  const playingHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    endedHandled = false;
    lerntexteAudioFehler = false;
    lerntexteAudioAktiv = true;
    lerntexteAudioPausiert = false;
    lerntexteAudioLaedt = false;
    if (lerntexteContinuousState) {
      lerntexteContinuousState.pendingStartPosition = null;
      lerntexteContinuousState.ignoreCompletion = false;
    }
    const item = lerntexteAudioPlaylist[lerntexteAudioPlaylistIndex];
    lerntextePilotStatus('Audio läuft: ' + (lerntexteAudioPlaylistIndex + 1) + ' von ' + lerntexteAudioPlaylist.length + ' – ' + (item && item.titel || 'Lerneinheit'));
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
  };
  const errorHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId) || mediaErrorHandled) return;
    mediaErrorHandled = true;
    lerntexteContinuousFallbackAktiv = true;
    lerntexteAudioFehler = true;
    lerntexteAudioAktiv = false;
    lerntexteAudioPausiert = false;
    lerntexteAudioLaedt = false;
    const mediaCode = audio.error && audio.error.code ? 'bundle_media_' + audio.error.code : 'bundle_media_error';
    window.WifaAnalytics?.audioError('Recht', lerntextePilotEntry && lerntextePilotEntry.titel, mediaCode);
    lerntextePilotStatus('Recht-Podcast-Mediafehler. Kapitel erneut laden oder wechseln.');
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
  };
  const endedHandler = function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId) || endedHandled) return;
    endedHandled = true;
    if (lerntexteContinuousState && lerntexteContinuousState.manifest) {
      lerntexteContinuousSynchronisieren(Number(lerntexteContinuousState.manifest.duration));
    }
    const index = lerntexteContinuousState ? lerntexteContinuousState.chapterIndex : lerntexteAudioPlaylistIndex;
    const chapter = lerntexteContinuousState && lerntexteContinuousState.manifest.chapters[index];
    if (chapter) lerntexteContinuousFortschrittSpeichern(index, Number(chapter.end) - Number(chapter.start), true);
    lerntexteAudioAktiv = false;
    lerntexteAudioPausiert = false;
    lerntexteAudioFehler = false;
    lerntexteAudioProgressSet(100, chapter ? lerntexteAudioZeitFormat(Number(chapter.end) - Number(chapter.start)) + ' / ' + lerntexteAudioZeitFormat(Number(chapter.end) - Number(chapter.start)) : '0:00 / 0:00');
    lerntextePilotStatus('Alle Lerneinheiten wurden abgespielt.');
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
  };

  audio.addEventListener('timeupdate', timeupdateHandler);
  audio.addEventListener('seeking', seekingHandler);
  audio.addEventListener('seeked', seekedHandler);
  audio.addEventListener('loadedmetadata', metadataHandler);
  audio.addEventListener('durationchange', metadataHandler);
  audio.addEventListener('waiting', waitingHandler);
  audio.addEventListener('stalled', stalledHandler);
  audio.addEventListener('playing', playingHandler);
  audio.addEventListener('error', errorHandler);
  audio.addEventListener('ended', endedHandler);
  const visibilityCleanup = typeof window !== 'undefined' && typeof window.setupVisibilitySyncHandlers === 'function'
    ? window.setupVisibilitySyncHandlers(audio, function (time) { resync(time); })
    : function () {};

  lerntextePilotKaraokeCleanup = function () {
    audio.removeEventListener('timeupdate', timeupdateHandler);
    audio.removeEventListener('seeking', seekingHandler);
    audio.removeEventListener('seeked', seekedHandler);
    audio.removeEventListener('loadedmetadata', metadataHandler);
    audio.removeEventListener('durationchange', metadataHandler);
    audio.removeEventListener('waiting', waitingHandler);
    audio.removeEventListener('stalled', stalledHandler);
    audio.removeEventListener('playing', playingHandler);
    audio.removeEventListener('error', errorHandler);
    audio.removeEventListener('ended', endedHandler);
    visibilityCleanup();
  };
  resync(audio.currentTime, { manual: true });
}

function resyncPilotHighlight(time, textRoot, manifest) {
  textRoot = textRoot || lerntextePilotTextRoot;
  manifest = manifest || lerntextePilotManifestState;
  if (!textRoot || !manifest || !Array.isArray(manifest.wortZeitmarken)) {
    return -1;
  }

  if (typeof window !== 'undefined' && typeof window.findWordIndexAtTime === 'function') {
    const currentTime = Number(time);
    const index = window.findWordIndexAtTime(manifest.wortZeitmarken, currentTime);
    const elements = textRoot.querySelectorAll ? textRoot.querySelectorAll('[data-word-index]') : [];
    elements.forEach(function (element) {
      element.classList.remove('podcast-word-spoken');
      element.classList.remove('podcast-word-active');
    });

    let reachedIndex = -1;
    manifest.wortZeitmarken.forEach(function (mark) {
      if (mark && typeof mark.wortIndex === 'number' && Number(mark.start) <= currentTime) {
        reachedIndex = Math.max(reachedIndex, mark.wortIndex);
      }
    });

    if (reachedIndex >= 0) {
      elements.forEach(function (element) {
        if (Number(element.getAttribute('data-word-index')) <= reachedIndex) {
          element.classList.add('podcast-word-spoken');
        }
      });
      lerntextePilotLastValidWordIndex = reachedIndex;
    }

    if (index >= 0) {
      const activeWord = textRoot.querySelector ? textRoot.querySelector('[data-word-index="' + String(index) + '"]') : null;
      if (activeWord) {
        activeWord.classList.add('podcast-word-active');
      }
      return index;
    }

    return -1;
  }

  return -1;
}

async function lerntextePilotFortschrittLaden(uid, entryOverride) {
  if (typeof uid !== 'string' || !uid.trim()) {
    throw new Error('Nutzer ist für Podcast-Fortschritt erforderlich.');
  }

  if (typeof window !== 'undefined' && typeof window.lerntextePodcastFortschrittLaden === 'function') {
    const entry = entryOverride || lerntextePilotEntry;
    const fach = entry && entry.fach || lerntexteAktuellesFach;
    const result = await window.lerntextePodcastFortschrittLaden(uid, fach);
    const currentPath = lerntextePodcastPfade(fach, entry).mp3Path;
    if (Array.isArray(result)) {
      return result.filter(function (entry) {
        return entry && entry.firebasePfad === currentPath;
      });
    }
    if (!result || !Array.isArray(result.data)) {
      return [];
    }
    return result.data.filter(function (entry) {
      return entry && entry.firebasePfad === currentPath;
    });
  }

  return [];
}

async function lerntextePilotFortschrittSpeichern(state) {
  if (typeof window !== 'undefined' && typeof window.lerntextePodcastFortschrittSpeichern === 'function') {
    return window.lerntextePodcastFortschrittSpeichern(state);
  }

  return state;
}

function lerntextePilotUidErmitteln() {
  const uid = typeof window !== 'undefined' ? window.aktuellerNutzer : null;
  return typeof uid === 'string' && uid.trim() ? uid.trim() : null;
}

async function lerntextePilotProgressLaden(eintrag, currentHash, sessionId, options) {
  options = options || {};
  const uid = lerntextePilotUidErmitteln();
  const resultState = { uid: uid, resumeState: null, completedState: null };
  if (!uid) return resultState;

  try {
    const result = await lerntextePilotFortschrittLaden(uid, eintrag);
    lerntexteAudioSessionPruefen(sessionId);
    const entries = Array.isArray(result)
      ? result
      : result && Array.isArray(result.data)
        ? result.data
        : [];
    const matchingEntries = entries.filter(function (entry) {
      return entry
        && entry.nutzer === uid
        && entry.fach === eintrag.fach
        && entry.einheit === eintrag.titel
        && entry.firebasePfad === lerntextePodcastPfade(eintrag.fach, eintrag).mp3Path
        && entry.lerntextHash === currentHash;
    });
    matchingEntries.forEach(function (entry) {
      if (entry.completed === true) {
        resultState.completedState = entry;
      } else if (entry.completed === false) {
        const position = Number(entry.sekundenPosition);
        if (isFinite(position) && position >= 0) {
          resultState.resumeState = entry;
        }
      }
    });
  } catch (error) {
    if (lerntexteAudioIstVeralteterFehler(error)) throw error;
    if (!options.silent && (typeof sessionId !== 'number' || lerntexteAudioSessionIstAktuell(sessionId))) {
      lerntextePilotStatus('Podcast-Fortschritt konnte nicht geladen werden. Wiedergabe startet von vorne.');
    }
  }
  return resultState;
}

function lerntextePilotSaveState(completed) {
  const audio = lerntextePilotAudio;
  if (lerntexteContinuousState && audio) {
    const indexAtTime = lerntexteContinuousHelper('rechtChapterIndexAtTime');
    const localTimeFor = lerntexteContinuousHelper('rechtChapterLocalTime');
    const absoluteTime = typeof audio.currentTime === 'number' && isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0;
    const derivedIndex = indexAtTime ? indexAtTime(lerntexteContinuousState.manifest, absoluteTime) : -1;
    const index = derivedIndex >= 0 ? derivedIndex : lerntexteContinuousState.chapterIndex;
    if (index !== lerntexteContinuousState.chapterIndex) lerntexteContinuousKapitelAktivieren(index);
    const localTime = localTimeFor ? localTimeFor(lerntexteContinuousState.manifest, index, absoluteTime) : 0;
    return lerntexteContinuousFortschrittState(index, localTime, completed);
  }
  const position = audio && typeof audio.currentTime === 'number' && isFinite(audio.currentTime)
    ? Math.max(0, audio.currentTime)
    : 0;
  return {
    nutzer: lerntextePilotUid,
    fach: lerntextePilotEntry && lerntextePilotEntry.fach || lerntexteAktuellesFach,
    einheit: lerntextePilotEntry && lerntextePilotEntry.titel || "",
    firebasePfad: lerntextePodcastPfade(lerntextePilotEntry && lerntextePilotEntry.fach || lerntexteAktuellesFach, lerntextePilotEntry).mp3Path,
    lerntextHash: lerntextePilotCurrentHash,
    sekundenPosition: position,
    wortIndex: Math.max(0, Number(lerntextePilotLastValidWordIndex) || 0),
    completed: completed === true
  };
}

async function lerntextePilotProgressSpeichern(completed, options) {
  options = options || {};
  if (!lerntextePilotUid || !lerntextePilotAudio) return false;
  const state = lerntextePilotSaveState(completed);
  const sessionId = typeof options.sessionId === 'number' ? options.sessionId : lerntexteAudioSessionId;
  try {
    await lerntextePilotFortschrittSpeichern(state);
    return true;
  } catch (error) {
    if (options.showError !== false && lerntexteAudioSessionIstAktuell(sessionId)) {
      lerntextePilotStatus('Podcast-Fortschritt konnte nicht gespeichert werden.');
    }
    return false;
  }
}

async function lerntextePilotFortsetzen() {
  if (!lerntextePilotAudio) return;
  const sessionId = lerntexteAudioSessionId;
  if (lerntexteContinuousState) lerntexteContinuousSynchronisieren(lerntextePilotAudio.currentTime, { manual: true });
  else resyncPilotHighlight(lerntextePilotAudio.currentTime);
  lerntexteAudioAktiv = true;
  lerntexteAudioPausiert = false;
  lerntexteAudioFehler = false;
  lerntexteAudioSteuerungAktualisieren();
  try {
    await lerntextePilotAudio.play();
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    lerntextePilotStatus('Audio läuft.');
    lerntexteAudioMediaSessionAktualisieren();
  } catch (error) {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    lerntexteAudioPrefetchVerwerfen();
    lerntexteAudioFehler = true;
    lerntexteAudioAktiv = false;
    lerntextePilotStatus('Podcast konnte nicht fortgesetzt werden. Kapitel erneut laden oder wechseln.');
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
  }
}

async function lerntextePilotVonVorne() {
  if (!lerntextePilotAudio) return;
  const sessionId = lerntexteAudioSessionId;
  lerntexteAudioPrefetchVerwerfen();
  window.WifaAnalytics?.restartAudio(lerntextePilotAudio);
  window.WifaUsage?.restartAudio(lerntextePilotAudio);
  if (lerntexteContinuousState) {
    const currentIndex = lerntexteContinuousIndexRekonstruieren();
    await lerntexteContinuousKapitelSpringen(currentIndex, 0);
    lerntexteAudioLetztePosition = Number(lerntextePilotAudio.currentTime) || 0;
  } else {
    lerntextePodcastVonVorne(lerntextePilotAudio);
    lerntexteAudioLetztePosition = 0;
    resyncPilotHighlight(lerntextePilotAudio.currentTime);
  }
  lerntexteAudioProgressVomPlayer(lerntextePilotAudio);
  lerntexteAudioAktiv = true;
  lerntexteAudioPausiert = false;
  lerntexteAudioFehler = false;
  lerntexteAudioSteuerungAktualisieren();
  try {
    await lerntextePilotAudio.play();
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    lerntextePilotStatus('Audio läuft.');
    lerntexteAudioMediaSessionAktualisieren();
  } catch (error) {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    lerntexteAudioPrefetchVerwerfen();
    lerntexteAudioFehler = true;
    lerntexteAudioAktiv = false;
    lerntextePilotStatus('Podcast konnte nicht gestartet werden. Kapitel erneut laden oder wechseln.');
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
  }
}

function lerntextePilotPausieren() {
  if (!lerntextePilotAudio) return;
  lerntextePilotAudio.pause();
  if (typeof lerntextePilotAudio.currentTime === 'number' && isFinite(lerntextePilotAudio.currentTime)) {
    lerntexteAudioLetztePosition = Math.max(0, lerntextePilotAudio.currentTime);
  }
  lerntexteAudioAktiv = true;
  lerntexteAudioPausiert = true;
  lerntexteAudioSteuerungAktualisieren();
  lerntexteElement('lerntexteAudioStatus').textContent = 'Audio pausiert.';
  lerntexteAudioMediaSessionAktualisieren();
  return lerntextePilotProgressSpeichern(false, { sessionId: lerntexteAudioSessionId, showError: true });
}

function lerntextePilotStoppen() {
  if (!lerntextePilotAudio) return;
  const sessionId = lerntexteAudioSessionId;
  lerntexteAudioPrefetchVerwerfen();
  lerntextePodcastStoppen(lerntextePilotAudio, function () {
    return lerntextePilotProgressSpeichern(false);
  }, lerntextePilotSaveState(false)).then(function (saved) {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    lerntexteAudioAktiv = false;
    lerntexteAudioPausiert = false;
    if (saved !== false) {
      lerntexteElement('lerntexteAudioStatus').textContent = 'Audio gestoppt.';
    }
    lerntexteAudioMediaSessionAktualisieren();
  }).catch(function () {
    if (!lerntexteAudioSessionIstAktuell(sessionId)) return;
    lerntexteAudioAktiv = false;
    lerntexteAudioPausiert = false;
    lerntextePilotStatus('Podcast-Fortschritt konnte nicht gespeichert werden.');
    lerntexteAudioMediaSessionAktualisieren();
  });
}

function lerntextePilotButtonsVerdrahten() {
  const pauseButton = lerntexteElement('lerntexteAudioPauseBtn');
  const stopButton = lerntexteElement('lerntexteAudioStopBtn');
  const resumeButton = lerntexteElement('lerntextePilotResumeBtn');
  const restartButton = lerntexteElement('lerntextePilotRestartBtn');
  if (pauseButton) pauseButton.onclick = lerntexteAudioPausieren;
  if (stopButton) stopButton.onclick = lerntexteAudioStoppen;
  if (resumeButton) {
    resumeButton.hidden = !lerntexteAudioPausiert;
    resumeButton.onclick = lerntextePilotFortsetzen;
  }
  if (restartButton) {
    restartButton.hidden = false;
    restartButton.onclick = lerntextePilotVonVorne;
  }
  lerntexteAudioKapitelsteuerungAktualisieren();
}

// Konvertiert einen Wert zu einem sicheren URL-Slug für Podcast-Dateipfade
function lerntexteAudioSlug(wert) {
  const text = String(wert || "").trim().toLowerCase();
  
  // Umlaute und ß ersetzen
  let slug = text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
  
  // Andere Diakritika entfernen (Akzente, etc.)
  slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Alles außer a-z, 0-9 und Bindestriche durch Bindestrich ersetzen
  slug = slug.replace(/[^a-z0-9\-]/g, "-");
  
  // Mehrfache Bindestriche zu einzelnen Bindestrichen zusammenfassen
  slug = slug.replace(/\-{2,}/g, "-");
  
  // Bindestriche am Anfang und Ende entfernen
  slug = slug.replace(/^\-+|\-+$/g, "");
  
  return slug;
}

// Erzeugt Firebase Storage-Pfad: podcast/<fach-slug>-<titel-slug>.mp3
function lerntexteAudioFirebasePfad(fach, eintrag) {
  if (!eintrag || !eintrag.titel) {
    return "";
  }
  
  const fachSlug = lerntexteAudioSlug(fach);
  const titelSlug = lerntexteAudioSlug(eintrag.titel);
  
  return "podcast/" + fachSlug + "-" + titelSlug + ".mp3";
}

function lerntextePodcastPfade(fach, eintrag) {
  const mp3Path = lerntexteAudioFirebasePfad(fach, eintrag);
  return {
    mp3Path: mp3Path,
    jsonPath: mp3Path.replace(/\.mp3$/, ".json")
  };
}

function lerntexteAudioTestKapitelFinden(einheiten) {
  if (lerntexteAktuellesFach !== "Recht") return null;

  const passendeEinheiten = (einheiten || []).filter(function (eintrag) {
    // Prüfe auf hauptkapitel (z.B. "Rechtssubjekte und Rechtsobjekte")
    return String(eintrag && eintrag.titel || "").trim() === "Rechtssubjekte und Rechtsobjekte";
  });

  return passendeEinheiten.length >= 1
    ? passendeEinheiten[0]
    : null;
}

function lerntexteAudioTestKapitelMetadatenSetzen() {
  if (!("mediaSession" in navigator)) return;

  if ("MediaMetadata" in window) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Rechtssubjekte und Rechtsobjekte",
      artist: "Recht",
      album: "WiFa Trainer"
    });
  }
}

async function lerntexteAudioFirebaseUrlLaden(eintrag) {
  if (typeof window !== 'undefined' && window.lerntexteAudioDependencies && typeof window.lerntexteAudioDependencies.loadUrl === 'function') {
    return window.lerntexteAudioDependencies.loadUrl(eintrag);
  }

  try {
    const { storage, ref, getDownloadURL } = await import('./firebase-config.js');
    
    // Verwende generalisierte Pfad-Funktion
    const storagePath = lerntexteAudioFirebasePfad(lerntexteAktuellesFach, eintrag);
    const storageRef = ref(storage, storagePath);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error("Firebase Storage Error:", error.code, error.message, error);
    throw error;
  }
}

function lerntexteAudioTestEreignisseBinden() {
  lerntexteAudioTestAudio.onended = function () {
    lerntexteAudioProgressSet(100, "Audio-Test beendet");
    lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio beendet.";
    if (lerntexteAudioTestKapitelAktiv) {
      lerntexteAudioAktiv = false;
      lerntexteAudioPausiert = false;
      lerntexteAudioSteuerungAktualisieren();
      lerntexteAudioMediaSessionAktualisieren();
    }
  };
  lerntexteAudioTestAudio.ontimeupdate = function () {
    if (!lerntexteAudioTestAudio.duration || !isFinite(lerntexteAudioTestAudio.duration)) return;
    const percent = (lerntexteAudioTestAudio.currentTime / lerntexteAudioTestAudio.duration) * 100;
    const minsCurrent = Math.floor(lerntexteAudioTestAudio.currentTime / 60);
    const secsCurrent = Math.floor(lerntexteAudioTestAudio.currentTime % 60);
    const minsTotal = Math.floor(lerntexteAudioTestAudio.duration / 60);
    const secsTotal = Math.floor(lerntexteAudioTestAudio.duration % 60);
    const timeText = String(minsCurrent).padStart(2, "0") + ":" + String(secsCurrent).padStart(2, "0") + " / " + String(minsTotal).padStart(2, "0") + ":" + String(secsTotal).padStart(2, "0");
    lerntexteAudioProgressSet(percent, timeText);
  };
}

function lerntexteTestAudioQuelleSetzen(url, text, eintrag, istTestKapitel) {
  lerntexteAudioTestCurrentUrl = url;
  lerntexteAudioTestHash = lerntexteAudioHash(text);
  lerntexteAudioTestKapitelAktiv = istTestKapitel;

  const domAudio = document.getElementById("lerntexteAudioPlayer");
  if (istTestKapitel && domAudio) {
    lerntexteAudioTestAudio = domAudio;
    lerntexteAudioTestAudio.preload = "auto";
    lerntexteAudioTestEreignisseBinden();
  } else if (!lerntexteAudioTestAudio || lerntexteAudioTestAudio === domAudio) {
    lerntexteAudioTestAudio = new Audio(url);
    lerntexteAudioTestAudio.preload = "auto";
    lerntexteAudioTestEreignisseBinden();
  }
  lerntexteAudioTestAudio.src = url;

  lerntexteAudioTestAudio.play();
  if (istTestKapitel) lerntexteAudioTestKapitelMetadatenSetzen();
  lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio läuft.";
  lerntexteAudioProgressSet(0, "0:00 / 0:00");
}

function lerntexteElement(id) {
  return document.getElementById(id);
}

function lerntexteAudioTextFuerEintrag(eintrag) {
  return lerntextePilotTextFuerEintrag(eintrag).trim();
}

function lerntexteAudioPlaylistErstellen(einheiten) {
  const playlist = [];
  const liste = Array.isArray(einheiten) ? einheiten : [];

  liste.forEach(function (eintrag) {
    const text = lerntexteAudioTextFuerEintrag(eintrag);
    if (!text) {
      return;
    }

    playlist.push({
      eintrag: eintrag,
      titel: eintrag && eintrag.titel ? String(eintrag.titel) : "Lerneinheit",
      text: text,
      fach: String(eintrag && eintrag.fach || lerntexteAktuellesFach || ""),
      textRoot: lerntextePilotTextRoots[String(eintrag && eintrag.fach || lerntexteAktuellesFach || "") + "\u0000" + String(eintrag && eintrag.titel || "")] || null
    });
  });

  return playlist;
}

function lerntexteAudioHash(text) {
  const source = String(text || "");
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return "audio-test-" + hash.toString(16);
}

async function lerntexteTestAudioStarten() {
  const einheiten = lerntexteAusgewaehlteEinheiten();
  if (!einheiten.length) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Für den Test ist kein Kapitel ausgewählt.";
    return;
  }

  const eintrag = lerntexteAudioTestKapitelFinden(einheiten) || einheiten
    .slice()
    .sort(function (a, b) {
      return String(b.lerntext || "").length - String(a.lerntext || "").length;
    })[0];

  const text = String((eintrag && eintrag.lerntext) || "").trim();
  if (!text) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Für den Test gibt es keinen Podcast-Text.";
    return;
  }

  const testKapitelCandidate = lerntexteAudioTestKapitelFinden(einheiten);
  const istTestKapitel = testKapitelCandidate === eintrag;
  
  if (istTestKapitel) {
    try {
      const firebaseUrl = await lerntexteAudioFirebaseUrlLaden(eintrag);
      lerntexteTestAudioQuelleSetzen(firebaseUrl, text, eintrag, true);
      return;
    } catch (error) {
      const errorMsg = "Firebase Audio konnte nicht geladen werden: " + error.message;
      console.error(errorMsg, error);
      lerntexteElement("lerntexteAudioStatus").textContent = errorMsg;
      return;
    }
  }

  if (lerntexteAudioTestAudio && lerntexteAudioTestHash === lerntexteAudioHash(text)) {
    lerntexteAudioTestKapitelAktiv = lerntexteAudioTestKapitelFinden(einheiten) === eintrag;
    if (lerntexteAudioTestAudio.ended) lerntexteAudioTestAudio.currentTime = 0;
    lerntexteAudioTestAudio.play();
    if (lerntexteAudioTestKapitelAktiv) lerntexteAudioTestKapitelMetadatenSetzen();
    lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio läuft.";
    return;
  }

  const baseUrl = new URL("https://script.google.com/macros/s/AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA/exec");
  baseUrl.searchParams.set("action", "podcastAudioTest");
  baseUrl.searchParams.set("fach", String(lerntexteAktuellesFach || ""));
  baseUrl.searchParams.set("chapter", String(eintrag.hauptkapitelNr || ""));
  baseUrl.searchParams.set("titel", String(eintrag.titel || ""));
  baseUrl.searchParams.set("text", text);

  fetch(baseUrl.toString())
    .then(function (response) {
      if (!response.ok) {
        throw new Error("TTS-Request fehlgeschlagen: " + response.status);
      }
      return response.json();
    })
    .then(function (payload) {
      if (!payload || !payload.success) {
        throw new Error(payload && payload.error ? payload.error : "OpenAI-Response war ungültig.");
      }

      const data = payload.data || {};
      const base64Audio = String(data.audioBase64 || "").trim();
      if (!base64Audio) {
        throw new Error("OpenAI TTS lieferte keine Base64-Audiodaten.");
      }

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "audio/mpeg" });
      if (!blob || blob.size === 0) {
        throw new Error("OpenAI TTS lieferte keine Audio-Daten.");
      }

      const url = URL.createObjectURL(blob);
      lerntexteTestAudioQuelleSetzen(url, text, eintrag, false);
    })
    .catch(function (error) {
      lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio fehlgeschlagen: " + error.message;
    });
}

function lerntexteTestAudioStoppen() {
  if (lerntexteAudioTestAudio) {
    lerntexteAudioTestAudio.pause();
    lerntexteAudioTestAudio.currentTime = 0;
  }
  lerntexteAudioProgressZuruecksetzen();
  lerntexteElement("lerntexteAudioStatus").textContent = "Test-Audio gestoppt.";
}

function lerntexteAudioSteuerungAktualisieren() {
  const playBtn = lerntexteElement("lerntexteAudioPlayBtn");
  const pauseBtn = lerntexteElement("lerntexteAudioPauseBtn");
  const resumeBtn = lerntexteElement("lerntextePilotResumeBtn");

  if (playBtn) {
    if (lerntexteAudioAktiv && !lerntexteAudioPausiert) {
      playBtn.textContent = "▶ Wiedergabe läuft";
      playBtn.disabled = true;
      playBtn.classList.remove("secondary-btn");
      playBtn.classList.add("action-btn");
    } else if (lerntexteAudioPausiert) {
      playBtn.textContent = "▶ Wiedergabe";
      playBtn.disabled = true;
      playBtn.classList.remove("action-btn");
      playBtn.classList.add("secondary-btn");
    } else {
      playBtn.textContent = "▶ Anhören";
      playBtn.disabled = false;
      playBtn.classList.remove("secondary-btn");
      playBtn.classList.add("action-btn");
    }
  }

  if (pauseBtn) {
    pauseBtn.disabled = !(lerntexteAudioAktiv && !lerntexteAudioPausiert);
  }

  if (resumeBtn) {
    resumeBtn.hidden = !(lerntextePilotAudio && lerntexteAudioPausiert);
    resumeBtn.classList.remove(lerntexteAudioPausiert ? "secondary-btn" : "action-btn");
    resumeBtn.classList.add(lerntexteAudioPausiert ? "action-btn" : "secondary-btn");
  }
  lerntexteAudioKapitelsteuerungAktualisieren();
}

function lerntexteAudioKapitelsteuerungAktualisieren() {
  const previousButton = lerntexteElement('lerntexteAudioPreviousBtn');
  const reloadButton = lerntexteElement('lerntexteAudioReloadBtn');
  const nextButton = lerntexteElement('lerntexteAudioNextBtn');
  const hasPlaylist = Array.isArray(lerntexteAudioPlaylist) && lerntexteAudioPlaylist.length > 0;
  if (previousButton) {
    previousButton.disabled = !hasPlaylist || lerntexteAudioPlaylistIndex <= 0;
    previousButton.onclick = lerntexteAudioKapitelVorher;
  }
  if (reloadButton) {
    reloadButton.disabled = !hasPlaylist;
    reloadButton.onclick = lerntexteAudioKapitelNeuLaden;
  }
  if (nextButton) {
    nextButton.disabled = !hasPlaylist || lerntexteAudioPlaylistIndex >= lerntexteAudioPlaylist.length - 1;
    nextButton.onclick = lerntexteAudioKapitelWeiter;
  }
}

function lerntexteAudioZeitFormat(seconds) {
  const value = typeof seconds === 'number' && isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(value / 60);
  return minutes + ':' + String(value % 60).padStart(2, '0');
}

function lerntexteAudioProgressVomPlayer(audio) {
  if (!audio) return;
  if (lerntexteContinuousState && audio === lerntextePilotAudio) {
    lerntexteContinuousProgressAktualisieren(audio);
    return;
  }
  const current = typeof audio.currentTime === 'number' && isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0;
  const duration = typeof audio.duration === 'number' && isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  const percent = duration > 0 ? (current / duration) * 100 : 0;
  lerntexteAudioProgressSet(percent, lerntexteAudioZeitFormat(current) + ' / ' + lerntexteAudioZeitFormat(duration));
}

function lerntexteAudioProgressSet(percent, metaText) {
  const bar = lerntexteElement("lerntexteAudioProgressBar");
  const percentLabel = lerntexteElement("lerntexteAudioProgressPercent");
  const metaLabel = lerntexteElement("lerntexteAudioProgressMeta");
  const wrapper = lerntexteElement("lerntexteAudioProgressWrapper");

  const clampedPercent = Math.max(0, Math.min(100, Number(percent) || 0));

  if (wrapper) {
    wrapper.hidden = false;
  }

  if (bar) {
    bar.style.width = clampedPercent + "%";
  }

  if (percentLabel) {
    percentLabel.textContent = Math.round(clampedPercent) + " %";
  }

  if (metaLabel && metaText) {
    metaLabel.textContent = metaText;
  }
}

function lerntexteAudioProgressZuruecksetzen() {
  lerntexteAudioProgressTotal = 0;
  lerntexteAudioProgressCompleted = 0;
  lerntexteAudioProgressCurrent = 0;
  lerntexteAudioChunkIndex = 0;
  lerntexteAudioCurrentChunkLength = 0;
  lerntexteAudioProgressSet(0, "Abschnitt 0 von 0");
}

function lerntexteAudioProgressAktualisieren() {
  const totalChars = Math.max(1, lerntexteAudioProgressTotal);
  const currentChunkLength = Math.max(0, lerntexteAudioCurrentChunkLength || 0);
  const currentProgressChars = Math.max(0, Math.min(currentChunkLength, lerntexteAudioProgressCurrent || 0));
  const totalProgress = lerntexteAudioProgressCompleted + currentProgressChars;
  const percent = (totalProgress / totalChars) * 100;

  const currentChunkNumber = lerntexteAudioChunks.length
    ? Math.max(1, Math.min(lerntexteAudioChunks.length, lerntexteAudioChunkIndex + 1))
    : 0;
  const metaText = lerntexteAudioChunks.length
    ? "Abschnitt " + currentChunkNumber + " von " + lerntexteAudioChunks.length
    : "Abschnitt 0 von 0";

  lerntexteAudioProgressSet(percent, metaText);
}

function lerntexteAudioMediaSessionAktualisieren() {
  if (!("mediaSession" in navigator)) return;

  let title = "Lerntext";
  if (lerntexteAudioPlaylist.length && lerntexteAudioPlaylistIndex >= 0 && lerntexteAudioPlaylistIndex < lerntexteAudioPlaylist.length) {
    const currentItem = lerntexteAudioPlaylist[lerntexteAudioPlaylistIndex];
    if (currentItem && currentItem.titel) {
      title = currentItem.titel;
    }
  }

  const chapterLabel = lerntexteElement("lerntexteAudioChapterLabel");
  if (chapterLabel && chapterLabel.textContent) {
    title = chapterLabel.textContent;
  }

  if ("MediaMetadata" in window) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: lerntexteAktuellesFach || "WiFa Trainer",
      album: "WiFa Trainer"
    });
  }

  navigator.mediaSession.playbackState = lerntexteAudioAktiv && !lerntexteAudioPausiert ? "playing" : "paused";
  const setHandler = function (action, handler) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (error) {
      // Nicht jeder Browser unterstützt jede Media-Session-Aktion.
    }
  };
  setHandler("play", function () { lerntexteAudioAbspielen(); });
  setHandler("pause", function () { lerntexteAudioPausieren(); });
  setHandler("stop", function () { lerntexteAudioStoppen("Wiedergabe beendet."); });
  setHandler("previoustrack", function () { lerntexteAudioKapitelVorher(); });
  setHandler("nexttrack", function () { lerntexteAudioKapitelWeiter(); });
  setHandler("seekto", function (details) {
    const audio = lerntexteElement('lerntexteAudioPlayer');
    if (!audio || !details || typeof details.seekTime !== 'number') return;
    if (lerntexteContinuousState) {
      const currentIndex = lerntexteContinuousIndexRekonstruieren();
      lerntexteContinuousKapitelSpringen(currentIndex, details.seekTime);
    } else {
      audio.currentTime = Math.max(0, details.seekTime);
    }
  });
  setHandler("seekbackward", function (details) {
    const audio = lerntexteElement('lerntexteAudioPlayer');
    if (!audio) return;
    const offset = details && Number(details.seekOffset) > 0 ? Number(details.seekOffset) : 10;
    if (lerntexteContinuousState) {
      const currentIndex = lerntexteContinuousIndexRekonstruieren();
      const localTimeFor = lerntexteContinuousHelper('rechtChapterLocalTime');
      const local = localTimeFor(lerntexteContinuousState.manifest, currentIndex, Number(audio.currentTime)) || 0;
      lerntexteContinuousKapitelSpringen(currentIndex, local - offset);
    } else audio.currentTime = Math.max(0, Number(audio.currentTime) - offset);
  });
  setHandler("seekforward", function (details) {
    const audio = lerntexteElement('lerntexteAudioPlayer');
    if (!audio) return;
    const offset = details && Number(details.seekOffset) > 0 ? Number(details.seekOffset) : 10;
    if (lerntexteContinuousState) {
      const currentIndex = lerntexteContinuousIndexRekonstruieren();
      const localTimeFor = lerntexteContinuousHelper('rechtChapterLocalTime');
      const local = localTimeFor(lerntexteContinuousState.manifest, currentIndex, Number(audio.currentTime)) || 0;
      lerntexteContinuousKapitelSpringen(currentIndex, local + offset);
    } else audio.currentTime = Math.max(0, Number(audio.currentTime) + offset);
  });

  if (lerntexteContinuousState && typeof navigator.mediaSession.setPositionState === 'function' && lerntextePilotAudio) {
    const chapter = lerntexteContinuousState.manifest.chapters[lerntexteContinuousState.chapterIndex];
    const localTimeFor = lerntexteContinuousHelper('rechtChapterLocalTime');
    const duration = chapter ? Number(chapter.end) - Number(chapter.start) : 0;
    const local = localTimeFor ? localTimeFor(lerntexteContinuousState.manifest, lerntexteContinuousState.chapterIndex, Number(lerntextePilotAudio.currentTime)) : 0;
    if (duration > 0 && local !== null) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: Number(lerntextePilotAudio.playbackRate) || 1,
          position: Math.max(0, Math.min(duration - 0.001, local))
        });
        lerntexteAudioMediaSessionPositionAktiv = true;
      } catch (error) {
        // Ungültige/noch nicht verfügbare Mediendauer darf Playback nicht blockieren.
      }
    }
  } else if (lerntexteAudioMediaSessionPositionAktiv && typeof navigator.mediaSession.setPositionState === 'function') {
    try {
      navigator.mediaSession.setPositionState();
      lerntexteAudioMediaSessionPositionAktiv = false;
    } catch (error) {
      // Browser ohne Clear-Unterstützung behalten ihre native Medienposition.
    }
  }
}

function initialisiereLerntexteAnsicht() {
  if (lerntexteFaecherAufgebaut) return;
  lerntexteFaecherAufgebaut = true;

  const grid = lerntexteElement("lerntexteFachGrid");
  grid.innerHTML = "";

  lerntexteFaecher.forEach(function (fach) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subject-btn";
    button.textContent = fach;
    button.onclick = function () {
      lerntexteFachWaehlen(fach);
    };
    grid.appendChild(button);
  });
}

async function lerntexteFachWaehlen(fach) {
  const usageTicket = window.WifaUsage?.captureTicket();
  lerntexteAudioStoppen(undefined, { resetSession: true });
  lerntexteAktuellesFach = fach;
  lerntexteAktuellesKapitel = "";
  lerntexteDaten = [];

  document.querySelectorAll("#lerntexteFachGrid .subject-btn").forEach(function (button) {
    button.classList.toggle("active", button.textContent === fach);
  });

  lerntexteElement("lerntexteKapitelBereich").style.display = "none";
  lerntexteElement("lerntexteAudioCard").style.display = "none";
  lerntexteElement("lerntexteInhaltBereich").innerHTML = "";
  lerntexteAudioProgressZuruecksetzen();

  try {
    lerntexteElement("lerntexteStatus").textContent = "Lerntexte werden geladen...";

    const result = await apiGet("getLerntexte", { fach: fach });

    if (!result.success) {
      throw new Error(result.error || "Lerntexte konnten nicht geladen werden.");
    }

    lerntexteDaten = (result.data || [])
      .slice()
      .sort(function (a, b) {
        return (Number(a.reihenfolgeFach) || 0) - (Number(b.reihenfolgeFach) || 0)
          || (Number(a.reihenfolgeKapitel) || 0) - (Number(b.reihenfolgeKapitel) || 0);
      });

    if (!lerntexteDaten.length) {
      lerntexteElement("lerntexteStatus").textContent = "Für dieses Fach sind noch keine Lerntexte hinterlegt.";
      return;
    }

    lerntexteBaueKapitelDropdown();
    lerntexteElement("lerntexteKapitelBereich").style.display = "block";
    lerntexteElement("lerntexteAudioCard").style.display = "block";
    lerntexteElement("lerntexteStatus").textContent = lerntexteDaten.length + " Lerneinheiten geladen.";

    const titelElement = lerntexteElement("lerntexteAudioChapterLabel");
    if (titelElement) {
      titelElement.textContent = lerntexteAktuellesKapitel ? "Kapitel " + lerntexteAktuellesKapitel : lerntexteAktuellesFach;
    }

    lerntexteAnzeigen(usageTicket);

  } catch (error) {
    lerntexteElement("lerntexteStatus").textContent =
      "Fehler beim Laden der Lerntexte: " + error.message;
  }
}

function lerntexteBaueKapitelDropdown() {
  const select = lerntexteElement("lerntexteKapitelSelect");
  select.innerHTML = '<option value="">Alle Kapitel</option>';

  const gesehen = new Set();

  lerntexteDaten.forEach(function (eintrag) {
    const key = String(eintrag.hauptkapitelNr);
    if (gesehen.has(key)) return;
    gesehen.add(key);

    const option = document.createElement("option");
    option.value = key;
    option.textContent = "Kapitel " + eintrag.hauptkapitelNr + " – " + eintrag.hauptkapitel;
    select.appendChild(option);
  });
}

function lerntexteKapitelWaehlen() {
  const selectedChapter = lerntexteElement("lerntexteKapitelSelect").value;
  if (lerntexteContinuousState && lerntexteContinuousIstRecht()) {
    lerntexteAktuellesKapitel = selectedChapter;
    lerntexteInhaltRendern(undefined, { trackUsage: false });
    const targetIndex = selectedChapter
      ? lerntexteAudioPlaylist.findIndex(function (item) {
        return item && item.eintrag && String(item.eintrag.hauptkapitelNr) === selectedChapter;
      })
      : 0;
    if (targetIndex >= 0) lerntexteContinuousKapitelSpringen(targetIndex, 0);
    return;
  }

  lerntexteAudioStoppen(undefined, { resetSession: true });
  lerntexteContinuousFallbackAktiv = false;
  lerntexteAktuellesKapitel = selectedChapter;
  const titelElement = lerntexteElement("lerntexteAudioChapterLabel");
  if (titelElement) {
    titelElement.textContent = lerntexteAktuellesKapitel ? "Kapitel " + lerntexteAktuellesKapitel : lerntexteAktuellesFach;
  }
  lerntexteAnzeigen();
}

function lerntexteAusgewaehlteEinheiten() {
  if (!lerntexteAktuellesKapitel) return lerntexteDaten;
  return lerntexteDaten.filter(function (eintrag) {
    return String(eintrag.hauptkapitelNr) === lerntexteAktuellesKapitel;
  });
}

function lerntexteTextZuChunks(text) {
  const normalisierterText = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/\s*\|\s*/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalisierterText) {
    return [];
  }

  const blocks = normalisierterText
    .split(/\n\s*\n+/)
    .map(function (block) {
      return String(block || "").trim();
    })
    .filter(Boolean);

  const chunks = [];

  blocks.forEach(function (block) {
    const sentenceCandidates = block
      .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9])/)
      .map(function (piece) {
        return String(piece || "").replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);

    if (sentenceCandidates.length > 1) {
      chunks.push.apply(chunks, sentenceCandidates);
      return;
    }

    const lineCandidates = block
      .split(/\n+/)
      .map(function (line) {
        return String(line || "").replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);

    if (lineCandidates.length > 1) {
      chunks.push.apply(chunks, lineCandidates);
      return;
    }

    chunks.push(block.replace(/\s+/g, " ").trim());
  });

  return chunks.filter(Boolean);
}

function lerntexteAbschnitteFuerEinheiten(einheiten) {
  const chunks = [];

  einheiten.forEach(function (eintrag) {
    const textQuelle = String(eintrag.lerntext || "").trim();
    if (!textQuelle) {
      return;
    }

    const abschnitte = lerntexteTextZuChunks(textQuelle);
    if (abschnitte.length) {
      chunks.push.apply(chunks, abschnitte);
    }
  });

  return chunks.filter(function (chunk) {
    return String(chunk || "").trim();
  });
}

// Erkennt vollständig großgeschriebene Abschnittsbezeichnungen (z.B. "KERNIDEE:") am Absatzanfang,
// nach einem Zeilenumbruch oder nach " | " und formatiert sie als klare Lernabschnitte.
function lerntexteHebeAbschnittsbezeichnungenHervor(escapedText) {
  return escapedText.replace(
    /(^|\n|\|\s*)([A-ZÄÖÜ][A-ZÄÖÜ0-9 \/\-\.()&]*:)/gm,
    function (match, prefix, label) {
      return prefix + '<strong class="lerntexte-abschnitt">' + label + "</strong>";
    }
  );
}

function lerntexteFormatiereText(text) {
  const normalisierterText = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s*\|\s*/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const absatzListe = normalisierterText.split(/\n\s*\n/).filter(function (absatz) {
    return String(absatz || "").trim();
  });

  return absatzListe
    .map(function (absatz) {
      const klarerAbsatz = String(absatz || "").trim();
      if (!klarerAbsatz) return "";

      const sectionMatcher = klarerAbsatz.match(/^([A-ZÄÖÜ][A-ZÄÖÜ0-9 \/\-\.()&]*?)(?::|\s*$)\s*(.*)$/s);
      if (sectionMatcher) {
        const label = String(sectionMatcher[1] || "").trim();
        const rest = String(sectionMatcher[2] || "").trim();
        const normalizedLabel = label.toUpperCase();
        const isKernidee = normalizedLabel === "KERNIDEE";
        const isSectionHeading = /^(KERNIDEE|NATÜRLICHE PERSONEN|JURISTISCHE PERSONEN|SACHEN UND RECHTE|BEWEGLICHE ODER UNBEWEGLICH|BEWEGLICHE UND UNBEWEGLICHE SACHEN|BESTANDTEILE|EIGENSCHAFTEN|RECHTSFOLGEN)$/i.test(normalizedLabel);

        if (isKernidee || isSectionHeading) {
          const wrapperClass = isKernidee ? "lerntexte-kernidee" : "lerntexte-sektionsblock";
          const sectionHeader = '<div class="lerntexte-section-header">' + escapeHtml(label.replace(/:$/, "")) + '</div>';
          const bodyHtml = rest
            ? '<p>' + lerntexteHebeAbschnittsbezeichnungenHervor(escapeHtml(rest)).replace(/\n/g, "<br>") + '</p>'
            : "";
          return '<div class="' + wrapperClass + '">' + sectionHeader + bodyHtml + '</div>';
        }
      }

      const hervorgehoben = lerntexteHebeAbschnittsbezeichnungenHervor(escapeHtml(klarerAbsatz));
      return "<p>" + hervorgehoben.replace(/\n/g, "<br>") + "</p>";
    })
    .join("");
}

// Google Sheets interpretiert Werte wie "1.1" oder "5.10" teils als Datum
function lerntexteNormalisiereUnterkapitelNr(wert) {
  const text = String(wert === null || wert === undefined ? "" : wert).trim();

  if (/^\d+\.\d+$/.test(text)) return text;

  const datum = new Date(wert);
  if (!isNaN(datum.getTime())) {
    return datum.getDate() + "." + (datum.getMonth() + 1);
  }

  return text;
}

function lerntexteAnzeigen(usageTicket = window.WifaUsage?.captureTicket()) {
  lerntexteAudioSessionInvalidieren();
  return lerntexteInhaltRendern(usageTicket);
}

function lerntexteInhaltRendern(usageTicket, options) {
  options = options || {};
  const bereich = lerntexteElement("lerntexteInhaltBereich");
  bereich.innerHTML = "";
  lerntextePilotTextRoots = {};

  const einheiten = lerntexteAusgewaehlteEinheiten();
  if (!einheiten.length) return;

  const zeigeKapitelUeberschrift = !lerntexteAktuellesKapitel;
  let letzteKapitelNr = null;

  einheiten.forEach(function (eintrag) {
    if (zeigeKapitelUeberschrift && String(eintrag.hauptkapitelNr) !== letzteKapitelNr) {
      letzteKapitelNr = String(eintrag.hauptkapitelNr);

      const kapitelTitel = document.createElement("h3");
      kapitelTitel.className = "lerntexte-kapitel-titel";
      kapitelTitel.textContent = "Kapitel " + eintrag.hauptkapitelNr + " – " + eintrag.hauptkapitel;
      bereich.appendChild(kapitelTitel);
    }

    const block = document.createElement("div");
    block.className = "lerntexte-einheit";

    const titel = document.createElement("h4");
    titel.className = "lerntexte-einheit-titel";
    const unterkapitelNr = eintrag.unterkapitelNr ? lerntexteNormalisiereUnterkapitelNr(eintrag.unterkapitelNr) : "";
    titel.textContent = (unterkapitelNr ? unterkapitelNr + " " : "") + (eintrag.titel || "");

    const text = document.createElement("div");
    text.className = "lerntexte-text";
    text.innerHTML = lerntexteFormatiereText(eintrag.lerntext);

    if (lerntexteIstPilotEinheit(eintrag.fach, eintrag.titel)
      && typeof window !== 'undefined'
      && typeof window.lerntexteDomTokenisieren === 'function') {
      window.lerntexteDomTokenisieren(text);
      lerntextePilotTextRoots[String(eintrag.fach) + "\u0000" + String(eintrag.titel)] = text;
    }

    block.appendChild(titel);
    block.appendChild(text);
    bereich.appendChild(block);
  });
  if (options.trackUsage !== false) {
    window.WifaAnalytics?.content('learning_text', lerntexteAktuellesFach, einheiten.length === 1 ? einheiten[0].titel : einheiten[0].hauptkapitel);
    if (window.WifaUsage?.isCurrent(usageTicket)) window.WifaUsage.content(lerntexteAktuellesFach, einheiten.map(eintrag => eintrag.titel));
  }
}

async function lerntexteContinuousStarten(targetIndex, options) {
  options = options || {};
  const domAudio = lerntexteElement('lerntexteAudioPlayer');
  if (!domAudio) return { started: false, fallback: true };
  const requestedItem = lerntexteAudioPlaylist[targetIndex];
  const requestedPath = requestedItem && requestedItem.eintrag
    ? lerntextePodcastPfade(requestedItem.eintrag.fach, requestedItem.eintrag).mp3Path
    : '';
  const completePlaylist = lerntexteAudioPlaylistErstellen(lerntexteDaten);
  const completeTargetIndex = completePlaylist.findIndex(function (item) {
    return item && item.eintrag && lerntextePodcastPfade(item.eintrag.fach, item.eintrag).mp3Path === requestedPath;
  });
  if (completeTargetIndex < 0) return { started: false, fallback: true };

  const sessionId = lerntexteAudioSessionInvalidieren();
  lerntexteAudioLoadController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const signal = lerntexteAudioLoadController ? lerntexteAudioLoadController.signal : undefined;
  lerntexteAudioAktiv = false;
  lerntexteAudioPausiert = false;
  lerntexteAudioFehler = false;
  lerntexteAudioLaedt = true;
  lerntexteAudioQuelle = 'firebase';
  let sourceApplied = false;

  try {
    lerntextePilotStatus('Kontinuierlicher Recht-Podcast wird geladen …');
    lerntexteAudioProgressSet(0, '0:00 / 0:00');
    lerntexteAudioSteuerungAktualisieren();
    const assets = await lerntexteContinuousAssetsLaden(sessionId, signal);
    lerntexteAudioSessionPruefen(sessionId);
    const validation = await lerntexteContinuousAssetsValidieren(assets, sessionId);
    lerntexteAudioSessionPruefen(sessionId);
    if (!validation.valid) {
      const invalid = new Error('Recht-Bundle ist nicht aktuell: ' + (validation.reason || 'ungültig'));
      invalid.code = 'podcast/bundle-invalid';
      throw invalid;
    }

    lerntexteAudioPlaylist = completePlaylist;
    targetIndex = completeTargetIndex;

    const chapter = assets.manifest.chapters[targetIndex];
    const item = lerntexteAudioPlaylist[targetIndex];
    if (!chapter || !item || !item.eintrag) throw new Error('Startkapitel fehlt im Recht-Bundle.');
    const progress = await lerntextePilotProgressLaden(item.eintrag, chapter.lerntextHash, sessionId, { silent: true });
    lerntexteAudioSessionPruefen(sessionId);
    lerntextePilotUid = progress.uid;
    lerntextePilotResumeState = progress.resumeState;
    lerntextePilotCompletedState = progress.completedState;
    let localStart = typeof options.startPosition === 'number' && isFinite(options.startPosition)
      ? Math.max(0, options.startPosition)
      : 0;
    if (options.startPosition === undefined && progress.resumeState && progress.resumeState.completed !== true) {
      const saved = Number(progress.resumeState.sekundenPosition);
      if (isFinite(saved) && saved >= 0) localStart = saved;
    }
    const seekTarget = lerntexteContinuousHelper('rechtChapterSeekTarget');
    const absoluteStart = seekTarget(assets.manifest, targetIndex, localStart);
    if (absoluteStart === null) throw new Error('Startposition fehlt im Recht-Bundle.');

    lerntexteContinuousState = {
      manifest: assets.manifest,
      manifestHash: assets.manifestHash,
      mp3Url: assets.mp3Url,
      chapterIndex: targetIndex,
      sessionId: sessionId,
      seeking: false,
      ignoreCompletion: true,
      pendingStartPosition: absoluteStart,
      lastTime: absoluteStart
    };
    lerntexteAudioPlaylistIndex = targetIndex;
    lerntexteAudioAktiv = true;
    lerntexteAudioPausiert = false;
    lerntexteAudioFehler = false;
    lerntexteAudioLaedt = false;
    lerntexteContinuousKapitelAktivieren(targetIndex);
    lerntexteContinuousKaraokeEinrichten(domAudio, options.usageTicket, sessionId, absoluteStart);
    lerntextePilotButtonsVerdrahten();

    domAudio.src = assets.mp3Url;
    sourceApplied = true;
    if (typeof domAudio.load === 'function') domAudio.load();
    try {
      domAudio.currentTime = absoluteStart;
      lerntexteAudioLetztePosition = absoluteStart;
    } catch (error) {
      // loadedmetadata setzt die vorgemerkte absolute Position.
    }
    lerntexteContinuousSynchronisieren(absoluteStart, { manual: true });
    lerntexteAudioSteuerungAktualisieren();
    window.WifaAnalytics?.audio(domAudio, item.eintrag.fach, item.eintrag.titel);
    window.WifaUsage?.audio(domAudio, item.eintrag.fach, item.eintrag.titel, options.usageTicket);
    await domAudio.play();
    lerntexteAudioSessionPruefen(sessionId);
    if (lerntexteContinuousState) lerntexteContinuousState.ignoreCompletion = false;
    const activeIndex = lerntexteContinuousState ? lerntexteContinuousState.chapterIndex : targetIndex;
    const activeItem = lerntexteAudioPlaylist[activeIndex] || item;
    lerntextePilotStatus('Audio läuft: ' + (activeIndex + 1) + ' von ' + lerntexteAudioPlaylist.length + ' – ' + activeItem.titel);
    lerntexteAudioMediaSessionAktualisieren();
    return { started: true, fallback: false };
  } catch (error) {
    if (lerntexteAudioIstVeralteterFehler(error) || !lerntexteAudioSessionIstAktuell(sessionId)) {
      return { started: false, fallback: false };
    }
    window.WifaAnalytics?.audioError('Recht', lerntexteAudioPlaylist[targetIndex] && lerntexteAudioPlaylist[targetIndex].titel, error?.code || error?.name);
    if (!sourceApplied) {
      lerntexteContinuousFallbackAktiv = true;
      lerntextePilotStatus('Recht-Bundle nicht verfügbar. Einzelkapitel wird geladen …');
      return { started: false, fallback: true };
    }
    lerntexteContinuousFallbackAktiv = true;
    lerntexteAudioFehler = true;
    lerntexteAudioAktiv = false;
    lerntextePilotStatus('Podcast konnte nicht gestartet werden. Kapitel erneut laden oder wechseln.');
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
    return { started: false, fallback: false };
  } finally {
    if (lerntexteAudioSessionIstAktuell(sessionId)) {
      lerntexteAudioLaedt = false;
      lerntexteAudioSteuerungAktualisieren();
    }
  }
}

function lerntexteAudioPlaylistWeiter(playlistOverride, playlistIndexOverride, usageTicket = window.WifaUsage?.captureTicket()) {
  if (Array.isArray(playlistOverride)) {
    lerntexteAudioPrefetchVerwerfen();
    lerntexteAudioPlaylist = playlistOverride;
    lerntexteAudioPlaylistIndex = typeof playlistIndexOverride === 'number' ? playlistIndexOverride : 0;
  }

  return lerntexteAudioKapitelLaden(lerntexteAudioPlaylistIndex, { usageTicket: usageTicket });
}

async function lerntexteAudioKapitelLaden(targetIndex, options) {
  options = options || {};

  if (!lerntexteAudioPlaylist.length) {
    lerntextePilotStatus('Keine Lerneinheiten zum Anhören vorhanden.');
    return false;
  }

  if (targetIndex < 0 || targetIndex >= lerntexteAudioPlaylist.length) {
    lerntextePilotStatus('Das gewünschte Kapitel ist nicht verfügbar.');
    lerntexteAudioKapitelsteuerungAktualisieren();
    return false;
  }

  if (lerntexteContinuousState && options.forceLegacy !== true) {
    return lerntexteContinuousKapitelSpringen(targetIndex, options.startPosition || 0);
  }

  if (options.forceLegacy !== true && lerntexteContinuousKannVersuchen()) {
    const continuousResult = await lerntexteContinuousStarten(targetIndex, options);
    if (continuousResult.started) return true;
    if (!continuousResult.fallback) return false;
    return lerntexteAudioKapitelLaden(targetIndex, Object.assign({}, options, {
      forceLegacy: true,
      saveCurrent: false
    }));
  }

  const oldSessionId = lerntexteAudioSessionId;
  let prepared = null;
  if (options.usePrefetch === true) {
    prepared = lerntexteAudioPrefetchNehmen(targetIndex, oldSessionId);
  } else {
    lerntexteAudioPrefetchVerwerfen();
  }
  const domAudio = document.getElementById('lerntexteAudioPlayer');
  if (options.saveCurrent !== false && lerntextePilotAudio && lerntextePilotUid) {
    lerntextePilotProgressSpeichern(false, { sessionId: oldSessionId, showError: false }).catch(function () {});
  }
  const sessionId = lerntexteAudioSessionInvalidieren();
  lerntexteAudioLoadController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const signal = lerntexteAudioLoadController ? lerntexteAudioLoadController.signal : undefined;
  lerntexteAudioPlaylistIndex = targetIndex;
  lerntexteAudioAktiv = false;
  lerntexteAudioPausiert = false;
  lerntexteAudioFehler = false;
  lerntexteAudioLaedt = true;
  lerntexteAudioQuelle = 'firebase';

  if (domAudio) {
    if (typeof domAudio.pause === 'function') domAudio.pause();
    if (typeof domAudio.removeAttribute === 'function') domAudio.removeAttribute('src');
    else domAudio.src = '';
    try {
      domAudio.currentTime = 0;
    } catch (error) {
      // Der neue Stream setzt seine Startposition nach dem Laden.
    }
    if (typeof domAudio.load === 'function') domAudio.load();
  }

  const total = lerntexteAudioPlaylist.length;
  const currentItem = lerntexteAudioPlaylist[lerntexteAudioPlaylistIndex];
  const title = currentItem && currentItem.titel ? currentItem.titel : "Lerneinheit";
  const statusText = "Podcast wird geladen: " + (lerntexteAudioPlaylistIndex + 1) + " von " + total + " – " + title;

  if (lerntexteElement("lerntexteAudioStatus")) {
    lerntexteElement("lerntexteAudioStatus").textContent = statusText;
  }

  const chapterLabel = lerntexteElement("lerntexteAudioChapterLabel");
  if (chapterLabel) {
    chapterLabel.textContent = title;
  }

  lerntexteAudioProgressSet(0, "0:00 / 0:00");
  lerntexteAudioMediaSessionAktualisieren();
  lerntexteAudioSteuerungAktualisieren();

  try {
    if (!domAudio) return false;
    const textRoot = currentItem.textRoot || lerntextePilotTextRoots[String(currentItem.eintrag.fach) + "\u0000" + String(currentItem.eintrag.titel)] || null;
    let assets = prepared ? prepared.assets : await lerntextePilotAssetsLaden(currentItem.eintrag, sessionId, signal);
    lerntexteAudioSessionPruefen(sessionId);
    let validation = await lerntextePilotAssetValidieren(currentItem.eintrag, assets.manifest, assets.mp3Metadata, sessionId);
    lerntexteAudioSessionPruefen(sessionId);
    let preparedProgress = prepared && prepared.currentHash === validation.currentHash ? prepared.progress : null;
    if (!validation.valid && prepared) {
      assets = await lerntextePilotAssetsLaden(currentItem.eintrag, sessionId, signal);
      lerntexteAudioSessionPruefen(sessionId);
      validation = await lerntextePilotAssetValidieren(currentItem.eintrag, assets.manifest, assets.mp3Metadata, sessionId);
      lerntexteAudioSessionPruefen(sessionId);
      preparedProgress = null;
    }
    if (!validation.valid) {
      window.WifaAnalytics?.audioError(currentItem.eintrag.fach, currentItem.eintrag.titel, 'asset_invalid');
      lerntextePilotStatus(validation.reason || 'Podcast muss aktualisiert werden.');
      lerntexteAudioPrefetchVerwerfen();
      lerntexteAudioFehler = true;
      lerntexteAudioMediaSessionAktualisieren();
      return false;
    }
    lerntextePilotTextRoot = textRoot;
    const startOptions = { sessionId: sessionId, startPosition: options.startPosition, mp3Url: assets.mp3Url, textRoot: textRoot };
    if (preparedProgress && prepared.currentHash === validation.currentHash) {
      startOptions.progress = preparedProgress;
    }
    return await lerntextePilotAudioStartenValidiert(
      currentItem.eintrag,
      assets.manifest,
      assets.mp3Metadata,
      null,
      validation,
      options.usageTicket,
      startOptions
    );
  } catch (error) {
    if (lerntexteAudioIstVeralteterFehler(error) || !lerntexteAudioSessionIstAktuell(sessionId)) return false;
    window.WifaAnalytics?.audioError(currentItem.eintrag.fach, currentItem.eintrag.titel, error?.code || error?.name);
    lerntexteAudioPrefetchVerwerfen();
    lerntexteAudioFehler = true;
    lerntexteAudioAktiv = false;
    lerntextePilotStatus((error && error.message ? error.message : 'Podcast konnte nicht geladen werden.') + ' Kapitel erneut laden oder wechseln.');
    lerntexteAudioMediaSessionAktualisieren();
    return false;
  } finally {
    if (lerntexteAudioSessionIstAktuell(sessionId)) {
      lerntexteAudioLaedt = false;
      lerntexteAudioSteuerungAktualisieren();
    }
  }
}

function lerntexteAudioKapitelVorher() {
  if (lerntexteContinuousState) {
    const currentIndex = lerntexteContinuousIndexRekonstruieren();
    if (currentIndex <= 0) return Promise.resolve(false);
    return lerntexteContinuousKapitelSpringen(currentIndex - 1, 0);
  }
  if (lerntexteAudioPlaylistIndex <= 0) return Promise.resolve(false);
  lerntexteAudioPrefetchVerwerfen();
  return lerntexteAudioKapitelLaden(lerntexteAudioPlaylistIndex - 1);
}

function lerntexteAudioKapitelNeuLaden() {
  if (!lerntexteAudioPlaylist.length) return Promise.resolve(false);
  lerntexteAudioPrefetchVerwerfen();
  const audio = document.getElementById('lerntexteAudioPlayer');
  if (lerntexteContinuousState && audio) {
    const index = lerntexteContinuousIndexRekonstruieren();
    const localTimeFor = lerntexteContinuousHelper('rechtChapterLocalTime');
    const localPosition = localTimeFor(lerntexteContinuousState.manifest, index, Number(audio.currentTime)) || 0;
    lerntexteContinuousFallbackAktiv = true;
    return lerntexteAudioKapitelLaden(index, { startPosition: localPosition, forceLegacy: true });
  }
  const currentPosition = audio && typeof audio.currentTime === 'number' && isFinite(audio.currentTime)
    ? Math.max(0, audio.currentTime)
    : lerntexteAudioLetztePosition;
  return lerntexteAudioKapitelLaden(lerntexteAudioPlaylistIndex, { startPosition: currentPosition });
}

function lerntexteAudioKapitelWeiter() {
  if (lerntexteContinuousState) {
    const currentIndex = lerntexteContinuousIndexRekonstruieren();
    if (currentIndex < 0 || currentIndex >= lerntexteAudioPlaylist.length - 1) return Promise.resolve(false);
    return lerntexteContinuousKapitelSpringen(currentIndex + 1, 0);
  }
  if (lerntexteAudioPlaylistIndex >= lerntexteAudioPlaylist.length - 1) return Promise.resolve(false);
  lerntexteAudioPrefetchVerwerfen();
  return lerntexteAudioKapitelLaden(lerntexteAudioPlaylistIndex + 1);
}

function lerntexteAudioStoppen(status, options) {
  options = options || {};
  const currentPlayer = document.getElementById("lerntexteAudioPlayer");
  if (!options.resetSession && currentPlayer && currentPlayer === lerntextePilotAudio) {
    lerntextePilotStoppen();
    return;
  }
  const oldSessionId = lerntexteAudioSessionId;
  if (currentPlayer && currentPlayer === lerntextePilotAudio && lerntextePilotUid) {
    lerntextePilotProgressSpeichern(false, { sessionId: oldSessionId, showError: false }).catch(function () {});
  }
  lerntexteAudioSessionInvalidieren();
  lerntexteContinuousFallbackAktiv = false;

  lerntexteAudioGeneration++;
  lerntexteAudioAktiv = false;
  lerntexteAudioPausiert = false;
  lerntexteAudioFehler = false;
  lerntexteAudioLaedt = false;
  lerntexteAudioQuelle = "";
  lerntexteAudioPlaylist = [];
  lerntexteAudioPlaylistIndex = 0;
  lerntexteAudioChunks = [];
  lerntexteAudioChunkIndex = 0;
  lerntexteAudioProgressCompleted = 0;
  lerntexteAudioProgressCurrent = 0;
  lerntexteAudioCurrentChunkLength = 0;
  lerntexteAudioCurrentUtterance = null;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  const player = document.getElementById("lerntexteAudioPlayer");
  if (player) {
    if (typeof player.pause === 'function') player.pause();
    if (typeof player.removeAttribute === 'function') player.removeAttribute('src');
    else player.src = '';
    player.currentTime = 0;
    window.WifaUsage?.restartAudio(player);
    player.onended = null;
    player.ontimeupdate = null;
    if (typeof player.load === 'function') player.load();
  }

  if (lerntexteAudioTestKapitelAktiv && lerntexteAudioTestAudio) {
    lerntexteAudioTestAudio.pause();
    lerntexteAudioTestAudio.currentTime = 0;
    lerntexteAudioTestKapitelAktiv = false;
  }

  if (lerntexteElement("lerntexteAudioStatus")) {
    lerntexteElement("lerntexteAudioStatus").textContent = status || "Audio gestoppt.";
  }

  lerntexteAudioProgressZuruecksetzen();
  lerntexteAudioSteuerungAktualisieren();
  lerntexteAudioMediaSessionAktualisieren();
}

function lerntexteAudioAbspielen() {
  if (lerntexteAudioPausiert) {
    if (lerntexteAudioQuelle === "firebase") {
      const player = document.getElementById("lerntexteAudioPlayer");
      if (player) {
        player.play();
      }
    } else if (lerntexteAudioQuelle === "speechSynthesis" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }

    lerntexteAudioPausiert = false;
    lerntexteAudioSteuerungAktualisieren();
    lerntexteElement("lerntexteAudioStatus").textContent = "Audio läuft.";
    lerntexteAudioMediaSessionAktualisieren();
    return;
  }

  if (lerntexteAudioFehler && lerntexteAudioPlaylist.length) {
    return lerntexteAudioKapitelNeuLaden();
  }

  if (lerntexteContinuousState && lerntextePilotAudio && !lerntexteAudioAktiv) {
    const manifestDuration = Number(lerntexteContinuousState.manifest && lerntexteContinuousState.manifest.duration);
    const atBundleEnd = lerntextePilotAudio.ended === true
      || (isFinite(manifestDuration) && Number(lerntextePilotAudio.currentTime) >= manifestDuration);
    return Promise.resolve().then(async function () {
      if (atBundleEnd) {
        let targetIndex = 0;
        if (lerntexteAktuellesKapitel) {
          const selectedIndex = lerntexteAudioPlaylist.findIndex(function (item) {
            return item && item.eintrag && String(item.eintrag.hauptkapitelNr) === String(lerntexteAktuellesKapitel);
          });
          if (selectedIndex >= 0) targetIndex = selectedIndex;
        }
        const moved = await lerntexteContinuousKapitelSpringen(targetIndex, 0);
        if (!moved) return false;
      }
      await lerntextePilotFortsetzen();
      return !lerntexteAudioFehler;
    });
  }

  const einheiten = lerntexteAusgewaehlteEinheiten();
  if (!einheiten.length) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Keine Lerneinheiten zum Anhören vorhanden.";
    return;
  }

  lerntexteContinuousFallbackAktiv = false;
  const playlist = lerntexteAudioPlaylistErstellen(einheiten);
  if (!playlist.length) {
    lerntexteElement("lerntexteAudioStatus").textContent = "Für diesen Abschnitt sind keine Vorlesetexte verfügbar.";
    return;
  }

  lerntexteAudioAktiv = true;
  lerntexteAudioPausiert = false;
  lerntexteAudioPlaylist = playlist;
  lerntexteAudioPlaylistIndex = 0;
  lerntexteAudioQuelle = "";
  if (playlist[lerntexteAudioPlaylistIndex] && playlist[lerntexteAudioPlaylistIndex].eintrag && lerntexteIstPilotEinheit(playlist[lerntexteAudioPlaylistIndex].eintrag.fach, playlist[lerntexteAudioPlaylistIndex].eintrag.titel)) {
    const pilotAudio = document.getElementById('lerntexteAudioPlayer');
    if (pilotAudio) pilotAudio.currentTime = 0;
  }
  lerntexteAudioProgressSet(0, "0:00 / 0:00");
  lerntexteAudioSteuerungAktualisieren();
  return lerntexteAudioPlaylistWeiter();
}

function lerntexteSprechen(chunks, index, generation) {
  if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
  if (index >= chunks.length) {
    lerntexteAudioProgressCompleted = Math.max(lerntexteAudioProgressCompleted, lerntexteAudioProgressTotal);
    lerntexteAudioProgressCurrent = 0;
    lerntexteAudioCurrentChunkLength = 0;
    lerntexteAudioProgressSet(100, "Abschnitt " + chunks.length + " von " + chunks.length);
    lerntexteAudioStoppen("Alle Podcast-Texte wurden vorgelesen.");
    return;
  }

  const chunk = String(chunks[index] || "").trim();
  if (!chunk) {
    lerntexteSprechen(chunks, index + 1, generation);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(chunk);
  utterance.lang = "de-DE";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  lerntexteAudioCurrentUtterance = utterance;
  lerntexteAudioChunkIndex = index;
  lerntexteAudioProgressCurrent = 0;
  lerntexteAudioCurrentChunkLength = chunk.length;
  lerntexteAudioProgressAktualisieren();

  utterance.onstart = function () {
    if (generation !== lerntexteAudioGeneration) return;
    lerntexteAudioAktiv = true;
    lerntexteAudioPausiert = false;
    lerntexteElement("lerntexteAudioStatus").textContent =
      "Audio läuft: Abschnitt " + (index + 1) + " von " + chunks.length;
    lerntexteAudioSteuerungAktualisieren();
    lerntexteAudioMediaSessionAktualisieren();
  };

  utterance.onboundary = function (event) {
    if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
    const nextProgress = typeof event.charIndex === "number" ? event.charIndex : 0;
    lerntexteAudioProgressCurrent = Math.max(0, Math.min(lerntexteAudioCurrentChunkLength, nextProgress));
    lerntexteAudioProgressAktualisieren();
  };

  utterance.onend = function () {
    if (generation !== lerntexteAudioGeneration || !lerntexteAudioAktiv) return;
    lerntexteAudioProgressCompleted += lerntexteAudioCurrentChunkLength;
    lerntexteAudioProgressCurrent = 0;
    lerntexteAudioCurrentChunkLength = 0;
    lerntexteAudioCurrentUtterance = null;
    lerntexteSprechen(chunks, index + 1, generation);
  };

  utterance.onerror = function () {
    if (generation === lerntexteAudioGeneration) {
      lerntexteAudioStoppen("Audio konnte nicht abgespielt werden.");
    }
  };

  window.speechSynthesis.speak(utterance);
}

function lerntexteAudioPausieren() {
  const currentPlayer = document.getElementById("lerntexteAudioPlayer");
  if (currentPlayer && currentPlayer === lerntextePilotAudio) {
    return lerntextePilotPausieren();
  }

  if (!lerntexteAudioAktiv || lerntexteAudioPausiert) return;
  lerntexteAudioPausiert = true;

  if (lerntexteAudioQuelle === "firebase") {
    const player = document.getElementById("lerntexteAudioPlayer");
    if (player) {
      player.pause();
    }
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.pause();
  }

  lerntexteElement("lerntexteAudioStatus").textContent = "Audio pausiert.";
  lerntexteAudioSteuerungAktualisieren();
  lerntexteAudioMediaSessionAktualisieren();
}

// ============================================================
// TASK 14: Pilot Playback Helper Functions
// ============================================================

// Plays audio and registers an onended handler for natural completion
function lerntextePodcastAbspielen(audio, saveProgress, progressState) {
  audio.onended = function() {
    const newState = Object.assign({}, progressState, {
      sekundenPosition: audio.currentTime,
      completed: true
    });
    return saveProgress(newState);
  };
  return audio.play();
}

// Pauses audio and saves progress
async function lerntextePodcastPausieren(audio, saveProgress, progressState) {
  audio.pause();
  const newState = Object.assign({}, progressState, {
    sekundenPosition: audio.currentTime,
    completed: false
  });
  return saveProgress(newState);
}

// Stops audio and saves progress (without resetting currentTime)
async function lerntextePodcastStoppen(audio, saveProgress, progressState) {
  audio.pause();
  const newState = Object.assign({}, progressState, {
    sekundenPosition: audio.currentTime,
    completed: false
  });
  return saveProgress(newState);
}

// Resumes audio from saved position if hash matches
function lerntextePodcastFortsetzen(audio, resumeState, currentHash) {
  if (!resumeState) return;
  if (resumeState.lerntextHash !== currentHash) return;
  if (resumeState.completed === true) return;
  
  const position = resumeState.sekundenPosition;
  if (typeof position !== 'number' || !isFinite(position) || position < 0) return;
  
  audio.currentTime = position;
}

// Plays from the beginning (von vorne)
function lerntextePodcastVonVorne(audio) {
  audio.currentTime = 0;
}

// ============================================================
// Browser Window Exports
// ============================================================

if (typeof window !== 'undefined') {
  window.initialisiereLerntexteAnsicht = initialisiereLerntexteAnsicht;
  window.lerntexteAudioStoppen = lerntexteAudioStoppen;
  window.lerntexteAudioAbspielen = lerntexteAudioAbspielen;
  window.lerntexteAudioSlug = lerntexteAudioSlug;
  window.lerntexteAudioFirebasePfad = lerntexteAudioFirebasePfad;
  window.lerntexteAudioTextFuerEintrag = lerntexteAudioTextFuerEintrag;
  window.lerntexteAudioPlaylistErstellen = lerntexteAudioPlaylistErstellen;
  window.lerntexteIstPilotEinheit = lerntexteIstPilotEinheit;
  window.lerntextePilotHash = lerntextePilotHash;
  window.lerntextePilotTextFuerEintrag = lerntextePilotTextFuerEintrag;
  window.lerntextePilotManifest = lerntextePilotManifest;
  window.lerntexteAudioPlaylistWeiter = lerntexteAudioPlaylistWeiter;
  window.lerntexteAudioKapitelVorher = lerntexteAudioKapitelVorher;
  window.lerntexteAudioKapitelNeuLaden = lerntexteAudioKapitelNeuLaden;
  window.lerntexteAudioKapitelWeiter = lerntexteAudioKapitelWeiter;
  window.lerntextePilotAudioStarten = lerntextePilotAudioStarten;
  window.resyncPilotHighlight = resyncPilotHighlight;
  window.lerntextePilotFortschrittLaden = lerntextePilotFortschrittLaden;
  window.lerntextePilotFortschrittSpeichern = lerntextePilotFortschrittSpeichern;
}

// ============================================================
// Node.js/CommonJS Exports for Testing
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    lerntexteIstPilotEinheit,
    lerntextePilotHash,
    lerntextePilotTextFuerEintrag,
    lerntextePilotManifest,
    lerntexteAudioPlaylistWeiter,
    lerntexteAudioKapitelVorher,
    lerntexteAudioKapitelNeuLaden,
    lerntexteAudioKapitelWeiter,
    lerntextePilotAudioStarten,
    resyncPilotHighlight,
    lerntextePilotFortschrittLaden,
    lerntextePilotFortschrittSpeichern,
    lerntextePodcastAbspielen,
    lerntextePodcastPausieren,
    lerntextePodcastStoppen,
    lerntextePodcastFortsetzen,
    lerntextePodcastVonVorne
  };
}
