'use strict';

const EventBus = require('../messaging/EventBusService');

const BookingProducer = {
  async bookingCreated(booking, meta = {}) {
    return EventBus.bookingCreated(booking._id?.toString() ?? booking.id, {
      listingId:   booking.listingId?.toString(),
      buyerId:     booking.buyerId?.toString(),
      sellerId:    booking.sellerId?.toString(),
      amount:      booking.amount,
      scheduledAt: booking.scheduledAt?.toISOString?.(),
      createdAt:   booking.createdAt?.toISOString?.() ?? new Date().toISOString(),
    }, meta);
  },

  async bookingConfirmed(bookingId, meta = {}) {
    return EventBus.bookingConfirmed(bookingId, {
      confirmedAt: new Date().toISOString(),
    }, meta);
  },

  async bookingCancelled(bookingId, cancelledBy, reason, meta = {}) {
    return EventBus.bookingCancelled(bookingId, {
      cancelledBy,
      reason,
      cancelledAt: new Date().toISOString(),
    }, meta);
  },

  async bookingCompleted(bookingId, meta = {}) {
    return EventBus.bookingCompleted(bookingId, {
      completedAt: new Date().toISOString(),
    }, meta);
  },
};

module.exports = BookingProducer;
