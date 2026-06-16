'use strict';

/**
 * Shared registry of marketplace listing models for cross-category queries.
 * Services use `userId`; all other categories use `seller`.
 */
const CATEGORY_ENTRIES = [
  { model: require('../models/electronics.model'), sellerField: 'seller' },
  { model: require('../models/vehicle.model'), sellerField: 'seller' },
  { model: require('../models/mobile.model'), sellerField: 'seller' },
  { model: require('../models/job.model'), sellerField: 'seller' },
  { model: require('../models/furniture.model'), sellerField: 'seller' },
  { model: require('../models/toy.model'), sellerField: 'seller' },
  { model: require('../models/fashion.model'), sellerField: 'seller' },
  { model: require('../models/sports.model'), sellerField: 'seller' },
  { model: require('../models/collectible.model'), sellerField: 'seller' },
  { model: require('../models/pet.model'), sellerField: 'seller' },
  { model: require('../models/book.model'), sellerField: 'seller' },
  { model: require('../models/beauty.model'), sellerField: 'seller' },
  { model: require('../models/other.model'), sellerField: 'seller' },
  { model: require('../models/forsale.model'), sellerField: 'seller' },
  { model: require('../models/event.model'), sellerField: 'seller' },
  { model: require('../models/property.model'), sellerField: 'seller' },
  { model: require('../models/takecare.model'), sellerField: 'seller' },
  { model: require('../models/servicelisting.model'), sellerField: 'userId' },
];

/**
 * Count a user's active listings across every marketplace category.
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {string} [status='active']
 */
async function countUserListings(userId, status = 'active') {
  const counts = await Promise.all(
    CATEGORY_ENTRIES.map(({ model, sellerField }) =>
      model.countDocuments({ [sellerField]: userId, status }),
    ),
  );
  return counts.reduce((sum, c) => sum + (c || 0), 0);
}

module.exports = { CATEGORY_ENTRIES, countUserListings };
