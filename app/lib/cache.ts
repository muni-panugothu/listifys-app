/**
 * Simple in-memory cache with TTL, modeled after the Redis caching
 * strategy in the backend (server/services/listingcache.service.js).
 *
 * Used on the React Native client to avoid redundant API calls for
 * frequently accessed listing data (feed, category listings, detail).
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 200;

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.timestamp > entry.ttl) {
      store.delete(key);
    }
  }
}

function evictOldest() {
  if (store.size <= MAX_ENTRIES) return;
  // Delete oldest entries until we're under the limit
  const entries = Array.from(store.entries()).sort(
    ([, a], [, b]) => a.timestamp - b.timestamp,
  );
  const toRemove = entries.slice(0, store.size - MAX_ENTRIES + 10);
  for (const [key] of toRemove) {
    store.delete(key);
  }
}

/** Get cached value. Returns undefined if expired or missing. */
export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > entry.ttl) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

/** Set a value in cache with a TTL in milliseconds. */
export function setCache<T>(key: string, data: T, ttlMs: number) {
  evictExpired();
  evictOldest();
  store.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

/** Invalidate a specific cache key or all keys matching a prefix. */
export function invalidateCache(keyOrPrefix: string) {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
    return;
  }
  // Prefix match
  for (const key of store.keys()) {
    if (key.startsWith(keyOrPrefix)) {
      store.delete(key);
    }
  }
}

/** Clear all cached data. */
export function clearAllCache() {
  store.clear();
}

/**
 * Wrap an async function with caching. If the cache has a fresh value,
 * return it immediately. Otherwise, call the fetcher, cache the result,
 * and return it.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;

  const data = await fetcher();
  setCache(key, data, ttlMs);
  return data;
}

// ── Cache key builders (match backend cache key patterns) ─────────────────────

export const cacheKeys = {
  feed: (page?: number) => `feed:home:${page ?? 1}`,
  categoryList: (slug: string, page?: number) => `list:${slug}:${page ?? 1}`,
  listingDetail: (slug: string, id: string) => `detail:${slug}:${id}`,
  myListings: () => "my-listings",
  savedListings: () => "saved-listings",
  conversations: () => "conversations",
};
