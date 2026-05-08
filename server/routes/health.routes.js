// ============================================================================
// HEALTH & DIAGNOSTICS ROUTES — Production-grade system health monitoring
// ============================================================================
// Endpoints:
//   GET /health          — Lightweight liveness probe (for load balancers / k8s)
//   GET /health/ready    — Deep readiness check (DB, Redis, Elasticsearch, caches)
//   GET /health/metrics  — Runtime metrics (memory, CPU, event-loop lag)
//
// Security:
//   • /health is always public (load balancers need it)
//   • /health/ready and /health/metrics expose operational detail —
//     in production they require a shared secret via header or query param
// ============================================================================

const express = require('express');
const mongoose = require('mongoose');
const os = require('os');
const router = express.Router();
const { logger } = require('../utils/logger');

// ==================== Auth Guard for Sensitive Endpoints ====================
function diagnosticsAuth(req, res, next) {
  // In development, allow unrestricted access
  if (process.env.NODE_ENV !== 'production') return next();

  const secret = process.env.HEALTH_CHECK_SECRET;
  if (!secret) {
    // If no secret is configured, block sensitive endpoints entirely in production
    return res.status(403).json({
      success: false,
      message: 'Diagnostics endpoints are disabled in production (no HEALTH_CHECK_SECRET configured)',
    });
  }

  const provided = req.headers['x-health-secret'];

  if (!provided || !secret) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  // Timing-safe comparison to prevent side-channel attacks
  const crypto = require('crypto');
  const secretBuf = Buffer.from(String(secret));
  const providedBuf = Buffer.from(String(provided));
  if (secretBuf.length !== providedBuf.length || !crypto.timingSafeEqual(secretBuf, providedBuf)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  next();
}

// ==================== Helper: Check a Dependency ====================
async function checkDependency(name, checkFn, timeoutMs = 3000) {
  const start = Date.now();
  try {
    const result = await Promise.race([
      checkFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timed out')), timeoutMs)
      ),
    ]);
    return {
      name,
      status: 'healthy',
      responseTime: `${Date.now() - start}ms`,
      ...(result || {}),
    };
  } catch (err) {
    return {
      name,
      status: 'unhealthy',
      responseTime: `${Date.now() - start}ms`,
      error: err.message,
    };
  }
}

// ==================== GET /health — Liveness Probe ====================
// Returns 200 if the process is alive — essential for Docker HEALTHCHECK.
// DB state is informational; a disconnected DB should NOT prevent the
// container from being considered "alive" (use /health/ready for readiness).
// Intentionally minimal — always returns 200 if the process is alive.
// Readiness/stateful dependency checks live under /health/ready.
router.get('/', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: dbReady ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: dbReady ? 'connected' : 'disconnected',
  });
});

// ==================== GET /health/ready — Readiness Probe ====================
// Deep check of every critical dependency with individual timing.
router.get('/ready', diagnosticsAuth, async (req, res) => {
  const checks = [];

  // 1. MongoDB
  checks.push(
    checkDependency('mongodb', async () => {
      const state = mongoose.connection.readyState;
      if (state !== 1) throw new Error(`readyState=${state}`);
      // Ping to verify the connection is truly alive
      await mongoose.connection.db.admin().ping();
      return { version: (await mongoose.connection.db.admin().serverInfo()).version };
    })
  );

  // 2. Redis
  checks.push(
    checkDependency('redis', async () => {
      const redis = require('../config/redis');
      const pong = await redis.ping();
      if (pong !== 'PONG') throw new Error(`Unexpected response: ${pong}`);
      const info = await redis.info('memory');
      const usedMemory = info.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'N/A';
      return { usedMemory };
    })
  );

  // 3. Elasticsearch
  checks.push(
    checkDependency('elasticsearch', async () => {
      const { getIsConnected } = require('../config/elasticsearch');
      if (!getIsConnected()) {
        return { status: 'healthy', note: 'Not configured — using MongoDB text-search fallback' };
      }
      return {};
    })
  );

  // 4. RabbitMQ
  checks.push(
    checkDependency('rabbitmq', async () => {
      const { connect } = require('../queues/rabbitmq');
      const ch = await connect();
      if (!ch) return { status: 'healthy', note: 'Not configured — queue system disabled' };
      return { connected: true };
    })
  );

  // 5. Cache layers
  checks.push(
    checkDependency('cache', async () => {
      const ListingCache = require('../services/listingcache.service');
      const { responseCache, listingCache: memListingCache } = require('../services/memorycache.service');

      let listingCacheStats = {};
      try { listingCacheStats = await ListingCache.getStats(); } catch { /* fallback */ }

      return {
        listingCache: listingCacheStats,
        memoryCache: {
          responseLayer: responseCache.getStats(),
          listingLayer: memListingCache.getStats(),
        },
      };
    })
  );

  // Run all checks concurrently
  const results = await Promise.all(checks);

  // Determine overall status
  const allHealthy = results.every((r) => r.status === 'healthy');
  const anyUnhealthy = results.some((r) => r.status === 'unhealthy');
  const overallStatus = allHealthy ? 'healthy' : anyUnhealthy ? 'degraded' : 'healthy';

  const httpStatus = overallStatus === 'healthy' ? 200 : 503;

  res.status(httpStatus).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    dependencies: results,
  });
});

