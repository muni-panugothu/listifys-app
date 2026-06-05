'use strict';

const { logger }      = require('../utils/logger');
const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

const ListingHandler = {
  async handle(payload, envelope) {
    const { routingKey } = envelope;
    switch (routingKey) {
      case ROUTING_KEYS.LISTING.CREATED:    return ListingHandler.onCreated(payload, envelope);
      case ROUTING_KEYS.LISTING.UPDATED:    return ListingHandler.onUpdated(payload, envelope);
      case ROUTING_KEYS.LISTING.DELETED:    return ListingHandler.onDeleted(payload, envelope);
      case ROUTING_KEYS.LISTING.SOLD:       return ListingHandler.onSold(payload, envelope);
      case ROUTING_KEYS.LISTING.EXPIRED:    return ListingHandler.onExpired(payload, envelope);
      case ROUTING_KEYS.LISTING.PRICE_DROP: return ListingHandler.onPriceDrop(payload, envelope);
      default:
        logger.debug('[ListingHandler] Unknown routing key', { routingKey });
    }
  },

  async onCreated(payload) {
    const { listingId, userId, title, category } = payload;
    logger.info('[ListingHandler] Listing created', { listingId, category });
    // await SearchService.indexListing(listingId);
    // await ImageService.processImages(listingId, payload.images);
  },

  async onUpdated(payload) {
    const { listingId, changes } = payload;
    logger.debug('[ListingHandler] Listing updated', { listingId, fields: Object.keys(changes ?? {}) });
    // await SearchService.updateIndex(listingId, changes);
  },

  async onDeleted(payload) {
    const { listingId, reason } = payload;
    logger.info('[ListingHandler] Listing deleted', { listingId, reason });
    // await SearchService.removeFromIndex(listingId);
    // await SavedItemsService.removeSaved(listingId);
  },

  async onSold(payload) {
    const { listingId, sellerId, buyerId, soldPrice } = payload;
    logger.info('[ListingHandler] Listing sold', { listingId, soldPrice });
    // await SearchService.markSold(listingId);
    // await NotificationProducer.push(buyerId, ..., 'Offer accepted!', ...);
  },

  async onExpired(payload) {
    const { listingId, userId } = payload;
    logger.info('[ListingHandler] Listing expired', { listingId });
    // await SearchService.removeFromIndex(listingId);
    // await NotificationProducer.push(userId, ..., 'Listing expired', ...);
  },

  async onPriceDrop(payload) {
    const { listingId, oldPrice, newPrice, savedBy } = payload;
    logger.info('[ListingHandler] Price drop', { listingId, oldPrice, newPrice, notifying: savedBy?.length });
    // For each userId in savedBy, push a price-drop notification
    // for (const userId of savedBy ?? []) {
    //   await NotificationProducer.push(userId, token, 'Price drop!', ...);
    // }
  },
};

module.exports = ListingHandler;
