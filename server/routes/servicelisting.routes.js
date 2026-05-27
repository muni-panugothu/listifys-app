const express = require('express');
const router = express.Router();
const {
  getListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
  getNearbyListings,
  toggleSaveListing,
  getSavedListings,
  uploadImages,
  incrementViews
} = require('../controllers/servicelisting.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const { cacheResponseTracked, invalidateAfter } = require('../middleware/cache.middleware');
const { searchLimiter, postingLimiter, saveLimiter, uploadLimiter } = require('../middleware/ratelimiter.middleware');
const {
  validateCreateServiceListing,
  validateUpdateServiceListing,
  validateServiceListingQuery,
  validateServiceListingParams,
} = require('../validations/servicelisting.validation');

// Validate params first, then body on update
const validateUpdateParams = [validateServiceListingParams, validateUpdateServiceListing];

// Protected routes (must be BEFORE /:id to avoid being caught by the param route)
router.get('/my/listings', protect, getMyListings);
router.get('/saved/listings', protect, getSavedListings);

// Public routes
router.get('/', searchLimiter, validateServiceListingQuery, cacheResponseTracked('serviceListings', 300), getListings);
router.get('/nearby', searchLimiter, cacheResponseTracked('serviceListingsNearby', 300), getNearbyListings);
router.get('/:id', searchLimiter, validateServiceListingParams, cacheResponseTracked('serviceListings', 300, 'detail'), getListingById);
router.post('/:id/views', searchLimiter, incrementViews);

// Protected routes
router.post('/', protect, postingLimiter, validateCreateServiceListing, invalidateAfter('serviceListings'), createListing);
router.put('/:id', protect, postingLimiter, validateServiceListingParams, validateUpdateServiceListing, invalidateAfter('serviceListings'), updateListing);
router.delete('/:id', protect, postingLimiter, validateServiceListingParams, invalidateAfter('serviceListings'), deleteListing);
router.post('/:id/toggle-save', protect, saveLimiter, toggleSaveListing);
router.post('/upload-images', protect, uploadLimiter, upload.array('images', 6), uploadImages);

module.exports = router;