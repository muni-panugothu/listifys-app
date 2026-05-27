const express = require('express');
const router = express.Router();

// Import all service routes
const categoryRoutes = require('./servicecategory.routes');
const providerRoutes = require('./serviceprovider.routes');
const listingRoutes = require('./servicelisting.routes');
const bookingRoutes = require('./servicebooking.routes');
const reviewRoutes = require('./servicereview.routes');
const requestRoutes = require('./servicerequest.routes');

// Mount routes
router.use('/categories', categoryRoutes);
router.use('/providers', providerRoutes);
router.use('/listings', listingRoutes);
router.use('/bookings', bookingRoutes);
router.use('/reviews', reviewRoutes);
router.use('/requests', requestRoutes);

module.exports = router;