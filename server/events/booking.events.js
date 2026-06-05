'use strict';

const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const BookingEvents = {
  CREATED: {
    routingKey: ROUTING_KEYS.BOOKING.CREATED,
    schema: {
      bookingId:  'string (required)',
      listingId:  'string (required)',
      buyerId:    'string (required)',
      sellerId:   'string (required)',
      amount:     'number (required)',
      scheduledAt:'ISO date string',
      createdAt:  'ISO date string',
    },
  },
  CONFIRMED: {
    routingKey: ROUTING_KEYS.BOOKING.CONFIRMED,
    schema: {
      bookingId:   'string (required)',
      confirmedAt: 'ISO date string',
    },
  },
  CANCELLED: {
    routingKey: ROUTING_KEYS.BOOKING.CANCELLED,
    schema: {
      bookingId:   'string (required)',
      cancelledBy: 'string — userId',
      reason:      'string',
      cancelledAt: 'ISO date string',
    },
  },
  COMPLETED: {
    routingKey: ROUTING_KEYS.BOOKING.COMPLETED,
    schema: {
      bookingId:   'string (required)',
      completedAt: 'ISO date string',
    },
  },
  REMINDER: {
    routingKey: ROUTING_KEYS.BOOKING.REMINDER,
    schema: {
      bookingId:    'string (required)',
      reminderType: "'24h' | '1h' | '15min'",
    },
  },
};

module.exports = BookingEvents;
