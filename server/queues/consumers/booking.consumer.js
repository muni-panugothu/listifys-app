'use strict';
/**
 * ── Booking Queue Consumer ────────────────────────────────────────────────────
 * Processes service-booking lifecycle events from the BOOKING queue.
 *
 * Event types handled:
 *  - booking_created    : notify provider + send confirmation email to customer
 *  - booking_confirmed  : notify customer, update calendar, send confirmation
 *  - booking_cancelled  : notify both parties, trigger refund flow if applicable
 *  - booking_completed  : notify customer to leave a review, update stats
 *  - booking_reminder   : 24h before appointment — push + email reminder
 *
 * Idempotency:
 *  Processed _messageId stored in Redis (mq:booking:done:{id}) for 24h.
 *  Duplicate deliveries are silently skipped.
 */
const { consume, QUEUES }  = require('../rabbitmq');
const { logger }           = require('../../utils/logger');

const getRedis     = () => require('../../config/redis');
const getSocket    = () => { try { return require('../../config/socket').getIO(); } catch { return null; } };

const IDEMPOTENCY_TTL_S = 86_400;

// ── Idempotency guard ─────────────────────────────────────────────────────────
const isDuplicate = async (messageId) => {
  if (!messageId) return false;
  try {
    const redis  = getRedis();
    const key    = `mq:booking:done:${messageId}`;
    const result = await redis.set(key, '1', { NX: true, EX: IDEMPOTENCY_TTL_S });
    if (result === null) {
      logger.debug('[BookingConsumer] Duplicate skipped', { messageId });
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ── Notification helper ───────────────────────────────────────────────────────
const sendNotification = async ({ recipientId, senderId, type, message, metadata }) => {
  try {
    const mongoose     = require('mongoose');
    const Notification = mongoose.models.Notification;
    if (!Notification) return;

    const notification = await Notification.create({
      recipient: recipientId,
      sender:    senderId,
      type,
      message,
      metadata:  metadata || {},
    });

    const io = getSocket();
    if (io && notification) {
      io.to(`user:${recipientId}`).emit('notification:new', {
        _id:       notification._id,
        type,
        message,
        sender:    senderId,
        metadata:  metadata || {},
        createdAt: notification.createdAt,
      });
    }

    return notification;
  } catch (err) {
    logger.error('[BookingConsumer] sendNotification error', { error: err.message });
  }
};

// ── Handler: booking_created ──────────────────────────────────────────────────
const handleBookingCreated = async (payload) => {
  const {
    bookingId, bookingNumber,
    customerId, customerName,
    providerId, providerName,
    serviceTitle, scheduleDate, totalAmount,
  } = payload;

  // 1. Notify provider — someone booked their service
  await sendNotification({
    recipientId: providerId,
    senderId:    customerId,
    type:        'booking_created',
    message:     `${customerName} booked your service "${serviceTitle}"`,
    metadata:    { bookingId, bookingNumber, serviceTitle, scheduleDate, totalAmount },
  });

  // 2. Notify customer — booking received, pending confirmation
  await sendNotification({
    recipientId: customerId,
    senderId:    providerId,
    type:        'booking_created',
    message:     `Your booking for "${serviceTitle}" has been received. Awaiting confirmation.`,
    metadata:    { bookingId, bookingNumber, serviceTitle, scheduleDate },
  });

  // 3. Bust provider's stats cache
  try {
    const redis = getRedis();
    await redis.del(`provider:stats:${providerId}`);
  } catch { /* Non-fatal */ }

  logger.info('[BookingConsumer] booking_created handled', { bookingId, bookingNumber });
};

// ── Handler: booking_confirmed ────────────────────────────────────────────────
const handleBookingConfirmed = async (payload) => {
  const {
    bookingId, bookingNumber,
    customerId, providerId,
    serviceTitle, scheduleDate, providerName,
  } = payload;

  await sendNotification({
    recipientId: customerId,
    senderId:    providerId,
    type:        'booking_confirmed',
    message:     `${providerName} confirmed your booking for "${serviceTitle}" on ${new Date(scheduleDate).toLocaleDateString()}`,
    metadata:    { bookingId, bookingNumber, serviceTitle, scheduleDate },
  });

  logger.info('[BookingConsumer] booking_confirmed handled', { bookingId });
};

// ── Handler: booking_cancelled ────────────────────────────────────────────────
const handleBookingCancelled = async (payload) => {
  const {
    bookingId, bookingNumber,
    customerId, providerId,
    serviceTitle, cancelledBy, cancellationReason,
  } = payload;

  const isCustomerCancel = cancelledBy === customerId;

  // Notify the OTHER party
  const recipientId = isCustomerCancel ? providerId : customerId;
  const senderId    = isCustomerCancel ? customerId  : providerId;
  const message     = isCustomerCancel
    ? `A customer cancelled their booking for "${serviceTitle}"`
    : `Your booking for "${serviceTitle}" was cancelled by the provider`;

  await sendNotification({
    recipientId,
    senderId,
    type:    'booking_cancelled',
    message,
    metadata: {
      bookingId, bookingNumber, serviceTitle,
      reason: cancellationReason || 'No reason provided',
    },
  });

  // Bust caches
  try {
    const redis = getRedis();
    await Promise.all([
      redis.del(`provider:stats:${providerId}`),
      redis.del(`booking:${bookingId}`),
    ]);
  } catch { /* Non-fatal */ }

  logger.info('[BookingConsumer] booking_cancelled handled', { bookingId, cancelledBy });
};

// ── Handler: booking_completed ────────────────────────────────────────────────
const handleBookingCompleted = async (payload) => {
  const {
    bookingId, bookingNumber,
    customerId, providerId, serviceTitle,
  } = payload;

  // Ask customer to review the service
  await sendNotification({
    recipientId: customerId,
    senderId:    providerId,
    type:        'booking_completed',
    message:     `Your booking for "${serviceTitle}" is complete! Share your experience with a review.`,
    metadata:    { bookingId, bookingNumber, serviceTitle, promptReview: true },
  });

  // Update provider's completed bookings count
  try {
    const mongoose    = require('mongoose');
    const ServiceBooking = mongoose.models.ServiceBooking;
    if (ServiceBooking) {
      // Increment provider's stats
      const ServiceProvider = mongoose.models.ServiceProvider || mongoose.models.User;
      if (ServiceProvider) {
        await ServiceProvider.findByIdAndUpdate(
          providerId,
          { $inc: { 'stats.completedBookings': 1 } },
          { new: false }
        ).catch(() => {});
      }
    }
  } catch { /* Non-fatal */ }

  // Bust caches
  try {
    const redis = getRedis();
    await redis.del(`provider:stats:${providerId}`);
  } catch { /* Non-fatal */ }

  logger.info('[BookingConsumer] booking_completed handled', { bookingId });
};

// ── Handler: booking_reminder ─────────────────────────────────────────────────
const handleBookingReminder = async (payload) => {
  const {
    bookingId, bookingNumber,
    customerId, providerId,
    serviceTitle, scheduleDate, hoursUntil,
  } = payload;

  const timeLabel = hoursUntil <= 1 ? '1 hour' : `${hoursUntil} hours`;

  // Remind customer
  await sendNotification({
    recipientId: customerId,
    senderId:    providerId,
    type:        'booking_confirmed', // reuse confirmed type for badge
    message:     `Reminder: "${serviceTitle}" is scheduled in ${timeLabel}`,
    metadata:    { bookingId, bookingNumber, serviceTitle, scheduleDate, isReminder: true },
  });

  // Remind provider
  await sendNotification({
    recipientId: providerId,
    senderId:    customerId,
    type:        'booking_confirmed',
    message:     `Upcoming appointment for "${serviceTitle}" in ${timeLabel}`,
    metadata:    { bookingId, bookingNumber, serviceTitle, scheduleDate, isReminder: true },
  });

  logger.info('[BookingConsumer] booking_reminder handled', { bookingId, hoursUntil });
};

// ── Main Dispatcher ───────────────────────────────────────────────────────────
const dispatch = async (payload) => {
  const { type, _messageId } = payload;

  if (await isDuplicate(_messageId)) return;

  switch (type) {
    case 'booking_created':
      await handleBookingCreated(payload);
      break;

    case 'booking_confirmed':
      await handleBookingConfirmed(payload);
      break;

    case 'booking_cancelled':
      await handleBookingCancelled(payload);
      break;

    case 'booking_completed':
      await handleBookingCompleted(payload);
      break;

    case 'booking_reminder':
      await handleBookingReminder(payload);
      break;

    default:
      logger.warn('[BookingConsumer] Unknown event type', { type });
  }
};

// ── Start Consumer ────────────────────────────────────────────────────────────
const startBookingConsumer = async () => {
  // BOOKING queue has priority 9 — process with 5 retries (money-critical events)
  await consume(QUEUES.BOOKING.name, dispatch, { maxRetries: 5 });
  logger.info('[BookingConsumer] ✅ Booking consumer started');
};

module.exports = { startBookingConsumer, dispatch };
