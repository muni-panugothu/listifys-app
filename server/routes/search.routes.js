/**
 * Search Routes — Unified Elasticsearch (Flipkart/Amazon-style)
 *
 * One unified index (listify_products) handles all 18 categories.
 * ES synonyms + dynamic mapping replace hardcoded entity aliases.
 * Falls back to MongoDB when Elasticsearch is unavailable.
 *
 * GET /api/search?q=iphone&entity=electronics&minPrice=100&maxPrice=1000
 * GET /api/search/suggest?q=iph&entity=electronics
 * POST /api/search/reindex   (admin — sync MongoDB → Elasticsearch)
 */

const express = require('express');
const router = express.Router();
const SearchService = require('../services/search.service.js');
const ListingCache = require('../services/listingcache.service.js');
const { searchLimiter } = require('../middleware/ratelimiter.middleware.js');
const { protect, authorize } = require('../middleware/auth.middleware.js');
const { logger } = require('../utils/logger');
const { publishSearchAnalytics } = require('../queues/producers/search.producer');

// Models for MongoDB fallback + reindex
const Electronics = require('../models/electronics.model.js');
const Job = require('../models/job.model.js');
const Vehicle = require('../models/vehicle.model.js');
const Event = require('../models/event.model.js');
const ForSale = require('../models/forsale.model.js');
const Furniture = require('../models/furniture.model.js');
const Fashion = require('../models/fashion.model.js');
const Sports = require('../models/sports.model.js');
const Collectible = require('../models/collectible.model.js');
const Pet = require('../models/pet.model.js');
const Book = require('../models/book.model.js');
const Beauty = require('../models/beauty.model.js');
const Other = require('../models/other.model.js');
const Toy = require('../models/toy.model.js');
const Mobile = require('../models/mobile.model.js');
const Property = require('../models/property.model.js');
const TakeCare = require('../models/takecare.model.js');
const ServiceListing = require('../models/servicelisting.model.js');

const MODEL_MAP = {
  electronics: Electronics,
  jobs: Job,
  vehicles: Vehicle,
  events: Event,
  forsale: ForSale,
  furniture: Furniture,
  fashion: Fashion,
  sports: Sports,
  collectibles: Collectible,
  pets: Pet,
  books: Book,
  beauty: Beauty,
  others: Other,
  toys: Toy,
  mobiles: Mobile,
  properties: Property,
  takecare: TakeCare,
  services: ServiceListing,
};

// Entity aliases — used for MongoDB fallback only (ES synonyms handle this in ES path)
const ENTITY_ALIASES = {
  electronics: ['electronic', 'tv', 'laptop', 'computer', 'ac', 'fridge', 'camera', 'appliance'],
  jobs: ['job', 'career', 'hiring', 'vacancy', 'work', 'employment', 'internship'],
  vehicles: ['vehicle', 'car', 'bike', 'cycle', 'motorcycle', 'scooter', 'automobile'],
  events: ['event', 'concert', 'show', 'festival', 'party', 'meetup'],
  forsale: ['for sale', 'sell', 'selling', 'buy', 'deal'],
  furniture: ['sofa', 'table', 'chair', 'bed', 'wardrobe', 'desk', 'shelf', 'cabinet'],
  fashion: ['clothes', 'clothing', 'wear', 'dress', 'shirt', 'shoes', 'footwear', 'watch'],
  sports: ['sport', 'fitness', 'gym', 'exercise', 'cricket', 'football', 'yoga'],
  collectibles: ['collectible', 'antique', 'vintage', 'coin', 'stamp', 'memorabilia'],
  pets: ['pet', 'dog', 'cat', 'puppy', 'kitten', 'bird', 'fish', 'animal'],
  books: ['book', 'novel', 'textbook', 'comic', 'magazine', 'literature', 'reading'],
  beauty: ['makeup', 'skincare', 'cosmetic', 'fragrance', 'perfume', 'hair care'],
  others: ['other', 'miscellaneous', 'misc'],
  toys: ['toy', 'game', 'puzzle', 'doll', 'lego', 'action figure'],
  mobiles: ['mobile', 'phone', 'smartphone', 'tablet', 'iphone', 'samsung', 'android'],
  properties: ['property', 'house', 'apartment', 'flat', 'room', 'rental', 'pg', 'roommate', 'rent', 'bhk', 'villa', 'condo'],
  takecare: ['nanny', 'babysitter', 'caretaker', 'elder care', 'childcare', 'daycare'],
  services: ['service', 'plumber', 'electrician', 'mechanic', 'cleaning', 'repair'],
};

