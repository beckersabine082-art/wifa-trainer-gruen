const fs = require('fs');

const MP3_STORAGE_PATH = 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3';
const JSON_STORAGE_PATH = 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json';

function validateInput({ mp3Path, jsonPath, lerntextHash }) {
  if (!mp3Path || !fs.existsSync(mp3Path)) {
    throw new Error('MP3-Datei nicht gefunden: ' + mp3Path);
  }
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    throw new Error('JSON-Datei nicht gefunden: ' + jsonPath);
  }
  if (typeof lerntextHash !== 'string' || lerntextHash.trim() === '') {
    throw new Error('lerntextHash darf nicht leer sein');
  }
}

async function publishToFirebase({ mp3Path, jsonPath, lerntextHash, adminClient }) {
  validateInput({ mp3Path, jsonPath, lerntextHash });

  const bucket = adminClient.storage().bucket();
  const mp3Data = fs.readFileSync(mp3Path);
  const jsonData = fs.readFileSync(jsonPath);

  await bucket.file(MP3_STORAGE_PATH).save(mp3Data, {
    metadata: {
      metadata: { lerntextHash }
    }
  });
  await bucket.file(JSON_STORAGE_PATH).save(jsonData, {
    metadata: { contentType: 'application/json' }
  });

  return {
    success: true,
    mp3Url: MP3_STORAGE_PATH,
    jsonUrl: JSON_STORAGE_PATH
  };
}

module.exports = { publishToFirebase };
