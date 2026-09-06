const fs = require('fs');

/**
 * Transkribiert Audiodatei in Wort-Zeitmarken mit OpenAI Whisper API
 * 
 * @param {Object} config - Konfiguration
 * @param {string} config.mp3Path - Pfad zur MP3-Audiodatei
 * @param {Object} config.openaiClient - Initialisierter OpenAI Client
 * 
 * @returns {Promise<{words: Array}>} Normalisierte Wort-Zeitmarken
 * 
 * @example
 * const { transcribeWordTimestamps } = require('./transcribe-words.js');
 * const result = await transcribeWordTimestamps({
 *   mp3Path: '/path/to/audio.mp3',
 *   openaiClient: openaiClientInstance
 * });
 * // result = {
 * //   words: [
 * //     { wort: 'Rechtssubjekte', start: 0, end: 1.5 },
 * //     { wort: 'sind', start: 1.5, end: 2 }
 * //   ]
 * // }
 */
async function transcribeWordTimestamps({
  mp3Path,
  openaiClient
}) {
  // Validiere mp3Path
  const safePath = String(mp3Path || '').trim();

  if (!safePath) {
    throw new Error('MP3-Pfad fehlt');
  }

  if (!fs.existsSync(safePath)) {
    throw new Error('MP3-Datei nicht gefunden: ' + safePath);
  }

  // Validiere openaiClient
  if (
    !openaiClient ||
    !openaiClient.audio ||
    !openaiClient.audio.transcriptions ||
    typeof openaiClient.audio.transcriptions.create !== 'function'
  ) {
    throw new Error('OpenAI Transcription Client fehlt');
  }

  // Rufe Whisper API auf mit exakten Parametern
  const result =
    await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(safePath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      language: 'de'
    });

  // Extrahiere words-Array aus result
  const sourceWords =
    Array.isArray(result && result.words)
      ? result.words
      : [];

  // Normalisiere: "word" -> "wort"
  return {
    words: sourceWords.map(function(word) {
      return {
        wort: String(word.word || ''),
        start: word.start,
        end: word.end
      };
    })
  };
}

module.exports = {
  transcribeWordTimestamps
};
