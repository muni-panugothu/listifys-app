/**
 * Listing Cache Service — Upstash Redis
 *
 * Stores individual listing data, image URLs, and search results
 * in Redis with organised, human-readable keys so they are
 * clearly visible in the Upstash Redis dashboard.
 *
 * Key namespaces:
 *   listing:{entity}:{id}                    → full listing JSON
 *   listing:{entity}:{id}:images             → JSON array of image URLs
 *   listing:{entity}:{id}:meta               → lightweight metadata
 *   listing:{entity}:recent                  → latest 20 listing summaries
 *   listing:{entity}:count                   → total active listing count
 *   listing:{entity}:popular                 → most-viewed listings
 *   listing:{entity}:gallery                 → all images in one key
 *
 *   ▼ Human-readable activity keys (visible by product title in Upstash) ▼
 *   posted:{entity}:{product_title}          → new post data + S3 image links
 *   edited:{entity}:{product_title}          → edited product data + changes
 *   saved:{entity}:{product_title}:by:{user} → saved product by user
 *   deleted:{entity}:{product_title}         → deletion record
 *
 *   cache:stats                              → cache hit/miss counters
 */

const redis = require('../config/redis');
const { logger } = require('../utils/logger');
const { listingCache } = require('./memorycache.service.js');

// TTL constants (seconds)
const TTL = {
  LISTING_DETAIL: 600,    // 10 min — individual listing
  LISTING_IMAGES: 1800,   // 30 min — image URLs change less often
  LISTING_META: 900,      // 15 min — lightweight metadata
  RECENT_LIST: 300,       // 5 min  — recent listings list
  POPULAR_LIST: 600,      // 10 min — popular listings
  COUNT: 300,             // 5 min  — total count
  SEARCH_RESULTS: 180,    // 3 min  — search result sets
  CATEGORY_PAGE: 300,     // 5 min  — full category page (default / first load)
  ACTIVITY_LOG: 86400,    // 24 hrs — human-readable activity entries
};

const STALE_TTL_MULTIPLIER = 4;
const REBUILD_LOCK_TTL_SECONDS = 8;

class ListingCacheService {

