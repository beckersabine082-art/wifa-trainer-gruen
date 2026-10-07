import { auth, storage, ref, getDownloadURL } from '../../js/firebase-config.js';
import { getIdToken } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getMetadata } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js';

const core = window.WifaPodcastStagingDiagnosticCore;
const ORDER_MANIFEST_PATH = '/release/WIFA-GESAMT-PROD-20261007-RC1/packages/lerntexte/Lerntexte_Reihenfolge_Manifest.json';

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
    panel.style.cssText = 'position:fixed;z-index:99999;inset:1rem;padding:1rem;background:#fff;border:3px solid #174f2a;color:#111;font:14px/1.4 system-ui;overflow:auto';
    document.body.appendChild(panel);
  }
  panel.replaceChildren();

  const heading = document.createElement('h2');
  heading.textContent = 'Podcast-Release-Diagnose (lokal, read-only)';
  panel.appendChild(heading);

  if (report.summary !== 'AUTH FAIL') {
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;margin:1rem 0';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Fach', 'Sidecar', 'Bundle', 'loadedmetadata', 'Dauer', 'Version', 'Ergebnis'].forEach(label => {
      const cell = document.createElement('th');
      cell.textContent = label;
      cell.style.cssText = 'padding:.4rem;border:1px solid #aaa;text-align:left';
      headRow.appendChild(cell);
    });
    head.appendChild(headRow);
    table.appendChild(head);
    const body = document.createElement('tbody');
    report.results.forEach(result => {
      const row = document.createElement('tr');
      const values = [
        result.subject,
        result.sidecar,
        result.bundle,
        result.loadedmetadata,
        Number.isFinite(result.duration) ? `${result.duration.toFixed(2)} s` : '—',
        result.version || '—',
        result.result
      ];
      values.forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        cell.style.cssText = 'padding:.4rem;border:1px solid #aaa;vertical-align:top';
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.appendChild(body);
    panel.appendChild(table);
  }

  const summary = document.createElement('strong');
  summary.style.cssText = 'display:block;font-size:1.05rem;margin:.75rem 0;color:' + (report.pass ? '#174f2a' : '#9a1d1d');
  summary.textContent = report.failure || report.summary;
  panel.appendChild(summary);

  if (report.summary !== (report.failure || report.summary)) {
    const totals = document.createElement('div');
    totals.textContent = report.summary;
    panel.appendChild(totals);
  }

  if (report.recht) {
    const recht = document.createElement('div');
    recht.style.cssText = 'margin:.75rem 0;padding:.75rem;background:#f2f7f3';
    recht.textContent = 'Recht: 48-Kapitel-Navigation ' + (report.recht.chapterNavigation ? 'PASS' : 'FAIL') +
      ' | Alle Kapitel ' + (report.recht.allChapters ? 'PASS' : 'FAIL') +
      ' | Kapitel 1 ' + (report.recht.chapterOne ? 'PASS' : 'FAIL') +
      ' | Einzeltextziel ' + (report.recht.singleEntry ? 'PASS' : 'FAIL') +
      ' | Nummerierung ' + (report.recht.numbering ? 'PASS' : 'FAIL') +
      ' | Start: ' + report.recht.firstVisibleTitle;
    panel.appendChild(recht);
  }

  ['Recht', 'VWL'].forEach(subject => {
    const evidence = report.structureEvidence?.[subject];
    if (!evidence) return;
    const details = document.createElement('details');
    details.style.cssText = 'margin:.75rem 0';
    const title = document.createElement('summary');
    title.textContent = `Strukturvergleich ${subject}`;
    const content = document.createElement('pre');
    content.style.cssText = 'white-space:pre-wrap;max-height:20rem;overflow:auto;background:#f6f6f6;padding:.75rem';
    content.textContent = JSON.stringify(evidence, null, 2);
    details.append(title, content);
    panel.appendChild(details);
  });

  if (report.errors.length) {
    const errors = document.createElement('pre');
    errors.textContent = report.errors.join('\n');
    errors.style.cssText = 'white-space:pre-wrap;color:#9a1d1d';
    panel.appendChild(errors);
  }

  const reportLabel = document.createElement('label');
  reportLabel.textContent = 'Kopierbarer Prüfbericht (ohne Tokens und URLs)';
  reportLabel.style.cssText = 'display:block;margin-top:1rem;font-weight:600';
  const text = document.createElement('textarea');
  text.readOnly = true;
  text.rows = 12;
  text.style.cssText = 'width:100%;font:12px/1.4 ui-monospace,monospace;margin-top:.4rem';
  text.value = JSON.stringify(report, null, 2);
  reportLabel.appendChild(text);
  panel.appendChild(reportLabel);
  panel.dataset.result = report.pass ? 'PASS' : 'FAIL';
}

async function run() {
  if (!core) throw new Error('Diagnosekern fehlt.');
  if (typeof auth.authStateReady === 'function') await auth.authStateReady();
  const config = window.WIFA_RUNTIME_CONFIGURATION;
  const helper = window.podcastContinuous || window;
  const report = await core.runPodcastStorageDiagnostic({
    currentUser: auth.currentUser,
    getIdToken: user => getIdToken(user),
    subjects: core.SUBJECTS,
    prefix: config?.podcastPrefix,
    version: config?.podcastVersion,
    expectedChapterGroups: 48,
    resolvePlaybackRange: helper.resolvePlaybackRange,
    numberEntries: entries => window.lerntexteSichtbareNummerierung(entries),
    loadOrderManifest: async () => {
      const response = await fetch(ORDER_MANIFEST_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
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
  summary: '0/13 Sidecars | 0/13 Bundles | 0/13 loadedmetadata | 0/13 duration > 0 | FAIL',
  failure: 'FAIL – Diagnose – START',
  results: [],
  recht: null,
  errors: [error.message]
})), 0));
