'use strict';
/**
 * Query Intelligence � Minimal Extractor
 *
 * WHAT THIS DOES (only things Elasticsearch cannot do natively):
 *   1. Price constraints  � regex math: "under 20k" ? maxPrice:20000
 *   2. Condition filter   � handful of words: "used/second hand" ? condition:"used"
 *   3. "near me" flag     � forward GPS coordinates to ES geo filter
 *   4. Speech filler strip � removes "I want", "show me", etc. from voice input
 *
 * WHAT THIS DOES NOT DO (ES + Google STT handle these automatically):
 *   - Brand detection      ? ES multi_match on `brand` field with fuzzy + synonyms
 *   - Category mapping     ? ES relevance scoring on _entity field
 *   - City/location        ? ES location field full-text match
 *   - Hindi/Telugu/Tamil   ? Google/Apple STT handles language at capture time
 *   - Synonym expansion    ? ES listify_synonyms filter (see config/elasticsearch.js)
 *
 * Architecture (same as Flipkart / Amazon / OLX):
 *   Voice input  ? Google STT (expo-speech-recognition) ? text
 *   Text input   ? strip filler ? Elasticsearch (synonyms + fuzzy + multi_match)
 *   Price/range  ? this file (regex) ? ES filter
 *   Everything else ? ES handles it
 */

// -- Price unit multipliers ---------------------------------------
function parseAmount(numStr, unit) {
  const n = parseFloat((numStr || '').replace(/,/g, ''));
  if (isNaN(n)) return null;
  const u = (unit || '').toLowerCase().trim();
  if (u === 'k' || u === 'thousand')                            return n * 1_000;
  if (u === 'lakh' || u === 'lac' || u === 'lacs' || u === 'l') return n * 1_00_000;
  if (u === 'cr'   || u === 'crore')                            return n * 1_00_00_000;
  return n;
}

function fmtPrice(n) {
  if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

const NUM  = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const UNIT = String.raw`(k|lakh|lac|lacs|l|cr|crore|thousand)?`;
const AMT  = String.raw`(?:[\u20B9]|rs\.?\s?)?${NUM}\s*${UNIT}`;

const PRICE_RE = {
  range:  new RegExp(String.raw`(?:between\s+)?${AMT}\s*(?:to|and|-)\s*${AMT}`, 'i'),
  max:    new RegExp(String.raw`(?:under|below|max|upto|up to|within|less than|se kam|se neeche|intha)\s*${AMT}`, 'i'),
  min:    new RegExp(String.raw`(?:above|over|more than|minimum|min|atleast|at least|se zyada)\s*${AMT}`, 'i'),
  budget: new RegExp(String.raw`(?:${AMT}\s*(?:budget|ka budget)|budget\s*${AMT})`, 'i'),
};

const PRICE_STRIP_RES = [
  /(?:between\s+)?(?:[\u20B9]|rs\.?\s?)?\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|lacs|l|cr|crore|thousand)?\s*(?:to|and|-)\s*(?:[\u20B9]|rs\.?\s?)?\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|lacs|l|cr|crore|thousand)?/gi,
  /(?:under|below|max|upto|up to|within|less than|se kam|se neeche|intha|above|over|more than|minimum|min|atleast|at least|se zyada)\s*(?:[\u20B9]|rs\.?\s?)?\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|lacs|l|cr|crore|thousand)?/gi,
  /(?:[\u20B9]|rs\.?\s?)?\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|lacs|l|cr|crore|thousand)?\s*(?:budget|ka budget)/gi,
  /budget\s*(?:[\u20B9]|rs\.?\s?)?\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|lacs|l|cr|crore|thousand)?/gi,
];

// -- Condition words ----------------------------------------------
const USED_WORDS = ['second hand', 'secondhand', '2nd hand', 'pre-owned', 'preowned', 'refurbished', 'used', 'old'];
const NEW_WORDS  = ['brand new', 'mint condition', 'never used', 'sealed', 'unboxed', 'unused', 'new'];

