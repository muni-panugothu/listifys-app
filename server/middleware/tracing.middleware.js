/**
 * Lightweight request-tracing middleware (APM-lite).
 *
 * Adds a unique `X-Request-Id` header to every request/response, measures
 * wall-clock duration, and logs slow requests (>1 s) automatically.
 *
 * Register EARLY in the middleware chain — before routes and auth.
 *
 * Usage in server.js:
 *   app.use(require('./middleware/tracing.middleware'));
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

const SLOW_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_MS, 10) || 1000;

function tracingMiddleware(req, res, next) {
  // ── Generate / accept trace ID ────────────────────────────────────────────
  const requestId =
    req.headers['x-request-id'] ||
    crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  // ── Start timer ───────────────────────────────────────────────────────────
  const startHr = process.hrtime.bigint();

  // ── Hook into response finish ─────────────────────────────────────────────
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startHr) / 1e6;

    // Always attach timing header (useful for front-end devtools)
    // Note: headers may already be sent, but setHeader won't throw post-finish
    // We set it before finish if possible — but this is a safety net

    const meta = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip,
    };

    if (durationMs > SLOW_THRESHOLD_MS) {
      logger.warn('[Tracing] Slow request', meta);
    } else if (process.env.TRACE_ALL_REQUESTS === 'true') {
      logger.debug('[Tracing] Request completed', meta);
    }
  });

  next();
}

module.exports = tracingMiddleware;
