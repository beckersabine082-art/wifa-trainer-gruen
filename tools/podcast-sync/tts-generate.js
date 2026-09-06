const fs = require('fs');
const path = require('path');
const { PILOT_CONFIG } = require('./index.js');

async function generateTtsMp3({
  text,
  outputPath,
  openaiClient,
  countTtsTokens
}) {
  const normalizedText = String(text || '');

  if (!normalizedText.trim()) {
    throw new Error('TTS-Text fehlt');
  }

  if (!outputPath) {
    throw new Error('TTS outputPath fehlt');
  }

  if (
    !openaiClient ||
    !openaiClient.audio ||
    !openaiClient.audio.speech ||
    typeof openaiClient.audio.speech.create !== 'function'
  ) {
    throw new Error('OpenAI Speech Client fehlt');
  }

  if (typeof countTtsTokens !== 'function') {
    throw new Error('countTtsTokens fehlt');
  }

  const tokenCount = countTtsTokens(normalizedText, PILOT_CONFIG.ttsModel);

  if (tokenCount > 2000) {
    throw new Error(
      'TTS input exceeds 2000 Input-Tokens: ' + tokenCount
    );
  }

  const response = await openaiClient.audio.speech.create({
    model: PILOT_CONFIG.ttsModel,
    voice: PILOT_CONFIG.ttsVoice,
    input: normalizedText,
    response_format: 'mp3',
    instructions:
      'Sprich ruhig, klar und sachlich auf Deutsch. ' +
      'Lies den Eingabetext vollständig und ohne zusätzliche Inhalte vor.'
  });

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error('OpenAI TTS lieferte leere Audiodaten');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);

  return {
    mp3Path: outputPath,
    duration: null
  };
}

module.exports = {
  generateTtsMp3
};
