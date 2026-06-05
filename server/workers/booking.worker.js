'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeMessaging, shutdownMessaging } = require('../messaging');
const ConsumerService  = require('../messaging/ConsumerService');
const BookingHandler   = require('../handlers/booking.handler');
const PaymentHandler   = require('../handlers/payment.handler');
const { QUEUES }       = require('../messaging/config/messaging.config');
const { logger }       = require('../utils/logger');

/**
 * BookingWorker — handles both booking and payment events.
 * Both queues have NO TTL (financial-grade). This worker handles the
 * most critical events in the system.
 */
async function start() {
  logger.info('[BookingWorker] 🚀 Starting...');

  await initializeMessaging({ startMonitoring: true, startDLQProcessing: true });

  // Booking events — 4 retries, money involved
  await ConsumerService.consume(
    QUEUES.BOOKING_EVENTS.name,
    (payload, envelope) => BookingHandler.handle(payload, envelope),
    { maxRetries: 4, prefetch: 10 },
  );

  // Payment events — 5 retries, financial-grade
  await ConsumerService.consume(
    QUEUES.PAYMENT_EVENTS.name,
    (payload, envelope) => PaymentHandler.handle(payload, envelope),
    { maxRetries: 5, prefetch: 5 },
  );

  logger.info('[BookingWorker] ✅ Ready — booking + payment consumers active');

  async function shutdown(signal) {
    logger.info(`[BookingWorker] ${signal} — shutting down`);
    await shutdownMessaging();
    process.exit(0);
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('[BookingWorker] Fatal', { error: err.message });
  process.exit(1);
});
