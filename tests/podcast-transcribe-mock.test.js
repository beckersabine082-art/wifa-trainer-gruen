const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  transcribeWordTimestamps
} = require('../tools/podcast-sync/transcribe-words.js');

/**
 * Erstelle eine temporäre Fake-MP3-Datei für Tests
 */
function createFakeMp3() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-test-'));
  const fakeMp3Path = path.join(tempDir, 'fake-audio-test.mp3');
  // Schreibe minimale Daten (keine echte MP3, nur für Datei-Existenz-Tests)
  fs.writeFileSync(fakeMp3Path, Buffer.from([0xFF, 0xFB, 0x90, 0x00]));
  return fakeMp3Path;
}

async function consumeReadStream(stream) {
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
    return;
  }

  for await (const chunk of stream) {
    // Der Inhalt ist für den Mock irrelevant; wir lesen den Stream bis zum Ende,
    // damit er sauber geschlossen wird, bevor der temporäre Testordner entfernt wird.
    void chunk;
  }
}

/**
 * Mock OpenAI Client für Tests
 */
function createMockOpenAiClient(mockResponse) {
  return {
    audio: {
      transcriptions: {
        create: async function(params) {
          assert.strictEqual(params.model, 'whisper-1', 'model must be "whisper-1"');
          assert.strictEqual(params.response_format, 'verbose_json', 'response_format must be "verbose_json"');
          assert.deepStrictEqual(params.timestamp_granularities, ['word'], 'timestamp_granularities must be ["word"]');
          assert.strictEqual(params.language, 'de', 'language must be "de"');
          assert.ok(params.file, 'file parameter must be present');
          assert.ok(typeof params.file.read === 'function', 'file must be a readable stream');
          await consumeReadStream(params.file);
          return mockResponse;
        }
      }
    }
  };
}

async function testA_ExactRequestParameters() {
  const fakeMp3 = createFakeMp3();
  try {
    const mockResponse = {
      words: [
        { word: 'Rechtssubjekte', start: 0, end: 1.5 },
        { word: 'sind', start: 1.5, end: 2 }
      ]
    };
    const mockClient = createMockOpenAiClient(mockResponse);
    const result = await transcribeWordTimestamps({ mp3Path: fakeMp3, openaiClient: mockClient });
    assert.ok(result, 'result must be present');
    assert.ok(Array.isArray(result.words), 'result.words must be an array');
  } finally {
    try { fs.rmSync(path.dirname(fakeMp3), { recursive: true }); } catch (e) {}
  }
}

async function testB_FileIsReadStream() {
  const fakeMp3 = createFakeMp3();
  try {
    let receivedStream = null;
    const mockClient = {
      audio: {
        transcriptions: {
          create: async function(params) {
            receivedStream = params.file;
            await consumeReadStream(params.file);
            return { words: [] };
          }
        }
      }
    };
    await transcribeWordTimestamps({ mp3Path: fakeMp3, openaiClient: mockClient });
    assert.ok(receivedStream, 'file parameter must be passed to API');
    assert.ok(typeof receivedStream.read === 'function', 'file must be a readable stream');
  } finally {
    try { fs.rmSync(path.dirname(fakeMp3), { recursive: true }); } catch (e) {}
  }
}

async function testC_NormalizesWordToWort() {
  const fakeMp3 = createFakeMp3();
  try {
    const mockResponse = {
      words: [
        { word: 'Rechtssubjekte', start: 0, end: 1.5 },
        { word: 'sind', start: 1.5, end: 2 }
      ]
    };
    const mockClient = createMockOpenAiClient(mockResponse);
    const result = await transcribeWordTimestamps({ mp3Path: fakeMp3, openaiClient: mockClient });
    assert.strictEqual(result.words.length, 2, 'should have 2 words');
    assert.strictEqual(result.words[0].wort, 'Rechtssubjekte', 'first word should be normalized');
    assert.strictEqual(result.words[1].wort, 'sind', 'second word should be normalized');
    assert.ok(!result.words[0].hasOwnProperty('word'), 'original "word" property should be removed');
  } finally {
    try { fs.rmSync(path.dirname(fakeMp3), { recursive: true }); } catch (e) {}
  }
}

