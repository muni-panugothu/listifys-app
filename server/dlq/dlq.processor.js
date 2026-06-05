'use strict';

const DeadLetterService = require('../messaging/DeadLetterService');
const MetricsService    = require('../messaging/MetricsService');
const { QUEUES }        = require('../messaging/config/messaging.config');
const { logger }        = require('../utils/logger');

/**
 * registerDLQHandlers — registers domain-specific dead-letter handlers.
 *
 * Call this before DeadLetterService.startAll() (done automatically inside
 * initializeMessaging when startDLQProcessing=true).
 *
 * Handler priority order:
 *  1. payment.events.dlq   → CRITICAL alert + persist for reconciliation
 *  2. booking.events.dlq   → CRITICAL alert + persist
 *  3. auth.events.dlq      → WARN log + security audit
 *  4. All others           → default handler (error log + metric)
 */
function registerDLQHandlers() {

  // ── PAYMENT DLQ — financial reconciliation required ───────────────────────
  DeadLetterService.registerHandler(QUEUES.PAYMENT_EVENTS.dlq, async (dlqName, envelope) => {
    logger.error('🚨 [DLQ] PAYMENT dead letter — FINANCIAL RECONCILIATION REQUIRED', {
      dlq:        dlqName,
      messageId:  envelope.messageId,
      routingKey: envelope.routingKey,
      paymentId:  envelope.payload?.paymentId,
      retryCount: envelope.retryCount,
      lastError:  envelope.lastError,
    });

    MetricsService.increment('dlq_payment_critical');

    // TODO: Persist to MongoDB dead_letters collection for manual ops review
    // await DeadLetterRepository.create({
    //   domain:     'payment',
    //   priority:   'critical',
    //   envelope,
    //   receivedAt: new Date(),
    // });

    // TODO: Page on-call engineer
    // await alertService.page('PAYMENT_DLQ', { paymentId: envelope.payload?.paymentId });
  });

  // ── BOOKING DLQ — money-critical, alert ops ───────────────────────────────
  DeadLetterService.registerHandler(QUEUES.BOOKING_EVENTS.dlq, async (dlqName, envelope) => {
    logger.error('🚨 [DLQ] BOOKING dead letter — REQUIRES IMMEDIATE ATTENTION', {
      dlq:        dlqName,
      messageId:  envelope.messageId,
      routingKey: envelope.routingKey,
      bookingId:  envelope.payload?.bookingId,
      retryCount: envelope.retryCount,
      lastError:  envelope.lastError,
    });

    MetricsService.increment('dlq_booking_critical');

    // TODO: await DeadLetterRepository.create({ domain: 'booking', priority: 'critical', envelope });
    // TODO: await alertService.page('BOOKING_DLQ', { bookingId: envelope.payload?.bookingId });
  });

  // ── AUTH DLQ — security implications ─────────────────────────────────────
  DeadLetterService.registerHandler(QUEUES.AUTH_EVENTS.dlq, async (dlqName, envelope) => {
    logger.warn('[DLQ] AUTH dead letter', {
      dlq:        dlqName,
      routingKey: envelope.routingKey,
      userId:     envelope.payload?.userId,
      lastError:  envelope.lastError,
    });

    MetricsService.increment('dlq_auth');

    // TODO: await SecurityAuditService.logDeadLetter(envelope);
  });

  // ── LISTING DLQ ───────────────────────────────────────────────────────────
  DeadLetterService.registerHandler(QUEUES.LISTING_EVENTS.dlq, async (dlqName, envelope) => {
    logger.warn('[DLQ] LISTING dead letter', {
      dlq:        dlqName,
      routingKey: envelope.routingKey,
      listingId:  envelope.payload?.listingId,
    });
    MetricsService.increment('dlq_listing');
  });

  logger.info('[DLQProcessor] Domain DLQ handlers registered');
}

module.exports = { registerDLQHandlers };
