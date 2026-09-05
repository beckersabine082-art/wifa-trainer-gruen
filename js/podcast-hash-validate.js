function lerntexteAudioVersionIstSynchron(currentHash, jsonHash, mp3Hash) {
  const hashes = [currentHash, jsonHash, mp3Hash];
  const sindGueltigeHashes = hashes.every(function(hash) {
    return typeof hash === 'string' && hash.length > 0 && /\S/.test(hash);
  });

  return sindGueltigeHashes && currentHash === jsonHash && jsonHash === mp3Hash;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lerntexteAudioVersionIstSynchron };
}

if (typeof window !== 'undefined') {
  window.lerntexteAudioVersionIstSynchron = lerntexteAudioVersionIstSynchron;
}