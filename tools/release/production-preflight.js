'use strict';

const PRODUCTION_APPS_SCRIPT_VERSION = 114;
const PRODUCTION_DEPLOYMENT_ID = 'AKfycbxTymUhl29rdmXONuWRlVkoe8xiFXqVf2bWUju1XgC44l2qoUT3LTU_PownQrNHbBKUVA';

function assertCleanComparison(comparison, phase) {
  if (!comparison || !Array.isArray(comparison.conflicts) || comparison.conflicts.length) {
    throw new Error(`Konflikt ${phase}: ${(comparison?.conflicts || ['ungültiger Vergleich']).join(', ')}`);
  }
  if (typeof comparison.fingerprint !== 'string' || !comparison.fingerprint) {
    throw new Error(`Konflikt ${phase}: Produktionsfingerprint fehlt.`);
  }
}

async function runAtomicPreflight(adapters) {
  const mainCommit = await adapters.getCurrentMainCommit();
  if (typeof mainCommit !== 'string' || !mainCommit) throw new Error('Aktueller main-Commit fehlt.');
  const before = await adapters.compareProductionExpectedOld();
  assertCleanComparison(before, 'vor Backup');
  const backup = await adapters.createFullProductionSheetBackup();
  if (!backup?.id) throw new Error('Frische Produktions-Sheetkopie wurde nicht bestätigt.');
  const gitReference = await adapters.createProductionGitRef(mainCommit);
  if (!gitReference?.ref || gitReference.commit !== mainCommit) throw new Error('Produktions-Git-Referenz ist ungültig.');
  const appsScript = await adapters.getProductionAppsScriptState();
  if (appsScript?.version !== PRODUCTION_APPS_SCRIPT_VERSION || appsScript?.deploymentId !== PRODUCTION_DEPLOYMENT_ID) {
    throw new Error('Produktives Apps-Script ist nicht mehr Version 114 bzw. die bekannte Deployment-ID.');
  }
  const podcast = await adapters.snapshotProductionPodcast();
  if (!podcast?.version || !Number.isInteger(podcast.objects) || !/^[a-f0-9]{64}$/.test(podcast.aggregateSha256 || '')) {
    throw new Error('Produktiver Podcast-Snapshot ist unvollständig.');
  }
  const runReport = await adapters.writeReleaseRunReport({
    status: 'PREFLIGHT_BACKUP_CREATED', mainCommit, beforeFingerprint: before.fingerprint,
    backup, gitReference, appsScript, podcast
  });
  if (!runReport?.id) throw new Error('Release-Run-Report wurde nicht bestätigt.');
  const after = await adapters.compareProductionExpectedOld();
  assertCleanComparison(after, 'nach Backup');
  if (after.fingerprint !== before.fingerprint) {
    throw new Error('Produktion wurde nach Backup verändert; Migration abgebrochen.');
  }
  return { readyForFirstWrite: true, mainCommit, backup, gitReference, appsScript, podcast, runReport };
}

module.exports = {
  PRODUCTION_APPS_SCRIPT_VERSION,
  PRODUCTION_DEPLOYMENT_ID,
  runAtomicPreflight
};