// ==================== GET /health/metrics — Runtime Metrics ====================
// CPU, memory, event-loop lag, active handles/requests — useful for dashboards.
router.get('/metrics', diagnosticsAuth, async (_req, res) => {
  const memUsage = process.memoryUsage();
  const cpus = os.cpus();

  // Measure event-loop lag (how long a setImmediate takes vs expected 0ms)
  const loopLag = await measureEventLoopLag();

  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime()),

    // ---- Process Memory ----
    memory: {
      rss:          formatBytes(memUsage.rss),
      heapTotal:    formatBytes(memUsage.heapTotal),
      heapUsed:     formatBytes(memUsage.heapUsed),
      external:     formatBytes(memUsage.external),
      arrayBuffers: formatBytes(memUsage.arrayBuffers || 0),
      heapUsage:    `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1)}%`,
    },

    // ---- System ----
    system: {
      platform:   os.platform(),
      arch:       os.arch(),
      nodeVersion: process.version,
      totalMemory: formatBytes(os.totalmem()),
      freeMemory:  formatBytes(os.freemem()),
      memoryUsage: `${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(1)}%`,
      cpuCount:    cpus.length,
      loadAverage: os.loadavg().map((l) => l.toFixed(2)),
    },

    // ---- Event Loop ----
    eventLoop: {
      lagMs: loopLag.toFixed(2),
      status: loopLag < 50 ? 'healthy' : loopLag < 200 ? 'warning' : 'critical',
    },

    // ---- Process ----
    process: {
      pid:            process.pid,
      activeHandles:  process._getActiveHandles?.().length ?? 'N/A',
      activeRequests: process._getActiveRequests?.().length ?? 'N/A',
    },

    // ---- Database Connections ----
    database: {
      readyState:  mongoose.connection.readyState,
      status:      ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
      host:        mongoose.connection.host || 'N/A',
      name:        mongoose.connection.name || 'N/A',
    },
  };

  // ---- RabbitMQ Queue Metrics ----
  try {
    const { metrics: queueMetrics } = require('../queues/rabbitmq');
    metrics.rabbitmq = queueMetrics.getStats();
  } catch { /* not available */ }

  // ---- Socket.IO Metrics ----
  try {
    const { socketMetrics } = require('../config/socket');
    metrics.socketIO = socketMetrics.getStats();
  } catch { /* not available */ }

  // ---- Circuit Breakers (ES, Redis, etc.) ----
  try {
    const { getAllBreakerStats } = require('../utils/circuitBreaker');
    metrics.circuitBreakers = getAllBreakerStats();
  } catch { /* not available */ }

  // ---- Request Coalescing (Thundering Herd Protection) ----
  try {
    const { getCoalescingStats } = require('../middleware/coalescing.middleware');
    metrics.coalescing = getCoalescingStats();
  } catch { /* not available */ }

  // ---- Backpressure / Load Shedding ----
  try {
    const { getBackpressureStats } = require('../middleware/backpressure.middleware');
    metrics.backpressure = getBackpressureStats();
  } catch { /* not available */ }

  res.status(200).json({ success: true, metrics });
});

// ==================== Utility Functions ====================

/**
 * Measure event-loop lag by comparing expected vs actual setImmediate timing.
 * @returns {Promise<number>} lag in milliseconds
 */
function measureEventLoopLag() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delta = Number(process.hrtime.bigint() - start) / 1e6; // ns → ms
      resolve(delta);
    });
  });
}

/**
 * Format bytes into a human-readable string (e.g. "128.5 MB").
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format seconds into "Xd Xh Xm Xs".
 * @param {number} seconds
 * @returns {string}
 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(' ');
}

module.exports = router;
