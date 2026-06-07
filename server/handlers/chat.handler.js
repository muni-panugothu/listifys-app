'use strict';

const { logger }       = require('../utils/logger');
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
    const { messageId, conversationId, threadId, recipientId, senderName, preview, productTitle } = payload;
    logger.debug('[ChatHandler] Message sent', { messageId, conversationId, threadId });

    try {
      const io = require('../config/socket').getIO();

      // Push Socket.IO unread badge update to recipient room
      io.to(`user:${recipientId}`).emit('conversation:unread_update', {
        conversationId,
        threadId:    threadId || null,
        productTitle: productTitle || '',
        lastMessage: {
          preview:    preview || (payload.attachmentUrl ? '📎 Attachment' : ''),
          senderId:   payload.senderId,
          senderName,
          messageId,
          createdAt:  new Date(),
        },
      });

      // Increment unread count badge
      const Conversation = require('../models/conversation.model');
      const convo = await Conversation.findById(conversationId).select('unreadCounts').lean();
      if (convo) {
        const unreadCount = convo.unreadCounts?.[recipientId] || 0;
        io.to(`user:${recipientId}`).emit('chat:unreadCount', { unreadCount });
      }
    } catch (err) {
      logger.debug('[ChatHandler] onMessageSent socket relay error', { err: err.message });
    }

    // Send push notification if recipient is offline
    try {
      const User = require('../models/user.model');
      const recipient = await User.findById(recipientId).select('fcmToken').lean();
      if (recipient?.fcmToken) {
        const { sendRichNotification } = require('../services/fcm.service');
        const title = `${senderName} sent a message${productTitle ? ` regarding ${productTitle}` : ''}`;
        await sendRichNotification(recipient.fcmToken, {
          title,
          body:  preview || 'You have a new message',
          type:  'message',
          data:  { conversationId: String(conversationId), threadId: String(threadId || ''), senderName, productTitle: productTitle || '' },
        });
      }
    } catch (err) {
      logger.debug('[ChatHandler] onMessageSent FCM error', { err: err.message });
    }
  },

  async onMessageRead(payload) {
    const { messageId, readBy, conversationId } = payload;
    logger.debug('[ChatHandler] Message read', { messageId, readBy });
    try {
      const io = require('../config/socket').getIO();
      io.to(`conversation:${conversationId}`).emit('message:status', {
        messageId,
        conversationId,
        status: 'read',
        userId: readBy,
      });
    } catch {}
  },

  async onMessageDeleted(payload) {
    logger.debug('[ChatHandler] Message deleted', { messageId: payload.messageId });
    try {
      const io = require('../config/socket').getIO();
      io.to(`conversation:${payload.conversationId}`).emit('chat:message_deleted', {
        messageId:      payload.messageId,
        conversationId: payload.conversationId,
        threadId:       payload.threadId || null,
      });
    } catch {}
  },

  async onOfferMade(payload) {
    const { threadId, sellerId, buyerId, amount, currency, productTitle } = payload;
    logger.info('[ChatHandler] Offer made', { threadId, amount });

    try {
      const User = require('../models/user.model');
      const seller = await User.findById(sellerId).select('fcmToken').lean();
      if (seller?.fcmToken) {
        const { sendRichNotification } = require('../services/fcm.service');
        await sendRichNotification(seller.fcmToken, {
          title: `New offer on ${productTitle || 'your product'}`,
          body:  `Buyer offered ${currency || '₹'}${(amount || 0).toLocaleString('en-IN')}`,
          type:  'offer',
          data:  { threadId: String(threadId), type: 'offer', buyerId: String(buyerId) },
        });
      }
    } catch (err) {
      logger.debug('[ChatHandler] onOfferMade FCM error', { err: err.message });
    }
  },

  async onOfferAccepted(payload) {
    const { threadId, buyerId, amount, currency } = payload;
    logger.info('[ChatHandler] Offer accepted', { threadId, amount });

    try {
      const User = require('../models/user.model');
      const buyer = await User.findById(buyerId).select('fcmToken').lean();
      if (buyer?.fcmToken) {
        const { sendRichNotification } = require('../services/fcm.service');
        await sendRichNotification(buyer.fcmToken, {
          title: 'Your offer was accepted!',
          body:  `The seller accepted your offer of ${currency || '₹'}${(amount || 0).toLocaleString('en-IN')}`,
          type:  'offer_accepted',
          data:  { threadId: String(threadId), type: 'offer_accepted' },
        });
      }
    } catch (err) {
      logger.debug('[ChatHandler] onOfferAccepted FCM error', { err: err.message });
    }
  },

  async onOfferDeclined(payload) {
    const { threadId, buyerId } = payload;
    logger.info('[ChatHandler] Offer declined', { threadId });

    try {
      const User = require('../models/user.model');
      const buyer = await User.findById(buyerId).select('fcmToken').lean();
      if (buyer?.fcmToken) {
        const { sendRichNotification } = require('../services/fcm.service');
        await sendRichNotification(buyer.fcmToken, {
          title: 'Offer declined',
          body:  'The seller declined your offer.',
          type:  'offer_declined',
          data:  { threadId: String(threadId), type: 'offer_declined' },
        });
      }
    } catch (err) {
      logger.debug('[ChatHandler] onOfferDeclined FCM error', { err: err.message });
    }
  },
};

module.exports = ChatHandler;
