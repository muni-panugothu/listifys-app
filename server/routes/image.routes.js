const express = require('express');
const { GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/aws');
const { logger } = require('../utils/logger');

const router = express.Router();

const BUCKET = process.env.AWS_S3_BUCKET_NAME;

// Allowed S3 key prefixes — prevents arbitrary bucket access
const ALLOWED_PREFIXES = ['profiles/', 'electronics/', 'vehicles/', 'mobiles/', 'furniture/', 'fashion/', 'sports/', 'collectibles/', 'pets/', 'toys/', 'books/', 'beauty/', 'others/', 'takecare/', 'events/', 'forsale/', 'listings/', 'services/', 'properties/','jobs/', 'chats/'];

// Allowed image extensions
const ALLOWED_EXTENSIONS = [
  '.jpeg', '.jpg', '.png', '.webp', '.gif', '.avif', '.heic', '.heif', '.bmp', '.tiff',
  '.mp4', '.mov', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.ogg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
  '.zip', '.rar', '.7z',
];

// ── In-memory LRU cache for frequently requested images ─────────
// Keeps up to 200 images ≤ 512 KB each (~100 MB max memory)
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHEABLE_SIZE = 512 * 1024; // 512 KB
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const imageCache = new Map();

function lruGet(key) {
  const entry = imageCache.get(key);
  if (!entry) return null;
  // Expire stale entries
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    imageCache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  imageCache.delete(key);
  imageCache.set(key, entry);
  return entry;
}

function lruSet(key, value) {
  if (imageCache.has(key)) imageCache.delete(key);
  imageCache.set(key, { ...value, createdAt: Date.now() });
  // Evict oldest when over limit
  if (imageCache.size > MAX_CACHE_ENTRIES) {
    const oldest = imageCache.keys().next().value;
    imageCache.delete(oldest);
  }
}

/**
 * GET /api/images/_health
 * Quick S3 connectivity check — hit this from the browser to diagnose issues.
 * Must be registered BEFORE the /* wildcard route.
 */
router.get('/_health', async (_req, res) => {
  const info = {
    s3ClientConfigured: !!s3Client,
    bucket: BUCKET || '(not set)',
    region: process.env.AWS_REGION || '(not set)',
    accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID
      ? process.env.AWS_ACCESS_KEY_ID.slice(0, 8) + '...'
      : '(not set)',
  };

  if (!s3Client) {
    return res.status(503).json({ status: 'error', ...info, detail: 'S3 client not initialised' });
  }

  try {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const listCmd = new ListObjectsV2Command({ Bucket: BUCKET, MaxKeys: 1 });
    const listRes = await s3Client.send(listCmd);
    return res.json({
      status: 'ok',
      ...info,
      sampleKey: listRes.Contents?.[0]?.Key || '(empty bucket)',
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      ...info,
      s3Error: err.name,
      s3Message: err.message,
      s3Status: err.$metadata?.httpStatusCode || null,
    });
  }
});

/**
 * GET /api/images/*
 * Serves images from S3 with:
 * - In-memory LRU cache for small images (instant response)
 * - ETag-based conditional requests (304 Not Modified)
 * - Long-lived browser cache headers (1 year, immutable)
 */
router.get('/*', async (req, res) => {
  let key = req.params[0];

  // Images are intentionally embeddable from the frontend origin (e.g. :5173 -> :5000 in dev).
  // Keep CORP strict globally, but relax it for this public media endpoint.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (key && /^https?:\/\//i.test(key)) {
    try {
      const nested = new URL(key);
      if (nested.pathname.startsWith('/api/images/')) {
        key = nested.pathname.slice('/api/images/'.length).replace(/^\/+/, '');
      }
    } catch {
      // Keep original key; normal validation below will reject invalid paths.
    }
  }

  if (!key || key.length === 0) {
    return res.status(400).json({ error: 'Missing image key' });
  }

  // Security: block path traversal
  if (key.includes('..') || key.includes('\\')) {
    return res.status(400).json({ error: 'Invalid image path' });
  }

  // Validate prefix
  const hasValidPrefix = ALLOWED_PREFIXES.some(p => key.startsWith(p));
  if (!hasValidPrefix) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Validate extension when present
  const dotIndex = key.lastIndexOf('.');
  if (dotIndex > -1) {
    const ext = key.substring(dotIndex).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }
  }

  try {
    // ── Guard: S3 must be configured ──────────────────────
    if (!s3Client) {
      return res.status(503).json({ error: 'Image storage not configured' });
    }

    // ── Check in-memory cache first (fastest path) ──────────
    const cached = lruGet(key);
    if (cached) {
      // Support conditional requests — return 304 if ETag matches
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === cached.etag) {
        return res.status(304).end();
      }

      res.set({
        'Content-Type': cached.contentType,
        'Content-Length': String(cached.buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': cached.etag,
        'X-Cache': 'MEM-HIT',
      });
      return res.status(200).end(cached.buffer);
    }

    // ── Check if browser already has this version (ETag match via S3 HEAD) ──
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag) {
      try {
        const headCmd = new HeadObjectCommand({ Bucket: BUCKET, Key: key });
        const headRes = await s3Client.send(headCmd);
        if (headRes.ETag === clientEtag) {
          res.set({
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': headRes.ETag,
          });
          return res.status(304).end();
        }
      } catch {
        // HEAD failed — fall through to full GET
      }
    }

    // ── Fetch from S3 ───────────────────────────────────────
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const s3Response = await s3Client.send(command);

    const contentType = s3Response.ContentType || 'image/jpeg';
    const etag = s3Response.ETag;
    const contentLength = s3Response.ContentLength;

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': etag,
      'X-Cache': 'S3',
    });

    if (contentLength) {
      res.set('Content-Length', String(contentLength));
    }

    // If small enough, buffer it for the LRU cache
    if (contentLength && contentLength <= MAX_CACHEABLE_SIZE) {
      const chunks = [];
      for await (const chunk of s3Response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      lruSet(key, { buffer, contentType, etag });
      return res.status(200).end(buffer);
    }

    // Large images — stream directly (no caching)
    s3Response.Body.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Region mismatch → S3 returns PermanentRedirect / 301
    if (error.name === 'PermanentRedirect' || error.$metadata?.httpStatusCode === 301) {
      logger.error('S3 region mismatch — bucket is in a different region', {
        key,
        configuredRegion: process.env.AWS_REGION,
        bucket: BUCKET,
        errorMessage: error.message,
      });
      return res.status(502).json({
        error: 'S3 region mismatch',
        detail: `Bucket "${BUCKET}" is not in configured region "${process.env.AWS_REGION}"`,
      });
    }

    // Access denied
    if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
      logger.error('S3 access denied', { key, bucket: BUCKET, error: error.message });
      return res.status(502).json({
        error: 'S3 access denied',
        detail: 'IAM credentials lack GetObject permission on this bucket',
      });
    }

    const statusCode = error.$metadata?.httpStatusCode;
    logger.error('Image proxy error', {
      key,
      bucket: BUCKET,
      region: process.env.AWS_REGION,
      errorName: error.name,
      errorCode: error.Code || error.code,
      s3Status: statusCode,
      error: error.message,
    });
    return res.status(500).json({
      error: 'Failed to load image',
      s3Error: error.name || 'Unknown',
      s3Status: statusCode || null,
    });
  }
});

module.exports = router;
