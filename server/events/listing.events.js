'use strict';

const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const ListingEvents = {
  CREATED: {
    routingKey: ROUTING_KEYS.LISTING.CREATED,
    description: 'Fired when a new listing is published.',
    schema: {
      listingId: 'string (required)',
      userId:    'string (required)',
      category:  'string (required)',
      title:     'string (required)',
      price:     'number',
      images:    'string[]',
      location:  '{ city, state, lat, lng }',
      createdAt: 'ISO date string',
    },
  },
  UPDATED: {
    routingKey: ROUTING_KEYS.LISTING.UPDATED,
    schema: {
      listingId: 'string (required)',
      userId:    'string (required)',
      changes:   'object — diff of changed fields (key → newValue)',
      updatedAt: 'ISO date string',
    },
  },
  DELETED: {
    routingKey: ROUTING_KEYS.LISTING.DELETED,
    schema: {
      listingId: 'string (required)',
      userId:    'string (required)',
      reason:    "string — 'user' | 'expired' | 'admin' | 'sold'",
      deletedAt: 'ISO date string',
    },
  },
  SOLD: {
    routingKey: ROUTING_KEYS.LISTING.SOLD,
    schema: {
      listingId: 'string (required)',
      sellerId:  'string (required)',
      buyerId:   'string | null',
      soldPrice: 'number',
      soldAt:    'ISO date string',
    },
  },
  EXPIRED: {
    routingKey: ROUTING_KEYS.LISTING.EXPIRED,
    schema: {
      listingId: 'string (required)',
      userId:    'string (required)',
      expiredAt: 'ISO date string',
    },
  },
  VIEWED: {
    routingKey: ROUTING_KEYS.LISTING.VIEWED,
    schema: {
      listingId: 'string (required)',
      viewerId:  'string | null — null for anonymous',
      ip:        'string',
      viewedAt:  'ISO date string',
    },
  },
  PRICE_DROP: {
    routingKey: ROUTING_KEYS.LISTING.PRICE_DROP,
    description: 'Fired when a seller reduces the listing price — used to notify savers.',
    schema: {
      listingId: 'string (required)',
      userId:    'string (required)',
      oldPrice:  'number (required)',
      newPrice:  'number (required)',
      savedBy:   'string[] — userIds who have saved this listing',
    },
  },
};

module.exports = ListingEvents;