function matchEntityNames(query) {
  if (!query) return new Set();
  const q = query.trim().toLowerCase();
  const matched = new Set();
  for (const [entityKey, aliases] of Object.entries(ENTITY_ALIASES)) {
    if (q === entityKey || q === entityKey.replace(/s$/, '') || q === entityKey + 's') {
      matched.add(entityKey);
      continue;
    }
    if (aliases.some(alias => q === alias || q.includes(alias) || alias.includes(q))) {
      matched.add(entityKey);
    }
  }
  return matched;
}

// ── Full-text search ──────────────────────────────────────
router.get('/', searchLimiter, async (req, res) => {
  try {
    const {
      q,
      entity = 'all',
      category,
      condition,
      minPrice,
      maxPrice,
      location,
      lat,
      lng,
      brand,
      fuelType,
      transmission,
      sort,
      page = 1,
      limit = 50,
    } = req.query;

    if (!q && !location && (!lat || !lng)) {
      return res.status(400).json({
        success: false,
        message: 'Either search query (q) or location is required',
      });
    }

    // Validate entity
    if (entity !== 'all' && !MODEL_MAP[entity]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity. Use "electronics", "jobs", "vehicles", "events", "forsale", "furniture", "fashion", "sports", "toys", "mobiles", "properties", "takecare", "services", or "all"',
      });
    }

    // ── 1. Try Redis cache ──
    const cacheKeyObj = { entity, q, category, condition, minPrice, maxPrice, location, brand, fuelType, transmission, sort, page: +page, limit: +limit };
    const cacheKey = `search:${entity}:${Buffer.from(JSON.stringify(cacheKeyObj)).toString('base64url')}`;
    const cachedResults = await ListingCache.getCachedSearchResults(entity, cacheKey);
    if (cachedResults) {
      const cachedArray = Array.isArray(cachedResults)
        ? cachedResults
        : cachedResults.results || cachedResults.listings || [];
      return res.status(200).json({
        success: true,
        query: q,
        entity,
        results: cachedArray,
        total: cachedResults.pagination?.total || cachedArray.length,
        pagination: cachedResults.pagination,
        source: 'cache',
      });
    }

    // ── 2. Try Elasticsearch (unified index — one query for all entities) ──
    const esResults = await SearchService.search({
      query: q,
      entity,
      category,
      condition,
      minPrice,
      maxPrice,
      location,
      lat,
      lng,
      radius: req.query.radius,
      brand,
      fuelType,
      transmission,
      sort,
      page,
      limit,
    });

    if (esResults && esResults.listings && esResults.listings.length > 0) {
      await ListingCache.cacheSearchResults(entity, cacheKey, esResults.listings, esResults.pagination);

      // Track search analytics (non-blocking)
      publishSearchAnalytics({
        query: q,
        entity,
        resultCount: esResults.pagination?.total || esResults.listings.length,
        source: 'elasticsearch',
        userId: req.user?._id?.toString(),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        query: q,
        entity,
        results: esResults.listings,
        total: esResults.pagination?.total || esResults.listings.length,
        pagination: esResults.pagination,
        source: 'elasticsearch',
      });
    }

    // ── 3. MongoDB fallback ──
    const entitiesToSearch = entity === 'all' ? Object.keys(MODEL_MAP) : [entity];
    const matchedEntities = matchEntityNames(q);

    const buildMongoFilter = (eName) => {
      const filter = { status: 'active' };

      if (matchedEntities.has(eName)) {
        // Entity name match — show all listings from this category
      } else if (q) {
        const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedQ, 'i');
        filter.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { subcategory: searchRegex },
          { brand: searchRegex },
        ];
      }

      if (category) filter.subcategory = { $in: category.split(',').map(c => c.trim()) };
      if (condition) filter.condition = { $in: condition.split(',').map(c => c.trim()) };
      if (minPrice || maxPrice) {
        if (eName === 'services') {
          filter['pricing.basePrice'] = {};
          if (minPrice) filter['pricing.basePrice'].$gte = Number(minPrice);
          if (maxPrice) filter['pricing.basePrice'].$lte = Number(maxPrice);
        } else {
          filter.price = {};
          if (minPrice) filter.price.$gte = Number(minPrice);
          if (maxPrice) filter.price.$lte = Number(maxPrice);
        }
      }
      if (location) {
        const locRegex = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (eName === 'services') {
          filter['location.address'] = locRegex;
        } else {
          filter.location = locRegex;
        }
      }

      const { applyGeoFilter } = require('../utils/geoQuery');
      const radiusKm = req.query.radius || 50;
      if (lat && lng) applyGeoFilter(filter, lat, lng, radiusKm);
      return filter;
    };

    const { buildSortOption } = require('../utils/geoQuery');
    const mongoSort = buildSortOption(sort, !!(lat && lng), !!q);
    const perEntityLimit = entity === 'all' ? Math.min(Number(limit), 20) : Number(limit);
    const skip = entity === 'all' ? 0 : (Number(page) - 1) * Number(limit);

    const SEARCH_PROJECTION = 'title slug price images location condition brand model year fuelType transmission kmDriven seller currency subcategory createdAt';

    const promises = entitiesToSearch.map(async (eName) => {
      const Model = MODEL_MAP[eName];
      const filter = buildMongoFilter(eName);
      try {
        const docs = await Model.find(filter)
          .select(SEARCH_PROJECTION)
          .sort(mongoSort)
          .skip(skip)
          .limit(perEntityLimit)
          .populate('seller', 'name profileImage')
          .lean();
        return docs.map(d => ({ ...d, _entity: eName }));
      } catch (err) {
        logger.warn(`Search query failed for entity "${eName}":`, err.message);
        return [];
      }
    });

    const arrays = await Promise.all(promises);
    const results = arrays.flat();

    const pagination = {
      total: results.length,
      page: Number(page),
      pages: 1,
      limit: Number(limit),
    };

    if (results.length > 0) {
      await ListingCache.cacheSearchResults(entity, cacheKey, results, pagination);
    }

    // Track search analytics (non-blocking)
    publishSearchAnalytics({
      query: q,
      entity,
      resultCount: results.length,
      source: 'mongodb',
      userId: req.user?._id?.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      query: q,
      entity,
      results,
      total: results.length,
      pagination,
      source: 'mongodb',
    });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
    });
  }
});

