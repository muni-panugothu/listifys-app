'use strict';

// ────────────────────────────────────────────────────────────────────────────
//  Listify — Enterprise RabbitMQ Topology Configuration
//  Single source of truth for all exchanges, queues, bindings and routing keys.
// ────────────────────────────────────────────────────────────────────────────

// ── EXCHANGE DEFINITIONS ─────────────────────────────────────────────────────
const EXCHANGES = {
  /** Primary domain event routing.  pattern: {domain}.{entity}.{action} */
  TOPIC: {
    name: 'listify.topic',
    type: 'topic',
    options: { durable: true, autoDelete: false },
  },
  /** Exact-match direct messages (worker-to-worker, admin commands). */
  DIRECT: {
    name: 'listify.direct',
    type: 'direct',
    options: { durable: true, autoDelete: false },
  },
  /** Broadcast — every bound queue receives every message. */
  FANOUT: {
    name: 'listify.fanout',
    type: 'fanout',
    options: { durable: true, autoDelete: false },
  },
  /** High-volume analytics events (separate exchange to isolate load). */
  ANALYTICS: {
    name: 'listify.analytics',
    type: 'topic',
    options: { durable: true, autoDelete: false },
  },
  /** Dead-letter exchange — receives expired/rejected messages from all queues. */
  DLX: {
    name: 'listify.dlx',
    type: 'direct',
    options: { durable: true, autoDelete: false },
  },
  /**
   * Delayed-retry exchanges (TTL + DLX pattern — works on plain RabbitMQ
   * without any plugins, compatible with CloudAMQP free tier).
   * Messages sit here for X seconds, then RabbitMQ dead-letters them
   * back to listify.topic with the original routing key restored.
   */
  RETRY_1S: {
    name: 'listify.retry.1s',
    type: 'direct',
    options: { durable: true, autoDelete: false },
  },
  RETRY_10S: {
    name: 'listify.retry.10s',
    type: 'direct',
    options: { durable: true, autoDelete: false },
  },
  RETRY_60S: {
    name: 'listify.retry.60s',
    type: 'direct',
    options: { durable: true, autoDelete: false },
  },
};

// ── ROUTING KEY REGISTRY ──────────────────────────────────────────────────────
const ROUTING_KEYS = {
  // ── Auth domain ───────────────────────────────────────────────────────────
  AUTH: {
    USER_CREATED:    'auth.user.created',
    USER_VERIFIED:   'auth.user.verified',
    USER_LOGIN:      'auth.user.login',
    USER_LOGOUT:     'auth.user.logout',
    USER_BLOCKED:    'auth.user.blocked',
    USER_DELETED:    'auth.user.deleted',
    PASSWORD_RESET:  'auth.user.password_reset',
  },

  // ── Listing domain ────────────────────────────────────────────────────────
  LISTING: {
    CREATED:    'listing.listing.created',
    UPDATED:    'listing.listing.updated',
    DELETED:    'listing.listing.deleted',
    SOLD:       'listing.listing.sold',
    EXPIRED:    'listing.listing.expired',
    VIEWED:     'listing.listing.viewed',
    SAVED:      'listing.listing.saved',
    REPORTED:   'listing.listing.reported',
    PRICE_DROP: 'listing.listing.price_drop',
  },

  // ── Chat domain ───────────────────────────────────────────────────────────
  CHAT: {
    MESSAGE_SENT:    'chat.message.sent',
    MESSAGE_READ:    'chat.message.read',
    MESSAGE_DELETED: 'chat.message.deleted',
    TYPING:          'chat.typing.started',
    TYPING_STOPPED:  'chat.typing.stopped',
    OFFER_MADE:      'chat.offer.made',
    OFFER_ACCEPTED:  'chat.offer.accepted',
    OFFER_DECLINED:  'chat.offer.declined',
  },

  // ── Booking domain ────────────────────────────────────────────────────────
  BOOKING: {
    CREATED:   'booking.booking.created',
    CONFIRMED: 'booking.booking.confirmed',
    CANCELLED: 'booking.booking.cancelled',
    COMPLETED: 'booking.booking.completed',
    REMINDER:  'booking.booking.reminder',
    NO_SHOW:   'booking.booking.no_show',
  },

  // ── Payment domain ────────────────────────────────────────────────────────
  PAYMENT: {
    CREATED:    'payment.payment.created',
    AUTHORIZED: 'payment.payment.authorized',
    CAPTURED:   'payment.payment.captured',
    FAILED:     'payment.payment.failed',
    REFUNDED:   'payment.payment.refunded',
    DISPUTED:   'payment.payment.disputed',
    WEBHOOK:    'payment.payment.webhook',
  },

  // ── Notification domain ───────────────────────────────────────────────────
  NOTIFICATION: {
    PUSH_SEND:   'notification.push.send',
    EMAIL_SEND:  'notification.email.send',
    SMS_SEND:    'notification.sms.send',
    IN_APP_SEND: 'notification.inapp.send',
  },

  // ── Analytics domain ──────────────────────────────────────────────────────
  ANALYTICS: {
    USER_ACTIVITY:    'analytics.user.activity',
    LISTING_VIEWED:   'analytics.listing.viewed',
    SEARCH_PERFORMED: 'analytics.search.performed',
    CONVERSION:       'analytics.conversion.completed',
    ENGAGEMENT:       'analytics.engagement.tracked',
    SESSION_START:    'analytics.session.started',
    SESSION_END:      'analytics.session.ended',
  },
};

