'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeMessaging, shutdownMessaging } = require('../messaging');
const ConsumerService    = require('../messaging/ConsumerService');
const NotificationHandler = require('../handlers/notification.handler');
const { QUEUES }         = require('../messaging/config/messaging.config');
const { logger }         = require('../utils/logger');

async function start() {
  logger.info('[EmailWorker] 🚀 Starting...');

  await initializeMessaging({ startMonitoring: false, startDLQProcessing: false });

  await ConsumerService.consume(
    QUEUES.NOTIFICATION_EMAIL.name,
    (payload, envelope) => NotificationHandler.handle(payload, envelope),
    // Low prefetch — outbound SMTP is rate-limited; avoid overwhelming the relay
    { maxRetries: 5, prefetch: 5 },
  );

  logger.info('[EmailWorker] ✅ Ready');

  async function shutdown(signal) {
    logger.info(`[EmailWorker] ${signal} — shutting down`);
    await shutdownMessaging();
    process.exit(0);
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('[EmailWorker] Fatal', { error: err.message });
  process.exit(1);
});
