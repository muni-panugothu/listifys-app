'use strict';

const { logger }      = require('../utils/logger');
const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const ChatHandler = {
  async handle(payload, envelope) {
    const { routingKey } = envelope;
    switch (routingKey) {
      case ROUTING_KEYS.CHAT.MESSAGE_SENT:    return ChatHandler.onMessageSent(payload, envelope);
      case ROUTING_KEYS.CHAT.MESSAGE_READ:    return ChatHandler.onMessageRead(payload, envelope);
      case ROUTING_KEYS.CHAT.MESSAGE_DELETED: return ChatHandler.onMessageDeleted(payload, envelope);
      case ROUTING_KEYS.CHAT.OFFER_MADE:      return ChatHandler.onOfferMade(payload, envelope);
      case ROUTING_KEYS.CHAT.OFFER_ACCEPTED:  return ChatHandler.onOfferAccepted(payload, envelope);
      case ROUTING_KEYS.CHAT.OFFER_DECLINED:  return ChatHandler.onOfferDeclined(payload, envelope);
      default:
        logger.debug('[ChatHandler] Unknown routing key', { routingKey });
    }
  },

  async onMessageSent(payload) {
    const { messageId, conversationId, recipientId } = payload;
    logger.debug('[ChatHandler] Message sent', { messageId, conversationId });
    // Deliver via Socket.IO to recipient if online
    // const io = require('../socket').getIO();
    // io.to(`user:${recipientId}`).emit('chat:message', payload);
    // Send push if recipient is offline
    // await NotificationProducer.push(recipientId, ...);
  },

  async onMessageRead(payload) {
    const { messageId, readBy } = payload;
    logger.debug('[ChatHandler] Message read', { messageId, readBy });
    // io.to(`user:${senderId}`).emit('chat:read', { messageId, readBy });
  },

  async onMessageDeleted(payload) {
    logger.debug('[ChatHandler] Message deleted', { messageId: payload.messageId });
    // Broadcast deletion to both conversation participants via Socket.IO
  },

  async onOfferMade(payload) {
    const { offerId, sellerId, offerAmount, listingId } = payload;
    logger.info('[ChatHandler] Offer made', { offerId, listingId, amount: offerAmount });
    // Notify seller of incoming offer
    // await NotificationProducer.inApp(sellerId, { title: 'New offer received', ... });
  },

  async onOfferAccepted(payload) {
    const { offerId, listingId } = payload;
    logger.info('[ChatHandler] Offer accepted', { offerId, listingId });
    // Trigger booking creation flow
    // await BookingProducer.bookingCreated(...);
  },

  async onOfferDeclined(payload) {
    logger.info('[ChatHandler] Offer declined', { offerId: payload.offerId });
  },
};

module.exports = ChatHandler;
