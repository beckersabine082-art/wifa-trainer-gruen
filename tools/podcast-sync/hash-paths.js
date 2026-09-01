/**
 * TASK 4: SHA-256 and canonical Firebase paths
 *
 * Single source of truth for:
 * - Canonical SHA-256 hashing of raw lerntext
 * - Podcast slug generation (parses with frontend lerntexteAudioSlug)
 * - Firebase Storage paths for MP3/JSON
 */

const crypto = require('crypto');

/**
 * Computes canonical SHA-256 hash of raw lerntext
 *
 * Invariant:
 * - Uses RAW lerntext (never normalized)
 * - UTF-8 encoding
 * - Ignores podcastText
 * - Output: 64-char hex string
 *
 * @param {string} text - Raw lerntext
 * @returns {string} SHA-256 hex digest
 */
function sha256Lerntext(text) {
  return crypto
    .createHash('sha256')
    .update(String(text || ''), 'utf8')
    .digest('hex');
}

/**
 * Converts a string to a URL-safe slug for podcast paths
 *
 * Replicates frontend's lerntexteAudioSlug() exactly:
 * 1. Lowercase + trim
 * 2. Umlaut replacement: ä→ae, ö→oe, ü→ue, ß→ss
 * 3. Unicode normalization (NFD) + diacritic removal
 * 4. Non-alphanumeric (except hyphens) → hyphens
 * 5. Collapse multiple hyphens
 * 6. Strip leading/trailing hyphens
 *
 * Examples:
 * - "Recht" → "recht"
 * - "Bücher" → "buecher"
 * - "Café Résumé" → "cafe-resume"
 * - "Recht: Vertrag / Angebot & Annahme" → "recht-vertrag-angebot-annahme"
 *
 * @param {string} value
 * @returns {string} URL-safe slug
 */
function podcastSlug(value) {
  const text = String(value || '').trim().toLowerCase();

  // Step 1: Replace common umlauts and ß
  let slug = text
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');

  // Step 2: Unicode normalization (NFD) + remove diacritics
  // This handles accents like é, à, ñ, etc.
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Step 3: Replace anything that's not a-z, 0-9, or hyphen with hyphen
  slug = slug.replace(/[^a-z0-9\-]/g, '-');

  // Step 4: Collapse consecutive hyphens
  slug = slug.replace(/\-{2,}/g, '-');

  // Step 5: Remove leading/trailing hyphens
  slug = slug.replace(/^\-+|\-+$/g, '');

  return slug;
}

/**
 * Generates Firebase Storage paths for podcast audio
 *
 * Format:
 * - podcast/{fach-slug}-{titel-slug}.mp3
 * - podcast/{fach-slug}-{titel-slug}.json
 *
 * @param {string} fach - Subject/discipline (e.g., "Recht")
 * @param {string} titel - Unit title (e.g., "Rechtssubjekte und Rechtsobjekte")
 * @returns {object} {mp3Path, jsonPath}
 */
function podcastPaths(fach, titel) {
  const base = 'podcast/' + podcastSlug(fach) + '-' + podcastSlug(titel);

  return {
    mp3Path: base + '.mp3',
    jsonPath: base + '.json'
  };
}

module.exports = {
  sha256Lerntext,
  podcastSlug,
  podcastPaths
};