// ── Autocomplete / suggestions ────────────────────────────
router.get('/suggest', searchLimiter, async (req, res) => {
  try {
    const { q, entity = 'all', limit = 8 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    // 1. Try Elasticsearch (works for both single entity and "all")
    const suggestions = await SearchService.suggest(q, { entity, limit: Number(limit) });
    if (suggestions && suggestions.length > 0) {
      return res.status(200).json({
        success: true,
        suggestions,
        source: 'elasticsearch',
      });
    }

    // 2. MongoDB fallback
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const entitiesToQuery = entity === 'all' ? Object.keys(MODEL_MAP) : (MODEL_MAP[entity] ? [entity] : []);

    if (entitiesToQuery.length === 0) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const perEntityLimit = entity === 'all' ? Math.max(2, Math.ceil(Number(limit) / entitiesToQuery.length)) : Number(limit);
    const promises = entitiesToQuery.map(async (eName) => {
      try {
        const docs = await MODEL_MAP[eName].find(
          {
            status: 'active',
            $or: [
              { title: regex },
              { description: regex },
              { category: regex },
              { subcategory: regex },
              { brand: regex },
            ],
          },
          { title: 1, price: 1, location: 1, images: 1, brand: 1, model: 1, currency: 1, subcategory: 1, slug: 1 }
        ).limit(perEntityLimit).lean();
        return docs.map(r => ({
          _id: r._id,
          title: r.title,
          price: r.price,
          currency: r.currency,
          location: r.location,
          thumbnail: r.images?.[0] || null,
          brand: r.brand,
          model: r.model,
          subcategory: r.subcategory,
          slug: r.slug,
          _entity: eName,
        }));
      } catch (err) { logger.warn(`Suggest failed for "${eName}":`, err.message); return []; }
    });

    const arrays = await Promise.all(promises);
    const mongoSuggestions = arrays.flat().slice(0, Number(limit));

    res.status(200).json({
      success: true,
      suggestions: mongoSuggestions,
      source: 'mongodb',
    });
  } catch (error) {
    logger.error('Suggest error:', error);
    res.status(200).json({ success: true, suggestions: [] });
  }
});

// ── Reindex: sync MongoDB → Elasticsearch ─────────────────
router.post('/reindex', protect, authorize('admin'), async (req, res) => {
  try {
    if (!SearchService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Elasticsearch is not connected. Set ELASTICSEARCH_URL env var.',
      });
    }

    const { entity } = req.body;
    const entities = entity ? [entity] : Object.keys(MODEL_MAP);
    const results = {};

    for (const ent of entities) {
      const Model = MODEL_MAP[ent];
      if (!Model) continue;

      const listings = await Model.find({ status: 'active' }).lean();
      const result = await SearchService.bulkIndex(ent, listings);
      results[ent] = { total: listings.length, ...result };
    }

    res.status(200).json({
      success: true,
      message: 'Reindex complete',
      results,
    });
  } catch (error) {
    logger.error('Reindex error:', error);
    res.status(500).json({
      success: false,
      message: 'Reindex failed',
    });
  }
});

