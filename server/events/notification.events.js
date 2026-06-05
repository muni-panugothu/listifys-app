'use strict';

const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const NotificationEvents = {
  PUSH_SEND: {
    routingKey: ROUTING_KEYS.NOTIFICATION.PUSH_SEND,
    schema: {
      userId:   'string (required)',
      fcmToken: 'string (required)',
      title:    'string (required)',
      body:     'string (required)',
      data:     'object — extra key-value pairs for the app to act on',
    },
  },
  EMAIL_SEND: {
    routingKey: ROUTING_KEYS.NOTIFICATION.EMAIL_SEND,
    schema: {
      to:       'string (required) — recipient email',
      template: 'string (required) — template name in email service',
      data:     'object — template variable substitutions',
    },
  },
  SMS_SEND: {
    routingKey: ROUTING_KEYS.NOTIFICATION.SMS_SEND,
    schema: {
      phone:   'string (required) — E.164 format',
      message: 'string (required)',
    },
  },
  IN_APP_SEND: {
    routingKey: ROUTING_KEYS.NOTIFICATION.IN_APP_SEND,
    schema: {
      userId:     'string (required)',
      title:      'string (required)',
      body:       'string (required)',
      type:       "string — 'message' | 'offer' | 'booking' | 'system'",
      route:      'string — deep-link route for the mobile app',
      params:     'object — route params',
      createdAt:  'ISO date string',
    },
  },
};

module.exports = NotificationEvents;
