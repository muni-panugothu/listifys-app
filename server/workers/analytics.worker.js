'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeMessaging, shutdownMessaging } = require('../messaging');
const ConsumerService    = require('../messaging/ConsumerService');
const AnalyticsHandler   = require('../handlers/analytics.handler');
const { QUEUES }         = require('../messaging/config/messaging.config');
const { logger }         = require('../utils/logger');

/**
 * AnalyticsWorker — high-throughput, best-effort analytics event processing.
 *
 * Design notes:
 *  - prefetch=100  : batch-friendly, fast processing
 *  - maxRetries=1  : analytics loss is acceptable; don't spam retries
 *  - deduplicate=false : views/searches naturally repeat; dedup wastes memory
 */
async function start() {
  logger.info('[AnalyticsWorker] 🚀 Starting...');

  await initializeMessaging({ startMonitoring: false, startDLQProcessing: false });

  await ConsumerService.consume(
    QUEUES.ANALYTICS_EVENTS.name,
    (payload, envelope) => AnalyticsHandler.handle(payload, envelope),
    { maxRetries: 1, prefetch: 100, deduplicate: false },
  );

  logger.info('[AnalyticsWorker] ✅ Ready');

  async function shutdown(signal) {
    logger.info(`[AnalyticsWorker] ${signal} — shutting down`);
    await shutdownMessaging();
    process.exit(0);
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('[AnalyticsWorker] Fatal', { error: err.message });
  process.exit(1);
});
