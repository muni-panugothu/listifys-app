'use strict';

const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const ChatEvents = {
  MESSAGE_SENT: {
    routingKey: ROUTING_KEYS.CHAT.MESSAGE_SENT,
    schema: {
      messageId:      'string (required)',
      conversationId: 'string (required)',
      senderId:       'string (required)',
      recipientId:    'string (required)',
      listingId:      'string | null',
      body:           'string',
      mediaUrl:       'string | null',
      sentAt:         'ISO date string',
    },
  },
  MESSAGE_READ: {
    routingKey: ROUTING_KEYS.CHAT.MESSAGE_READ,
    schema: {
      messageId:      'string (required)',
      conversationId: 'string (required)',
      readBy:         'string (required) — userId',
      readAt:         'ISO date string',
    },
  },
  MESSAGE_DELETED: {
    routingKey: ROUTING_KEYS.CHAT.MESSAGE_DELETED,
    schema: {
      messageId:      'string (required)',
      conversationId: 'string (required)',
      deletedBy:      'string (required)',
      deletedAt:      'ISO date string',
    },
  },
  TYPING: {
    routingKey: ROUTING_KEYS.CHAT.TYPING,
    schema: {
      conversationId: 'string (required)',
      userId:         'string (required)',
    },
  },
  OFFER_MADE: {
    routingKey: ROUTING_KEYS.CHAT.OFFER_MADE,
    schema: {
      offerId:        'string (required)',
      conversationId: 'string (required)',
      listingId:      'string (required)',
      buyerId:        'string (required)',
      sellerId:       'string (required)',
      offerAmount:    'number (required)',
      offeredAt:      'ISO date string',
    },
  },
  OFFER_ACCEPTED: {
    routingKey: ROUTING_KEYS.CHAT.OFFER_ACCEPTED,
    schema: {
      offerId:        'string (required)',
      listingId:      'string (required)',
      acceptedAt:     'ISO date string',
    },
  },
  OFFER_DECLINED: {
    routingKey: ROUTING_KEYS.CHAT.OFFER_DECLINED,
    schema: {
      offerId:        'string (required)',
      declinedAt:     'ISO date string',
    },
  },
};

module.exports = ChatEvents;
