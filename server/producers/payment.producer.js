'use strict';

const EventBus = require('../messaging/EventBusService');

const PaymentProducer = {
  async paymentCreated(payment, meta = {}) {
    return EventBus.paymentCreated(payment._id?.toString() ?? payment.id, {
      bookingId: payment.bookingId?.toString() ?? null,
      listingId: payment.listingId?.toString() ?? null,
      payerId:   payment.payerId?.toString(),
      payeeId:   payment.payeeId?.toString(),
      amount:    payment.amount,
      currency:  payment.currency ?? 'USD',
      provider:  payment.provider ?? 'stripe',
      createdAt: payment.createdAt?.toISOString?.() ?? new Date().toISOString(),
    }, meta);
  },

  async paymentAuthorized(paymentId, authCode, meta = {}) {
    return EventBus.paymentAuthorized(paymentId, {
      authCode,
      authorizedAt: new Date().toISOString(),
    }, meta);
  },

  async paymentCaptured(paymentId, meta = {}) {
    return EventBus.paymentCaptured(paymentId, {
      capturedAt: new Date().toISOString(),
    }, meta);
  },

  async paymentFailed(paymentId, reason, errorCode = null, meta = {}) {
    return EventBus.paymentFailed(paymentId, {
      reason,
      errorCode,
      failedAt: new Date().toISOString(),
    }, meta);
  },

  async paymentRefunded(paymentId, amount, refundId = null, reason = null, meta = {}) {
    return EventBus.paymentRefunded(paymentId, {
      refundId,
      amount,
      reason,
      refundedAt: new Date().toISOString(),
    }, meta);
  },

  async paymentDisputed(paymentId, reason, meta = {}) {
    return EventBus.paymentDisputed(paymentId, {
      reason,
      disputedAt: new Date().toISOString(),
    }, meta);
  },
};

module.exports = PaymentProducer;
