const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getProviderBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  getBookingTimeline
} = require('../controllers/servicebooking.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { postingLimiter, searchLimiter } = require('../middleware/ratelimiter.middleware');
const { cacheResponseTracked, invalidateAfter } = require('../middleware/cache.middleware');

// Protected routes (User)
router.post('/', protect, postingLimiter, invalidateAfter('serviceBookings'), createBooking);
router.get('/my-bookings', protect, searchLimiter, getMyBookings);

// Protected routes (Provider) — must be above /:id to avoid route shadowing
router.get('/provider-bookings', protect, searchLimiter, getProviderBookings);

router.get('/:id', protect, searchLimiter, getBookingById);
router.get('/:id/timeline', protect, searchLimiter, getBookingTimeline);
router.post('/:id/cancel', protect, postingLimiter, invalidateAfter('serviceBookings'), cancelBooking);
// Note: authorize('provider') removed — User schema has no 'provider' role.
// The controller itself checks booking.providerId.userId === req.user._id for ownership.
router.put('/:id/status', protect, postingLimiter, invalidateAfter('serviceBookings'), updateBookingStatus);

module.exports = router;