const PILOT_CONFIG = Object.freeze({
  pilotFach: 'Recht',
  pilotTitel: 'Rechtssubjekte und Rechtsobjekte',
  ttsModel: 'gpt-4o-mini-tts',
  ttsVoice: 'alloy'
});

function getPodcastSyncConfig() {
  return {
    ...PILOT_CONFIG
  };
}

function requireOpenAiKey(env = process.env) {
  const value = String(env.OPENAI_API_KEY || '').trim();

  if (!value) {
    throw new Error('OPENAI_API_KEY fehlt');
  }

  return value;
}

function requireFirebaseAdminConfig(env = process.env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKeyRaw = String(env.FIREBASE_PRIVATE_KEY || '');
  const storageBucket = String(env.FIREBASE_STORAGE_BUCKET || '').trim();

  if (!projectId) throw new Error('FIREBASE_PROJECT_ID fehlt');
  if (!clientEmail) throw new Error('FIREBASE_CLIENT_EMAIL fehlt');
  if (!privateKeyRaw.trim()) throw new Error('FIREBASE_PRIVATE_KEY fehlt');
  if (!storageBucket) throw new Error('FIREBASE_STORAGE_BUCKET fehlt');

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
    storageBucket
  };
}

module.exports = {
  PILOT_CONFIG,
  getPodcastSyncConfig,
  requireOpenAiKey,
  requireFirebaseAdminConfig
};