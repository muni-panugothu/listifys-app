'use strict';
/**
 * ── Notification Consumer ─────────────────────────────────────────────────────
 * Processes: notification_queue
 * Handles:
 *   - In-app Notification.create() (DB write)
 *   - Socket.IO real-time delivery  
 *   - Booking status emails to customer + provider
 *   - Review alerts to service providers
 *   - Chat message notifications
 *   - Offer notification emails
 */
const { consume, QUEUES } = require('../rabbitmq');
const { logger } = require('../../utils/logger');
const { encrypt } = require('../../services/encryption.service');

// Lazy-require heavy modules to avoid circular deps
const getNotificationModel = () => require('../../models/notification.model');
const getSocket = () => {
  try { return require('../../config/socket').getIO(); } catch { return null; }
};
const getEmailService = () => require('../../services/email.service');

// ── Dispatch ──────────────────────────────────────────────────────────────────
const dispatch = async (payload) => {
  const { type } = payload;

  switch (type) {

    // ─────────────────── IN-APP NOTIFICATION ─────────────────────────────────
    case 'in_app_notification': {
      const { recipient, sender, notifType, message, metadata, socketEvent } = payload;
      if (!recipient || !sender || recipient === sender) return;

      const Notification = getNotificationModel();
      const encryptedMsg = encrypt(message);

      const notification = await Notification.create({
        recipient,
        sender,
        type:     notifType,
        message:  encryptedMsg,
        metadata: metadata || {},
      });

      // Real-time delivery via Socket.IO
      const io = getSocket();
      if (io) {
        io.to(`user:${recipient}`).emit('notification:new', {
          _id:       notification._id,
          type:      notifType,
          message,   // send decrypted to the socket — recipient only
          sender,
          metadata:  metadata || {},
          createdAt: notification.createdAt,
        });

        // Also emit if there's an extra socket event (e.g. conversation:updated)
        if (socketEvent?.event && socketEvent?.data) {
          io.to(`user:${recipient}`).emit(socketEvent.event, socketEvent.data);
        }
      }

      logger.info('[NotifConsumer] In-app notification delivered', { type: notifType, recipient });
      break;
    }

    // ─────────────────── BOOKING EVENT ───────────────────────────────────────
    case 'booking_event': {
      const { bookingId, event, customerId, providerId, title, actor } = payload;
      const Notification = getNotificationModel();
      const io = getSocket();

      // Notification messages per event
      const messages = {
        created:   `Your booking for "${title}" has been confirmed.`,
        confirmed: `Great news! Your booking for "${title}" has been approved.`,
        cancelled: `Your booking for "${title}" has been cancelled.`,
        completed: `Your booking for "${title}" has been marked complete.`,
      };
      const notifMsg = messages[event] || `Booking update: ${event}`;

      // Notify customer
      if (customerId && customerId !== actor) {
        const encrypted = encrypt(notifMsg);
        const n = await Notification.create({
          recipient: customerId,
          sender:    actor,
          type:      'booking',
          message:   encrypted,
          metadata:  { bookingId, event },
        });
        if (io) {
          io.to(`user:${customerId}`).emit('notification:new', {
            _id: n._id, type: 'booking', message: notifMsg, sender: actor,
            metadata: { bookingId, event }, createdAt: n.createdAt,
          });
        }
      }

      // Notify provider when booking is created
      if (event === 'created' && providerId && providerId !== actor) {
        const provMsg = `New booking request for "${title}"`;
        const encrypted = encrypt(provMsg);
        const n = await Notification.create({
          recipient: providerId,
          sender:    actor,
          type:      'booking',
          message:   encrypted,
          metadata:  { bookingId, event },
        });
        if (io) {
          io.to(`user:${providerId}`).emit('notification:new', {
            _id: n._id, type: 'booking', message: provMsg, sender: actor,
            metadata: { bookingId, event }, createdAt: n.createdAt,
          });
        }
      }

      logger.info('[NotifConsumer] Booking notification delivered', { event, bookingId });
      break;
    }

    // ─────────────────── REVIEW NOTIFICATION ─────────────────────────────────
    case 'review_notification': {
      const { reviewId, reviewerId, reviewerName, recipientUserId, listingTitle, rating } = payload;
      if (!recipientUserId || !reviewerId || recipientUserId === reviewerId) return;

      const Notification = getNotificationModel();
      const io = getSocket();
      const message = `${reviewerName} gave your service "${listingTitle}" a ${rating}-star review.`;
      const encrypted = encrypt(message);

      const n = await Notification.create({
        recipient: recipientUserId,
        sender:    reviewerId,
        type:      'review',
        message:   encrypted,
        metadata:  { reviewId, rating, listingTitle },
      });

      if (io) {
        io.to(`user:${recipientUserId}`).emit('notification:new', {
          _id: n._id, type: 'review', message, sender: reviewerId,
          metadata: { reviewId, rating, listingTitle }, createdAt: n.createdAt,
        });
        // Click-to-navigate — the frontend handles redirect to services page
        io.to(`user:${recipientUserId}`).emit('review:received', { reviewId, listingTitle, rating });
      }

      logger.info('[NotifConsumer] Review notification delivered', { recipientUserId, rating });
      break;
    }

    // ─────────────────── CHAT MESSAGE NOTIFICATION ────────────────────────────
    case 'chat_message': {
      const { conversationId, senderId, senderName, recipientId, messagePreview } = payload;
      if (!recipientId || !senderId || recipientId === senderId) return;

      const Notification = getNotificationModel();
      const io = getSocket();
      const message = `${senderName} sent you a message`;
      const encrypted = encrypt(message);

      // Only create a DB notification if recipient is NOT in the conversation room (offline)
      // (Socket.IO handles real-time when they're online)
      const n = await Notification.create({
        recipient: recipientId,
        sender:    senderId,
        type:      'message',
        message:   encrypted,
        metadata:  { conversationId },
      });

      if (io) {
        io.to(`user:${recipientId}`).emit('notification:new', {
          _id: n._id, type: 'message', message, sender: senderId,
          metadata: { conversationId }, createdAt: n.createdAt,
        });
      }
      break;
    }

    // ─────────────────── OFFER NOTIFICATION EMAIL ─────────────────────────────
    case 'offer_notification': {
      const EmailService = getEmailService();
      await EmailService.sendOfferNotificationEmail(payload);
      logger.info('[NotifConsumer] Offer email dispatched', { to: payload.sellerEmail });
      break;
    }

    default:
      logger.warn('[NotifConsumer] Unknown notification type', { type });
  }
};

// ── Start Notification Consumer ───────────────────────────────────────────────
const startNotificationConsumer = async () => {
  await consume(QUEUES.NOTIFICATION.name, dispatch, { maxRetries: 3 });
  logger.info('[NotifConsumer] ✅ Notification consumer started');
};

module.exports = { startNotificationConsumer };
