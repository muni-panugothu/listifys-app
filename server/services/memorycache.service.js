/**
 * In-Memory L1 Cache Service
 *
 * Sits in front of Upstash Redis (L2) to eliminate HTTP round-trips
 * for hot data. Uses a Map with TTL and LRU eviction.
 *
 * Architecture:
 *   Request → L1 Memory (~0.01ms) → L2 Upstash Redis (~50-200ms) → MongoDB (~100-500ms)
 *
 * Features:
 *   - TTL per entry (auto-expires stale data)
 *   - Max size with LRU eviction (prevents memory leaks)
 *   - Namespace support (separate limits per data type)
 *   - Periodic cleanup of expired entries
 *   - Request coalescing (prevents thundering herd on cache miss)
 *   - Stale-while-revalidate support
 */

const { logger } = require('../utils/logger');

class MemoryCacheService {
  constructor() {
    // Main cache store: key → { value, expiresAt, lastAccessed }
    this._cache = new Map();

    // Request coalescing: key → Promise (in-flight fetches)
    this._inflight = new Map();

    // Config — sized for 10k+ concurrent users
    this._maxSize = 10_000; // max entries (bumped for high-traffic)
    this._cleanupInterval = 15_000; // 15s cleanup interval (aggressive)

    // Stats
    this._stats = { hits: 0, misses: 0, evictions: 0, coalesced: 0 };

    // Start periodic cleanup
    this._timer = setInterval(() => this._cleanup(), this._cleanupInterval);
    if (this._timer.unref) this._timer.unref(); // don't keep process alive
  }

  /**
   * Get a value from memory cache.
   * Returns null if not found or expired.
   */
  get(key) {
    const entry = this._cache.get(key);
    if (!entry) {
      this._stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      this._stats.misses++;
      return null;
    }

    entry.lastAccessed = Date.now();
    this._stats.hits++;
    return entry.value;
  }

  /**
   * Get a value, returning stale data if within grace period.
   * Returns { value, stale: boolean } or null.
   */
  getWithStale(key, graceMs = 30_000) {
    const entry = this._cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    entry.lastAccessed = now;

    if (now <= entry.expiresAt) {
      this._stats.hits++;
      return { value: entry.value, stale: false };
    }

    // Within grace period — return stale data
    if (now <= entry.expiresAt + graceMs) {
      this._stats.hits++;
      return { value: entry.value, stale: true };
    }

    // Beyond grace — expired
    this._cache.delete(key);
    this._stats.misses++;
    return null;
  }

  /**
   * Set a value with TTL (seconds).
   */
  set(key, value, ttlSeconds = 120) {
    // Evict LRU entries if at capacity
    if (this._cache.size >= this._maxSize && !this._cache.has(key)) {
      this._evictLRU();
    }

    this._cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      lastAccessed: Date.now(),
    });
  }

  /**
   * Delete a specific key.
   */
  del(key) {
    return this._cache.delete(key);
  }

  /**
   * Delete all keys matching a prefix.
   */
  delByPrefix(prefix) {
    let count = 0;
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) {
        this._cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Request coalescing — if a fetch for this key is already in flight,
   * return the same Promise instead of launching a duplicate fetch.
   *
   * @param {string} key – cache key
   * @param {Function} fetchFn – async function that fetches the data
   * @param {number} ttlSeconds – TTL for cached result
   * @returns {Promise<any>} – the fetched (or coalesced) value
   */
  async coalesce(key, fetchFn, ttlSeconds = 120) {
    // 1. Check L1 memory
    const cached = this.get(key);
    if (cached !== null) return cached;

    // 2. Check if another request is already fetching this
    if (this._inflight.has(key)) {
      this._stats.coalesced++;
      return this._inflight.get(key);
    }

    // 3. Launch the fetch and register it
    const promise = fetchFn()
      .then((result) => {
        if (result !== null && result !== undefined) {
          this.set(key, result, ttlSeconds);
        }
        this._inflight.delete(key);
        return result;
      })
      .catch((err) => {
        this._inflight.delete(key);
        throw err;
      });

    this._inflight.set(key, promise);
    return promise;
  }

  /**
   * Evict the least recently accessed entries (batch eviction).
   * Evicts 10% of entries at once to avoid frequent O(n) scans.
   */
  _evictLRU() {
    const evictCount = Math.max(1, Math.floor(this._maxSize * 0.1)); // 10% at a time
    const entries = [...this._cache.entries()]
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    for (let i = 0; i < Math.min(evictCount, entries.length); i++) {
      this._cache.delete(entries[i][0]);
      this._stats.evictions++;
    }
  }

  /**
   * Clean up expired entries.
   */
  _cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this._cache) {
      if (now > entry.expiresAt) {
        this._cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`[MemCache] Cleaned ${cleaned} expired entries, ${this._cache.size} remaining`);
    }
  }

  /**
   * Get cache stats.
   */
  getStats() {
    return {
      ...this._stats,
      size: this._cache.size,
      maxSize: this._maxSize,
      inflight: this._inflight.size,
    };
  }

  /**
   * Clear all entries.
   */
  clear() {
    this._cache.clear();
    this._inflight.clear();
  }
}

// Singleton instances for different cache scopes
const responseCache = new MemoryCacheService();  // For HTTP response caching (middleware)
const listingCache = new MemoryCacheService();   // For listing data caching (service layer)

module.exports = { MemoryCacheService, responseCache, listingCache };
