'use strict';
/**
 * ── Request Coalescing Middleware (Thundering Herd Protection) ──────────────
 *
 * When 10,000 users hit GET /api/electronics?page=1 at the same instant,
 * without coalescing each request spawns its own MongoDB query (10k queries).
 * This middleware ensures only ONE query fires; all other identical requests
 * wait for that single result and share it.
 *
 * How Amazon/Flipkart handle this:
 *   - "Request collapsing" at the CDN layer (CloudFront)
 *   - "Singleflight" pattern at the app layer
 *   - Proxy cache lock (nginx proxy_cache_lock — we have this too)
 *
 * This is the app-layer portion. Combined with nginx proxy_cache_lock,
 * it provides defense-in-depth against thundering herd.
 *
 * Only applies to GET requests. Write requests always pass through.
 */
const crypto = require('crypto');
const { logger } = require('../utils/logger');

// In-flight requests: key → { promise, refCount, createdAt }
const _inflight = new Map();

// Safety: prevent memory leaks — if a coalesced request hasn't resolved
// in 30s, something is very wrong; evict it.
const MAX_COALESCE_MS = 30_000;
const CLEANUP_INTERVAL = 60_000;

// Periodic cleanup of stuck entries
const _cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _inflight) {
    if (now - entry.createdAt > MAX_COALESCE_MS) {
      _inflight.delete(key);
    }
  }
}, CLEANUP_INTERVAL);
if (_cleanupTimer.unref) _cleanupTimer.unref();

/**
 * Build a coalescing key from the request.
 * Includes method + path + sorted query params (excluding cache-busters).
 */
function buildCoalesceKey(req) {
  const params = { ...req.query };
  // Remove cache-busting params
  delete params._t;
  delete params._cb;
  delete params._;

  const sortedQuery = Object.keys(params)
    .sort()
    .filter(k => params[k] !== undefined && params[k] !== '')
    .map(k => `${k}=${params[k]}`)
    .join('&');

  return `coalesce:${req.method}:${req.path}:${sortedQuery}`;
}

/**
 * Request coalescing middleware.
 *
 * For identical GET requests arriving simultaneously, only the first
 * one executes the handler. Subsequent identical requests wait for
 * the first one's response and receive the same data.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.enabled=true]       – Kill switch
 * @param {string[]} [opts.excludePaths=[]]   – Paths to exclude from coalescing
 */
function requestCoalescing(opts = {}) {
  const { enabled = true, excludePaths = [] } = opts;

  return (req, res, next) => {
    // Only coalesce GET/HEAD (safe methods)
    if (!enabled || (req.method !== 'GET' && req.method !== 'HEAD')) {
      return next();
    }

    // Skip excluded paths
    if (excludePaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    // Skip if user is authenticated (personalized responses)
    // But allow coalescing for public listing pages (no auth header)
    if (req.cookies?.accessToken || req.headers.authorization) {
      return next();
    }

    const key = buildCoalesceKey(req);
    const existing = _inflight.get(key);

    if (existing) {
      // Another identical request is already in-flight — wait for it
      existing.refCount++;
      existing.promise
        .then(({ statusCode, headers, body }) => {
          if (!res.headersSent) {
            // Copy relevant headers
            if (headers['x-cache']) res.setHeader('X-Cache', headers['x-cache']);
            if (headers['x-cache-layer']) res.setHeader('X-Cache-Layer', headers['x-cache-layer']);
            if (headers['etag']) res.setHeader('ETag', headers['etag']);
            if (headers['x-search-source']) res.setHeader('X-Search-Source', headers['x-search-source']);
            res.setHeader('X-Coalesced', 'true');
            res.status(statusCode).json(body);
          }
        })
        .catch(() => {
          // If the original request failed, let this one retry normally
          if (!res.headersSent) {
            next();
          }
        });
      return;
    }

    // First request — execute normally but capture the response
    let resolveCoalesce, rejectCoalesce;
    const promise = new Promise((resolve, reject) => {
      resolveCoalesce = resolve;
      rejectCoalesce = reject;
    });

    _inflight.set(key, { promise, refCount: 1, createdAt: Date.now() });

    // Intercept res.json to capture the response for coalesced requests
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.json = originalJson; // restore immediately

      // Capture response for waiting requests
      const captured = {
        statusCode: res.statusCode,
        headers: {
          'x-cache': res.getHeader('x-cache'),
          'x-cache-layer': res.getHeader('x-cache-layer'),
          'etag': res.getHeader('etag'),
          'x-search-source': res.getHeader('x-search-source'),
        },
        body,
      };

      resolveCoalesce(captured);

      // Clean up after a short delay (let all waiters resolve)
      setImmediate(() => _inflight.delete(key));

      return originalJson(body);
    };

    // If the primary response closes early, only reject when there are waiters.
    // For refCount=1 there is no consumer for this promise, so rejecting it
    // would surface as an unhandled rejection in the global process handler.
    res.on('close', () => {
      const entry = _inflight.get(key);
      if (entry) {
        if (entry.refCount > 1) {
          rejectCoalesce(new Error('Response closed'));
        }
        _inflight.delete(key);
      }
    });

    next();
  };
}

/**
 * Get coalescing stats (for metrics/health).
 */
function getCoalescingStats() {
  return {
    inflightKeys: _inflight.size,
    entries: [..._inflight.entries()].map(([key, entry]) => ({
      key: key.substring(0, 80),
      refCount: entry.refCount,
      ageMs: Date.now() - entry.createdAt,
    })),
  };
}

module.exports = { requestCoalescing, getCoalescingStats };
