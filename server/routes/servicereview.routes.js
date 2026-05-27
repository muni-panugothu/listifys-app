const express = require('express');
const router = express.Router();
const {
  createReview,
  getReviewsByProvider,
  getReviewsByListing,
  updateReview,
  deleteReview,
  markHelpful,
  reportReview
} = require('../controllers/servicereview.controller');
const { protect } = require('../middleware/auth.middleware');
const { postingLimiter, searchLimiter } = require('../middleware/ratelimiter.middleware');
const { cacheResponseTracked, invalidateAfter } = require('../middleware/cache.middleware');

// Public routes (with caching)
router.get('/provider/:providerId', searchLimiter, (req, res, next) => {
  req.query.providerId = req.params.providerId;
  next();
}, cacheResponseTracked('srvcReviewProv', 300), getReviewsByProvider);

router.get('/listing/:listingId', searchLimiter, (req, res, next) => {
  req.query.listingId = req.params.listingId;
  next();
}, cacheResponseTracked('srvcReviewList', 300), getReviewsByListing);

// Protected routes (User/Admin)
router.post('/', protect, postingLimiter, 
  invalidateAfter('srvcReviewProv'), invalidateAfter('srvcReviewList'), 
  createReview
);

router.put('/:id', protect, postingLimiter, 
  invalidateAfter('srvcReviewProv'), invalidateAfter('srvcReviewList'), 
  updateReview
);

router.delete('/:id', protect, postingLimiter, 
  invalidateAfter('srvcReviewProv'), invalidateAfter('srvcReviewList'), 
  deleteReview
);

router.post('/:id/helpful', protect, searchLimiter, markHelpful);
router.post('/:id/report', protect, postingLimiter, reportReview);

module.exports = router;