// ── TTL CONSTANTS ─────────────────────────────────────────────────────────────
const TTL = {
  DEFAULT:   5 * 60 * 1000,   //  5 min — standard events
  ANALYTICS: 10 * 60 * 1000,  // 10 min — analytics (higher tolerance)
  // BOOKING / PAYMENT intentionally have NO TTL — financial events never expire
};

// ── QUEUE DEFINITIONS ─────────────────────────────────────────────────────────
const QUEUES = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  AUTH_EVENTS: {
    name: 'auth.events.q',
    dlq:  'auth.events.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['auth.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'auth.events.q',
        'x-message-ttl':             TTL.DEFAULT,
        'x-max-length':              50_000,
      },
    },
  },

  // ── Listing ───────────────────────────────────────────────────────────────
  LISTING_EVENTS: {
    name: 'listing.events.q',
    dlq:  'listing.events.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['listing.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'listing.events.q',
        'x-message-ttl':             TTL.DEFAULT,
        'x-max-length':              100_000,
      },
    },
  },

  SEARCH_INDEX: {
    name: 'search.index.q',
    dlq:  'search.index.dlq',
    exchange: EXCHANGES.TOPIC.name,
    routingKeys: [
      'listing.listing.created',
      'listing.listing.updated',
      'listing.listing.deleted',
      'listing.listing.sold',
    ],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'search.index.q',
        'x-message-ttl':             TTL.DEFAULT,
      },
    },
  },

  IMAGE_PROCESSING: {
    name: 'image.processing.q',
    dlq:  'image.processing.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['listing.listing.created', 'listing.listing.updated'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'image.processing.q',
        'x-message-ttl':             TTL.DEFAULT,
      },
    },
  },

  // ── Chat ──────────────────────────────────────────────────────────────────
  CHAT_EVENTS: {
    name: 'chat.events.q',
    dlq:  'chat.events.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['chat.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'chat.events.q',
        'x-message-ttl':             TTL.DEFAULT,
        'x-max-length':              200_000,
      },
    },
  },

  // ── Booking — NO TTL, financial-grade reliability ─────────────────────────
  BOOKING_EVENTS: {
    name: 'booking.events.q',
    dlq:  'booking.events.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['booking.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'booking.events.q',
        // No x-message-ttl intentionally
      },
    },
  },

  // ── Payment — NO TTL, financial-grade reliability ─────────────────────────
  PAYMENT_EVENTS: {
    name: 'payment.events.q',
    dlq:  'payment.events.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['payment.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'payment.events.q',
        // No x-message-ttl intentionally
      },
    },
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  NOTIFICATION_PUSH: {
    name: 'notification.push.q',
    dlq:  'notification.push.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['notification.push.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'notification.push.q',
        'x-message-ttl':             TTL.DEFAULT,
        'x-max-length':              100_000,
      },
    },
  },

  NOTIFICATION_EMAIL: {
    name: 'notification.email.q',
    dlq:  'notification.email.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['notification.email.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'notification.email.q',
        'x-message-ttl':             TTL.DEFAULT,
      },
    },
  },

  NOTIFICATION_SMS: {
    name: 'notification.sms.q',
    dlq:  'notification.sms.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['notification.sms.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'notification.sms.q',
        'x-message-ttl':             TTL.DEFAULT,
      },
    },
  },

  NOTIFICATION_IN_APP: {
    name: 'notification.inapp.q',
    dlq:  'notification.inapp.dlq',
    exchange:    EXCHANGES.TOPIC.name,
    routingKeys: ['notification.inapp.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'notification.inapp.q',
        'x-message-ttl':             TTL.DEFAULT,
      },
    },
  },

  // ── Analytics — high-volume, tolerate some loss ───────────────────────────
  ANALYTICS_EVENTS: {
    name: 'analytics.events.q',
    dlq:  'analytics.events.dlq',
    exchange:    EXCHANGES.ANALYTICS.name,
    routingKeys: ['analytics.#'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange':    EXCHANGES.DLX.name,
        'x-dead-letter-routing-key': 'analytics.events.q',
        'x-message-ttl':             TTL.ANALYTICS,
        'x-max-length':              500_000,
      },
    },
  },

  // ── Retry queues (TTL + DLX pattern) ─────────────────────────────────────
  // After TTL expires, RabbitMQ moves the message back to listify.topic.
  RETRY_1S: {
    name: 'retry.1s.q',
    exchange:    EXCHANGES.RETRY_1S.name,
    routingKeys: ['retry.1s'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.TOPIC.name,
        'x-message-ttl':          1_000,
      },
    },
  },
  RETRY_10S: {
    name: 'retry.10s.q',
    exchange:    EXCHANGES.RETRY_10S.name,
    routingKeys: ['retry.10s'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.TOPIC.name,
        'x-message-ttl':          10_000,
      },
    },
  },
  RETRY_60S: {
    name: 'retry.60s.q',
    exchange:    EXCHANGES.RETRY_60S.name,
    routingKeys: ['retry.60s'],
    options: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.TOPIC.name,
        'x-message-ttl':          60_000,
      },
    },
  },
};

// ── PREFETCH (tuned for 100k+ concurrent users) ──────────────────────────────
const PREFETCH = {
  PUBLISH:    100,  // confirm channel
  CONSUME:     20,  // per consumer channel
  ANALYTICS:  100,  // analytics worker — cheap processing
  EMAIL:        5,  // email — rate-limited by SMTP
  SMS:          5,  // SMS — rate-limited by Twilio
};

// ── MESSAGE SCHEMA VERSION ────────────────────────────────────────────────────
const MESSAGE_VERSION = '2.0';

module.exports = {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
  TTL,
  PREFETCH,
  MESSAGE_VERSION,
};
