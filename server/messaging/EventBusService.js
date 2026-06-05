'use strict';

const ProducerService   = require('./ProducerService');
const { EXCHANGES, ROUTING_KEYS } = require('./config/messaging.config');

/**
 * EventBusService — typed, domain-aware event publishing API.
 *
 * Use this from controllers and services instead of calling ProducerService
 * directly. Each method encodes the exact payload shape expected by consumers.
 *
 * Usage:
 *   const EventBus = require('./messaging/EventBusService');
 *   await EventBus.listingCreated(listing, { correlationId: req.id });
 */
class EventBusService {

  // ── Auth ───────────────────────────────────────────────────────────────────

  async userCreated(userId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.AUTH.USER_CREATED, { userId, ...data }, meta);
  }

  async userVerified(userId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.AUTH.USER_VERIFIED, { userId, ...data }, meta);
  }

  async userLogin(userId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.AUTH.USER_LOGIN, { userId, ...data }, meta);
  }

  async userLogout(userId, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.AUTH.USER_LOGOUT, { userId }, meta);
  }

  async userBlocked(userId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.AUTH.USER_BLOCKED, { userId, ...data }, meta);
  }

  async passwordReset(userId, email, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.AUTH.PASSWORD_RESET, {
      userId, email, resetAt: new Date().toISOString(),
    }, meta);
  }

  // ── Listing ────────────────────────────────────────────────────────────────

  async listingCreated(listingId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.LISTING.CREATED, { listingId, ...data }, meta);
  }

  async listingUpdated(listingId, changes, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.LISTING.UPDATED, { listingId, changes }, meta);
  }

  async listingDeleted(listingId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.LISTING.DELETED, { listingId, ...data }, meta);
  }

  async listingSold(listingId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.LISTING.SOLD, { listingId, ...data }, meta);
  }

  async listingExpired(listingId, userId, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.LISTING.EXPIRED, { listingId, userId }, meta);
  }

  async listingViewed(listingId, viewerId, meta = {}) {
    // Analytics exchange — high volume, isolated load
    return ProducerService.publishAnalytics(ROUTING_KEYS.ANALYTICS.LISTING_VIEWED, {
      listingId, viewerId, viewedAt: new Date().toISOString(),
    }, meta);
  }

  async listingPriceDrop(listingId, oldPrice, newPrice, savedBy = [], meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.LISTING.PRICE_DROP, {
      listingId, oldPrice, newPrice, savedBy,
    }, meta);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async chatMessageSent(messageId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.CHAT.MESSAGE_SENT, { messageId, ...data }, meta);
  }

  async chatMessageRead(messageId, readBy, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.CHAT.MESSAGE_READ, { messageId, readBy }, meta);
  }

  async chatMessageDeleted(messageId, deletedBy, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.CHAT.MESSAGE_DELETED, { messageId, deletedBy }, meta);
  }

  async chatTyping(conversationId, userId, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.CHAT.TYPING, { conversationId, userId }, meta);
  }

  async offerMade(offerId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.CHAT.OFFER_MADE, { offerId, ...data }, meta);
  }

  async offerAccepted(offerId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.CHAT.OFFER_ACCEPTED, { offerId, ...data }, meta);
  }

  async offerDeclined(offerId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.CHAT.OFFER_DECLINED, { offerId, ...data }, meta);
  }

  // ── Booking ────────────────────────────────────────────────────────────────

  async bookingCreated(bookingId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.BOOKING.CREATED, { bookingId, ...data }, meta);
  }

  async bookingConfirmed(bookingId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.BOOKING.CONFIRMED, { bookingId, ...data }, meta);
  }

  async bookingCancelled(bookingId, reason, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.BOOKING.CANCELLED, { bookingId, reason }, meta);
  }

  async bookingCompleted(bookingId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.BOOKING.COMPLETED, { bookingId, ...data }, meta);
  }

  // ── Payment ────────────────────────────────────────────────────────────────

  async paymentCreated(paymentId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.PAYMENT.CREATED, { paymentId, ...data }, meta);
  }

  async paymentAuthorized(paymentId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.PAYMENT.AUTHORIZED, { paymentId, ...data }, meta);
  }

  async paymentCaptured(paymentId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.PAYMENT.CAPTURED, { paymentId, ...data }, meta);
  }

  async paymentFailed(paymentId, reason, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.PAYMENT.FAILED, { paymentId, reason }, meta);
  }

  async paymentRefunded(paymentId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.PAYMENT.REFUNDED, { paymentId, ...data }, meta);
  }

  async paymentDisputed(paymentId, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.PAYMENT.DISPUTED, { paymentId, ...data }, meta);
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  async sendPushNotification(userId, fcmToken, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.NOTIFICATION.PUSH_SEND, {
      userId, fcmToken, ...data,
    }, meta);
  }

  async sendEmail(to, template, data, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.NOTIFICATION.EMAIL_SEND, {
      to, template, data,
    }, meta);
  }

  async sendSMS(phone, message, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.NOTIFICATION.SMS_SEND, {
      phone, message,
    }, meta);
  }

  async sendInAppNotification(userId, notification, meta = {}) {
    return ProducerService.publish(ROUTING_KEYS.NOTIFICATION.IN_APP_SEND, {
      userId, ...notification,
    }, meta);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  async trackActivity(userId, action, data, meta = {}) {
    return ProducerService.publishAnalytics(ROUTING_KEYS.ANALYTICS.USER_ACTIVITY, {
      userId, action, data, timestamp: new Date().toISOString(),
    }, meta);
  }

  async trackSearch(userId, queryData, resultCount, meta = {}) {
    return ProducerService.publishAnalytics(ROUTING_KEYS.ANALYTICS.SEARCH_PERFORMED, {
      userId, ...queryData, resultCount, timestamp: new Date().toISOString(),
    }, meta);
  }

  async trackConversion(userId, listingId, conversionType, meta = {}) {
    return ProducerService.publishAnalytics(ROUTING_KEYS.ANALYTICS.CONVERSION, {
      userId, listingId, conversionType, timestamp: new Date().toISOString(),
    }, meta);
  }
}

module.exports = new EventBusService();
