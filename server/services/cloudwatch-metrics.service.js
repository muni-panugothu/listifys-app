'use strict';

/**
 * AWS CloudWatch Custom Metrics — Push-based metrics for production monitoring.
 *
 * Pushes key application metrics to CloudWatch every 60 seconds using PutMetricData.
 * Works alongside the Prometheus /metrics endpoint (which is pull-based).
 *
 * Metrics pushed:
 *   - RequestCount        (HTTP requests per interval)
 *   - ErrorCount          (4xx/5xx responses per interval)
 *   - ResponseTimeP95     (95th percentile response time)
 *   - ActiveConnections   (current Socket.IO connections)
 *   - HeapUsedMB          (V8 heap usage)
 *   - EventLoopLagMs      (event loop latency)
 *   - OnlineUsers         (Socket.IO tracked users)
 *
 * Required env:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *   CLOUDWATCH_NAMESPACE (optional, defaults to "Listifys")
 */

const { logger } = require('../utils/logger');

// ── Metric accumulators (reset each flush interval) ─────────────────────────
let requestCount = 0;
let errorCount = 0;
const responseTimes = [];

/** Call from Express middleware to record a request. */
function recordRequest(statusCode, durationMs) {
  requestCount++;
  if (statusCode >= 400) errorCount++;
  responseTimes.push(durationMs);
}

// ── Event loop lag measurement ──────────────────────────────────────────────
let eventLoopLag = 0;
let lagInterval = null;

function startLagMeasurement() {
  lagInterval = setInterval(() => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      eventLoopLag = Number(process.hrtime.bigint() - start) / 1e6; // ms
    });
  }, 2000);
  lagInterval.unref();
}

// ── Percentile helper ───────────────────────────────────────────────────────
function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── CloudWatch push ─────────────────────────────────────────────────────────
let cwClient = null;
let pushInterval = null;
const NAMESPACE = process.env.CLOUDWATCH_NAMESPACE || 'Listifys';
const PUSH_INTERVAL_MS = 60_000; // 1 minute

async function initCloudWatchClient() {
  const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');

  cwClient = new CloudWatchClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    maxAttempts: 2,
  });

  // Validate credentials
  await cwClient.config.credentials();
}

/**
 * Flush accumulated metrics to CloudWatch.
 * @param {Function} getSocketStats - optional callback returning { activeConnections, onlineUsers }
 */
async function flushMetrics(getSocketStats) {
  if (!cwClient) return;

  const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

  const now = new Date();
  const env = process.env.NODE_ENV || 'development';

  // Snapshot and reset accumulators
  const reqCount = requestCount;
  const errCount = errorCount;
  const p95 = percentile(responseTimes, 95);
  requestCount = 0;
  errorCount = 0;
  responseTimes.length = 0;

  // Process metrics
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);

  // Socket metrics (if available)
  let activeConnections = 0;
  let onlineUsers = 0;
  if (typeof getSocketStats === 'function') {
    try {
      const stats = getSocketStats();
      activeConnections = stats.activeConnections || 0;
      onlineUsers = stats.onlineUsers || 0;
    } catch (_) {}
  }

  const dimensions = [{ Name: 'Environment', Value: env }];

  const metricData = [
    {
      MetricName: 'RequestCount',
      Value: reqCount,
      Unit: 'Count',
      Timestamp: now,
      Dimensions: dimensions,
    },
    {
      MetricName: 'ErrorCount',
      Value: errCount,
      Unit: 'Count',
      Timestamp: now,
      Dimensions: dimensions,
    },
    {
      MetricName: 'ResponseTimeP95',
      Value: p95,
      Unit: 'Milliseconds',
      Timestamp: now,
      Dimensions: dimensions,
    },
    {
      MetricName: 'ActiveConnections',
      Value: activeConnections,
      Unit: 'Count',
      Timestamp: now,
      Dimensions: dimensions,
    },
    {
      MetricName: 'HeapUsedMB',
      Value: heapMB,
      Unit: 'Megabytes',
      Timestamp: now,
      Dimensions: dimensions,
    },
    {
      MetricName: 'EventLoopLagMs',
      Value: eventLoopLag,
      Unit: 'Milliseconds',
      Timestamp: now,
      Dimensions: dimensions,
    },
    {
      MetricName: 'OnlineUsers',
      Value: onlineUsers,
      Unit: 'Count',
      Timestamp: now,
      Dimensions: dimensions,
    },
  ];

  try {
    await cwClient.send(new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: metricData,
    }));
    logger.debug('[CloudWatch] Metrics pushed', {
      requests: reqCount,
      errors: errCount,
      p95Ms: p95.toFixed(1),
      heapMB,
      connections: activeConnections,
    });
  } catch (err) {
    logger.warn('[CloudWatch] Failed to push metrics', { error: err.message });
  }
}

/**
 * Start the CloudWatch metrics pusher.
 * Call once from server.js after the server starts listening.
 *
 * @param {Object} opts
 * @param {Function} [opts.getSocketStats] - Returns { activeConnections, onlineUsers }
 * @returns {boolean} true if started, false if skipped (missing credentials)
 */
async function startCloudWatchMetrics({ getSocketStats } = {}) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
    logger.info('[CloudWatch] Metrics disabled — AWS credentials not configured');
    return false;
  }

  try {
    await initCloudWatchClient();
    startLagMeasurement();

    pushInterval = setInterval(() => flushMetrics(getSocketStats), PUSH_INTERVAL_MS);
    pushInterval.unref();

    logger.info('[CloudWatch] Metrics pusher started', { namespace: NAMESPACE, intervalMs: PUSH_INTERVAL_MS });
    return true;
  } catch (err) {
    logger.warn('[CloudWatch] Metrics init failed (non-fatal) — metrics will NOT be pushed', { error: err.message });
    return false;
  }
}

/**
 * Stop the metrics pusher (for graceful shutdown).
 * Flushes remaining metrics before stopping.
 */
async function stopCloudWatchMetrics(getSocketStats) {
  if (pushInterval) {
    clearInterval(pushInterval);
    pushInterval = null;
  }
  if (lagInterval) {
    clearInterval(lagInterval);
    lagInterval = null;
  }
  // Final flush
  await flushMetrics(getSocketStats).catch(() => {});
}

module.exports = {
  recordRequest,
  startCloudWatchMetrics,
  stopCloudWatchMetrics,
};
