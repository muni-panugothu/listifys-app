'use strict';
/**
 * ── Backpressure Middleware ─────────────────────────────────────────────────────
 * Production-grade load shedding for 10k+ concurrent users.
 *
 * When the server is overloaded (event loop lag > threshold OR heap > limit),
 * new requests are rejected with 503 Service Unavailable BEFORE they consume
 * any resources. This prevents cascade failures and keeps existing requests
 * healthy.
 *
 * How Amazon/Flipkart handle this:
 *   - They use "load shedding" at the edge (ALB/Nginx) AND at the app layer.
 *   - Non-critical endpoints (search, browse) are shed first.
 *   - Critical endpoints (checkout, auth) are always allowed through.
 *   - A "circuit breaker" pattern prevents one slow dependency from killing all.
 *
 * This middleware implements the app-layer portion.
 */

const { logger } = require('../utils/logger');

// ── Configuration ──────────────────────────────────────────────────────────────
const EVENT_LOOP_LAG_THRESHOLD_MS = parseInt(process.env.BACKPRESSURE_LAG_MS, 10) || 1500;
const HEAP_LIMIT_MB               = parseInt(process.env.BACKPRESSURE_HEAP_MB, 10) || 1200;
const CHECK_INTERVAL_MS            = 1_000;  // Sample event loop every 1s (faster detection)
const WARMUP_MS                    = parseInt(process.env.BACKPRESSURE_WARMUP_MS, 10) || 60_000; // Grace period after start
const _startedAt                   = Date.now();

// Critical paths that are NEVER shed (auth, health, payment-related)
const CRITICAL_PATHS = [
  '/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/google',
  '/api/auth/check-auth',
  '/api/chat',              // messaging must always work (not /api/chatbot)
  '/api/notifications',     // real-time alerts
  '/api/services/bookings', // money-related
];

// ── State ──────────────────────────────────────────────────────────────────────
let _eventLoopLag = 0;
let _isOverloaded = false;
let _shedCount = 0;

// ── Measure event loop lag continuously ────────────────────────────────────────
function startEventLoopMonitor() {
  let lastCheck = process.hrtime.bigint();

  const timer = setInterval(() => {
    const now = process.hrtime.bigint();
    const expectedMs = CHECK_INTERVAL_MS;
    const actualMs = Number(now - lastCheck) / 1e6;
    _eventLoopLag = Math.max(0, actualMs - expectedMs);
    lastCheck = now;

    const heapMB = process.memoryUsage().heapUsed / 1024 / 1024;
    _isOverloaded = _eventLoopLag > EVENT_LOOP_LAG_THRESHOLD_MS || heapMB > HEAP_LIMIT_MB;

    if (_isOverloaded) {
      logger.warn('[Backpressure] Server overloaded', {
        eventLoopLagMs: _eventLoopLag.toFixed(1),
        heapMB: heapMB.toFixed(0),
        thresholdLagMs: EVENT_LOOP_LAG_THRESHOLD_MS,
        thresholdHeapMB: HEAP_LIMIT_MB,
      });
    }
  }, CHECK_INTERVAL_MS);

  if (timer.unref) timer.unref();
}

// Start monitoring immediately
startEventLoopMonitor();

// ── Middleware ──────────────────────────────────────────────────────────────────
/**
 * Load-shedding middleware.
 * When the server is severely overloaded, responds with 503 for non-critical
 * requests. Critical paths (auth, health) are always allowed through.
 */
function backpressureMiddleware(req, res, next) {
  if (!_isOverloaded) return next();

  // Grace period after startup — containers have initial event loop spikes
  if (Date.now() - _startedAt < WARMUP_MS) return next();

  // Always allow critical paths (exact match or prefix with /)
  const isCritical = CRITICAL_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'));
  if (isCritical) return next();

  // Always allow GET /health for load balancers
  if (req.method === 'GET' && req.path === '/health') return next();

  _shedCount++;
  logger.warn('[Backpressure] Request shed', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    shedCount: _shedCount,
  });

  res.setHeader('Retry-After', '5');
  return res.status(503).json({
    success: false,
    message: 'Server is temporarily overloaded. Please retry in a few seconds.',
    code: 'SERVER_OVERLOADED',
    retryAfter: 5,
  });
}

/**
 * Get backpressure stats (for health/metrics endpoint).
 */
function getBackpressureStats() {
  return {
    eventLoopLagMs: _eventLoopLag.toFixed(1),
    isOverloaded: _isOverloaded,
    shedCount: _shedCount,
    thresholds: {
      eventLoopLagMs: EVENT_LOOP_LAG_THRESHOLD_MS,
      heapLimitMB: HEAP_LIMIT_MB,
    },
  };
}

module.exports = { backpressureMiddleware, getBackpressureStats };
