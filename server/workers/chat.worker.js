'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeMessaging, shutdownMessaging } = require('../messaging');
const ConsumerService = require('../messaging/ConsumerService');
const ChatHandler     = require('../handlers/chat.handler');
const { QUEUES }      = require('../messaging/config/messaging.config');
const { logger }      = require('../utils/logger');

async function start() {
  logger.info('[ChatWorker] 🚀 Starting...');

  await initializeMessaging({ startMonitoring: false, startDLQProcessing: false });

  await ConsumerService.consume(
    QUEUES.CHAT_EVENTS.name,
    (payload, envelope) => ChatHandler.handle(payload, envelope),
    { maxRetries: 3, prefetch: 50 },
  );

  logger.info('[ChatWorker] ✅ Ready');

  async function shutdown(signal) {
    logger.info(`[ChatWorker] ${signal} — shutting down`);
    await shutdownMessaging();
    process.exit(0);
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('[ChatWorker] Fatal', { error: err.message });
  process.exit(1);
});
