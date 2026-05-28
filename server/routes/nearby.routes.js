/**
 * Nearby Routes — Unified cross-category location-based search
 *
 * GET /api/nearby?lat=17.38&lng=78.48&radius=50&search=bike&sort=nearest
 */
const express = require('express');
const router = express.Router();
const { getNearby } = require('../controllers/nearby.controller');
const { searchLimiter } = require('../middleware/ratelimiter.middleware');
const { cacheResponseTracked } = require('../middleware/cache.middleware');

// Cache nearby results for 60s — short TTL since results are geo-specific.
// The cache key automatically includes lat, lng, radius, search, sort, page, limit
// from ALLOWED_QUERY_KEYS, so different locations get different cache entries.
router.get('/', searchLimiter, cacheResponseTracked('nearby', 60, 'list'), getNearby);

module.exports = router;
