'use strict';

const connectionManager = require('./connection/connection.manager');
const MetricsService    = require('./MetricsService');
const { QUEUES }        = require('./config/messaging.config');
const { logger }        = require('../utils/logger');

const POLL_INTERVAL_MS    = 30_000;  // Poll queue depths every 30 s
const DEPTH_WARN_THRESHOLD = 1_000;  // Log warning if queue depth exceeds this
const DEPTH_CRIT_THRESHOLD = 10_000; // Log critical if queue depth exceeds this

/**
 * MonitoringService — periodic queue-depth monitoring + health aggregation.
 *
 * Emits structured log warnings when:
 *  - A queue depth exceeds DEPTH_WARN_THRESHOLD
 *  - A queue has messages but 0 consumers (consumer lag)
 *
 * Results are also available via healthCheck() for the /health HTTP endpoint.
 */
class MonitoringService {
  constructor() {
    this._timer   = null;
    this._channel = null;
    this._lastReport = [];
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.collectQueueMetrics(), POLL_INTERVAL_MS);
    // Collect immediately on start
    setImmediate(() => this.collectQueueMetrics());
    logger.info('[MonitoringService] ✅ Queue depth polling started (every 30s)');
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  async collectQueueMetrics() {
    const ch = await this._getChannel();
    if (!ch) return [];

    const report = [];

    for (const qDef of Object.values(QUEUES)) {
      try {
        const { messageCount, consumerCount } = await ch.checkQueue(qDef.name);
        const entry = {
          queue:         qDef.name,
          messages:      messageCount,
          consumers:     consumerCount,
          consumerLag:   consumerCount === 0 && messageCount > 0,
        };
        report.push(entry);

        if (messageCount >= DEPTH_CRIT_THRESHOLD) {
          logger.error('[MonitoringService] 🚨 CRITICAL queue depth', {
            queue: qDef.name, depth: messageCount, consumers: consumerCount,
          });
        } else if (messageCount >= DEPTH_WARN_THRESHOLD) {
          logger.warn('[MonitoringService] ⚠️  High queue depth', {
            queue: qDef.name, depth: messageCount, consumers: consumerCount,
          });
        }

        if (entry.consumerLag) {
          logger.warn('[MonitoringService] ⚠️  No consumers — messages accumulating', {
            queue: qDef.name, depth: messageCount,
          });
        }
      } catch {
        // Queue not declared yet or permission issue — skip silently
      }
    }

    this._lastReport = report;
    return report;
  }

  /** Aggregate health status for /health endpoint. */
  async healthCheck() {
    const connected    = connectionManager.isConnected();
    const stats        = MetricsService.getStats();
    const queueDepths  = this._lastReport;

    let status = 'healthy';
    const alerts = [];

    for (const q of queueDepths) {
      if (q.messages >= DEPTH_CRIT_THRESHOLD) {
        status = 'critical';
        alerts.push({ type: 'queue_depth_critical', queue: q.queue, depth: q.messages });
      } else if (q.messages >= DEPTH_WARN_THRESHOLD && status === 'healthy') {
        status = 'degraded';
        alerts.push({ type: 'queue_depth_high', queue: q.queue, depth: q.messages });
      }
      if (q.consumerLag) {
        if (status === 'healthy') status = 'degraded';
        alerts.push({ type: 'no_consumers', queue: q.queue, pending: q.messages });
      }
    }

    if (!connected) {
      status = 'critical';
      alerts.push({ type: 'broker_disconnected' });
    }

    return {
      status,
      connected,
      metrics:      stats,
      queues:       queueDepths,
      alerts,
      checkedAt:    new Date().toISOString(),
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  async _getChannel() {
    if (this._channel) return this._channel;
    this._channel = await connectionManager.createChannel('monitoring');
    if (this._channel) {
      this._channel.on('error', () => { this._channel = null; });
      this._channel.on('close', () => { this._channel = null; });
    }
    return this._channel;
  }
}

module.exports = new MonitoringService();
