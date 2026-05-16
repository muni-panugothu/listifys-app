/**
 * Image Moderation Service
 * Uses Google Cloud Vision SafeSearch to detect inappropriate content.
 */
const vision = require('@google-cloud/vision');
const path = require('path');
const { logger } = require('../utils/logger');

// Resolve credentials path from env or default
const credentialsPath = process.env.GOOGLE_VISION_CREDENTIALS_PATH
  ? path.resolve(__dirname, '..', process.env.GOOGLE_VISION_CREDENTIALS_PATH)
  : path.resolve(__dirname, '..', 'config', 'gcp-vision-service-account.json');

let client;
try {
  client = new vision.ImageAnnotatorClient({
    keyFilename: credentialsPath,
  });
} catch (err) {
  logger.error('Failed to initialize Google Vision client:', err.message);
}

/**
 * SafeSearch likelihood levels from Google Vision API.
 * VERY_UNLIKELY=1, UNLIKELY=2, POSSIBLE=3, LIKELY=4, VERY_LIKELY=5
 */
const LIKELIHOOD_MAP = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

// Thresholds: >=4 (LIKELY) = block, ==3 (POSSIBLE) = review
const BLOCK_THRESHOLD = 4;
const REVIEW_THRESHOLD = 3;

/**
 * Analyze a single image buffer for inappropriate content.
 * @param {Buffer} imageBuffer - The image file as a buffer
 * @returns {Promise<{decision: 'allow'|'review'|'block', categories: object}>}
 */
async function analyzeImage(imageBuffer) {
  if (!client) {
    logger.warn('Vision client not available — skipping moderation');
    return { decision: 'allow', categories: {} };
  }

  try {
    const [result] = await client.safeSearchDetection({
      image: { content: imageBuffer },
    });

    const safeSearch = result.safeSearchAnnotation;
    if (!safeSearch) {
      return { decision: 'allow', categories: {} };
    }

    const categories = {
      adult: safeSearch.adult,
      violence: safeSearch.violence,
      racy: safeSearch.racy,
      medical: safeSearch.medical,
      spoof: safeSearch.spoof,
    };

    // Check for block-level content
    const blockCategories = ['adult', 'violence'];
    for (const cat of blockCategories) {
      const level = LIKELIHOOD_MAP[categories[cat]] || 0;
      if (level >= BLOCK_THRESHOLD) {
        return { decision: 'block', categories };
      }
    }

    // Check for review-level content
    for (const cat of blockCategories) {
      const level = LIKELIHOOD_MAP[categories[cat]] || 0;
      if (level >= REVIEW_THRESHOLD) {
        return { decision: 'review', categories };
      }
    }

    // Check racy content (slightly more lenient — only block at VERY_LIKELY)
    const racyLevel = LIKELIHOOD_MAP[categories.racy] || 0;
    if (racyLevel >= 5) {
      return { decision: 'block', categories };
    }
    if (racyLevel >= BLOCK_THRESHOLD) {
      return { decision: 'review', categories };
    }

    return { decision: 'allow', categories };
  } catch (err) {
    logger.error('Vision SafeSearch API error:', err.message);
    // Fail open — allow the image but log the error
    return { decision: 'allow', categories: {}, error: err.message };
  }
}

/**
 * Analyze multiple image buffers.
 * @param {Array<{buffer: Buffer, filename: string}>} images
 * @returns {Promise<Array<{filename: string, decision: string, categories: object}>>}
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

module.exports = {
  analyzeImage,
  analyzeImages,
};
