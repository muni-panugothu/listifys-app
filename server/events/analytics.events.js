'use strict';

const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const AnalyticsEvents = {
  USER_ACTIVITY: {
    routingKey: ROUTING_KEYS.ANALYTICS.USER_ACTIVITY,
    schema: {
      userId:    'string (required)',
      action:    'string (required)',
      data:      'object — action-specific properties',
      timestamp: 'ISO date string',
    },
  },
  LISTING_VIEWED: {
    routingKey: ROUTING_KEYS.ANALYTICS.LISTING_VIEWED,
    schema: {
      listingId: 'string (required)',
      viewerId:  'string | null',
      viewedAt:  'ISO date string',
    },
  },
  SEARCH_PERFORMED: {
    routingKey: ROUTING_KEYS.ANALYTICS.SEARCH_PERFORMED,
    schema: {
      userId:      'string | null',
      query:       'string',
      filters:     'object',
      resultCount: 'number',
      timestamp:   'ISO date string',
    },
  },
  CONVERSION: {
    routingKey: ROUTING_KEYS.ANALYTICS.CONVERSION,
    schema: {
      userId:          'string (required)',
      listingId:       'string (required)',
      conversionType:  "string — 'contact' | 'offer' | 'purchase' | 'saved'",
      timestamp:       'ISO date string',
    },
  },
  SESSION_START: {
    routingKey: ROUTING_KEYS.ANALYTICS.SESSION_START,
    schema: {
      userId:    'string | null',
      sessionId: 'string (required)',
      device:    'object — { platform, os, appVersion }',
      timestamp: 'ISO date string',
    },
  },
  SESSION_END: {
    routingKey: ROUTING_KEYS.ANALYTICS.SESSION_END,
    schema: {
      userId:     'string | null',
      sessionId:  'string (required)',
      duration_s: 'number — session duration in seconds',
      timestamp:  'ISO date string',
    },
  },
};

module.exports = AnalyticsEvents;
