/**
 * Aggregated feed endpoint.
 * Returns listings from all 13 categories in a single API call,
 * reducing 13 parallel requests from the client to 1.
 */
const express = require("express");
const router = express.Router();
const { applyGeoFilter, buildLocationRegex, applyCountryFilter } = require("../utils/geoQuery");
const { esHydratedSearch } = require("../utils/esSearch");
const redis = require("../config/redis");
const { logger } = require("../utils/logger");
const { optionalAuth } = require("../middleware/auth.middleware");

const CATEGORY_MODELS = {
  electronics: require("../models/electronics.model"),
  vehicles: require("../models/vehicle.model"),
  forsale: require("../models/forsale.model"),
  mobiles: require("../models/mobile.model"),
  furniture: require("../models/furniture.model"),
  fashion: require("../models/fashion.model"),
  toys: require("../models/toy.model"),
  sports: require("../models/sports.model"),
  collectibles: require("../models/collectible.model"),
  pets: require("../models/pet.model"),
  books: require("../models/book.model"),
  beauty: require("../models/beauty.model"),
  others: require("../models/other.model"),
  jobs: require("../models/job.model"),
  events: require("../models/event.model"),
  properties: require("../models/property.model"),
  services: require("../models/servicelisting.model"),
  takecare: require("../models/takecare.model"),
};

const LISTING_FIELDS =
  "title slug price pricing currency location countryCode images condition category subcategory createdAt savedBy coordinates seller";

/**
 * GET /api/feed
 * Query params:
 *   limit     – per-category limit (default 8, max 100)
 *   page      – page number (default 1)
 *   search    – text search across title/description
 *   location  – text location filter
 *   lat, lng  – geo center for $geoWithin filter
 *   radius    – km radius for geo filter (default 50)
 */
