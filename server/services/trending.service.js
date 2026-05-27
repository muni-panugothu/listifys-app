'use strict';
/**
 * Trending & Recommendation Service
 *
 * Powers:
 *   • Trending searches (global + per-city) — Redis sorted sets
 *   • Trending categories  — based on search frequency
 *   • "Similar items" recommendations — based on category / price / brand
 *   • Recently viewed      — per-user, stored in Redis (60-item ring buffer)
 *   • Hot listings         — high-engagement items per category
 *
 * All operations degrade gracefully when Redis is unavailable.
 */

const redis  = require('../config/redis');
const { logger } = require('../utils/logger');

// Redis key prefixes
const KEYS = {
  trendingGlobal:  'trending:global',           // sorted set  { term → score }
  trendingCity:    (city) => `trending:city:${city.toLowerCase().replace(/\s/g, '-')}`,
  trendingCat:     'trending:categories',        // sorted set  { entity → score }
  recentlyViewed:  (uid)  => `user:${uid}:viewed`,
  hotListings:     (ent)  => `hot:${ent}`,
};

// TTLs (seconds)
const TTL = {
  TRENDING: 24 * 3600,         // 24 h — rotate trending daily
  RECENTLY_VIEWED: 7 * 86400,  // 7 days
  HOT_LISTINGS: 3600,          // 1 h
};

class TrendingService {

