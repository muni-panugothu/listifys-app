'use strict';

const { logger }      = require('../utils/logger');
const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

/**
 * AnalyticsHandler — writes analytics events to your analytics store.
 * Replace the TODO comments with calls to your chosen sink:
 *   MongoDB (analytics collection), ClickHouse, BigQuery, etc.
 */
const AnalyticsHandler = {
  async handle(payload, envelope) {
    const { routingKey } = envelope;
    switch (routingKey) {
      case ROUTING_KEYS.ANALYTICS.USER_ACTIVITY:    return AnalyticsHandler.onActivity(payload);
      case ROUTING_KEYS.ANALYTICS.LISTING_VIEWED:   return AnalyticsHandler.onListingViewed(payload);
      case ROUTING_KEYS.ANALYTICS.SEARCH_PERFORMED: return AnalyticsHandler.onSearch(payload);
      case ROUTING_KEYS.ANALYTICS.CONVERSION:       return AnalyticsHandler.onConversion(payload);
      case ROUTING_KEYS.ANALYTICS.SESSION_START:    return AnalyticsHandler.onSessionStart(payload);
      case ROUTING_KEYS.ANALYTICS.SESSION_END:      return AnalyticsHandler.onSessionEnd(payload);
      default:
        logger.debug('[AnalyticsHandler] Unknown routing key', { routingKey });
    }
  },

  async onActivity(payload) {
    logger.debug('[AnalyticsHandler] Activity', { userId: payload.userId, action: payload.action });
    // await AnalyticsRepository.insertActivity(payload);
  },

  async onListingViewed(payload) {
    logger.debug('[AnalyticsHandler] Listing viewed', { listingId: payload.listingId });
    // await AnalyticsRepository.incrementViewCount(payload.listingId);
    // await AnalyticsRepository.insertView(payload);
  },

  async onSearch(payload) {
    logger.debug('[AnalyticsHandler] Search', { query: payload.query, results: payload.resultCount });
    // await AnalyticsRepository.insertSearch(payload);
  },

  async onConversion(payload) {
    logger.info('[AnalyticsHandler] Conversion', {
      userId:   payload.userId,
      type:     payload.conversionType,
      listing:  payload.listingId,
    });
    // await AnalyticsRepository.insertConversion(payload);
  },

  async onSessionStart(payload) {
    logger.debug('[AnalyticsHandler] Session start', { sessionId: payload.sessionId });
    // await AnalyticsRepository.startSession(payload);
  },

  async onSessionEnd(payload) {
    logger.debug('[AnalyticsHandler] Session end', {
      sessionId:  payload.sessionId,
      duration_s: payload.duration_s,
    });
    // await AnalyticsRepository.endSession(payload);
  },
};

module.exports = AnalyticsHandler;
