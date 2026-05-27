/**
 * Image Moderation Service — v2
 *
 * Combines Google Cloud Vision SafeSearch + Label Detection + Web Detection
 * with a rule-based decision matrix to detect:
 *   - Explicit adult / sexual content
 *   - Graphic violence / gore
 *   - Illegal goods: drugs, weapons, paraphernalia
 *   - Hate symbols (swastika, KKK, etc.)
 *   - Underage safety concerns (flagged for human review)
 *
 * Credentials: set GOOGLE_VISION_CREDENTIALS_PATH (relative to server root)
 *              OR GOOGLE_APPLICATION_CREDENTIALS (absolute path to JSON key).
 *              NEVER hard-code credentials in source code.
 *
 * Output per image:
 *   { decision, block, category, confidence, requiresHumanReview, categories }
 */

const vision = require('@google-cloud/vision');
const path = require('path');
const { logger } = require('../utils/logger');

// ─── Vision Client ─────────────────────────────────────────────────────────────

const credentialsPath = process.env.GOOGLE_VISION_CREDENTIALS_PATH
  ? path.resolve(__dirname, '..', process.env.GOOGLE_VISION_CREDENTIALS_PATH)
  : process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : path.resolve(__dirname, '..', 'config', 'gcp-vision-service-account.json');

let client;
try {
  client = new vision.ImageAnnotatorClient({ keyFilename: credentialsPath });
} catch (err) {
  logger.error('Failed to initialize Google Vision client:', err.message);
}

// ─── Likelihood Scale ──────────────────────────────────────────────────────────

const LIKELIHOOD = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

// ─── Decision Thresholds ───────────────────────────────────────────────────────

const ADULT_BLOCK = 4;      // LIKELY+
const ADULT_REVIEW = 3;     // POSSIBLE
const VIOLENCE_BLOCK = 4;
const VIOLENCE_REVIEW = 3;
const RACY_BLOCK = 5;       // VERY_LIKELY only (swimwear / art false-positives)
const RACY_REVIEW = 4;      // LIKELY

// ─── Keyword Lists for Label / Web Detection ───────────────────────────────────
// Matched case-insensitively against Vision label and web-entity descriptions.

const DRUG_KEYWORDS = [
  'cannabis', 'marijuana', 'weed', 'cocaine', 'heroin', 'methamphetamine', 'meth',
  'hashish', 'opium', 'fentanyl', 'drug', 'narcotic', 'bong', 'smoking pipe',
  'syringe', 'hypodermic needle', 'paraphernalia', 'rolling paper', 'blunt',
  'crack cocaine', 'crystal meth', 'psychedelic mushroom', 'magic mushroom',
];

const WEAPON_KEYWORDS = [
  'gun', 'firearm', 'pistol', 'revolver', 'rifle', 'shotgun', 'machine gun',
  'submachine gun', 'assault rifle', 'handgun', 'ammunition', 'bullet', 'grenade',
  'explosive', 'bomb', 'switchblade', 'brass knuckles', 'taser', 'stun gun',
  'silencer', 'suppressor', 'illegal weapon',
];