router.get("/", optionalAuth, async (req, res) => {
  try {
    const {
      limit: rawLimit,
      page: rawPage,
      search,
      location,
      lat,
      lng,
      radius = 50,
      countryCode,
    } = req.query;

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 8, 1), 100);
    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const useEsSearch = Boolean(search && !lat && !lng);
    const excludeSellerId = req.user?._id ? String(req.user._id) : null;

    // ── Redis cache (60s TTL) ───────────────────────────────────
    const cacheKey = `feed:${page}:${limit}:${search || ''}:${location || ''}:${lat || ''}:${lng || ''}:${radius}:cc:${countryCode || ''}:ex:${excludeSellerId || "0"}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(parsed);
      }
    } catch { /* cache miss — continue to DB */ }

    // Build shared filter
    const baseFilter = { status: "active" };

    if (excludeSellerId) {
      baseFilter.seller = { $ne: excludeSellerId };
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      baseFilter.$or = [{ title: regex }, { description: regex }];
    }

    if (location) {
      // Match any part of "Suburb, City" (e.g. Hitech City OR Hyderabad), not the
      // full string — so nearby areas like Madhapur still appear with GPS + city.
      const regexFilter = buildLocationRegex(location);
      if (regexFilter) {
        baseFilter.location = regexFilter;
      } else {
        baseFilter.location = {
          $regex: location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        };
      }
    }

    const fetchFromMongo = async (Model) => {
      const filter = { ...baseFilter };

      // Apply geo filter per-model (each has its own coordinates field)
      if (lat && lng) {
        applyGeoFilter(filter, lat, lng, radius);
      }
      applyCountryFilter(filter, countryCode);

      const listings = await Model.find(filter)
        .select(LISTING_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .lean();

      // .lean() bypasses toJSON transforms, so normalize image URLs manually
      const s3Service = require("../services/s3.service");
      for (const doc of listings) {
        if (Array.isArray(doc.images)) {
          doc.images = doc.images.map((img) => {
            const url = typeof img === "object" ? img.url || img.src : img;
            return url ? s3Service.toProxyUrl(url) : url;
          });
        }
      }

      const hasMore = listings.length > limit;
      const pageListings = hasMore ? listings.slice(0, limit) : listings;

      return { listings: pageListings, hasMore, source: "mongodb" };
    };

    // Run all category queries in parallel
    const entries = Object.entries(CATEGORY_MODELS);
    const results = await Promise.allSettled(
      entries.map(async ([key, Model]) => {
        if (useEsSearch) {
          const esResult = await esHydratedSearch({
            entity: key,
            searchParams: {
              query: search,
              location,
              page,
              limit,
              sort: "relevance",
            },
            Model,
            projection: LISTING_FIELDS,
            populate: [],
          });

          if (esResult) {
            const total = esResult.pagination?.total || esResult.docs.length;
            return {
              key,
              listings: esResult.docs,
              hasMore: total > page * limit,
              source: "elasticsearch",
            };
          }
        }

        const mongoResult = await fetchFromMongo(Model);
        return { key, ...mongoResult };
      }),
    );

    // Assemble response
    const feed = {};
    let total = 0;
    let hasMore = false;
    let hasElastic = false;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const catKey = entries[i][0];
      if (result.status === "fulfilled") {
        const { key, listings, hasMore: catHasMore, source } = result.value;
        feed[key] = {
          listings: listings.map((l) => ({ ...l, _source: key })),
          count: listings.length,
          hasMore: !!catHasMore,
        };
        total += listings.length;
        if (catHasMore) hasMore = true;
        if (source === "elasticsearch") hasElastic = true;
      } else {
        // Category query failed — return empty with the actual category key
        feed[catKey] = {
          listings: [],
          count: 0,
          hasMore: false,
          error: result.reason?.message,
        };
      }
    }

    if (hasElastic) {
      res.setHeader("X-Search-Source", "elasticsearch");
    }

    const responseBody = {
      success: true,
      total,
      pagination: {
        page,
        limit,
        hasMore,
      },
      categories: feed,
    };

    // Cache for 60s (non-blocking)
    redis.setex(cacheKey, 60, JSON.stringify(responseBody)).catch(() => {});
    res.setHeader('X-Cache', 'MISS');

    res.status(200).json(responseBody);
  } catch (err) {
    logger.error('Feed endpoint error', { error: err.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch feed",
    });
  }
});

// ── GET /api/feed/my-listings — all user listings across every category ──
router.get("/my-listings", require("../middleware/auth.middleware").protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const s3Service = require("../services/s3.service");

    const entries = Object.entries(CATEGORY_MODELS);
    const results = await Promise.allSettled(
      entries.map(async ([key, Model]) => {
        // services use "userId" instead of "seller"
        const filter = key === "services"
          ? { userId }
          : { seller: userId };

        const listings = await Model.find(filter)
          .select(LISTING_FIELDS + " status seller")
          .populate("seller", "name profileImage")
          .sort({ createdAt: -1 })
          .lean();

        for (const doc of listings) {
          if (Array.isArray(doc.images)) {
            doc.images = doc.images.map((img) => {
              const url = typeof img === "object" ? img.url || img.src : img;
              return url ? s3Service.toProxyUrl(url) : url;
            });
          }
          doc._source = key;
        }
        return { key, listings };
      }),
    );

    let all = [];
    for (const r of results) {
      if (r.status === "fulfilled") all.push(...r.value.listings);
    }
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ success: true, listings: all });
  } catch (err) {
    logger.error("Feed my-listings error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to fetch my listings" });
  }
});

// ── GET /api/feed/saved — all saved listings across every category ──
router.get("/saved", require("../middleware/auth.middleware").protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const s3Service = require("../services/s3.service");

    const entries = Object.entries(CATEGORY_MODELS);
    const results = await Promise.allSettled(
      entries.map(async ([key, Model]) => {
        const listings = await Model.find({ savedBy: userId, status: "active" })
          .select(LISTING_FIELDS + " seller")
          .populate("seller", "name profileImage")
          .sort({ createdAt: -1 })
          .lean();

        for (const doc of listings) {
          if (Array.isArray(doc.images)) {
            doc.images = doc.images.map((img) => {
              const url = typeof img === "object" ? img.url || img.src : img;
              return url ? s3Service.toProxyUrl(url) : url;
            });
          }
          doc._source = key;
          doc._saved = true;
        }
        return { key, listings };
      }),
    );

    let all = [];
    for (const r of results) {
      if (r.status === "fulfilled") all.push(...r.value.listings);
    }
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ success: true, listings: all });
  } catch (err) {
    logger.error("Feed saved error", { error: err.message });
    res.status(500).json({ success: false, message: "Failed to fetch saved listings" });
  }
});

module.exports = router;
