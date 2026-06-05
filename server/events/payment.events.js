'use strict';

const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const PaymentEvents = {
  CREATED: {
    routingKey: ROUTING_KEYS.PAYMENT.CREATED,
    schema: {
      paymentId:  'string (required)',
      bookingId:  'string',
      listingId:  'string',
      payerId:    'string (required)',
      payeeId:    'string (required)',
      amount:     'number (required)',
      currency:   "string — default 'USD'",
      provider:   "string — 'stripe' | 'paypal' | 'manual'",
      createdAt:  'ISO date string',
    },
  },
  AUTHORIZED: {
    routingKey: ROUTING_KEYS.PAYMENT.AUTHORIZED,
    schema: {
      paymentId:    'string (required)',
      authCode:     'string',
      authorizedAt: 'ISO date string',
    },
  },
  CAPTURED: {
    routingKey: ROUTING_KEYS.PAYMENT.CAPTURED,
    schema: {
      paymentId:  'string (required)',
      capturedAt: 'ISO date string',
    },
  },
  FAILED: {
    routingKey: ROUTING_KEYS.PAYMENT.FAILED,
    schema: {
      paymentId:  'string (required)',
      reason:     'string (required)',
      errorCode:  'string',
      failedAt:   'ISO date string',
    },
  },
  REFUNDED: {
    routingKey: ROUTING_KEYS.PAYMENT.REFUNDED,
    schema: {
      paymentId:  'string (required)',
      refundId:   'string',
      amount:     'number (required)',
      reason:     'string',
      refundedAt: 'ISO date string',
    },
  },
  DISPUTED: {
    routingKey: ROUTING_KEYS.PAYMENT.DISPUTED,
    schema: {
      paymentId:  'string (required)',
      reason:     'string',
      disputedAt: 'ISO date string',
    },
  },
};

module.exports = PaymentEvents;
