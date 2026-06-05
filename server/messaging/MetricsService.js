'use strict';

/**
 * MetricsService — in-process counters + optional Prometheus integration.
 *
 * If prom-client is installed (`npm i prom-client`), metrics are also exposed
 * via a Prometheus-compatible /metrics endpoint (see metrics/prometheus.metrics.js).
 * If not installed, in-process counters still work for internal health checks.
 */

let promClient = null;
try {
  promClient = require('prom-client');
} catch {
  // prom-client not installed — in-process mode only
}

class MetricsService {
  constructor() {
    this._counters  = new Map(); // name → number
    this._startTime = Date.now();

    this._promCounters   = {};
    this._promHistograms = {};

    if (promClient) {
      this._initPrometheus();
    }
  }

  // ── Prometheus Registration ───────────────────────────────────────────────

  _initPrometheus() {
    const reg = promClient.register;

    const counter = (name, help, labelNames = []) => {
      this._promCounters[name] = new promClient.Counter({
        name: `listify_mq_${name}`,
        help,
        labelNames,
        registers: [reg],
      });
    };

    const histogram = (name, help, labelNames = [], buckets) => {
      this._promHistograms[name] = new promClient.Histogram({
        name: `listify_mq_${name}`,
        help,
        labelNames,
        buckets: buckets ?? [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000],
        registers: [reg],
      });
    };

    counter('messages_published_total',      'Total messages published to RabbitMQ');
    counter('messages_consumed_total',       'Total messages successfully consumed');
    counter('messages_retried_total',        'Total messages sent to retry queues');
    counter('messages_dead_lettered_total',  'Total messages sent to DLQ');
    counter('handler_errors_total',          'Total consumer handler errors');
    counter('duplicate_messages_total',      'Total duplicate messages skipped');
    counter('publish_errors_total',          'Total publish errors');
    counter('circuit_breaker_opens_total',   'Total circuit breaker open events');
    counter('dlq_processed_total',           'Total DLQ messages processed', ['queue']);

    histogram('message_processing_ms', 'Message processing latency (ms)', ['queue']);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  increment(name, count = 1, labels = {}) {
    this._counters.set(name, (this._counters.get(name) ?? 0) + count);

    if (promClient) {
      // Try both raw name and underscore variant (Prometheus naming)
      const c = this._promCounters[name];
      if (c) {
        Object.keys(labels).length ? c.labels(labels).inc(count) : c.inc(count);
      }
    }
  }

  observe(name, value, labels = {}) {
    if (promClient) {
      const h = this._promHistograms[name];
      if (h) {
        Object.keys(labels).length ? h.labels(labels).observe(value) : h.observe(value);
      }
    }
  }

  getStats() {
    const stats = { uptime_ms: Date.now() - this._startTime };
    for (const [k, v] of this._counters) stats[k] = v;
    return stats;
  }

  async getPrometheusMetrics() {
    if (!promClient) return '# prom-client not installed\n';
    return promClient.register.metrics();
  }

  getContentType() {
    return promClient?.register.contentType ?? 'text/plain; version=0.0.4';
  }
}

module.exports = new MetricsService();
