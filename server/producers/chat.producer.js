'use strict';

const EventBus = require('../messaging/EventBusService');

const ChatProducer = {
  async messageSent(message, meta = {}) {
    return EventBus.chatMessageSent(message._id?.toString() ?? message.id, {
      conversationId: message.conversationId?.toString(),
      senderId:       message.senderId?.toString(),
      recipientId:    message.recipientId?.toString(),
      listingId:      message.listingId?.toString() ?? null,
      body:           message.body,
      mediaUrl:       message.mediaUrl ?? null,
      sentAt:         message.createdAt?.toISOString?.() ?? new Date().toISOString(),
    }, meta);
  },

  async messageRead(messageId, readBy, meta = {}) {
    return EventBus.chatMessageRead(messageId, readBy, meta);
  },

  async messageDeleted(messageId, deletedBy, meta = {}) {
    return EventBus.chatMessageDeleted(messageId, deletedBy, meta);
  },

  async typing(conversationId, userId, meta = {}) {
    return EventBus.chatTyping(conversationId, userId, meta);
  },

  async offerMade(offer, meta = {}) {
    return EventBus.offerMade(offer._id?.toString() ?? offer.id, {
      conversationId: offer.conversationId?.toString(),
      listingId:      offer.listingId?.toString(),
      buyerId:        offer.buyerId?.toString(),
      sellerId:       offer.sellerId?.toString(),
      offerAmount:    offer.amount,
      offeredAt:      offer.createdAt?.toISOString?.() ?? new Date().toISOString(),
    }, meta);
  },

  async offerAccepted(offerId, listingId, meta = {}) {
    return EventBus.offerAccepted(offerId, {
      listingId,
      acceptedAt: new Date().toISOString(),
    }, meta);
  },

  async offerDeclined(offerId, meta = {}) {
    return EventBus.offerDeclined(offerId, {
      declinedAt: new Date().toISOString(),
    }, meta);
  },
};

module.exports = ChatProducer;