// ── Trending / Popular searches ───────────────────────────
router.get('/trending', searchLimiter, async (req, res) => {
  try {
    const { limit = 12 } = req.query;

    // 1. Try Redis cache
    const cacheKey = 'search:trending';
    const cached = await ListingCache.getCachedSearchResults('trending', cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        trending: Array.isArray(cached) ? cached : cached.results || [],
        source: 'cache',
      });
    }

    // 2. Aggregate popular searches from recently created listings across all entities
    const trendingItems = [];

    // Get recently created listings and extract popular subcategories + titles
    const popularPromises = Object.entries(MODEL_MAP).map(async ([eName, Model]) => {
      try {
        const docs = await Model.find({ status: 'active' })
          .sort({ views: -1, createdAt: -1 })
          .select('title subcategory category brand images price location')
          .limit(Math.ceil(Number(limit) / Object.keys(MODEL_MAP).length) + 1)
          .lean();
        return docs.map(d => ({
          _id: d._id,
          title: d.title,
          subcategory: d.subcategory,
          category: d.category,
          brand: d.brand,
          thumbnail: d.images?.[0] || null,
          price: d.price,
          location: d.location,
          _entity: eName,
        }));
      } catch { return []; }
    });

    const arrays = await Promise.all(popularPromises);
    trendingItems.push(...arrays.flat());

    // Sort by some "trending" heuristic (views would be ideal, but we have limited data)
    const trending = trendingItems.slice(0, Number(limit));

    // Cache for 10 min
    if (trending.length > 0) {
      await ListingCache.cacheSearchResults('trending', cacheKey, trending, { total: trending.length });
    }

    res.status(200).json({
      success: true,
      trending,
      source: 'mongodb',
    });
  } catch (error) {
    logger.error('Trending error:', error);
    res.status(200).json({ success: true, trending: [] });
  }
});

// ── Trending Search Terms (from analytics) ────────────────
router.get('/trending-terms', searchLimiter, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const mongoose = require('mongoose');

    if (!mongoose.models.SearchAnalytics) {
      return res.status(200).json({ success: true, terms: [] });
    }

    const SearchAnalytics = mongoose.models.SearchAnalytics;
    const terms = await SearchAnalytics.find({
      searchCount: { $gte: 3 }, // Minimum 3 searches
      lastSearched: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    })
      .sort({ searchCount: -1 })
      .limit(Number(limit))
      .select('query searchCount entity -_id')
      .lean();

    res.status(200).json({ success: true, terms });
  } catch (error) {
    logger.error('Trending terms error:', error);
    res.status(200).json({ success: true, terms: [] });
  }
});

// ── Elasticsearch status ──────────────────────────────────
router.get('/status', protect, authorize('admin'), async (req, res) => {
  res.status(200).json({
    success: true,
    elasticsearch: {
      connected: SearchService.isAvailable(),
      fallback: 'MongoDB regex search',
    },
  });
});

// Export MODEL_MAP for use in server.js (background reindex + change streams)
router.MODEL_MAP = MODEL_MAP;

module.exports = router;
