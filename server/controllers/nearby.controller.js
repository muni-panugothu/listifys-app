/**
 * Nearby Controller — Unified cross-category geo search
 *
 * GET /api/nearby?lat=17.38&lng=78.48&radius=20&search=bike&sort=nearest&page=1&limit=30
 *
 * Returns listings from ALL categories sorted by distance,
 * with a computed `distance` field (in km) for each result.
 */
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const SearchService = require('../services/search.service');

// All geo-enabled models
const Electronics = require('../models/electronics.model');
const Vehicle = require('../models/vehicle.model');
const ForSale = require('../models/forsale.model');
const Furniture = require('../models/furniture.model');
const Fashion = require('../models/fashion.model');
const Sports = require('../models/sports.model');
const Collectible = require('../models/collectible.model');
const Pet = require('../models/pet.model');
const Book = require('../models/book.model');
const Beauty = require('../models/beauty.model');
const Other = require('../models/other.model');
const Toy = require('../models/toy.model');
const Job = require('../models/job.model');
const Event = require('../models/event.model');
const TakeCare = require('../models/takecare.model');
const Mobile = require('../models/mobile.model');
const Property = require('../models/property.model');

const MODEL_MAP = {
  electronics: { model: Electronics, path: '/electronics' },
  vehicles:    { model: Vehicle,     path: '/vehicles' },
  forsale:     { model: ForSale,     path: '/forsale' },
  furniture:   { model: Furniture,   path: '/furniture' },
  fashion:     { model: Fashion,     path: '/fashion' },
  sports:      { model: Sports,      path: '/sports' },
  collectibles: { model: Collectible, path: '/collectibles' },
  pets:         { model: Pet,         path: '/pets' },
  books:        { model: Book,        path: '/books' },
  beauty:       { model: Beauty,      path: '/beauty' },
  others:       { model: Other,       path: '/others' },
  toys:        { model: Toy,         path: '/toys' },
  jobs:        { model: Job,         path: '/jobs' },
  events:      { model: Event,       path: '/events' },
  takecare:    { model: TakeCare,    path: '/takecare' },
  mobiles:     { model: Mobile,      path: '/mobiles' },
  properties:  { model: Property,    path: '/properties' },
};

// Haversine distance in km
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Extract coordinates from a listing
function extractCoords(listing) {
  const c = listing.coordinates;
  if (c?.coordinates && Array.isArray(c.coordinates) && c.coordinates.length === 2) {
    return { lng: c.coordinates[0], lat: c.coordinates[1] };
  }
  return null;
}

// Projection – only fetch needed fields for listing cards
const CARD_PROJECTION = { currency: 1,
  title: 1, price: 1, location: 1, condition: 1,
  images: 1, sellerName: 1, seller: 1,
  coordinates: 1, createdAt: 1, category: 1, subcategory: 1,
};

/**
 * @desc    Get nearby listings across all categories
 * @route   GET /api/nearby
 * @access  Public
 */