async function testD_WordOrderUnchanged() {
  const fakeMp3 = createFakeMp3();
  try {
    const mockResponse = {
      words: [
        { word: 'Das', start: 0, end: 0.5 },
        { word: 'ist', start: 0.5, end: 1 },
        { word: 'ein', start: 1, end: 1.5 },
        { word: 'Test', start: 1.5, end: 2 }
      ]
    };
    const mockClient = createMockOpenAiClient(mockResponse);
    const result = await transcribeWordTimestamps({ mp3Path: fakeMp3, openaiClient: mockClient });
    assert.strictEqual(result.words[0].wort, 'Das');
    assert.strictEqual(result.words[1].wort, 'ist');
    assert.strictEqual(result.words[2].wort, 'ein');
    assert.strictEqual(result.words[3].wort, 'Test');
  } finally {
    try { fs.rmSync(path.dirname(fakeMp3), { recursive: true }); } catch (e) {}
  }
}

async function testE_StartEndNumericUnchanged() {
  const fakeMp3 = createFakeMp3();
  try {
    const mockResponse = {
      words: [
        { word: 'Test', start: 0.123, end: 1.456 },
        { word: 'Wort', start: 1.456, end: 2.789 }
      ]
    };
    const mockClient = createMockOpenAiClient(mockResponse);
    const result = await transcribeWordTimestamps({ mp3Path: fakeMp3, openaiClient: mockClient });
    assert.strictEqual(result.words[0].start, 0.123);
    assert.strictEqual(result.words[0].end, 1.456);
    assert.strictEqual(result.words[1].start, 1.456);
    assert.strictEqual(result.words[1].end, 2.789);
  } finally {
    try { fs.rmSync(path.dirname(fakeMp3), { recursive: true }); } catch (e) {}
  }
}

async function testF_MissingMp3PathBeforeApi() {
  const mockClient = createMockOpenAiClient({ words: [] });
  try {
    await transcribeWordTimestamps({ mp3Path: null, openaiClient: mockClient });
    assert.fail('should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('Pfad') || e.message.includes('fehlt'), 'error should mention missing path');
  }
}

async function testG_MissingMp3FileBeforeApi() {
  const mockClient = createMockOpenAiClient({ words: [] });
  try {
    await transcribeWordTimestamps({ mp3Path: '/nicht/existente/datei.mp3', openaiClient: mockClient });
    assert.fail('should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('nicht') || e.message.includes('existiert'), 'error should mention missing file');
  }
}

async function testH_MissingClientBeforeApi() {
  const fakeMp3 = createFakeMp3();
  try {
    await transcribeWordTimestamps({ mp3Path: fakeMp3, openaiClient: null });
    assert.fail('should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('Client') || e.message.includes('fehlt'), 'error should mention missing client');
  } finally {
    try { fs.rmSync(path.dirname(fakeMp3), { recursive: true }); } catch (e) {}
  }
}

async function testI_MissingWordsReturnsEmpty() {
  const fakeMp3 = createFakeMp3();
  try {
    const mockClient = {
      audio: {
        transcriptions: {
          create: async function(params) {
            await consumeReadStream(params.file);
            return { text: 'transcription' };
          }
        }
      }
    };
    const result = await transcribeWordTimestamps({ mp3Path: fakeMp3, openaiClient: mockClient });
    assert.deepStrictEqual(result, { words: [] }, 'should return { words: [] } when no words present');
  } finally {
    try { fs.rmSync(path.dirname(fakeMp3), { recursive: true }); } catch (e) {}
  }
}

async function testJ_NoClientAtRequireTime() {
  const mod = require('../tools/podcast-sync/transcribe-words.js');
  assert.ok(mod && typeof mod.transcribeWordTimestamps === 'function', 'transcribeWordTimestamps must be a function');
}

async function run() {
  await testA_ExactRequestParameters();
  await testB_FileIsReadStream();
  await testC_NormalizesWordToWort();
  await testD_WordOrderUnchanged();
  await testE_StartEndNumericUnchanged();
  await testF_MissingMp3PathBeforeApi();
  await testG_MissingMp3FileBeforeApi();
  await testH_MissingClientBeforeApi();
  await testI_MissingWordsReturnsEmpty();
  await testJ_NoClientAtRequireTime();
  console.log('10/10 Transcribe mock tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
