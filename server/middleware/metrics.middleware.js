/**
 * Lightweight Prometheus-compatible metrics middleware.
 * No external dependencies — emits text/plain in Prometheus exposition format.
 */

const os = require('os');

// ── Metric counters ──────────────────────────────────────────────────────────
const MAX_METRIC_KEYS = 5000;
const httpRequestsTotal = {};      // { "method:route:status" → count }
const httpDurationBuckets = {};    // { "method:route" → { bucket → count } }
let httpRequestsInFlight = 0;
let _counterKeyCount = 0;
let _histKeyCount = 0;

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizeRoute(req) {
  // Use mounted route pattern if available (e.g. "/api/electronics/:id")
  if (req.route && req.route.path) {
    return req.baseUrl + req.route.path;
  }
  // Fallback: collapse IDs in the path to keep cardinality low
  return req.path.replace(/\/[a-f0-9]{24}/g, '/:id')
               .replace(/\/[0-9]+/g, '/:num');
}

// ── Middleware: track request duration & counts ─────────────────────────────
function metricsMiddleware(req, res, next) {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') return next();

  const start = process.hrtime.bigint();
  httpRequestsInFlight++;

  const onFinish = () => {
    httpRequestsInFlight--;
    res.removeListener('finish', onFinish);
    res.removeListener('close', onFinish);

    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const method = req.method;
    const route = normalizeRoute(req);
    const status = res.statusCode;
    const statusGroup = `${Math.floor(status / 100)}xx`;

    // Increment request counter (capped to prevent unbounded memory growth)
    const counterKey = `${method}:${route}:${statusGroup}`;
    if (httpRequestsTotal[counterKey] !== undefined) {
      httpRequestsTotal[counterKey]++;
    } else if (_counterKeyCount < MAX_METRIC_KEYS) {
      httpRequestsTotal[counterKey] = 1;
      _counterKeyCount++;
    }

    // Increment histogram buckets (capped)
    const histKey = `${method}:${route}`;
    if (!httpDurationBuckets[histKey]) {
      if (_histKeyCount >= MAX_METRIC_KEYS) return; // drop new high-cardinality keys
      httpDurationBuckets[histKey] = { sum: 0, count: 0 };
      DURATION_BUCKETS.forEach(b => { httpDurationBuckets[histKey][b] = 0; });
      _histKeyCount++;
    }
    const hist = httpDurationBuckets[histKey];
    hist.sum += durationSec;
    hist.count++;
    DURATION_BUCKETS.forEach(b => {
      if (durationSec <= b) hist[b]++;
    });
  };

  res.on('finish', onFinish);
  res.on('close', onFinish);
  next();
}

// ── /metrics endpoint handler ───────────────────────────────────────────────
function metricsHandler(_req, res) {
  const lines = [];

  // -- HTTP request totals
  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, count] of Object.entries(httpRequestsTotal)) {
    const [method, route, status] = key.split(':');
    lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
  }

  // -- HTTP request duration histogram
  lines.push('# HELP http_request_duration_seconds HTTP request duration');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const [key, hist] of Object.entries(httpDurationBuckets)) {
    const [method, route] = key.split(':');
    const labels = `method="${method}",route="${route}"`;
    DURATION_BUCKETS.forEach(b => {
      lines.push(`http_request_duration_seconds_bucket{${labels},le="${b}"} ${hist[b]}`);
    });
    lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${hist.count}`);
    lines.push(`http_request_duration_seconds_sum{${labels}} ${hist.sum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${hist.count}`);
  }

  // -- In-flight requests
  lines.push('# HELP http_requests_in_flight Current in-flight HTTP requests');
  lines.push('# TYPE http_requests_in_flight gauge');
  lines.push(`http_requests_in_flight ${httpRequestsInFlight}`);

  // -- Node.js process metrics
  const mem = process.memoryUsage();
  lines.push('# HELP process_resident_memory_bytes Resident memory size');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${mem.rss}`);

  lines.push('# HELP process_heap_used_bytes Heap used');
  lines.push('# TYPE process_heap_used_bytes gauge');
  lines.push(`process_heap_used_bytes ${mem.heapUsed}`);

  lines.push('# HELP process_heap_total_bytes Heap total');
  lines.push('# TYPE process_heap_total_bytes gauge');
  lines.push(`process_heap_total_bytes ${mem.heapTotal}`);

  lines.push('# HELP process_uptime_seconds Process uptime');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);

  // -- OS load
  const loadAvg = os.loadavg();
  lines.push('# HELP node_load1 1-minute load average');
  lines.push('# TYPE node_load1 gauge');
  lines.push(`node_load1 ${loadAvg[0].toFixed(2)}`);

  // -- Event loop lag (rough estimate)
  lines.push('# HELP nodejs_active_handles Active libuv handles');
  lines.push('# TYPE nodejs_active_handles gauge');
  lines.push(`nodejs_active_handles ${process._getActiveHandles?.()?.length || 0}`);

  lines.push('# HELP nodejs_active_requests Active libuv requests');
  lines.push('# TYPE nodejs_active_requests gauge');
  lines.push(`nodejs_active_requests ${process._getActiveRequests?.()?.length || 0}`);

  // -- Upstash Redis quota
  try {
    const redis = require('../config/redis');
    const stats = redis.__quotaStats;
    if (stats) {
      lines.push('# HELP upstash_redis_daily_requests_used Daily Redis requests used');
      lines.push('# TYPE upstash_redis_daily_requests_used gauge');
      lines.push(`upstash_redis_daily_requests_used ${stats.used}`);
      lines.push('# HELP upstash_redis_daily_requests_limit Daily Redis request limit');
      lines.push('# TYPE upstash_redis_daily_requests_limit gauge');
      lines.push(`upstash_redis_daily_requests_limit ${stats.limit}`);
      lines.push('# HELP upstash_redis_quota_exhausted Whether Redis quota is exhausted');
      lines.push('# TYPE upstash_redis_quota_exhausted gauge');
      lines.push(`upstash_redis_quota_exhausted ${stats.exhausted ? 1 : 0}`);
    }
  } catch (_) { /* redis not available */ }

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.end(lines.join('\n') + '\n');
}

module.exports = { metricsMiddleware, metricsHandler };
