/**
 * Cache Routes — Monitoring & management for Upstash Redis cache
 *
 * GET /api/cache/stats        → cache hit/miss/write counters
 * GET /api/cache/keys/:entity → list cached keys for an entity
 * DELETE /api/cache/:entity   → flush entity cache
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware.js');
const redis = require('../config/redis');
const ListingCache = require('../services/listingcache.service.js');
const { logger } = require('../utils/logger');
// ── All cache routes require admin authentication ────
router.use(protect, authorize('admin'));
// ── Cache statistics ──────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await ListingCache.getStats();

    // Also collect per-entity key counts
    const entityCounts = {};
    for (const entity of ['electronics', 'jobs', 'vehicles', 'forsale']) {
      try {
        const indexKey = `listing:${entity}:index`;
        const keys = await redis.smembers(indexKey);
        entityCounts[entity] = keys ? keys.length : 0;
      } catch {
        entityCounts[entity] = 0;
      }
    }

    res.status(200).json({
      success: true,
      cache: {
        ...stats,
        entities: entityCounts,
        provider: 'Upstash Redis',
        note: 'All cached data is visible in your Upstash Redis dashboard under the Data Browser tab',
      },
    });
  } catch (error) {
    logger.error('Cache stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cache stats' });
  }
});

// ── List cached keys for an entity ────────────────────────
router.get('/keys/:entity', async (req, res) => {
  try {
    const { entity } = req.params;
    const indexKey = `listing:${entity}:index`;
    const keys = await redis.smembers(indexKey);

    // For each key, get the TTL
    const keyDetails = [];
    if (keys && keys.length > 0) {
      for (const key of keys.slice(0, 50)) { // max 50 to avoid overload
        try {
          const ttl = await redis.ttl(key);
          keyDetails.push({ key, ttl, exists: ttl > 0 });
        } catch {
          keyDetails.push({ key, ttl: -1, exists: false });
        }
      }
    }

    res.status(200).json({
      success: true,
      entity,
      totalKeys: keys ? keys.length : 0,
      keys: keyDetails,
      upstashDashboard: 'Open Upstash Redis console → Data Browser to view all keys and their values',
    });
  } catch (error) {
    logger.error('Cache keys error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cache keys' });
  }
});

// ── Flush cache for an entity ─────────────────────────────
router.delete('/:entity', async (req, res) => {
  try {
    const { entity } = req.params;
    await ListingCache.invalidateListingCache(entity);

    res.status(200).json({
      success: true,
      message: `Cache flushed for entity: ${entity}`,
    });
  } catch (error) {
    logger.error('Cache flush error:', error);
    res.status(500).json({ success: false, message: 'Failed to flush cache' });
  }
});

module.exports = router;
