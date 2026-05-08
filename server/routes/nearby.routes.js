/**
 * Nearby Routes — Unified cross-category location-based search
 *
 * GET /api/nearby?lat=17.38&lng=78.48&radius=20&search=bike&sort=nearest
 */
const express = require('express');
const router = express.Router();
const { getNearby } = require('../controllers/nearby.controller');
const { searchLimiter } = require('../middleware/ratelimiter.middleware');

router.get('/', searchLimiter, getNearby);

module.exports = router;