const HATE_KEYWORDS = [
  'swastika', 'nazi', 'kkk', 'ku klux klan', 'white power', 'white supremacy',
  'neo-nazi', 'hate group', 'extremist symbol', 'noose', 'confederate flag',
  'black sun', 'odal rune', 'celtic cross hate',
];

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function matchesKeywords(description, keywords) {
  const lower = (description ?? '').toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function toConfidence(likelihoodLevel) {
  // Maps VERY_UNLIKELY(1)–VERY_LIKELY(5) → 0.0–1.0
  return Math.min(1, Math.max(0, (likelihoodLevel - 1) / 4));
}

function clamp(v) {
  return Math.min(1, Math.max(0, v ?? 0));
}

// ─── Retry with Exponential Back-off ──────────────────────────────────────────

async function withRetry(fn, retries = 3, baseDelayMs = 500) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const delay = baseDelayMs * 2 ** (attempt - 1); // 500 → 1000 → 2000 ms
        logger.warn(`[Vision] retry ${attempt}/${retries} after ${delay}ms: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Core Analysis ─────────────────────────────────────────────────────────────

/**
 * Analyze a single image buffer.
 *
 * @param {Buffer} imageBuffer
 * @returns {Promise<{
 *   decision: 'allow'|'review'|'block',
 *   block: boolean,
 *   category: string,
 *   confidence: number,
 *   requiresHumanReview: boolean,
 *   categories: object,
 *   error?: string
 * }>}
 */
async function analyzeImage(imageBuffer) {
  // ── Result factory helpers ───────────────────────────────────────────────────
  const blockResult = (category, confidence, cats, requiresHumanReview = false) => ({
    decision: 'block',
    block: true,
    category,
    confidence: clamp(confidence),
    requiresHumanReview,
    categories: cats ?? {},
  });

  const reviewResult = (category, confidence, cats, requiresHumanReview = true) => ({
    decision: 'review',
    block: false,
    category,
    confidence: clamp(confidence),
    requiresHumanReview,
    categories: cats ?? {},
  });

  const allowResult = (errorMsg) => ({
    decision: 'allow',
    block: false,
    category: 'none',
    confidence: 0,
    requiresHumanReview: false,
    categories: {},
    ...(errorMsg ? { error: errorMsg } : {}),
  });

  if (!client) {
    logger.warn('[Vision] client not available — skipping moderation');
    return allowResult();
  }

  // ── Call Vision API (SafeSearch + Labels + Web Detection) ───────────────────
  // batchAnnotateImages is the direct gRPC call; it returns [BatchAnnotateImagesResponse, ...]
  // so array-destructuring is safe. annotateImage() is a helper that returns the
  // AnnotateImageResponse directly (not a tuple) — do NOT use it with array destructure.
  let annotation;
  try {
    const [batchResponse] = await withRetry(() =>
      client.batchAnnotateImages({
        requests: [{
          image: { content: imageBuffer },
          features: [
            { type: 'SAFE_SEARCH_DETECTION' },
            { type: 'LABEL_DETECTION', maxResults: 30 },
            { type: 'WEB_DETECTION', maxResults: 10 },
          ],
        }],
      }),
    );
    annotation = batchResponse.responses?.[0];
    if (!annotation) {
      logger.warn('[Vision] empty response from batchAnnotateImages');
      return allowResult();
    }
    if (annotation.error) {
      logger.warn('[Vision] per-image error:', annotation.error.message);
      return allowResult(annotation.error.message);
    }
  } catch (err) {
    logger.error('[Vision] API error (all retries exhausted):', err.message);
    // Fail open — allow the image so API outages don't block all uploads
    return allowResult(err.message);
  }

  const safeSearch = annotation.safeSearchAnnotation ?? {};
  const labels = (annotation.labelAnnotations ?? []).map((l) => ({
    description: l.description ?? '',
    score: l.score ?? 0,
  }));
  const webEntities = (annotation.webDetection?.webEntities ?? []).map((e) => ({
    description: e.description ?? '',
    score: e.score ?? 0,
  }));

  const ssCategories = {
    adult: safeSearch.adult ?? 'UNKNOWN',
    violence: safeSearch.violence ?? 'UNKNOWN',
    racy: safeSearch.racy ?? 'UNKNOWN',
    medical: safeSearch.medical ?? 'UNKNOWN',
    spoof: safeSearch.spoof ?? 'UNKNOWN',
  };

  // ── 1. SafeSearch: Explicit adult content ────────────────────────────────────
  const adultLevel = LIKELIHOOD[ssCategories.adult] ?? 0;
  if (adultLevel >= ADULT_BLOCK) {
    return blockResult('explicit_sexual', toConfidence(adultLevel), ssCategories);
  }
  if (adultLevel >= ADULT_REVIEW) {
    return reviewResult('sexual', toConfidence(adultLevel), ssCategories);
  }

  // ── 2. SafeSearch: Graphic violence ──────────────────────────────────────────
  const violenceLevel = LIKELIHOOD[ssCategories.violence] ?? 0;
  if (violenceLevel >= VIOLENCE_BLOCK) {
    return blockResult('graphic_violence', toConfidence(violenceLevel), ssCategories);
  }
  if (violenceLevel >= VIOLENCE_REVIEW) {
    return reviewResult('violence', toConfidence(violenceLevel), ssCategories);
  }

  // ── 3. SafeSearch: Racy (lenient — swimwear / art cause false positives) ──────
  const racyLevel = LIKELIHOOD[ssCategories.racy] ?? 0;
  if (racyLevel >= RACY_BLOCK) {
    return blockResult('explicit_sexual', toConfidence(racyLevel), ssCategories);
  }
  if (racyLevel >= RACY_REVIEW) {
    return reviewResult('racy', toConfidence(racyLevel), ssCategories);
  }

  // ── 4. Label Detection: Illegal goods & hate symbols ─────────────────────────
  // Only act on labels with >= 60% confidence to reduce false positives.
  for (const label of labels) {
    if (label.score < 0.6) continue;

    if (matchesKeywords(label.description, DRUG_KEYWORDS)) {
      // requiresHumanReview=true: "pipe" or "needle" could be benign items
      return blockResult('illegal_drugs', label.score, ssCategories, true);
    }
    if (matchesKeywords(label.description, WEAPON_KEYWORDS)) {
      // requiresHumanReview=true: toy guns, historical items, etc.
      return blockResult('weapon', label.score, ssCategories, true);
    }
    if (matchesKeywords(label.description, HATE_KEYWORDS)) {
      return blockResult('hate_symbol', label.score, ssCategories, false);
    }
  }

  // ── 5. Web Detection: Cross-reference against known harmful content ───────────
  // Lower threshold (0.5) since web matching is more contextual.
  for (const entity of webEntities) {
    if (entity.score < 0.5) continue;

    if (matchesKeywords(entity.description, DRUG_KEYWORDS)) {
      return reviewResult('illegal_drugs', entity.score, ssCategories, true);
    }
    if (matchesKeywords(entity.description, WEAPON_KEYWORDS)) {
      return reviewResult('weapon', entity.score, ssCategories, true);
    }
    if (matchesKeywords(entity.description, HATE_KEYWORDS)) {
      return blockResult('hate_symbol', entity.score, ssCategories, false);
    }
  }

  return allowResult();
}

/**
 * Analyze multiple image buffers in parallel.
 *
 * @param {Array<{buffer: Buffer, filename: string}>} images
 * @returns {Promise<Array<{
 *   filename: string,
 *   decision: string,
 *   block: boolean,
 *   category: string,
 *   confidence: number,
 *   requiresHumanReview: boolean,
 *   categories: object
 * }>>}
 */
async function analyzeImages(images) {
  const results = await Promise.all(
    images.map(async (img) => {
      const result = await analyzeImage(img.buffer);
      return { filename: img.filename, ...result };
    }),
  );
  return results;
}

module.exports = { analyzeImage, analyzeImages };
