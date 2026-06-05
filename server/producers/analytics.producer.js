'use strict';

const EventBus = require('../messaging/EventBusService');

const AnalyticsProducer = {
  async listingViewed(listingId, viewerId = null, meta = {}) {
    return EventBus.listingViewed(listingId, viewerId, meta);
  },

  async searchPerformed(userId, query, filters, resultCount, meta = {}) {
    return EventBus.trackSearch(userId, { query, filters }, resultCount, meta);
  },

  async conversion(userId, listingId, type, meta = {}) {
    return EventBus.trackConversion(userId, listingId, type, meta);
  },

  async sessionStart(userId, sessionId, device, meta = {}) {
    return EventBus.trackActivity(userId, 'session_start', { sessionId, device }, meta);
  },

  async sessionEnd(userId, sessionId, duration_s, meta = {}) {
    return EventBus.trackActivity(userId, 'session_end', { sessionId, duration_s }, meta);
  },

  async activity(userId, action, data, meta = {}) {
    return EventBus.trackActivity(userId, action, data, meta);
  },
};

module.exports = AnalyticsProducer;
