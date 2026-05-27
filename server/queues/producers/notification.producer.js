'use strict';
/**
 * ── Notification Producer ────────────────────────────────────────────────────
 * Routes all in-app notifications + real-time socket events through
 * RabbitMQ so controllers return immediately without waiting for Mongo writes.
 *
 * Queues: notification_queue
 */
const { publish, QUEUES } = require('../rabbitmq');

// ── 1. In-App Notification ────────────────────────────────────────────────────
/**
 * Create a DB notification and/or fire a Socket.IO event to a user.
 * Consumer handles both the Notification.create() and io.emit().
 */
const publishNotification = async ({ recipient, sender, type, message, metadata = {}, socketEvent = null }) => {
  // Guard: never self-notify at the queue level too
  if (!recipient || !sender) return;
  if (recipient.toString() === sender.toString()) return;

  return publish(QUEUES.NOTIFICATION.name, {
    type:        'in_app_notification',
    recipient:   recipient.toString(),
    sender:      sender.toString(),
    notifType:   type,         // e.g. 'message', 'review', 'booking', 'offer'
    message,
    metadata,
    socketEvent, // optional immediate socket event payload
    timestamp:   new Date().toISOString(),
  });
};

// ── 2. Booking Notification (to provider + customer) ─────────────────────────
const publishBookingNotification = async ({ booking, event, actor }) => {
  return publish(QUEUES.NOTIFICATION.name, {
    type:      'booking_event',
    bookingId: booking._id?.toString(),
    event,     // 'created' | 'confirmed' | 'cancelled' | 'completed'
    actor:     actor.toString(),
    customerId: booking.userId?.toString(),
    providerId: booking.providerId?.toString(),
    title:     booking.serviceDetails?.title || 'Your booking',
    timestamp: new Date().toISOString(),
  });
};

// ── 3. Review Notification (to service provider) ─────────────────────────────
const publishReviewNotification = async ({ reviewId, reviewerId, reviewerName, recipientUserId, listingTitle, rating }) => {
  return publish(QUEUES.NOTIFICATION.name, {
    type:            'review_notification',
    reviewId:        reviewId?.toString(),
    reviewerId:      reviewerId?.toString(),
    reviewerName,
    recipientUserId: recipientUserId?.toString(),
    listingTitle,
    rating,
    timestamp:       new Date().toISOString(),
  });
};

// ── 4. Chat Message Notification ─────────────────────────────────────────────
const publishChatNotification = async ({ conversationId, senderId, senderName, recipientId, messagePreview }) => {
  return publish(QUEUES.NOTIFICATION.name, {
    type:           'chat_message',
    conversationId: conversationId.toString(),
    senderId:       senderId.toString(),
    senderName,
    recipientId:    recipientId.toString(),
    messagePreview: messagePreview?.substring(0, 100), // never store full message content in queue
    timestamp:      new Date().toISOString(),
  });
};

// ── 5. Offer Notification Email (to seller) ───────────────────────────────────
const publishOfferEmail = async ({ sellerEmail, sellerName, buyerName, productTitle, listingPrice, offerPrice, productImage, chatUrl }) => {
  return publish(QUEUES.EMAIL.name, {
    type: 'offer_notification',
    sellerEmail,
    sellerName,
    buyerName,
    productTitle,
    listingPrice,
    offerPrice,
    productImage,
    chatUrl,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  publishNotification,
  publishBookingNotification,
  publishReviewNotification,
  publishChatNotification,
  publishOfferEmail,
};