  // ══════════════════════════════════════════════════════════
  //  Helper: create a human-readable slug from product title
  // ══════════════════════════════════════════════════════════
  static _slugify(title) {
    if (!title) return 'untitled';
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);
  }

  static _ttlWithJitter(baseTtl, jitterPct = 0.2) {
    const spread = Math.max(1, Math.floor(baseTtl * jitterPct));
    const delta = Math.floor(Math.random() * (spread * 2 + 1)) - spread;
    return Math.max(1, baseTtl + delta);
  }

  static _staleKey(key) {
    return `${key}:stale`;
  }

  static _rebuildLockKey(key) {
    return `cache:rebuild:lock:${key}`;
  }

  static async tryAcquireRebuildLock(key, ttlSeconds = REBUILD_LOCK_TTL_SECONDS) {
    const lockKey = this._rebuildLockKey(key);
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const result = await redis.set(lockKey, token, { nx: true, ex: ttlSeconds });
      const acquired = result === 'OK' || result === true;
      return { acquired, lockKey, token };
    } catch (err) {
      logger.error('[Cache] Failed to acquire rebuild lock', { key, error: err.message });
      return { acquired: false, lockKey, token: null };
    }
  }

  static async releaseRebuildLock(lock) {
    if (!lock?.acquired || !lock.lockKey || !lock.token) return;
    try {
      const current = await redis.get(lock.lockKey);
      if (current === lock.token) {
        await redis.del(lock.lockKey);
      }
    } catch (err) {
      logger.warn('[Cache] Failed to release rebuild lock', { lockKey: lock.lockKey, error: err.message });
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Store a full listing in cache
  // ══════════════════════════════════════════════════════════
  static async cacheListing(entity, listing) {
    if (!listing || !listing._id) return;

    const id = listing._id.toString();
    const key = `listing:${entity}:${id}`;
    const staleKey = this._staleKey(key);

    try {
      const now = new Date().toISOString();
      const ops = [];
      const indexKeys = [key];
      const detailTtl = this._ttlWithJitter(TTL.LISTING_DETAIL);

      // L1: Store in memory (half of Redis TTL for freshness)
      listingCache.set(key, listing, Math.floor(TTL.LISTING_DETAIL / 2));

      // L2: Store the full listing in Redis
      const listingPayload = JSON.stringify(listing);
      ops.push(redis.setex(key, detailTtl, listingPayload));
      ops.push(redis.setex(staleKey, detailTtl * STALE_TTL_MULTIPLIER, listingPayload));

      // 2. Store images separately (easy to find in Upstash dashboard)
      if (listing.images && listing.images.length > 0) {
        const imgKey = `${key}:images`;
        ops.push(redis.setex(imgKey, TTL.LISTING_IMAGES, JSON.stringify({
          listingId: id,
          title: listing.title,
          imageCount: listing.images.length,
          imageUrls: listing.images,
          cachedAt: now,
        })));
        indexKeys.push(imgKey);
      }

      // 3. Store lightweight meta (for quick list views)
      const metaKey = `${key}:meta`;
      ops.push(redis.setex(metaKey, TTL.LISTING_META, JSON.stringify({
        _id: id,
        title: listing.title,
        price: listing.price,
        location: listing.location,
        condition: listing.condition,
        category: listing.category || listing.subcategory,
        thumbnail: listing.images?.[0] || null,
        sellerName: listing.sellerName,
        views: listing.views || 0,
        createdAt: listing.createdAt,
        cachedAt: now,
      })));
      indexKeys.push(metaKey);

      // Track keys + execute all writes in parallel
      ops.push(redis.sadd(`listing:${entity}:index`, ...indexKeys));

      await Promise.all(ops);

      logger.info(`[Cache] Stored listing ${entity}:${id} (+ images + meta)`);
      this._incrementStat('cache:writes').catch(() => {});
    } catch (err) {
      logger.error(`[Cache] Error caching listing ${entity}:${id}:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Retrieve a cached listing
  // ══════════════════════════════════════════════════════════
  static async getCachedListing(entity, id) {
    const key = `listing:${entity}:${id}`;
    const staleKey = this._staleKey(key);
    try {
      // L1: Check in-memory cache first (sub-millisecond)
      const memCached = listingCache.get(key);
      if (memCached) {
        await this._incrementStat('cache:hits');
        return memCached;
      }

      // L2: Check Redis with request coalescing
      const data = await listingCache.coalesce(`redis:${key}`, async () => {
        const result = await redis.get(key);
        if (result) {
          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          // Promote to L1
          listingCache.set(key, parsed, Math.floor(TTL.LISTING_DETAIL / 2));
          return parsed;
        }
        return null;
      }, Math.floor(TTL.LISTING_DETAIL / 2));

      if (data) {
        await this._incrementStat('cache:hits');
        return data;
      }

      const staleRaw = await redis.get(staleKey);
      if (staleRaw) {
        const stale = typeof staleRaw === 'string' ? JSON.parse(staleRaw) : staleRaw;
        listingCache.set(key, stale, Math.floor(TTL.LISTING_DETAIL / 4));
        await this._incrementStat('cache:stale_hits');
        return stale;
      }

      await this._incrementStat('cache:misses');
      return null;
    } catch (err) {
      logger.error(`[Cache] Error reading listing ${entity}:${id}:`, err.message);
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Retrieve cached images for a listing
  // ══════════════════════════════════════════════════════════
  static async getCachedImages(entity, id) {
    const key = `listing:${entity}:${id}:images`;
    try {
      const data = await redis.get(key);
      if (data) {
        await this._incrementStat('cache:hits');
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
      await this._incrementStat('cache:misses');
      return null;
    } catch (err) {
      logger.error(`[Cache] Error reading images ${entity}:${id}:`, err.message);
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Cache a list of listings (recent / search results)
  // ══════════════════════════════════════════════════════════
  static async cacheListingList(entity, queryKey, listings, pagination, ttl = TTL.RECENT_LIST) {
    const key = `listing:${entity}:list:${queryKey}`;
    const staleKey = this._staleKey(key);
    try {
      const listTtl = this._ttlWithJitter(ttl);
      const payload = {
        entity,
        query: queryKey,
        listingCount: listings.length,
        pagination,
        // Store summaries (not full docs) to save Redis memory
        listings: listings.map((l) => ({
          _id: l._id,
          title: l.title,
          price: l.price,
          currency: l.currency,
          location: l.location,
          condition: l.condition,
          category: l.category || l.subcategory,
          subcategory: l.subcategory,
          thumbnail: l.images?.[0] || null,
          images: l.images || [],
          sellerName: l.sellerName,
          seller: l.seller,
          views: l.views || 0,
          features: l.features,
          phone: l.phone,
          status: l.status,
          savedBy: l.savedBy,
          createdAt: l.createdAt,
          // Vehicle-specific
          brand: l.brand,
          model: l.model,
          year: l.year,
          fuelType: l.fuelType,
          transmission: l.transmission,
          kmDriven: l.kmDriven,
        })),
        cachedAt: new Date().toISOString(),
      };

      // L1: Store in memory
      listingCache.set(key, payload, Math.floor(listTtl / 2));

      // L2: Store in Redis
      const body = JSON.stringify(payload);
      await Promise.all([
        redis.setex(key, listTtl, body),
        redis.setex(staleKey, listTtl * STALE_TTL_MULTIPLIER, body),
      ]);
      await redis.sadd(`listing:${entity}:index`, key);

      logger.info(`[Cache] Stored listing list ${entity}:${queryKey} (${listings.length} items)`);
      await this._incrementStat('cache:writes');
    } catch (err) {
      logger.error(`[Cache] Error caching list ${entity}:${queryKey}:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Retrieve a cached listing list
  // ══════════════════════════════════════════════════════════
  static async getCachedListingList(entity, queryKey) {
    const key = `listing:${entity}:list:${queryKey}`;
    const staleKey = this._staleKey(key);
    try {
      // L1: Check in-memory cache (sub-millisecond)
      const memCached = listingCache.get(key);
      if (memCached) {
        await this._incrementStat('cache:hits');
        return memCached;
      }

      // L2: Check Redis with request coalescing
      const data = await listingCache.coalesce(`redis:${key}`, async () => {
        const result = await redis.get(key);
        if (result) {
          const parsed = typeof result === 'string' ? JSON.parse(result) : result;
          // Promote to L1
          listingCache.set(key, parsed, Math.floor(TTL.RECENT_LIST / 2));
          return parsed;
        }
        return null;
      }, Math.floor(TTL.RECENT_LIST / 2));

      if (data) {
        await this._incrementStat('cache:hits');
        return data;
      }

      const staleRaw = await redis.get(staleKey);
      if (staleRaw) {
        const stale = typeof staleRaw === 'string' ? JSON.parse(staleRaw) : staleRaw;
        listingCache.set(key, stale, Math.floor(TTL.RECENT_LIST / 4));
        await this._incrementStat('cache:stale_hits');
        return stale;
      }

      await this._incrementStat('cache:misses');
      return null;
    } catch (err) {
      logger.error(`[Cache] Error reading list ${entity}:${queryKey}:`, err.message);
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Cache uploaded image URLs after S3 upload
  // ══════════════════════════════════════════════════════════
  static async cacheUploadedImages(entity, userId, imageUrls) {
    const key = `images:uploaded:${entity}:${userId}:${Date.now()}`;
    try {
      await redis.setex(key, TTL.LISTING_IMAGES, JSON.stringify({
        userId,
        entity,
        imageUrls,
        uploadedAt: new Date().toISOString(),
      }));
      logger.info(`[Cache] Cached ${imageUrls.length} uploaded images for user ${userId}`);
    } catch (err) {
      logger.error(`[Cache] Error caching uploaded images:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Cache search results
  // ══════════════════════════════════════════════════════════
  static async cacheSearchResults(entity, cacheKey, results, pagination) {
    const key = typeof cacheKey === 'string' && cacheKey.startsWith('search:')
      ? cacheKey
      : `search:${entity}:${(cacheKey || '').toLowerCase().trim().replace(/\s+/g, '_')}`;
    const staleKey = this._staleKey(key);
    try {
      const queryText = typeof cacheKey === 'string'
        ? cacheKey.replace(/^search:[^:]+:/, '').replace(/_/g, ' ')
        : String(cacheKey || '').toLowerCase().trim();
      const searchTtl = this._ttlWithJitter(TTL.SEARCH_RESULTS);
      const payload = JSON.stringify({
        entity,
        query: queryText,
        resultCount: results.length,
        pagination,
        results: results.map((r) => ({
          _id: r._id,
          _entity: r._entity,
          title: r.title,
          slug: r.slug,
          price: r.price,
          location: r.location,
          thumbnail: r.images?.[0] || null,
          images: r.images || [],
          condition: r.condition,
          sellerName: r.sellerName,
          seller: r.seller,
          views: r.views,
          features: r.features,
          phone: r.phone,
          savedBy: r.savedBy,
          brand: r.brand,
          model: r.model,
          year: r.year,
          fuelType: r.fuelType,
          transmission: r.transmission,
          kmDriven: r.kmDriven,
          currency: r.currency,
          subcategory: r.subcategory,
          createdAt: r.createdAt,
        })),
        cachedAt: new Date().toISOString(),
      });
      await Promise.all([
        redis.setex(key, searchTtl, payload),
        redis.setex(staleKey, searchTtl * STALE_TTL_MULTIPLIER, payload),
      ]);
      await redis.sadd(`listing:${entity}:index`, key);
      logger.info(`[Cache] Cached search "${queryText}" for ${entity} (${results.length} results)`);
    } catch (err) {
      logger.error(`[Cache] Error caching search results:`, err.message);
    }
  }

  static async getCachedSearchResults(entity, cacheKey) {
    const key = typeof cacheKey === 'string' && cacheKey.startsWith('search:')
      ? cacheKey
      : `search:${entity}:${(cacheKey || '').toLowerCase().trim().replace(/\s+/g, '_')}`;
    const staleKey = this._staleKey(key);
    try {
      // L1: Check memory
      const memCached = listingCache.get(key);
      if (memCached) {
        await this._incrementStat('cache:hits');
        return memCached;
      }

      // L2: Check Redis
      const data = await redis.get(key);
      if (data) {
        await this._incrementStat('cache:hits');
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        listingCache.set(key, parsed, Math.floor(TTL.SEARCH_RESULTS / 2));
        return parsed;
      }

      const staleRaw = await redis.get(staleKey);
      if (staleRaw) {
        await this._incrementStat('cache:stale_hits');
        const stale = typeof staleRaw === 'string' ? JSON.parse(staleRaw) : staleRaw;
        listingCache.set(key, stale, Math.floor(TTL.SEARCH_RESULTS / 4));
        return stale;
      }

      await this._incrementStat('cache:misses');
      return null;
    } catch (err) {
      logger.error(`[Cache] Error reading search cache:`, err.message);
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Prefetch & cache all listings + images for a category page
  //  Called on the FIRST request to a category — subsequent
  //  requests hit cache instantly.
  // ══════════════════════════════════════════════════════════
  static async prefetchCategoryListings(entity, listings) {
    if (!listings || listings.length === 0) return;

    try {
      const now = new Date().toISOString();
      const indexKeys = [];

      // Fire ALL Redis writes in a single Promise.all — no sequential awaits
      const cacheOps = [];

      for (const listing of listings) {
        const id = (listing._id || listing.id)?.toString();
        if (!id) continue;

        // Full listing
        const key = `listing:${entity}:${id}`;
        cacheOps.push(redis.setex(key, TTL.LISTING_DETAIL, JSON.stringify(listing)));
        indexKeys.push(key);

        // Images separately (for fast image-only lookups)
        if (listing.images && listing.images.length > 0) {
          const imgKey = `${key}:images`;
          cacheOps.push(redis.setex(imgKey, TTL.LISTING_IMAGES, JSON.stringify({
            listingId: id,
            title: listing.title,
            imageCount: listing.images.length,
            imageUrls: listing.images,
            s3Folder: entity,
            cachedAt: now,
          })));
          indexKeys.push(imgKey);
        }

        // Lightweight meta
        const metaKey = `${key}:meta`;
        cacheOps.push(redis.setex(metaKey, TTL.LISTING_META, JSON.stringify({
          _id: id,
          title: listing.title,
          price: listing.price,
          location: listing.location,
          condition: listing.condition,
          category: listing.category || listing.subcategory,
          thumbnail: listing.images?.[0] || null,
          sellerName: listing.sellerName,
          views: listing.views || 0,
          createdAt: listing.createdAt,
          cachedAt: now,
        })));
        indexKeys.push(metaKey);
      }

      // Gallery key
      const galleryKey = `listing:${entity}:gallery`;
      const gallery = listings
        .filter((l) => l.images && l.images.length > 0)
        .map((l) => ({
          listingId: (l._id || l.id)?.toString(),
          title: l.title,
          images: l.images,
        }));
      cacheOps.push(redis.setex(galleryKey, TTL.CATEGORY_PAGE, JSON.stringify({
        entity,
        totalListings: listings.length,
        totalImages: gallery.reduce((sum, g) => sum + g.images.length, 0),
        gallery,
        cachedAt: now,
      })));
      indexKeys.push(galleryKey);

      // Track all keys in one call
      if (indexKeys.length > 0) {
        cacheOps.push(redis.sadd(`listing:${entity}:index`, ...indexKeys));
      }

      // Execute ALL Redis writes in parallel
      await Promise.all(cacheOps);

      logger.info(`[Cache] Prefetched ${listings.length} ${entity} listings (${cacheOps.length} ops)`);
      await this._incrementStat('cache:writes');
    } catch (err) {
      logger.error(`[Cache] Prefetch error for ${entity}:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Get the cached image gallery for a category
  // ══════════════════════════════════════════════════════════
  static async getCategoryGallery(entity) {
    const key = `listing:${entity}:gallery`;
    try {
      const data = await redis.get(key);
      if (data) {
        await this._incrementStat('cache:hits');
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
      await this._incrementStat('cache:misses');
      return null;
    } catch (err) {
      logger.error(`[Cache] Error reading gallery for ${entity}:`, err.message);
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Invalidate only LIST / aggregate caches for an entity
  //  Use this after create/update so the individual listing
  //  cache survives but stale list pages are refreshed.
  // ══════════════════════════════════════════════════════════
  static async invalidateListCaches(entity) {
    try {
      // L1: Clear memory cache for this entity's list/search keys
      listingCache.delByPrefix(`listing:${entity}:list:`);
      listingCache.delByPrefix(`listing:${entity}:gallery`);
      listingCache.delByPrefix(`search:${entity}:`);
      listingCache.delByPrefix(`redis:listing:${entity}:list:`);
      listingCache.delByPrefix(`redis:search:${entity}:`);

      // L2: Only delete aggregate keys — NOT individual listing keys
      const indexKey = `listing:${entity}:index`;
      const keys = await redis.smembers(indexKey);
      if (keys && keys.length > 0) {
        // Only remove list:* keys, search:* keys, gallery, count, recent, popular
        const listKeys = keys.filter(k =>
          k.includes(':list:') ||
          k.includes(':gallery') ||
          k.startsWith('search:')
        );
        for (const key of listKeys) {
          await redis.del(key);
          await redis.srem(indexKey, key);
        }
      }

      // Clear aggregate keys
      await Promise.all([
        redis.del(`listing:${entity}:count`),
        redis.del(`listing:${entity}:recent`),
        redis.del(`listing:${entity}:popular`),
        redis.del(`listing:${entity}:gallery`),
      ]);

      logger.info(`[Cache] Invalidated list caches for entity: ${entity}`);
    } catch (err) {
      logger.error(`[Cache] List invalidation error for ${entity}:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Invalidate all caches for an entity (or a specific listing)
  // ══════════════════════════════════════════════════════════
  static async invalidateListingCache(entity, id = null) {
    try {
      // L1: Clear all memory cache for this entity
      listingCache.delByPrefix(`listing:${entity}:`);
      listingCache.delByPrefix(`redis:listing:${entity}:`);
      listingCache.delByPrefix(`search:${entity}:`);
      listingCache.delByPrefix(`redis:search:${entity}:`);

      if (id) {
        // Delete specific listing caches
        await Promise.all([
          redis.del(`listing:${entity}:${id}`),
          redis.del(`listing:${entity}:${id}:images`),
          redis.del(`listing:${entity}:${id}:meta`),
        ]);
        logger.info(`[Cache] Invalidated listing ${entity}:${id}`);
      }

      // Delete all tracked keys for this entity
      const indexKey = `listing:${entity}:index`;
      const keys = await redis.smembers(indexKey);
      if (keys && keys.length > 0) {
        for (const key of keys) {
          await redis.del(key);
        }
        await redis.del(indexKey);
      }

      // Clear common keys
      await Promise.all([
        redis.del(`listing:${entity}:count`),
        redis.del(`listing:${entity}:recent`),
        redis.del(`listing:${entity}:popular`),
        redis.del(`listing:${entity}:gallery`),
      ]);

      logger.info(`[Cache] Full cache invalidation for entity: ${entity}`);
    } catch (err) {
      logger.error(`[Cache] Invalidation error for ${entity}:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  LOG: New product posted
  //  Key pattern → posted:{entity}:{product-title-slug}
  //  Visible in Upstash with the product name!
  // ══════════════════════════════════════════════════════════
  static async logProductPosted(entity, listing) {
    if (!listing) return;
    const id = (listing._id || listing.id)?.toString();
    const slug = this._slugify(listing.title);
    const key = `posted:${entity}:${slug}`;

    try {
      const payload = {
        action: 'POSTED',
        entity,
        listingId: id,
        title: listing.title,
        price: listing.price,
        condition: listing.condition || 'Good',
        category: listing.category,
        subcategory: listing.subcategory,
        location: listing.location,
        sellerName: listing.sellerName,
        phone: listing.phone,
        imageCount: listing.images?.length || 0,
        s3ImageUrls: listing.images || [],
        mongoDbId: id,
        storedIn: {
          mongoDB: true,
          awsS3: listing.images?.length > 0,
          upstashRedis: true,
        },
        postedAt: listing.createdAt || new Date().toISOString(),
        cachedAt: new Date().toISOString(),
      };

      // Vehicle-specific fields
      if (entity === 'vehicles') {
        payload.brand = listing.brand;
        payload.model = listing.model;
        payload.year = listing.year;
        payload.fuelType = listing.fuelType;
        payload.transmission = listing.transmission;
        payload.kmDriven = listing.kmDriven;
        payload.ownership = listing.ownership;
      }

      await redis.setex(key, TTL.ACTIVITY_LOG, JSON.stringify(payload));
      logger.info(`[Cache] 📝 Activity logged — POSTED ${entity}: "${listing.title}" (key: ${key})`);
    } catch (err) {
      logger.error(`[Cache] Error logging post activity:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  LOG: Product edited / updated
  //  Key pattern → edited:{entity}:{product-title-slug}
  // ══════════════════════════════════════════════════════════
  static async logProductEdited(entity, oldListing, updatedListing) {
    if (!updatedListing) return;
    const id = (updatedListing._id || updatedListing.id)?.toString();
    const slug = this._slugify(updatedListing.title);
    const key = `edited:${entity}:${slug}`;

    try {
      // Detect which fields actually changed
      const changes = {};
      const trackFields = [
        'title', 'price', 'description', 'condition', 'location',
        'phone', 'category', 'subcategory', 'brand', 'model',
        'year', 'fuelType', 'transmission', 'kmDriven', 'ownership',
      ];

      for (const field of trackFields) {
        const oldVal = oldListing?.[field];
        const newVal = updatedListing[field];
        if (oldVal !== undefined && newVal !== undefined && String(oldVal) !== String(newVal)) {
          changes[field] = { from: oldVal, to: newVal };
        }
      }

      // Detect image changes
      const oldImages = oldListing?.images || [];
      const newImages = updatedListing.images || [];
      const imagesChanged = JSON.stringify(oldImages) !== JSON.stringify(newImages);

      const payload = {
        action: 'EDITED',
        entity,
        listingId: id,
        title: updatedListing.title,
        price: updatedListing.price,
        fieldsChanged: Object.keys(changes),
        changes,
        imagesUpdated: imagesChanged,
        oldImageCount: oldImages.length,
        newImageCount: newImages.length,
        s3ImageUrls: newImages,
        mongoDbId: id,
        storedIn: {
          mongoDB: 'updated',
          awsS3: imagesChanged ? 'updated' : 'unchanged',
          upstashRedis: 'updated',
        },
        editedAt: new Date().toISOString(),
      };

      await redis.setex(key, TTL.ACTIVITY_LOG, JSON.stringify(payload));
      logger.info(`[Cache] ✏️  Activity logged — EDITED ${entity}: "${updatedListing.title}" (${Object.keys(changes).length} fields changed)`);
    } catch (err) {
      logger.error(`[Cache] Error logging edit activity:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  LOG: Product saved by user
  //  Key pattern → saved:{entity}:{product-title-slug}:by:{userId}
  // ══════════════════════════════════════════════════════════
  static async logProductSaved(entity, listing, userId, saved) {
    if (!listing) return;
    const slug = this._slugify(listing.title);
    const action = saved ? 'SAVED' : 'UNSAVED';
    const prefix = saved ? 'saved' : 'unsaved';
    const key = `${prefix}:${entity}:${slug}:by:${userId}`;

    try {
      const payload = {
        action,
        entity,
        listingId: (listing._id || listing.id)?.toString(),
        title: listing.title,
        price: listing.price,
        userId: userId.toString(),
        thumbnail: listing.images?.[0] || null,
        timestamp: new Date().toISOString(),
      };

      if (saved) {
        await redis.setex(key, TTL.ACTIVITY_LOG, JSON.stringify(payload));
      } else {
        // Remove saved key if unsaved
        await redis.del(`saved:${entity}:${slug}:by:${userId}`);
        await redis.setex(key, TTL.ACTIVITY_LOG, JSON.stringify(payload));
      }

      logger.info(`[Cache] ${saved ? '❤️' : '💔'} Activity logged — ${action} ${entity}: "${listing.title}" by user ${userId}`);
    } catch (err) {
      logger.error(`[Cache] Error logging save activity:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  LOG: Product deleted
  //  Key pattern → deleted:{entity}:{product-title-slug}
  // ══════════════════════════════════════════════════════════
  static async logProductDeleted(entity, listing) {
    if (!listing) return;
    const slug = this._slugify(listing.title);
    const key = `deleted:${entity}:${slug}`;

    try {
      await redis.setex(key, TTL.ACTIVITY_LOG, JSON.stringify({
        action: 'DELETED',
        entity,
        listingId: (listing._id || listing.id)?.toString(),
        title: listing.title,
        price: listing.price,
        sellerName: listing.sellerName,
        hadImages: (listing.images?.length || 0) > 0,
        imageCount: listing.images?.length || 0,
        deletedAt: new Date().toISOString(),
      }));
      logger.info(`[Cache] 🗑️  Activity logged — DELETED ${entity}: "${listing.title}"`);
    } catch (err) {
      logger.error(`[Cache] Error logging delete activity:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Cache stats (visible in Upstash dashboard under cache:stats)
  // ══════════════════════════════════════════════════════════
  static async getStats() {
    try {
      const [hits, misses, writes] = await Promise.all([
        redis.get('cache:hits'),
        redis.get('cache:misses'),
        redis.get('cache:writes'),
      ]);

      const totalHits = parseInt(hits) || 0;
      const totalMisses = parseInt(misses) || 0;
      const totalWrites = parseInt(writes) || 0;
      const total = totalHits + totalMisses;
      const hitRate = total > 0 ? ((totalHits / total) * 100).toFixed(1) : '0.0';

      return {
        hits: totalHits,
        misses: totalMisses,
        writes: totalWrites,
        total,
        hitRate: `${hitRate}%`,
        memoryCache: listingCache.getStats(),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('[Cache] Error reading stats:', err.message);
      return { hits: 0, misses: 0, writes: 0, total: 0, hitRate: '0%' };
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Internal: increment a stat counter
  // ══════════════════════════════════════════════════════════
  static async _incrementStat(key) {
    try {
      const val = await redis.incr(key);
      // Set a 24h TTL on first write so stats auto-reset daily
      if (val === 1) await redis.expire(key, 86400);
    } catch {
      // non-critical
    }
  }
}

module.exports = ListingCacheService;