exports.getNearby = async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 50,
      search,
      category,
      sort = 'nearest',
      page = 1,
      limit = 30,
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng are required for nearby search',
      });
    }

    const userLat = Number(lat);
    const userLng = Number(lng);
    const maxDist = Number(radius);

    if (isNaN(userLat) || isNaN(userLng) || isNaN(maxDist)) {
      return res.status(400).json({
        success: false,
        message: 'lat, lng, and radius must be valid numbers',
      });
    }
    if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates out of valid range',
      });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);

    if (SearchService.isAvailable()) {
      const esResults = await SearchService.search({
        query: search,
        category,
        lat: userLat,
        lng: userLng,
        radius: maxDist,
        sort,
        page: safePage,
        limit: safeLimit,
      });

      if (esResults && esResults.listings) {
        const paged = esResults.listings.map(doc => ({
          ...doc,
          _detailPath: `${MODEL_MAP[doc._entity]?.path || ''}/${doc._id}`,
        }));
        
        return res.status(200).json({
          success: true,
          listings: paged,
          pagination: esResults.pagination,
          location: { lat: userLat, lng: userLng, radius: maxDist },
          source: 'elasticsearch'
        });
      }
    }

    // Determine which categories to query
    const categoriesToSearch = category
      ? category.split(',').map(c => c.trim().toLowerCase()).filter(c => MODEL_MAP[c])
      : Object.keys(MODEL_MAP);

    // Use $geoNear aggregation to let MongoDB compute distances + filter
    // This avoids fetching excess docs and doing haversine in JS
    const maxDistMeters = maxDist * 1000;
    // Fetch enough per category to fill the requested page after cross-category merge & sort.
    // We need at least (page * limit) total results, divided across categories, plus a buffer.
    const perCatLimit = Math.ceil((safePage * safeLimit * 2) / Math.max(categoriesToSearch.length, 1)) + 5;

    const promises = categoriesToSearch.map(async (catKey) => {
      const { model } = MODEL_MAP[catKey];
      try {
        const pipeline = [
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [userLng, userLat] },
              distanceField: 'distance',
              maxDistance: maxDistMeters,
              spherical: true,
              query: { status: 'active' },
            },
          },
        ];

        // Text search as regex match (since $geoNear must be first stage)
        if (search && search.trim()) {
          const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          pipeline.push({
            $match: {
              $or: [
                { title: { $regex: escaped, $options: 'i' } },
                { description: { $regex: escaped, $options: 'i' } },
              ],
            },
          });
        }

        pipeline.push(
          { $limit: perCatLimit },
          { $project: { ...CARD_PROJECTION, distance: 1 } },
        );

        const docs = await model.aggregate(pipeline);

        // Populate seller after aggregation
        const populated = await model.populate(docs, { path: 'seller', select: 'name profileImage' });

        return populated.map(doc => ({
          ...doc,
          distance: doc.distance ? Math.round(doc.distance / 100) / 10 : null, // meters → km, 1 decimal
          _entity: catKey,
          _detailPath: `${MODEL_MAP[catKey].path}/${doc._id}`,
        }));
      } catch (err) {
        // Model may lack 2dsphere index — fall back to simple geo filter
        try {
          const { applyGeoFilter } = require('../utils/geoQuery');
          const filter = { status: 'active' };
          applyGeoFilter(filter, lat, lng, radius);

          if (search && search.trim()) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
              { title: { $regex: escaped, $options: 'i' } },
              { description: { $regex: escaped, $options: 'i' } },
            ];
          }

          const docs = await model.find(filter, CARD_PROJECTION)
            .lean();

          // Compute distances first, then sort by distance, then limit
          const withDist = docs.map(doc => {
            const coords = extractCoords(doc);
            const distance = coords
              ? Math.round(haversine(userLat, userLng, coords.lat, coords.lng) * 10) / 10
              : null;
            return { ...doc, distance, _entity: catKey, _detailPath: `${MODEL_MAP[catKey].path}/${doc._id}` };
          });
          withDist.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
          return withDist.slice(0, perCatLimit);
        } catch {
          return [];
        }
      }
    });

    const arrays = await Promise.all(promises);
    let allResults = arrays.flat();

    // Sort
    if (sort === 'nearest') {
      allResults.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else if (sort === 'newest') {
      allResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'price_asc') {
      allResults.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sort === 'price_desc') {
      allResults.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }

    // Paginate
    const total = allResults.length;
    const start = (safePage - 1) * safeLimit;
    const paged = allResults.slice(start, start + safeLimit);

    res.status(200).json({
      success: true,
      listings: paged,
      pagination: {
        total,
        page: safePage,
        pages: Math.ceil(total / safeLimit),
        limit: safeLimit,
        hasMore: start + safeLimit < total,
      },
      location: {
        lat: userLat,
        lng: userLng,
        radius: maxDist,
      },
    });
  } catch (error) {
    logger.error('Nearby search error:', error);
    res.status(500).json({
      success: false,
      message: 'Nearby search failed',
    });
  }
};
