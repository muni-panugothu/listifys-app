/**
 * Image Compressor Service
 *
 * Production-grade multi-pass adaptive compression.
 * Handles any input size (up to 50MB) and compresses to configurable
 * target sizes using sharp.
 *
 * Presets:
 *   - listing:  max 1200px, target ~120KB, WebP output
 *   - profile:  max 500px,  target ~60KB,  WebP output
 *   - thumbnail: max 400px, target ~30KB,  WebP output
 */

const sharp = require('sharp');
const { logger } = require('../utils/logger');

// ── Compression presets ────────────────────────────────────────────

const PRESETS = {
  listing: {
    maxDimension: 1200,
    targetBytes: 120 * 1024,     // 120 KB
    minQuality: 30,
    startQuality: 78,
    format: 'webp',
    maxPasses: 5,
  },
  profile: {
    maxDimension: 500,
    targetBytes: 60 * 1024,      // 60 KB
    minQuality: 35,
    startQuality: 75,
    format: 'webp',
    maxPasses: 4,
  },
  thumbnail: {
    maxDimension: 400,
    targetBytes: 30 * 1024,      // 30 KB
    minQuality: 30,
    startQuality: 70,
    format: 'webp',
    maxPasses: 4,
  },
};

/**
 * Compress a single image buffer to hit a target file size.
 *
 * Algorithm:
 *   1. Resize to maxDimension (no upscaling)
 *   2. Strip EXIF / metadata
 *   3. Encode as WebP at startQuality
 *   4. If result > targetBytes, binary-search quality downward
 *   5. If still too large after minQuality, reduce dimensions by 25% and retry
 *
 * @param {Buffer} inputBuffer  – Raw image bytes (any format sharp supports)
 * @param {string} preset       – 'listing' | 'profile' | 'thumbnail'
 * @returns {Promise<{buffer: Buffer, contentType: string, extension: string, width: number, height: number, originalSize: number, compressedSize: number}>}
 */
async function compressImage(inputBuffer, preset = 'listing') {
  const config = PRESETS[preset] || PRESETS.listing;
  const originalSize = inputBuffer.length;

  let { maxDimension, targetBytes, minQuality, startQuality, format, maxPasses } = config;

  // Get input metadata to decide if processing is needed
  let metadata;
  try {
    metadata = await sharp(inputBuffer).metadata();
  } catch (err) {
    logger.warn('Failed to read image metadata, attempting raw processing', { error: err.message });
    metadata = {};
  }

  let currentDimension = maxDimension;
  let bestBuffer = null;
  let bestMeta = null;
  let pass = 0;

  while (pass < maxPasses) {
    pass++;

    // Binary search for quality within this dimension
    let lo = minQuality;
    let hi = pass === 1 ? startQuality : Math.min(startQuality, 70);
    let mid = hi;
    let lastGood = null;

    // First try at the high quality end
    let result = await encodeImage(inputBuffer, currentDimension, mid, format);

    if (result.buffer.length <= targetBytes) {
      // Already within target at high quality — done
      bestBuffer = result.buffer;
      bestMeta = result;
      break;
    }

    // Binary search: find the highest quality that fits target
    while (lo <= hi) {
      mid = Math.round((lo + hi) / 2);
      result = await encodeImage(inputBuffer, currentDimension, mid, format);

      if (result.buffer.length <= targetBytes) {
        lastGood = result;
        lo = mid + 1; // Try higher quality
      } else {
        hi = mid - 1; // Need lower quality
      }
    }

    if (lastGood) {
      bestBuffer = lastGood.buffer;
      bestMeta = lastGood;
      break;
    }

    // Even at minQuality it's too big — reduce dimensions by 25%
    currentDimension = Math.round(currentDimension * 0.75);
    if (currentDimension < 200) {
      // Floor: encode at min quality + min dimension
      result = await encodeImage(inputBuffer, 200, minQuality, format);
      bestBuffer = result.buffer;
      bestMeta = result;
      break;
    }
  }

  // Fallback: if no pass produced output (shouldn't happen), just encode once
  if (!bestBuffer) {
    const fallback = await encodeImage(inputBuffer, currentDimension, minQuality, format);
    bestBuffer = fallback.buffer;
    bestMeta = fallback;
  }

  const ratio = originalSize > 0 ? ((1 - bestBuffer.length / originalSize) * 100).toFixed(1) : 0;

  logger.info('🗜️ Image compressed', {
    preset,
    originalSize: formatBytes(originalSize),
    compressedSize: formatBytes(bestBuffer.length),
    ratio: `${ratio}%`,
    dimensions: `${bestMeta.width}x${bestMeta.height}`,
    passes: pass,
  });

  return {
    buffer: bestBuffer,
    contentType: `image/${format}`,
    extension: format,
    width: bestMeta.width,
    height: bestMeta.height,
    originalSize,
    compressedSize: bestBuffer.length,
  };
}

/**
 * Encode an image at given dimension + quality.
 * @returns {Promise<{buffer: Buffer, width: number, height: number}>}
 */
async function encodeImage(inputBuffer, maxDim, quality, format) {
  let pipeline = sharp(inputBuffer)
    .rotate()                               // Auto-rotate based on EXIF
    .resize(maxDim, maxDim, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .removeAlpha()                           // Remove alpha for photos
    .toFormat(format, {
      quality,
      effort: format === 'webp' ? 4 : undefined,  // Balance speed vs compression
    });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

/**
 * Compress multiple image buffers in parallel with concurrency limit.
 *
 * @param {Array<{buffer: Buffer, originalname?: string}>} files – Array of file objects (multer-style)
 * @param {string} preset – Compression preset name
 * @param {number} concurrency – Max parallel compressions (default 3)
 * @returns {Promise<Array>} Compressed results
 */
async function compressImages(files, preset = 'listing', concurrency = 3) {
  const results = [];

  // Process in batches for memory control
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        try {
          const compressed = await compressImage(file.buffer, preset);
          return {
            ...file,
            buffer: compressed.buffer,
            mimetype: compressed.contentType,
            size: compressed.compressedSize,
            originalname: (file.originalname || 'image').replace(/\.[^.]+$/, `.${compressed.extension}`),
            _compression: {
              originalSize: compressed.originalSize,
              compressedSize: compressed.compressedSize,
              width: compressed.width,
              height: compressed.height,
            },
          };
        } catch (err) {
          logger.warn('Compression failed for file, using original', {
            name: file.originalname,
            error: err.message,
          });
          return file; // Fallback to original
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}

// ── Middleware factory ──────────────────────────────────────────────

/**
 * Express middleware that compresses req.files (multer array) or req.file (multer single).
 *
 * @param {string} preset – 'listing' | 'profile' | 'thumbnail'
 * @returns {Function} Express middleware
 */
function compressionMiddleware(preset = 'listing') {
  return async (req, res, next) => {
    try {
      // Handle multer array (req.files)
      if (req.files && req.files.length > 0) {
        req.files = await compressImages(req.files, preset);
        return next();
      }

      // Handle multer single (req.file)
      if (req.file && req.file.buffer) {
        const compressed = await compressImage(req.file.buffer, preset);
        req.file = {
          ...req.file,
          buffer: compressed.buffer,
          mimetype: compressed.contentType,
          size: compressed.compressedSize,
          originalname: req.file.originalname.replace(/\.[^.]+$/, `.${compressed.extension}`),
        };
        return next();
      }

      next();
    } catch (err) {
      logger.warn('Compression middleware error, proceeding with originals', { error: err.message });
      next();
    }
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = {
  compressImage,
  compressImages,
  compressionMiddleware,
  PRESETS,
};
