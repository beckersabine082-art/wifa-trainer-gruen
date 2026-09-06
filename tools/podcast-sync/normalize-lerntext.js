/**
 * TASK 3: Canonical-TTS-Normalisierung
 * 
 * Normalisiert lerntext für TTS-Verarbeitung:
 * - Entfernt HTML-Formatierung
 * - Dekodiert HTML-Entities
 * - Normalisiert Whitespace
 * - Tokenisiert sichtbare Wörter
 * 
 * Invarianten:
 * - podcastText wird NIE verwendet
 * - Wortregel ist Unicode-sicher und gemeinsam mit Alignment/Karaoke
 * - sha256Lerntext hasht IMMER den RAW lerntext, niemals normalized text
 * - Keine fachliche Umformulierung, nur technische Transformation
 */

/**
 * Dekodiert HTML-Entities in Text
 * Unterstützt:
 * - Benannte Entities: &amp;, &lt;, &gt;, &quot;, &apos;, &nbsp;
 * - Dezimale Entities: &#123;
 * - Hexadezimale Entities: &#x1F600;
 * 
 * @param {string} text
 * @returns {string}
 */
function decodeHtmlEntities(text) {
  text = String(text || '');
  
  // Benannte Entities
  const namedEntities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' '
  };
  
  for (const entity in namedEntities) {
    text = text.split(entity).join(namedEntities[entity]);
  }
  
  // Dezimale numerische Entities: &#123;
  text = text.replace(/&#(\d+);/g, function(match, codePoint) {
    try {
      const code = parseInt(codePoint, 10);
      if (code > 0 && code <= 0x10FFFF) {
        return String.fromCodePoint(code);
      }
    } catch (e) {
      // Invalid codepoint, return original
    }
    return match;
  });
  
  // Hexadezimale numerische Entities: &#x1F600; oder &#xABC;
  text = text.replace(/&#x([0-9a-fA-F]+);/g, function(match, codePoint) {
    try {
      const code = parseInt(codePoint, 16);
      if (code > 0 && code <= 0x10FFFF) {
        return String.fromCodePoint(code);
      }
    } catch (e) {
      // Invalid codepoint, return original
    }
    return match;
  });
  
  return text;
}

/**
 * Tokenisiert Text in sichtbare Wörter
 * 
 * Regel: Unicode-sichere Tokenisierung
 * - Startet mit [\p{L}\p{N}]+ (Buchstaben oder Ziffern)
 * - Kann intern Bindestrich/Apostroph enthalten
 * - Endet mit [\p{L}\p{N}]
 * 
 * Beispiele:
 * - "Kosten-Nutzen-Analyse" -> 1 Wort
 * - "Manager's" -> 1 Wort
 * - "Das ist" -> 2 Wörter
 * - "Text. Absatz." -> 2 Wörter (Satzzeichen außen)
 * 
 * @param {string} text
 * @returns {string[]} Array von Wörtern
 */
function tokenizeVisibleWords(text) {
  text = String(text || '');
  
  // Unicode-Regel mit Bindestrich und Apostroph als interne Wortzeichen
  // [\p{L}\p{N}]+(?:[-''][\p{L}\p{N}]+)*
  // mit /gu (global, unicode)
  const words = text.match(/[\p{L}\p{N}]+(?:[-''][\p{L}\p{N}]+)*/gu) || [];
  
  return words;
}

/**
 * Normalisiert lerntext für TTS-Verarbeitung
 * 
 * Schritte:
 * 1. <br>-Tags in Zeilenumbrüche umwandeln
 * 2. Andere HTML-Tags entfernen
 * 3. HTML-Entities dekodieren
 * 4. Whitespace normalisieren (CRLF->LF, multiple spaces->single)
 * 5. Absatzstruktur erhalten
 * 6. Trimmen
 * 7. Wörter tokenisieren mit Indizes
 * 
 * Invariante: podcastText wird NICHT verwendet/angesehen
 * 
 * @param {string} lerntext - Der kanonische Lerntext (nie podcastText)
 * @returns {object} {text, words, wordCount}
 *   - text: normalisierter TTS-Text
 *   - words: [{index, text}, ...] mit 0-basierten Indizes
 *   - wordCount: Anzahl der Wörter
 */
function normalizeLerntextForTts(lerntext) {
  let text = String(lerntext || '');
  
  // Schritt 1: <br>-Tags (und Varianten) in Zeilenumbrüche
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Block-End-Tags in Zeilenumbrüche (</p>, </div>, </li>, </h1-6>, etc.)
  text = text.replace(/<\/(p|div|li|h[1-6]|article|section|blockquote)>/gi, '\n');
  
  // Schritt 2: Alle anderen HTML-Tags entfernen
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Schritt 3: HTML-Entities dekodieren
  text = decodeHtmlEntities(text);
  
  // Schritt 4: Whitespace normalisieren
  // - CRLF/CR -> LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // - Horizontale Whitespace (spaces/tabs) zusammenfassen
  text = text.replace(/[ \t]+/g, ' ');
  // - Spaces um Zeilenumbrüche bereinigen
  text = text.replace(/ +\n/g, '\n').replace(/\n +/g, '\n');
  // - Mehrfache Leerzeilen auf maximal 1 reduzieren
  text = text.replace(/\n{3,}/g, '\n\n');
  // - Trimmen
  text = text.trim();
  
  // Schritt 5: Wörter tokenisieren
  const wordList = tokenizeVisibleWords(text);
  const words = wordList.map(function(word, index) {
    return { index: index, text: word };
  });
  
  return {
    text: text,
    words: words,
    wordCount: words.length
  };
}

module.exports = {
  decodeHtmlEntities,
  tokenizeVisibleWords,
  normalizeLerntextForTts
};
