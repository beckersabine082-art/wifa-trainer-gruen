const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {syncAll, inspectAll} = require('../tools/podcast-sync/sync-all.js');
const {withPublishLock} = require('../tools/podcast-sync/publish-lock.js');
const {sha256Lerntext,podcastPaths} = require('../tools/podcast-sync/hash-paths.js');
const entry = {fach:'Recht',titel:'Test',lerntext:'Ein Test.',podcastText:'FALSCH'};

function store() {
  const data = new Map();
  let generation = 0;
  return {data, file(name) {return {
    exists: async () => [data.has(name)],
    getMetadata: async () => [{generation:String(data.get(name).generation),metadata:data.get(name).metadata}],
    download: async () => [data.get(name).buffer],
    delete: async options => {
      assert.equal(options.ifGenerationMatch,String(data.get(name).generation));
      data.delete(name);
    },
    save: async (buffer, options) => {
      if (options.preconditionOpts.ifGenerationMatch !== (data.get(name)?.generation?.toString() || 0)) {
        const error = new Error('Generation mismatch'); error.code = 412; throw error;
      }
      data.set(name,{buffer,metadata:options.metadata.metadata,generation:++generation});
    }
  };}};
}

test('lokaler Sync veröffentlicht, verifiziert und überspringt beim Neustart fertige Paare', async () => {
  const bucket=store(); const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'local-sync-test-'));
  let generated=0;
  const generateLocal=async ({lerntext,outputPath}) => {
    assert.equal(lerntext,'Ein Test.'); generated++;
    fs.writeFileSync(outputPath,Buffer.alloc(1500,1));
    return {wortZeitmarken:[{wortIndex:0,wort:'Ein',start:0,end:0.3},{wortIndex:1,wort:'Test',start:0.3,end:0.8}]};
  };
  const config={lerntexte:[entry],adminClient:{storage:()=>({bucket:()=>bucket})},tempDir,adapters:{generateLocal}};
  const first=await syncAll(config);
  assert.equal(first.generated.length,1); assert.equal(first.failed.length,0);
  const versions=Array.from(bucket.data.values()).map(x=>x.generation);
  const second=await syncAll(config);
  assert.equal(second.inspection.summary['VALID/SKIP'],1);
  assert.equal(generated,1);
  assert.deepEqual(Array.from(bucket.data.values()).map(x=>x.generation),versions);
  assert.equal(fs.readdirSync(tempDir).length,0);
  fs.rmdirSync(tempDir);
});

test('Publikationssperre verhindert zweiten Schreiber zwischen MP3 und JSON', async () => {
  const bucket=store(); let entered=false;
  await withPublishLock(bucket,'podcast/test.mp3',async()=>{
    await assert.rejects(withPublishLock(bucket,'podcast/test.mp3',async()=>{entered=true;}), /gerade veröffentlicht/);
  });
  assert.equal(entered,false);
  assert.equal(bucket.data.size,0);
  await withPublishLock(bucket,'podcast/test.mp3',async()=>{entered=true;});
  assert.equal(entered,true);
});

test('gleicher Lerntexthash mit falschen Manifestbytes gilt nicht als fertiges Paar', async () => {
  const bucket=store();const paths=podcastPaths(entry.fach,entry.titel);const hash=sha256Lerntext(entry.lerntext);
  bucket.data.set(paths.mp3Path,{generation:1,metadata:{lerntextHash:hash,manifestHash:'0'.repeat(64)},buffer:Buffer.from('audio')});
  bucket.data.set(paths.jsonPath,{generation:2,buffer:Buffer.from(JSON.stringify({lerntextHash:hash}))});
  const result=await inspectAll({lerntexte:[entry],bucket});
  assert.equal(result.summary['VALID/SKIP'],0);
  assert.equal(result.summary.SYNC_NEEDED,1);
});

test('gültiges Paar wird auch dann geschützt, wenn es während der Erzeugung erscheint',async()=>{
  const bucket=store();const paths=podcastPaths(entry.fach,entry.titel);
  const hash=sha256Lerntext(entry.lerntext);
  const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'local-race-test-'));
  const result=await syncAll({lerntexte:[entry],adminClient:{storage:()=>({bucket:()=>bucket})},tempDir,
    adapters:{generateLocal:async({outputPath})=>{
      fs.writeFileSync(outputPath,'audio');
      bucket.data.set(paths.mp3Path,{generation:10,metadata:{lerntextHash:hash},buffer:Buffer.from('existing')});
      bucket.data.set(paths.jsonPath,{generation:11,buffer:Buffer.from(JSON.stringify({lerntextHash:hash}))});
      return {wortZeitmarken:[{wortIndex:0,wort:'Ein',start:0,end:0.3},{wortIndex:1,wort:'Test',start:0.3,end:0.8}]};
    }}});
  assert.equal(result.failed.length,0);
  assert.equal(bucket.data.get(paths.mp3Path).generation,10);
  assert.equal(bucket.data.get(paths.jsonPath).generation,11);
  fs.rmdirSync(tempDir);
});