// -- Speech filler to strip before sending to ES ------------------
const FILLER_RE = /^(?:(?:please|can you|could you)\s+)?(?:search|find|show|look|get)\s+(?:me\s+)?(?:for\s+)?|^(?:i want|i need|i'?m looking for|looking for)\s+(?:to (?:buy|find)\s+)?/i;
const SUFFIX_RE = /\s+(?:near me|nearby|for sale|please|now|today|cheapest?|best)\s*$/i;

class QueryIntelligenceService {
  /**
   * Parse a raw query. Returns structured params for the search route.
   * @param {string} rawQuery
   * @param {{ lat?: number, lng?: number }} [hints]
   */
  static parse(rawQuery, hints = {}) {
    if (!rawQuery || typeof rawQuery !== 'string') return this._empty(rawQuery || '');

    const raw  = rawQuery.trim();
    const text = raw.toLowerCase();

    const result = {
      originalQuery:  raw,
      cleanQuery:     raw,
      intent:         'search',
      minPrice:       null,
      maxPrice:       null,
      condition:      null,
      extractedChips: [],
    };

    // 1. Strip speech filler from voice input
    let clean = raw.replace(FILLER_RE, '').replace(SUFFIX_RE, '').trim() || raw;

    // 2. "near me" ? pass GPS so ES geo filter activates
    if (/\bnear(?:\s+me)?\b|\bnearby\b/i.test(text)) {
      result.nearMe = true;
      if (hints.lat && hints.lng) {
        result.lat = hints.lat;
        result.lng = hints.lng;
        result.extractedChips.push({ type: 'location', label: 'Near me', key: 'location' });
      }
      clean = clean.replace(/\bnear(?:\s+me)?\b|\bnearby\b/gi, '').trim();
    }

    // 3. Price (only thing ES cannot derive from text)
    this._price(text, result);
    clean = this.stripPrice(clean);

    // 4. Condition ? becomes an ES term filter
    this._condition(text, result);

    result.cleanQuery = clean.trim() || raw;
    return result;
  }

  static _price(text, r) {
    const rm = text.match(PRICE_RE.range);
    if (rm) {
      r.minPrice = parseAmount(rm[1], rm[2]);
      r.maxPrice = parseAmount(rm[3], rm[4]);
      if (r.minPrice != null) r.extractedChips.push({ type: 'price', label: `\u20B9${fmtPrice(r.minPrice)}\u2013\u20B9${fmtPrice(r.maxPrice)}`, key: 'price' });
      return;
    }
    const mx = text.match(PRICE_RE.max);
    if (mx) {
      r.maxPrice = parseAmount(mx[1], mx[2]);
      if (r.maxPrice != null) r.extractedChips.push({ type: 'price', label: `Under \u20B9${fmtPrice(r.maxPrice)}`, key: 'price' });
      return;
    }
    const mn = text.match(PRICE_RE.min);
    if (mn) {
      r.minPrice = parseAmount(mn[1], mn[2]);
      if (r.minPrice != null) r.extractedChips.push({ type: 'price', label: `Above \u20B9${fmtPrice(r.minPrice)}`, key: 'price' });
      return;
    }
    const bm = text.match(PRICE_RE.budget);
    if (bm) {
      r.maxPrice = parseAmount(bm[1] || bm[3], bm[2] || bm[4]);
      if (r.maxPrice != null) r.extractedChips.push({ type: 'price', label: `Budget \u20B9${fmtPrice(r.maxPrice)}`, key: 'price' });
    }
  }

  static _condition(text, r) {
    for (const kw of USED_WORDS) {
      if (text.includes(kw)) { r.condition = 'Used'; r.extractedChips.push({ type: 'condition', label: 'Used', key: 'condition' }); return; }
    }
    for (const kw of NEW_WORDS) {
      if (text.includes(kw)) { r.condition = 'New';  r.extractedChips.push({ type: 'condition', label: 'New',  key: 'condition' }); return; }
    }
  }

  /** Strip price phrases before sending to ES so "20k" is not treated as a product keyword. */
  static stripPrice(text) {
    let t = text;
    for (const re of PRICE_STRIP_RES) t = t.replace(re, '');
    return t.replace(/\s{2,}/g, ' ').trim();
  }

  static _empty(raw) {
    return { originalQuery: raw, cleanQuery: raw, intent: 'search', minPrice: null, maxPrice: null, condition: null, extractedChips: [] };
  }
}

module.exports = QueryIntelligenceService;
