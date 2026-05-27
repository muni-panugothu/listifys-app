const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const { optimiseImages } = require('../middleware/upload.middleware');
const { validateProperty } = require('../validations/property.validation');
const {
  postingLimiter,
  uploadLimiter,
  saveLimiter,
  searchLimiter,
} = require('../middleware/ratelimiter.middleware');
const {
  cacheResponseTracked,
  invalidateAfter,
} = require('../middleware/cache.middleware');
const {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  toggleSaveProperty,
  uploadImages,
  getMyProperties,
  getSavedProperties,
} = require('../controllers/properties.controller');

// Public routes — cached, search-rate-limited
router.get(
  '/',
  searchLimiter,
  cacheResponseTracked('properties', 300, 'list'),
  getProperties,
);

// Protected routes (must come BEFORE /:id to avoid param collision)
router.get('/my-listings', protect, getMyProperties);
router.get('/saved', protect, getSavedProperties);

router.get(
  '/:id',
  searchLimiter,
  cacheResponseTracked('properties', 300, 'detail'),
  getPropertyById,
);

// Protected routes
router.post(
  '/',
  protect,
  postingLimiter,
  (req, res, next) => {
    // Validate request body
    const { error, value } = validateProperty(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(err => err.message),
      });
    }
    req.body = value;
    next();
  },
  invalidateAfter('properties'),
  createProperty,
);

router.put(
  '/:id',
  protect,
  postingLimiter,
  (req, res, next) => {
    const { error, value } = validateProperty(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(err => err.message),
      });
    }
    req.body = value;
    next();
  },
  invalidateAfter('properties'),
  updateProperty,
);

// Image upload — Upstash-backed rate limiting + S3 optimisation
router.post(
  '/upload-images',
  protect,
  uploadLimiter,
  upload.array('images', 6),
  optimiseImages,
  uploadImages,
);

router.delete('/:id', protect, invalidateAfter('properties'), deleteProperty);
router.post('/:id/save', protect, saveLimiter, toggleSaveProperty);

module.exports = router;
