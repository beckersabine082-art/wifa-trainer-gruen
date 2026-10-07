import { auth, storage, ref, getDownloadURL } from '../../js/firebase-config.js';
import { getIdToken } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getMetadata } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js';

const core = window.WifaPodcastStagingDiagnosticCore;

function audioMetadata(downloadUrl) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const timeout = setTimeout(() => finish(new Error('loadedmetadata-Timeout')), 30000);
    function finish(error) {
      clearTimeout(timeout);
      audio.removeAttribute('src');
      audio.load();
      if (error) reject(error);
    }
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      const value = { duration: audio.duration, readyState: audio.readyState };
      finish();
      resolve(value);
    }, { once: true });
    audio.addEventListener('error', () => finish(new Error('Audio-Metadaten konnten nicht geladen werden.')), { once: true });
    audio.src = downloadUrl;
    audio.load();
  });
}

function render(report) {
  let panel = document.getElementById('podcastStagingDiagnosticReport');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'podcastStagingDiagnosticReport';
    panel.style.cssText = 'position:fixed;z-index:99999;left:1rem;right:1rem;bottom:1rem;padding:1rem;background:#fff;border:3px solid #174f2a;color:#111;font:16px/1.4 system-ui;max-height:45vh;overflow:auto';
    document.body.appendChild(panel);
  }
  panel.textContent = report.summary + (report.errors.length ? '\n' + report.errors.join('\n') : '');
  panel.dataset.result = report.pass ? 'PASS' : 'FAIL';
}

async function run() {
  if (!core) throw new Error('Diagnosekern fehlt.');
  if (typeof auth.authStateReady === 'function') await auth.authStateReady();
  const config = window.WIFA_RUNTIME_CONFIGURATION;
  const helper = window.podcastContinuous || window;
  const report = await core.runPodcastStorageDiagnostic({
    currentUser: auth.currentUser,
    getIdToken: user => getIdToken(user, true),
    subjects: core.SUBJECTS,
    prefix: config?.podcastPrefix,
    version: config?.podcastVersion,
    pathsForSubject: subject => helper.continuousPodcastPaths(subject, { prefix: config.podcastPrefix }),
    loadSidecar: async sidecarPath => {
      const sidecarRef = ref(storage, sidecarPath);
      await getMetadata(sidecarRef);
      const response = await fetch(await getDownloadURL(sidecarRef), { cache: 'no-store' });
      if (!response.ok) throw new Error(`Sidecar HTTP ${response.status}`);
      return response.json();
    },
    loadBundleMetadata: async mp3Path => {
      const mp3Ref = ref(storage, mp3Path);
      const metadata = await getMetadata(mp3Ref);
      return { contentType: metadata.contentType, size: Number(metadata.size), downloadUrl: await getDownloadURL(mp3Ref) };
    },
    loadAudioMetadata: (_mp3Path, bundle) => audioMetadata(bundle.downloadUrl)
  });
  render(report);
  return report;
}

window.runWifaPodcastStagingDiagnostic = run;
window.addEventListener('load', () => setTimeout(() => run().catch(error => render({
  pass: false,
  summary: '0/13 Sidecars | 0/13 Bundles | 0/13 loadedmetadata | FAIL',
  errors: [error.message]
})), 0));