  // ─────────────────────────────────────────────────────────────
  //  Record a search query (call after search completes)
  // ─────────────────────────────────────────────────────────────
  static async recordSearch(query, { entity, resultCount, city } = {}) {
    if (!query || query.trim().length < 2) return;

    const term = query.trim().toLowerCase().substring(0, 80);

    try {
      const pipeline = redis.pipeline ? redis.pipeline() : null;
      const exec = async (cmd, ...args) => {
        if (pipeline) pipeline[cmd](...args);
        else await redis[cmd](...args).catch(() => {});
      };

      // Global trending set
      await exec('zincrby', KEYS.trendingGlobal, 1, term);
      await redis.expire?.(KEYS.trendingGlobal, TTL.TRENDING).catch(() => {});

      // City-level trending
      if (city) {
        await exec('zincrby', KEYS.trendingCity(city), 1, term);
        await redis.expire?.(KEYS.trendingCity(city), TTL.TRENDING).catch(() => {});
      }

      // Category frequency
      if (entity && entity !== 'all') {
        await exec('zincrby', KEYS.trendingCat, 1, entity);
      }

      if (pipeline) await pipeline.exec().catch(() => {});

    } catch (err) {
      // Non-blocking — analytics should never break search
      logger.debug('[Trending] recordSearch error:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Get global trending searches
  //  @returns string[]  e.g. ["iphone 14", "honda activa", ...]
  // ─────────────────────────────────────────────────────────────
  static async getGlobalTrending(limit = 10) {
    try {
      // ZREVRANGE returns members sorted high-score first
      const raw = await redis.zrevrange(KEYS.trendingGlobal, 0, limit - 1);
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Get trending searches for a city
  // ─────────────────────────────────────────────────────────────
  static async getCityTrending(city, limit = 8) {
    if (!city) return this.getGlobalTrending(limit);
    try {
      const raw = await redis.zrevrange(KEYS.trendingCity(city), 0, limit - 1);
      return Array.isArray(raw) && raw.length >= 3
        ? raw
        : this.getGlobalTrending(limit);
    } catch {
      return this.getGlobalTrending(limit);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Get trending categories
  //  @returns Array<{ entity, label, count }>
  // ─────────────────────────────────────────────────────────────
  static async getTrendingCategories(limit = 6) {
    const ENTITY_LABELS = {
      mobiles: 'Mobiles', electronics: 'Electronics', vehicles: 'Vehicles',
      furniture: 'Furniture', fashion: 'Fashion', toys: 'Toys',
      jobs: 'Jobs', properties: 'Properties', services: 'Services',
      sports: 'Sports', books: 'Books', pets: 'Pets',
      beauty: 'Beauty', events: 'Events', collectibles: 'Collectibles',
      forsale: 'For Sale', takecare: 'Care', others: 'Others',
    };

    try {
      const raw = await redis.zrevrangewithscores?.(KEYS.trendingCat, 0, limit - 1)
        ?? await redis.zrevrange(KEYS.trendingCat, 0, limit - 1, 'WITHSCORES');

      if (!Array.isArray(raw)) return [];

      // Upstash returns flat [member, score, member, score, ...]
      const results = [];
      for (let i = 0; i < raw.length; i += 2) {
        const entity = raw[i];
        const count  = Number(raw[i + 1]) || 0;
        if (ENTITY_LABELS[entity]) {
          results.push({ entity, label: ENTITY_LABELS[entity], count });
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Record a listing view (for recently-viewed)
  // ─────────────────────────────────────────────────────────────
  static async recordView(userId, item) {
    if (!userId || !item?._id) return;
    const key = KEYS.recentlyViewed(userId);
    const payload = JSON.stringify({
      _id: item._id,
      _entity: item._entity,
      title: item.title,
      price: item.price,
      currency: item.currency,
      image: Array.isArray(item.images) ? item.images[0] : null,
      viewedAt: new Date().toISOString(),
    });

    try {
      await redis.lpush(key, payload);
      await redis.ltrim(key, 0, 59);           // Keep last 60 items
      await redis.expire(key, TTL.RECENTLY_VIEWED);
    } catch {
      // ignore
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Get recently viewed items for a user
  // ─────────────────────────────────────────────────────────────
  static async getRecentlyViewed(userId, limit = 10) {
    if (!userId) return [];
    try {
      const raw = await redis.lrange(KEYS.recentlyViewed(userId), 0, limit - 1);
      return (raw || []).map(r => {
        try { return JSON.parse(r); } catch { return null; }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Get "similar items" recommendations
  //  Finds items in the same entity + subcategory with similar price.
  //  Uses MongoDB directly (fast, no ES overhead for small result sets).
  // ─────────────────────────────────────────────────────────────
  static async getSimilarItems(item, MODEL_MAP, limit = 10) {
    if (!item || !item._entity) return [];

    const Model = MODEL_MAP[item._entity];
    if (!Model) return [];

    try {
      const filter = {
        status: 'active',
        _id: { $ne: item._id },
      };

      // Match subcategory first (most specific)
      if (item.subcategory) {
        filter.subcategory = item.subcategory;
      }

      // Price similarity: ±50% of item price
      if (item.price && Number(item.price) > 0) {
        const p = Number(item.price);
        filter.price = { $gte: p * 0.5, $lte: p * 2 };
      }

      const docs = await Model.find(filter)
        .select('title price images location subcategory currency createdAt views seller')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return docs.map(d => ({ ...d, _entity: item._entity }));
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Get "you might also like" — cross-category by interest
  //  Looks at user's recently viewed to suggest other categories.
  // ─────────────────────────────────────────────────────────────
  static async getMightAlsoLike(userId, MODEL_MAP, limit = 12) {
    const viewed = await this.getRecentlyViewed(userId, 5);
    if (viewed.length === 0) return [];

    // Collect entity + subcategory pairs from viewed items
    const interests = viewed.reduce((acc, item) => {
      const key = `${item._entity}:${item.subcategory || ''}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topInterest = Object.entries(interests)
      .sort((a, b) => b[1] - a[1])[0];

    if (!topInterest) return [];

    const [entity, subcategory] = topInterest[0].split(':');
    const Model = MODEL_MAP[entity];
    if (!Model) return [];

    try {
      const filter = { status: 'active' };
      if (subcategory) filter.subcategory = subcategory;

      const docs = await Model.find(filter)
        .select('title price images location subcategory currency createdAt views')
        .sort({ views: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      return docs.map(d => ({ ...d, _entity: entity }));
    } catch {
      return [];
    }
  }
}

module.exports = TrendingService;
