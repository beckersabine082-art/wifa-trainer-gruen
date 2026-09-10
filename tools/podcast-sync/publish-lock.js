const { randomUUID } = require('node:crypto');

// Serialize the entire read/check + two-object publish. Object CAS alone cannot
// protect a pair from another writer completing JSON between those operations.
async function withPublishLock(bucket, mp3Path, action) {
  const lock = bucket.file('podcast-sync-locks/' + mp3Path.replaceAll('/', '_') + '.lock');
  const owner = randomUUID();
  async function claim() {
    await lock.save(Buffer.from(owner), {
      preconditionOpts: {ifGenerationMatch:0},
      metadata: {contentType:'text/plain', metadata:{owner, createdAt:new Date().toISOString()}}
    });
  }
  try {
    await claim();
  } catch (error) {
    if (Number(error.code) !== 412) throw error;
    const [metadata] = await lock.getMetadata();
    const createdAt = Date.parse(metadata.timeCreated || metadata.metadata?.createdAt);
    // Publication only (not synthesis) is locked. Interrupted leases can be
    // reclaimed after 30 minutes; generation checks protect the reclaim itself.
    if (!Number.isFinite(createdAt) || Date.now() - createdAt < 30 * 60 * 1000) {
      throw new Error('Einheit wird gerade veröffentlicht; später erneut starten: ' + mp3Path);
    }
    await lock.delete({ifGenerationMatch:metadata.generation});
    await claim();
  }
  const [metadata] = await lock.getMetadata();
  if (metadata.metadata?.owner !== owner) throw new Error('Veröffentlichungssperre verloren');
  try {
    return await action();
  } finally {
    await lock.delete({ifGenerationMatch:metadata.generation});
  }
}

module.exports = {withPublishLock};
