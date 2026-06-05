'use strict';

const EventBus = require('../messaging/EventBusService');

const ListingProducer = {
  async listingCreated(listing, meta = {}) {
    return EventBus.listingCreated(listing._id?.toString() ?? listing.id, {
      userId:    listing.userId?.toString() ?? listing.user?.toString(),
      category:  listing.category,
      title:     listing.title,
      price:     listing.price,
      images:    listing.images ?? [],
      location:  listing.location,
      createdAt: listing.createdAt?.toISOString?.() ?? new Date().toISOString(),
    }, meta);
  },

  async listingUpdated(listing, changes, meta = {}) {
    return EventBus.listingUpdated(
      listing._id?.toString() ?? listing.id,
      changes,
      meta,
    );
  },

  async listingDeleted(listingId, userId, reason = 'user', meta = {}) {
    return EventBus.listingDeleted(listingId, {
      userId,
      reason,
      deletedAt: new Date().toISOString(),
    }, meta);
  },

  async listingSold(listing, buyerId = null, meta = {}) {
    return EventBus.listingSold(listing._id?.toString() ?? listing.id, {
      sellerId:  listing.userId?.toString(),
      buyerId,
      soldPrice: listing.price,
      soldAt:    new Date().toISOString(),
    }, meta);
  },

  async listingExpired(listing, meta = {}) {
    return EventBus.listingExpired(
      listing._id?.toString() ?? listing.id,
      listing.userId?.toString(),
      meta,
    );
  },

  async listingViewed(listingId, viewerId = null, meta = {}) {
    return EventBus.listingViewed(listingId, viewerId, meta);
  },

  async listingPriceDrop(listing, oldPrice, savedBy = [], meta = {}) {
    return EventBus.listingPriceDrop(
      listing._id?.toString() ?? listing.id,
      oldPrice,
      listing.price,
      savedBy,
      meta,
    );
  },
};

module.exports = ListingProducer;
