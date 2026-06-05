'use strict';
/**
 * ── Queue Worker Bootstrap ─────────────────────────────────────────────────────
 * Initializes RabbitMQ connection and starts ALL consumers.
 * Called once at server startup from server.js.
 *
 * Design:
 *  - Non-blocking: server runs even if RabbitMQ is unavailable
 *  - Graceful: registered for SIGTERM/SIGINT in shutdown handler
 *  - Parallel boot: all consumers start simultaneously for fast init
 */
const { connect, close }             = require('./rabbitmq');
const { startEmailConsumers }        = require('./consumers/email.consumer');
const { startAuditLogConsumer }      = require('./consumers/auditlog.consumer');
const { startListingConsumers }      = require('./consumers/listing.consumer');
const { startNotificationConsumer }  = require('./consumers/notification.consumer');
const { startChatConsumer }          = require('./consumers/chat.consumer');
const { startBookingConsumer }       = require('./consumers/booking.consumer');
const { logger }                     = require('../utils/logger');

let _started = false;

const startWorkers = async () => {
  // _started guard prevents duplicate consumer registrations on the SAME connection.
  // consume() in rabbitmq.js now handles reconnect re-registration automatically,
  // so this guard only needs to block the very first double-call at server boot.
  if (_started) return;

  try {
    const ch = await connect();
    if (!ch) {
      logger.warn('[Workers] RabbitMQ not available — workers not started (gracefully skipped)');
      return;
    }

    // Start all consumers in parallel for fast boot.
    // Each consumer saves its registration in rabbitmq._registeredConsumers so
    // it is automatically re-applied after any reconnect.
    await Promise.all([
      startEmailConsumers(),
      startAuditLogConsumer(),
      startListingConsumers(),
      startNotificationConsumer(),
      startChatConsumer(),
      startBookingConsumer(),
    ]);

    _started = true;
    logger.info('🚀 [Workers] All RabbitMQ consumers running (auth + listing + notification + chat + booking)');
  } catch (err) {
    logger.error('[Workers] Failed to start workers (non-fatal)', { error: err.message });
    // Never throw — server must keep running even if queue workers fail
  }
};

const stopWorkers = async () => {
  try {
    await close();
    logger.info('[Workers] RabbitMQ closed gracefully');
  } catch (err) {
    logger.error('[Workers] Error closing RabbitMQ', { error: err.message });
  }
};

module.exports = { startWorkers, stopWorkers };
