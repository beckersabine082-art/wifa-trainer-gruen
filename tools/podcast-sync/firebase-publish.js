const fs = require('fs');
const { createHash } = require('node:crypto');

function validateInput({ mp3Path, jsonPath, storageMp3Path, storageJsonPath, lerntextHash }) {
  if (!mp3Path || !fs.existsSync(mp3Path)) {
    throw new Error('MP3-Datei nicht gefunden: ' + mp3Path);
  }
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    throw new Error('JSON-Datei nicht gefunden: ' + jsonPath);
  }
  if (typeof lerntextHash !== 'string' || lerntextHash.trim() === '') {
    throw new Error('lerntextHash darf nicht leer sein');
  }
  if (!storageMp3Path || !storageJsonPath) {
    throw new Error('Firebase-Zielpfade fehlen');
  }
}

async function publishToFirebase({ mp3Path, jsonPath, storageMp3Path, storageJsonPath, lerntextHash, adminClient, expectedState }) {
  validateInput({ mp3Path, jsonPath, storageMp3Path, storageJsonPath, lerntextHash });

  const bucket = adminClient.storage().bucket();
  const mp3Data = fs.readFileSync(mp3Path);
  const jsonData = fs.readFileSync(jsonPath);
  if (!expectedState || expectedState.mp3Generation === undefined || expectedState.jsonGeneration === undefined) {
    throw new Error('Geprüfte Firebase-Objektversionen fehlen');
  }

  await bucket.file(storageMp3Path).save(mp3Data, {
    preconditionOpts: { ifGenerationMatch: expectedState.mp3Generation },
    metadata: {
      contentType: 'audio/mpeg',
      metadata: { lerntextHash, manifestHash: createHash('sha256').update(jsonData).digest('hex') }
    }
  });
  await bucket.file(storageJsonPath).save(jsonData, {
    preconditionOpts: { ifGenerationMatch: expectedState.jsonGeneration },
    metadata: { contentType: 'application/json' }
  });

  return {
    success: true,
    mp3Url: storageMp3Path,
    jsonUrl: storageJsonPath
  };
}

module.exports = { publishToFirebase };
