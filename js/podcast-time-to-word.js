/**
 * TASK 13: currentTime → Wortindex Mapping
 * 
 * Findet den Wortindex für eine gegebene Zeit mittels binärer Suche.
 * Regel: start <= currentTime < end
 * 
 * @param {Array} wortZeitmarken - Array von Objekten mit { wortIndex, start, end }
 * @param {number} currentTime - Die aktuelle Zeit in Sekunden
 * @returns {number} Der wortIndex oder -1 wenn nicht gefunden oder ungültig
 */
function findWordIndexAtTime(wortZeitmarken, currentTime) {
  // Validierung: wortZeitmarken muss ein Array sein
  if (!Array.isArray(wortZeitmarken)) {
    return -1;
  }

  // Validierung: Array darf nicht leer sein
  if (wortZeitmarken.length === 0) {
    return -1;
  }

  // Validierung: currentTime muss eine gültige Number sein
  if (typeof currentTime !== 'number' || isNaN(currentTime) || !isFinite(currentTime)) {
    return -1;
  }

  // Binäre Suche
  let left = 0;
  let right = wortZeitmarken.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const current = wortZeitmarken[mid];

    // Bereich-Prüfung: start <= currentTime < end
    if (currentTime < current.start) {
      // Zeit liegt vor diesem Wort
      right = mid - 1;
    } else if (currentTime >= current.end) {
      // Zeit liegt nach diesem Wort
      left = mid + 1;
    } else {
      // Zeit liegt im Bereich dieses Wortes
      return current.wortIndex;
    }
  }

  // Nicht gefunden
  return -1;
}

// CommonJS Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findWordIndexAtTime };
}

// Browser Export
if (typeof window !== 'undefined') {
  window.findWordIndexAtTime = findWordIndexAtTime;
}
