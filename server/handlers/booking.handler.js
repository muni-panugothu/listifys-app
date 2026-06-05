'use strict';

const { logger }      = require('../utils/logger');
const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const BookingHandler = {
  async handle(payload, envelope) {
    const { routingKey } = envelope;
    switch (routingKey) {
      case ROUTING_KEYS.BOOKING.CREATED:   return BookingHandler.onCreated(payload, envelope);
      case ROUTING_KEYS.BOOKING.CONFIRMED: return BookingHandler.onConfirmed(payload, envelope);
      case ROUTING_KEYS.BOOKING.CANCELLED: return BookingHandler.onCancelled(payload, envelope);
      case ROUTING_KEYS.BOOKING.COMPLETED: return BookingHandler.onCompleted(payload, envelope);
      case ROUTING_KEYS.BOOKING.REMINDER:  return BookingHandler.onReminder(payload, envelope);
      default:
        logger.debug('[BookingHandler] Unknown routing key', { routingKey });
    }
  },

  async onCreated(payload) {
    const { bookingId, buyerId, sellerId, amount } = payload;
    logger.info('[BookingHandler] Booking created', { bookingId, amount });
    // Notify seller of new booking request
    // await NotificationProducer.push(sellerId, token, 'New booking request!', ...);
    // await NotificationProducer.email(sellerEmail, 'booking-request', { ...payload });
  },

  async onConfirmed(payload) {
    const { bookingId } = payload;
    logger.info('[BookingHandler] Booking confirmed', { bookingId });
    // Notify buyer — booking confirmed
    // Trigger calendar invite generation
  },

  async onCancelled(payload) {
    const { bookingId, reason, cancelledBy } = payload;
    logger.info('[BookingHandler] Booking cancelled', { bookingId, reason, cancelledBy });
    // Notify the other party
    // Trigger refund if payment was already captured
    // await PaymentProducer.paymentRefunded(...);
  },

  async onCompleted(payload) {
    const { bookingId } = payload;
    logger.info('[BookingHandler] Booking completed', { bookingId });
    // Release escrow payment to seller
    // Request review from buyer
  },

  async onReminder(payload) {
    const { bookingId, reminderType } = payload;
    logger.info('[BookingHandler] Booking reminder', { bookingId, reminderType });
    // Send reminder push/email to both parties
  },
};

module.exports = BookingHandler;
