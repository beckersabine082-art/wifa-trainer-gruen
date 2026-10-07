(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WifaPodcastStagingDiagnosticCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const SUBJECTS = Object.freeze([
    'Führung und Zusammenarbeit', 'Betriebliches Management', 'Rechnungswesen', 'Steuern',
    'Marketing', 'Vertrieb', 'Recht', 'VWL', 'BWL', 'Logistik', 'Unternehmensführung',
    'Investition und Finanzierung', 'Betriebliches Rechnungswesen und Controlling'
  ]);

  function emptyReport(total) {
    return { pass: false, currentUser: false, idToken: false, sidecars: 0, bundles: 0, loadedmetadata: 0, total, errors: [] };
  }

  function finalize(report) {
    report.pass = report.currentUser && report.idToken && report.errors.length === 0 &&
      report.sidecars === report.total && report.bundles === report.total && report.loadedmetadata === report.total;
    report.summary = `${report.sidecars}/${report.total} Sidecars | ${report.bundles}/${report.total} Bundles | ` +
      `${report.loadedmetadata}/${report.total} loadedmetadata | ${report.pass ? 'PASS' : 'FAIL'}`;
    return report;
  }

  async function runPodcastStorageDiagnostic(options) {
    const subjects = Array.isArray(options?.subjects) ? options.subjects : [];
    const report = emptyReport(subjects.length);
    if (!options?.currentUser) {
      report.errors.push('Firebase currentUser fehlt.');
      return finalize(report);
    }
    report.currentUser = true;
    let token;
    try { token = await options.getIdToken(options.currentUser); }
    catch (error) { report.errors.push(`ID-Token: ${error.message}`); return finalize(report); }
    if (typeof token !== 'string' || !token.trim()) {
      report.errors.push('Firebase ID-Token fehlt.');
      return finalize(report);
    }
    report.idToken = true;
    const prefix = String(options.prefix || '');
    const version = String(options.version || '');
    if (!prefix.startsWith('podcast/staging/') || !version) {
      report.errors.push('Staging-Präfix oder Bundle-Version fehlt.');
      return finalize(report);
    }

    for (const subject of subjects) {
      try {
        const paths = options.pathsForSubject(subject);
        if (!paths?.sidecarPath?.startsWith(prefix) || !paths?.mp3Prefix?.startsWith(prefix)) {
          throw new Error('Sidecar-/Bundlepfad liegt außerhalb des Stagingpräfixes.');
        }
        const manifest = await options.loadSidecar(paths.sidecarPath);
        if (manifest?.bundleVersion !== version) throw new Error('Bundle-Version stimmt nicht.');
        if (typeof manifest.mp3Path !== 'string' || !manifest.mp3Path.startsWith(paths.mp3Prefix) ||
            manifest.mp3Path.startsWith('podcast/continuous/')) {
          throw new Error('Legacy- oder Fremdpräfix im MP3-Pfad.');
        }
        report.sidecars += 1;
        const bundle = await options.loadBundleMetadata(manifest.mp3Path);
        if (bundle?.contentType !== 'audio/mpeg' || !Number(bundle?.size)) throw new Error('MP3-Metadaten ungültig.');
        report.bundles += 1;
        const audio = await options.loadAudioMetadata(manifest.mp3Path, bundle);
        if (!Number.isFinite(audio?.duration) || audio.duration <= 0 || Number(audio.readyState) < 1) {
          throw new Error('loadedmetadata ohne gültige Dauer.');
        }
        report.loadedmetadata += 1;
      } catch (error) {
        report.errors.push(`${subject}: ${error.message}`);
      }
    }
    return finalize(report);
  }

  return { SUBJECTS, runPodcastStorageDiagnostic };
});
