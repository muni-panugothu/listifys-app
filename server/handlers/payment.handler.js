'use strict';

const { logger }      = require('../utils/logger');
const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

/**
 * PaymentHandler — processes payment domain events.
 * Financial events are on the NO-TTL queue and retry up to 5× before DLQ.
 * The DLQ handler in dlq.processor.js triggers critical alerts for exhausted retries.
 */
const PaymentHandler = {
  async handle(payload, envelope) {
    const { routingKey } = envelope;
    switch (routingKey) {
      case ROUTING_KEYS.PAYMENT.CREATED:    return PaymentHandler.onCreated(payload, envelope);
      case ROUTING_KEYS.PAYMENT.AUTHORIZED: return PaymentHandler.onAuthorized(payload, envelope);
      case ROUTING_KEYS.PAYMENT.CAPTURED:   return PaymentHandler.onCaptured(payload, envelope);
      case ROUTING_KEYS.PAYMENT.FAILED:     return PaymentHandler.onFailed(payload, envelope);
      case ROUTING_KEYS.PAYMENT.REFUNDED:   return PaymentHandler.onRefunded(payload, envelope);
      case ROUTING_KEYS.PAYMENT.DISPUTED:   return PaymentHandler.onDisputed(payload, envelope);
      default:
        logger.debug('[PaymentHandler] Unknown routing key', { routingKey });
    }
  },

  async onCreated(payload) {
    const { paymentId, payerId, amount, currency } = payload;
    logger.info('[PaymentHandler] Payment created', { paymentId, amount, currency });
    // await PaymentRepository.recordCreated(payload);
  },

  async onAuthorized(payload) {
    const { paymentId, authCode } = payload;
    logger.info('[PaymentHandler] Payment authorized', { paymentId });
    // await PaymentRepository.recordAuthorized(paymentId, authCode);
    // await BookingProducer.bookingConfirmed(payload.bookingId);
  },

  async onCaptured(payload) {
    const { paymentId } = payload;
    logger.info('[PaymentHandler] Payment captured', { paymentId });
    // await LedgerService.credit(payload.payeeId, payload.amount);
  },

  async onFailed(payload) {
    const { paymentId, reason } = payload;
    logger.warn('[PaymentHandler] Payment failed', { paymentId, reason });
    // await PaymentRepository.recordFailed(paymentId, reason);
    // Notify payer, unblock listing
  },

  async onRefunded(payload) {
    const { paymentId, amount } = payload;
    logger.info('[PaymentHandler] Payment refunded', { paymentId, amount });
    // await LedgerService.debit(payload.payeeId, amount);
    // await NotificationProducer.email(payerEmail, 'refund-processed', payload);
  },

  async onDisputed(payload) {
    const { paymentId, reason } = payload;
    logger.warn('[PaymentHandler] Payment disputed 🚨', { paymentId, reason });
    // Freeze related funds, alert ops team
  },
};

module.exports = PaymentHandler;
