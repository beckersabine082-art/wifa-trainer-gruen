const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { publishToFirebase } = require('../tools/podcast-sync/firebase-publish.js');

const pilotMp3Path = 'podcast/recht-rechtssubjekte-und-rechtsobjekte.mp3';
const pilotJsonPath = 'podcast/recht-rechtssubjekte-und-rechtsobjekte.json';

let testCount = 0;
let passedCount = 0;

async function test(name, fn) {
  testCount++;
  try {
    await fn();
    passedCount++;
    console.log('✓ ' + name);
  } catch (error) {
    console.log('✗ ' + name);
    console.log('  Error: ' + error.message);
    process.exitCode = 1;
  }
}

function createFixtureFiles() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-firebase-'));
  const mp3Path = path.join(directory, 'source.mp3');
  const jsonPath = path.join(directory, 'source.json');
  fs.writeFileSync(mp3Path, 'mock mp3');
  fs.writeFileSync(jsonPath, '{"words":[]}');
  return { mp3Path, jsonPath };
}

function createMockClient(options) {
  const calls = [];
  let storageCalls = 0;
  const settings = options || {};
  const client = {
    storage: function() {
      storageCalls++;
      return {
        bucket: function() {
          return {
            file: function(storagePath) {
              return {
                save: async function(data, saveOptions) {
                  calls.push({ storagePath, data, saveOptions });
                  if (settings.failPath === storagePath) {
                    throw settings.error || new Error('mock upload failed');
                  }
                }
              };
            }
          };
        }
      };
    }
  };
  return { client, calls, getStorageCalls: function() { return storageCalls; } };
}

(async function() {
  await test('Firebase: MP3 wird vor JSON hochgeladen', async function() {
    const files = createFixtureFiles();
    const mock = createMockClient();

    await publishToFirebase({
      mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
      jsonPath: files.jsonPath,
      lerntextHash: 'hash-1',
      adminClient: mock.client
    });

    assert.deepStrictEqual(mock.calls.map(function(call) { return call.storagePath; }), [
      pilotMp3Path,
      pilotJsonPath
    ]);
  });

  await test('Firebase: MP3 erhält lerntextHash als Custom Metadata', async function() {
    const files = createFixtureFiles();
    const mock = createMockClient();

    await publishToFirebase({
      mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
      jsonPath: files.jsonPath,
      lerntextHash: 'sha256-unchanged',
      adminClient: mock.client
    });

    assert.deepStrictEqual(mock.calls[0].saveOptions, {
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: 'audio/mpeg',
        metadata: {
          lerntextHash: 'sha256-unchanged',
          manifestHash: require('crypto').createHash('sha256').update('{"words":[]}').digest('hex')
        }
      }
    });
  });

  await test('Firebase: JSON wird erst nach erfolgreichem MP3-Upload aufgerufen', async function() {
    const files = createFixtureFiles();
    const events = [];
    const mock = createMockClient();
    mock.calls.push = function(call) {
      events.push(call.storagePath);
      return Array.prototype.push.call(this, call);
    };

    await publishToFirebase({
      mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
      jsonPath: files.jsonPath,
      lerntextHash: 'hash-2',
      adminClient: mock.client
    });

    assert.deepStrictEqual(events, [pilotMp3Path, pilotJsonPath]);
  });

  await test('Firebase: MP3-Fehler blockiert JSON', async function() {
    const files = createFixtureFiles();
    const mock = createMockClient({ failPath: pilotMp3Path });

    await assert.rejects(function() {
      return publishToFirebase({
        mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
        jsonPath: files.jsonPath,
        lerntextHash: 'hash-3',
        adminClient: mock.client
      });
    }, /mock upload failed/);

    assert.strictEqual(mock.calls.length, 1);
    assert.strictEqual(mock.calls[0].storagePath, pilotMp3Path);
  });

  await test('Firebase: JSON-Fehler wird propagiert und meldet keinen Erfolg', async function() {
    const files = createFixtureFiles();
    const error = new Error('json upload failed');
    const mock = createMockClient({ failPath: pilotJsonPath, error });

    await assert.rejects(function() {
      return publishToFirebase({
        mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
        jsonPath: files.jsonPath,
        lerntextHash: 'hash-4',
        adminClient: mock.client
      });
    }, function(actualError) {
      return actualError === error;
    });

    assert.strictEqual(mock.calls.length, 2);
  });

  await test('Firebase: Erfolgsfall liefert URLs und success', async function() {
    const files = createFixtureFiles();
    const mock = createMockClient();

    const result = await publishToFirebase({
      mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
      jsonPath: files.jsonPath,
      lerntextHash: 'hash-5',
      adminClient: mock.client
    });

    assert.deepStrictEqual(result, {
      success: true,
      mp3Url: pilotMp3Path,
      jsonUrl: pilotJsonPath
    });
  });

  await test('Firebase: Pilot-Storage-Pfade sind exakt korrekt', async function() {
    const files = createFixtureFiles();
    const mock = createMockClient();

    await publishToFirebase({
      mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
      jsonPath: files.jsonPath,
      lerntextHash: 'hash-6',
      adminClient: mock.client
    });

    assert.strictEqual(mock.calls[0].storagePath, pilotMp3Path);
    assert.strictEqual(mock.calls[1].storagePath, pilotJsonPath);
  });

  await test('Firebase: fehlender MP3-Pfad wird vor storage() abgelehnt', async function() {
    const files = createFixtureFiles();
    const mock = createMockClient();
    fs.unlinkSync(files.mp3Path);

    await assert.rejects(function() {
      return publishToFirebase({
        mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
        jsonPath: files.jsonPath,
        lerntextHash: 'hash-7',
        adminClient: mock.client
      });
    }, /MP3-Datei nicht gefunden/);

    assert.strictEqual(mock.getStorageCalls(), 0);
    assert.strictEqual(mock.calls.length, 0);
  });

  await test('Firebase: fehlender JSON-Pfad wird vor storage() abgelehnt', async function() {
    const files = createFixtureFiles();
    const mock = createMockClient();
    fs.unlinkSync(files.jsonPath);

    await assert.rejects(function() {
      return publishToFirebase({
        mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
        jsonPath: files.jsonPath,
        lerntextHash: 'hash-8',
        adminClient: mock.client
      });
    }, /JSON-Datei nicht gefunden/);

    assert.strictEqual(mock.getStorageCalls(), 0);
    assert.strictEqual(mock.calls.length, 0);
  });

  await test('Firebase: leerer lerntextHash wird vor storage() abgelehnt', async function() {
    const files = createFixtureFiles();
    const mock = createMockClient();

    await assert.rejects(function() {
      return publishToFirebase({
        mp3Path: files.mp3Path,
      storageMp3Path: pilotMp3Path, storageJsonPath: pilotJsonPath,
      expectedState: {mp3Generation:0,jsonGeneration:0},
        jsonPath: files.jsonPath,
        lerntextHash: '',
        adminClient: mock.client
      });
    }, /lerntextHash darf nicht leer sein/);

    assert.strictEqual(mock.getStorageCalls(), 0);
    assert.strictEqual(mock.calls.length, 0);
  });

  console.log(`\n${passedCount}/${testCount} tests passed`);
})();
