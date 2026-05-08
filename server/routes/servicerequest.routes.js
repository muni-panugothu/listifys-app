const express = require('express');
const router = express.Router();
const {
  createRequest,
  getRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
  makeOffer,
  acceptOffer,
  getMyRequests,
  getRequestsForProvider
} = require('../controllers/servicerequest.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { postingLimiter, searchLimiter } = require('../middleware/ratelimiter.middleware');
const { cacheResponseTracked, invalidateAfter } = require('../middleware/cache.middleware');

// Public routes (with caching)
router.get('/', searchLimiter, cacheResponseTracked('serviceRequests', 300), getRequests);

// Protected routes (User)
router.post('/', protect, postingLimiter, invalidateAfter('serviceRequests'), createRequest);
router.get('/my-requests', protect, searchLimiter, getMyRequests);

// Protected routes (Provider) — must be above /:id to avoid route shadowing
router.get('/provider-requests', protect, searchLimiter, getRequestsForProvider);

// User - Accepting offers (must be above /:id)
router.put('/offers/:offerId/accept', protect, postingLimiter, invalidateAfter('serviceRequests'), acceptOffer);

router.get('/:id', protect, searchLimiter, getRequestById);
router.put('/:id', protect, postingLimiter, invalidateAfter('serviceRequests'), updateRequest);
router.delete('/:id', protect, postingLimiter, invalidateAfter('serviceRequests'), deleteRequest);

// Provider - Make offers
router.post('/:id/offers', protect, postingLimiter, invalidateAfter('serviceRequests'), makeOffer);

module.exports = router;