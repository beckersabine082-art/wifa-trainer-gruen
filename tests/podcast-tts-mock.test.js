const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { generateTtsMp3 } = require('../tools/podcast-sync/tts-generate.js');

function createTempOutputPath(prefix = 'tts-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return path.join(dir, 'output.mp3');
}

async function testBlockBeforeApi() {
  let callMade = false;
  const mockClient = {
    audio: {
      speech: {
        create: async () => {
          callMade = true;
          return { arrayBuffer: async () => Buffer.from('should-not-be-used') };
        }
      }
    }
  };

  try {
    await generateTtsMp3({
      text: 'Tokenbasierter Grenzfall',
      outputPath: createTempOutputPath('tts-limit-'),
      openaiClient: mockClient,
      countTtsTokens: () => 2001
    });
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(String(err.message).includes('2000 Input-Tokens'), 'Tokenlimit message');
    assert.strictEqual(callMade, false, 'API must not be called');
  }
}

async function testExact2000Allowed() {
  let callCount = 0;
  const outputPath = createTempOutputPath('tts-2000-');
  const mockClient = {
    audio: {
      speech: {
        create: async () => {
          callCount += 1;
          return {
            arrayBuffer: async () => Buffer.from([1, 2, 3, 4])
          };
        }
      }
    }
  };

  const result = await generateTtsMp3({
    text: 'ok',
    outputPath,
    openaiClient: mockClient,
    countTtsTokens: () => 2000
  });

  assert.strictEqual(callCount, 1, 'API called exactly once');
  assert.strictEqual(result.mp3Path, outputPath, 'returns mp3 path');
  assert.strictEqual(result.duration, null, 'duration remains null');
}

async function testRequestParameters() {
  let capturedParams = null;
  const text = 'Normalisierter Lerntext';
  const mockClient = {
    audio: {
      speech: {
        create: async (params) => {
          capturedParams = params;
          return {
            arrayBuffer: async () => Buffer.from('ok')
          };
        }
      }
    }
  };

  await generateTtsMp3({
    text,
    outputPath: createTempOutputPath('tts-params-'),
    openaiClient: mockClient,
    countTtsTokens: () => 10
  });

  assert.ok(capturedParams, 'params captured');
  assert.strictEqual(capturedParams.model, 'gpt-4o-mini-tts');
  assert.strictEqual(capturedParams.voice, 'alloy');
  assert.strictEqual(capturedParams.input, text);
  assert.strictEqual(capturedParams.response_format, 'mp3');
  assert.ok(capturedParams.instructions.includes('ruhig, klar und sachlich auf Deutsch'));
}

async function testInputMustBePassedUnchanged() {
  const text = 'Absatz eins.\nAbsatz zwei.';
  let capturedInput = null;
  const mockClient = {
    audio: {
      speech: {
        create: async (params) => {
          capturedInput = params.input;
          return {
            arrayBuffer: async () => Buffer.from('ok')
          };
        }
      }
    }
  };

  await generateTtsMp3({
    text,
    outputPath: createTempOutputPath('tts-input-'),
    openaiClient: mockClient,
    countTtsTokens: () => 5
  });

  assert.strictEqual(capturedInput, text, 'must pass the exact input string unchanged');
}

async function testResponseWritesMp3AndReturnsPath() {
  const outputPath = createTempOutputPath('tts-write-');
  const mockClient = {
    audio: {
      speech: {
        create: async () => ({
          arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer
        })
      }
    }
  };

  const result = await generateTtsMp3({
    text: 'Schreibe MP3',
    outputPath,
    openaiClient: mockClient,
    countTtsTokens: () => 3
  });

  const fileBytes = fs.readFileSync(outputPath);
  assert.deepStrictEqual(Array.from(fileBytes), [1, 2, 3, 4]);
  assert.deepStrictEqual(result, { mp3Path: outputPath, duration: null });
}

async function testCreatesParentDirectory() {
  const dir = path.join(os.tmpdir(), 'tts-parent-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  const outputPath = path.join(dir, 'nested', 'audio', 'test.mp3');
  const mockClient = {
    audio: {
      speech: {
        create: async () => ({
          arrayBuffer: async () => Buffer.from('abc')
        })
      }
    }
  };

  await generateTtsMp3({
    text: 'Verzeichnisse erzeugen',
    outputPath,
    openaiClient: mockClient,
    countTtsTokens: () => 3
  });

  assert.ok(fs.existsSync(outputPath), 'file created in nested directory');
}

async function testEmptyAudioRejected() {
  const mockClient = {
    audio: {
      speech: {
        create: async () => ({
          arrayBuffer: async () => Buffer.alloc(0)
        })
      }
    }
  };

  await assert.rejects(
    () => generateTtsMp3({
      text: 'Leere Antwort',
      outputPath: createTempOutputPath('tts-empty-'),
      openaiClient: mockClient,
      countTtsTokens: () => 2
    }),
    /leere Audiodaten|empty/i
  );
}

async function testNoClientAtRequireTime() {
  const mod = require('../tools/podcast-sync/tts-generate.js');
  assert.ok(mod && typeof mod.generateTtsMp3 === 'function');
}

async function run() {
  await testBlockBeforeApi();
  await testExact2000Allowed();
  await testRequestParameters();
  await testInputMustBePassedUnchanged();
  await testResponseWritesMp3AndReturnsPath();
  await testCreatesParentDirectory();
  await testEmptyAudioRejected();
  await testNoClientAtRequireTime();
  console.log('8/8 TTS mock tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
