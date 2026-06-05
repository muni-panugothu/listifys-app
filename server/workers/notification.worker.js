'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeMessaging, shutdownMessaging } = require('../messaging');
const ConsumerService    = require('../messaging/ConsumerService');
const NotificationHandler = require('../handlers/notification.handler');
const { QUEUES }         = require('../messaging/config/messaging.config');
const { logger }         = require('../utils/logger');

async function start() {
  logger.info('[NotificationWorker] 🚀 Starting...');

  await initializeMessaging({ startMonitoring: true, startDLQProcessing: false });

  const dispatch = (payload, envelope) => NotificationHandler.handle(payload, envelope);

  // Push notifications
  await ConsumerService.consume(QUEUES.NOTIFICATION_PUSH.name,  dispatch, { maxRetries: 3, prefetch: 20 });
  // In-app (Socket.IO fan-out)
  await ConsumerService.consume(QUEUES.NOTIFICATION_IN_APP.name, dispatch, { maxRetries: 2, prefetch: 50 });

  logger.info('[NotificationWorker] ✅ Consumers ready');

  async function shutdown(signal) {
    logger.info(`[NotificationWorker] ${signal} received — shutting down`);
    await shutdownMessaging();
    process.exit(0);
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('[NotificationWorker] Fatal startup error', { error: err.message });
  process.exit(1);
});
