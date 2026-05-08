const express = require('express');
const router = express.Router();
const {
  getProviders,
  getProviderById,
  getProviderProfile,
  createProviderProfile,
  updateProviderProfile,
  getProviderListings,
  getProviderReviews,
  getProviderAvailability,
  updateAvailability,
  toggleProviderStatus,
  getNearbyProviders
} = require('../controllers/serviceprovider.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { postingLimiter, searchLimiter } = require('../middleware/ratelimiter.middleware');
const { cacheResponseTracked, invalidateAfter } = require('../middleware/cache.middleware');

// Protected routes that must be matched BEFORE /:id wildcard
router.get('/profile/me', protect, getProviderProfile);

// Public routes (with caching)
router.get('/', searchLimiter, cacheResponseTracked('serviceProviders', 300), getProviders);
router.get('/nearby', searchLimiter, cacheResponseTracked('serviceProvidersNearby', 300), getNearbyProviders);
router.get('/:id', searchLimiter, cacheResponseTracked('serviceProviders_detail', 300), getProviderById);
router.get('/:id/listings', searchLimiter, cacheResponseTracked('serviceProviders_listings', 300), getProviderListings);
router.get('/:id/reviews', searchLimiter, cacheResponseTracked('serviceProviders_reviews', 300), getProviderReviews);
router.get('/:id/availability', searchLimiter, getProviderAvailability);
router.post('/profile', protect, postingLimiter, invalidateAfter('serviceProviders'), createProviderProfile);
router.put('/profile', protect, postingLimiter, invalidateAfter('serviceProviders'), updateProviderProfile);
router.put('/availability', protect, postingLimiter, invalidateAfter('serviceProviders'), updateAvailability);
router.put('/toggle-status', protect, postingLimiter, invalidateAfter('serviceProviders'), toggleProviderStatus);

module.exports = router;