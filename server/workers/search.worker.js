'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeMessaging, shutdownMessaging } = require('../messaging');
const ConsumerService  = require('../messaging/ConsumerService');
const ListingHandler   = require('../handlers/listing.handler');
const { QUEUES }       = require('../messaging/config/messaging.config');
const { logger }       = require('../utils/logger');

/**
 * SearchWorker — keeps the search index in sync with listing changes.
 * Subscribes to search.index.q (bound to listing.created / updated / deleted / sold).
 */
async function start() {
  logger.info('[SearchWorker] 🚀 Starting...');

  await initializeMessaging({ startMonitoring: false, startDLQProcessing: false });

  await ConsumerService.consume(
    QUEUES.SEARCH_INDEX.name,
    (payload, envelope) => ListingHandler.handle(payload, envelope),
    { maxRetries: 3, prefetch: 20 },
  );

  logger.info('[SearchWorker] ✅ Ready — indexing listing events');

  async function shutdown(signal) {
    logger.info(`[SearchWorker] ${signal} — shutting down`);
    await shutdownMessaging();
    process.exit(0);
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('[SearchWorker] Fatal', { error: err.message });
  process.exit(1);
});
