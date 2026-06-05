'use strict';

const EventBus = require('../messaging/EventBusService');

const NotificationProducer = {
  async push(userId, fcmToken, title, body, data = {}, meta = {}) {
    return EventBus.sendPushNotification(userId, fcmToken, { title, body, data }, meta);
  },

  async email(to, template, data, meta = {}) {
    return EventBus.sendEmail(to, template, data, meta);
  },

  async sms(phone, message, meta = {}) {
    return EventBus.sendSMS(phone, message, meta);
  },

  async inApp(userId, notification, meta = {}) {
    return EventBus.sendInAppNotification(userId, {
      ...notification,
      createdAt: notification.createdAt ?? new Date().toISOString(),
    }, meta);
  },

  /**
   * Fire all applicable notification channels at once.
   * Only fires a channel if the relevant identifier is provided.
   */
  async sendAll({ userId, fcmToken, email, phone }, notification, meta = {}) {
    const jobs = [];
    if (fcmToken) {
      jobs.push(this.push(userId, fcmToken, notification.title, notification.body, notification.data ?? {}, meta));
    }
    if (email) {
      jobs.push(this.email(email, notification.template, notification.data ?? {}, meta));
    }
    if (phone) {
      jobs.push(this.sms(phone, notification.sms ?? notification.body, meta));
    }
    if (userId) {
      jobs.push(this.inApp(userId, notification, meta));
    }
    return Promise.all(jobs);
  },
};

module.exports = NotificationProducer;
