'use strict';
/**
 * ── Booking Queue Producer ────────────────────────────────────────────────────
 * Publishes booking lifecycle events to the BOOKING queue.
 * The booking consumer handles: notifications to both parties, stats updates,
 * cache invalidation, email delivery, and review prompts.
 *
 * This producer should be called from booking controllers/services — NOT from
 * the notification.producer's publishBookingNotification (which only sends
 * a lightweight notification event, not the full lifecycle payload).
 *
 * Usage example in booking controller:
 *   const { publishBookingEvent } = require('../queues/producers/booking.producer');
 *   await publishBookingEvent({ type: 'booking_created', booking, customer, provider });
 */
const { publish, QUEUES } = require('../rabbitmq');
const { logger }          = require('../../utils/logger');

const QUEUE = QUEUES.BOOKING.name;

/**
 * Generic booking lifecycle event publisher.
 * @param {object} p
 * @param {string}  p.type            - 'booking_created' | 'booking_confirmed' | 'booking_cancelled' | 'booking_completed' | 'booking_reminder'
 * @param {string}  p.bookingId       - ServiceBooking._id
 * @param {string}  [p.bookingNumber] - human-readable booking ref
 * @param {string}  p.customerId
 * @param {string}  p.customerName
 * @param {string}  p.providerId
 * @param {string}  p.providerName
 * @param {string}  p.serviceTitle
 * @param {string}  [p.scheduleDate]  - ISO date string
 * @param {number}  [p.totalAmount]
 * @param {string}  [p.cancelledBy]   - userId of who cancelled (for booking_cancelled)
 * @param {string}  [p.cancellationReason]
 * @param {number}  [p.hoursUntil]    - for booking_reminder
 */
const publishBookingEvent = async (p) => {
  try {
    const queued = await publish(QUEUE, {
      type:               p.type,
      bookingId:          p.bookingId?.toString(),
      bookingNumber:      p.bookingNumber,
      customerId:         p.customerId?.toString(),
      customerName:       p.customerName,
      providerId:         p.providerId?.toString(),
      providerName:       p.providerName,
      serviceTitle:       p.serviceTitle,
      scheduleDate:       p.scheduleDate,
      totalAmount:        p.totalAmount,
      cancelledBy:        p.cancelledBy?.toString(),
      cancellationReason: p.cancellationReason,
      hoursUntil:         p.hoursUntil,
      timestamp:          Date.now(),
    });

    if (!queued) {
      logger.warn('[BookingProducer] Queue unavailable — booking event may be delayed', {
        type: p.type, bookingId: p.bookingId,
      });
    }
    return queued;
  } catch (err) {
    logger.error('[BookingProducer] publishBookingEvent error', { error: err.message, type: p.type });
    return false;
  }
};

// ── Convenience wrappers ──────────────────────────────────────────────────────

const publishBookingCreated = (p) => publishBookingEvent({ type: 'booking_created',   ...p });
const publishBookingConfirmed = (p) => publishBookingEvent({ type: 'booking_confirmed', ...p });
const publishBookingCancelled = (p) => publishBookingEvent({ type: 'booking_cancelled', ...p });
const publishBookingCompleted = (p) => publishBookingEvent({ type: 'booking_completed', ...p });

/**
 * Schedule a reminder. Call this when the booking is created/confirmed.
 * Use a job scheduler (e.g. node-schedule or BullMQ delay) to defer this
 * publish by (scheduleDate - 24h) or (scheduleDate - 1h).
 */
const publishBookingReminder = (p) => publishBookingEvent({ type: 'booking_reminder', ...p });

module.exports = {
  publishBookingEvent,
  publishBookingCreated,
  publishBookingConfirmed,
  publishBookingCancelled,
  publishBookingCompleted,
  publishBookingReminder,
};
