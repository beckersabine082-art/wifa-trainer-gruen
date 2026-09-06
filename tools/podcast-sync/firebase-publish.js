const fs = require('fs');

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

async function publishToFirebase({ mp3Path, jsonPath, storageMp3Path, storageJsonPath, lerntextHash, adminClient }) {
  validateInput({ mp3Path, jsonPath, storageMp3Path, storageJsonPath, lerntextHash });

  const bucket = adminClient.storage().bucket();
  const mp3Data = fs.readFileSync(mp3Path);
  const jsonData = fs.readFileSync(jsonPath);

  await bucket.file(storageMp3Path).save(mp3Data, {
    metadata: {
      metadata: { lerntextHash }
    }
  });
  await bucket.file(storageJsonPath).save(jsonData, {
    metadata: { contentType: 'application/json' }
  });

  return {
    success: true,
    mp3Url: storageMp3Path,
    jsonUrl: storageJsonPath
  };
}

module.exports = { publishToFirebase };
