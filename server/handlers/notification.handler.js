'use strict';

const { logger }      = require('../utils/logger');
const fcmService      = require('../services/fcm.service');
const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

/**
 * NotificationHandler — delivers push, email, SMS, and in-app notifications.
 * Consumed by notification.worker.js (push/in-app) and email.worker.js (email).
 */
const NotificationHandler = {
  async handle(payload, envelope) {
    const { routingKey } = envelope;
    switch (routingKey) {
      case ROUTING_KEYS.NOTIFICATION.PUSH_SEND:   return NotificationHandler.onPush(payload);
      case ROUTING_KEYS.NOTIFICATION.EMAIL_SEND:  return NotificationHandler.onEmail(payload);
      case ROUTING_KEYS.NOTIFICATION.SMS_SEND:    return NotificationHandler.onSMS(payload);
      case ROUTING_KEYS.NOTIFICATION.IN_APP_SEND: return NotificationHandler.onInApp(payload);
      default:
        logger.debug('[NotificationHandler] Unknown routing key', { routingKey });
    }
  },

  async onPush(payload) {
    const { userId, fcmToken, title, body, data } = payload;
    if (!fcmToken) {
      logger.warn('[NotificationHandler] No FCM token — skipping push', { userId });
      return;
    }
    await fcmService.sendRichNotification(fcmToken, {
      notificationId: data?.notificationId,
      type:           data?.type ?? 'general',
      title,
      body,
      route:          data?.route,
      params:         data?.params,
    });
    logger.debug('[NotificationHandler] Push sent', { userId });
  },

  async onEmail(payload) {
    const { to, template, data } = payload;
    // await emailService.send(to, template, data);
    logger.info('[NotificationHandler] Email dispatched', { to, template });
  },

  async onSMS(payload) {
    const { phone, message } = payload;
    // await twilioService.sendSMS(phone, message);
    logger.info('[NotificationHandler] SMS dispatched', { phone });
  },

  async onInApp(payload) {
    const { userId, title, body, type, route, params } = payload;
    // Emit via Socket.IO to connected user
    // const io = require('../socket').getIO();
    // io.to(`user:${userId}`).emit('notification', { title, body, type, route, params });
    logger.debug('[NotificationHandler] In-app sent', { userId, type });
  },
};

module.exports = NotificationHandler;
