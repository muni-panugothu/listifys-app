'use strict';

const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

/**
 * Auth domain event schemas.
 * These are authoritative payload contracts — both producers and consumers
 * should reference this file to stay in sync.
 */
const AuthEvents = {
  USER_CREATED: {
    routingKey: ROUTING_KEYS.AUTH.USER_CREATED,
    description: 'Fired when a new user successfully registers.',
    schema: {
      userId:    'string (required) — MongoDB ObjectId',
      email:     'string (required)',
      name:      'string (required)',
      provider:  "string — 'local' | 'google' | 'apple'",
      createdAt: 'ISO date string',
    },
  },
  USER_VERIFIED: {
    routingKey: ROUTING_KEYS.AUTH.USER_VERIFIED,
    description: 'Fired when a user confirms their email or phone.',
    schema: {
      userId:     'string (required)',
      email:      'string (required)',
      verifiedAt: 'ISO date string',
    },
  },
  USER_LOGIN: {
    routingKey: ROUTING_KEYS.AUTH.USER_LOGIN,
    description: 'Fired on every successful login.',
    schema: {
      userId:    'string (required)',
      ip:        'string',
      userAgent: 'string',
      provider:  "string — 'local' | 'google' | 'apple'",
      loginAt:   'ISO date string',
    },
  },
  USER_LOGOUT: {
    routingKey: ROUTING_KEYS.AUTH.USER_LOGOUT,
    schema: {
      userId:   'string (required)',
      logoutAt: 'ISO date string',
    },
  },
  USER_BLOCKED: {
    routingKey: ROUTING_KEYS.AUTH.USER_BLOCKED,
    description: 'Fired when an admin or automated system blocks a user.',
    schema: {
      userId:    'string (required)',
      reason:    'string (required)',
      blockedBy: 'string — admin userId',
      blockedAt: 'ISO date string',
    },
  },
  PASSWORD_RESET: {
    routingKey: ROUTING_KEYS.AUTH.PASSWORD_RESET,
    schema: {
      userId:  'string (required)',
      email:   'string (required)',
      resetAt: 'ISO date string',
    },
  },
};

module.exports = AuthEvents;
