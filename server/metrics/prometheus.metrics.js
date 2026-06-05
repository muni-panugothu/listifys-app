'use strict';

const MetricsService = require('../messaging/MetricsService');

/**
 * Prometheus metrics endpoint handler.
 *
 * Mount in Express:
 *   const { metricsHandler } = require('./metrics/prometheus.metrics');
 *   app.get('/metrics', metricsHandler);
 *
 * Requires prom-client: `npm install prom-client`
 * If not installed, returns a plain-text comment.
 *
 * Prometheus scrape config (prometheus.yml):
 *   - job_name: 'listify-api'
 *     static_configs:
 *       - targets: ['<server-host>:5000']
 *     metrics_path: /metrics
 */
async function metricsHandler(req, res) {
  try {
    const [metrics, contentType] = await Promise.all([
      MetricsService.getPrometheusMetrics(),
      Promise.resolve(MetricsService.getContentType()),
    ]);
    res.set('Content-Type', contentType);
    res.end(metrics);
  } catch (err) {
    res.status(500).end(`# metrics collection error\n# ${err.message}\n`);
  }
}

/**
 * Return current in-process counter snapshot as JSON.
 * Useful for internal dashboards without a full Prometheus setup.
 */
function statsHandler(req, res) {
  res.json(MetricsService.getStats());
}

module.exports = { metricsHandler, statsHandler };
