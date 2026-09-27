const { buildSubjectBundle, publishSubjectBundle, runFfmpeg } = require('./continuous-bundle');
const SIDECAR_PATH = 'podcast/continuous/recht.json';

async function buildRechtBundle(options) {
  if (!Array.isArray(options.lerntexte) || options.lerntexte.length !== 57) throw new Error('Recht-Bundle benötigt exakt 57 Lerntexte');
  if (options.lerntexte.some(entry => entry?.fach !== 'Recht')) throw new Error('Recht-Bundle darf nur Fach Recht enthalten');
  return buildSubjectBundle({ ...options, fach: 'Recht', catalog: options.catalog || options.lerntexte });
}

async function publishRechtBundle(options) {
  if (options.bundle?.sidecar?.fach !== 'Recht' || options.bundle?.sidecar?.chapters?.length !== 57) throw new Error('Recht-Bundle ungültig');
  const loadCatalog = options.loadCatalog || (() => require('./sync-bundles').loadBundleCatalog());
  return publishSubjectBundle({ ...options, loadCatalog });
}

async function buildAndPublishRechtBundle(options) {
  const bundle = await buildRechtBundle(options);
  const published = await publishRechtBundle({ ...options, bundle });
  return { bundle, published };
}

module.exports = { buildRechtBundle, publishRechtBundle, buildAndPublishRechtBundle, runFfmpeg, SIDECAR_PATH };
