'use strict';

const MonitoringService = require('../messaging/MonitoringService');
const MetricsService    = require('../messaging/MetricsService');

/**
 * HealthMonitor — aggregate RabbitMQ health for HTTP /health endpoints.
 *
 * Mount in Express:
 *   const HealthMonitor = require('./monitoring/health.monitor');
 *   app.get('/health/mq', HealthMonitor.expressHandler);
 *   app.get('/health',    HealthMonitor.expressHandler);  // full health
 */
const HealthMonitor = {
  /**
   * Express route handler — returns JSON health status.
   * HTTP 200 = healthy/degraded, HTTP 503 = critical.
   */
  async expressHandler(req, res) {
    try {
      const health = await MonitoringService.healthCheck();
      const statusCode = health.status === 'critical' ? 503 : 200;
      res.status(statusCode).json(health);
    } catch (err) {
      res.status(503).json({
        status:    'critical',
        error:     err.message,
        checkedAt: new Date().toISOString(),
      });
    }
  },

  /**
   * Kubernetes liveness probe — lightweight, just checks broker connection.
   * Mount at GET /healthz
   */
  async livenessHandler(req, res) {
    const MonSvc = require('../messaging/MonitoringService');
    const connMgr = require('../messaging/connection/connection.manager');
    if (connMgr.isConnected()) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(503).json({ status: 'disconnected' });
    }
  },

  /**
   * Return raw health object (for programmatic use — no Express dependency).
   */
  async getStatus() {
    return MonitoringService.healthCheck();
  },
};

module.exports = HealthMonitor;
