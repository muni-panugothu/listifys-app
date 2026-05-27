const { Redis } = require('@upstash/redis');
const { logger } = require('../utils/logger');

// Trim env vars to handle spaces around "=" in .env files
const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
const REDIS_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

let redis;

// ── In-memory Redis fallback with real TTL support ─────────────────────────
// When Upstash credentials are missing OR the daily quota is exhausted the
// proxy falls back to this store.  Unlike the old no-op stub this one
// actually persists data in-process so that auth/OTP/reset flows keep
// working.  NOTE: state is per-process — cluster.js forces single-worker
// mode when Redis is unconfigured so there is no cross-worker drift.
function createInMemoryFallback() {
  const store = new Map();   // key → { value, expiresAt }

  const _now = () => Date.now();

  const _alive = (entry) => {
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt <= _now()) {
      return false;
    }
    return true;
  };

  const _get = (key) => {
    const e = store.get(key);
    if (!e) return undefined;
    if (!_alive(e)) { store.delete(key); return undefined; }
    return e;
  };

  const _set = (key, value, ttlSeconds) => {
    store.set(key, {
      value,
      expiresAt: Number.isFinite(ttlSeconds) ? _now() + ttlSeconds * 1000 : null,
    });
  };

  // Lazy GC — runs at most once per 30 s when a read/write happens
  let _lastGC = _now();
  const _maybeGC = () => {
    if (_now() - _lastGC < 30_000) return;
    _lastGC = _now();
    for (const [k, e] of store) {
      if (e.expiresAt && e.expiresAt <= _now()) store.delete(k);
    }
  };

  return {
    _stub: true,
    __quotaStats: { used: 0, limit: 0, exhausted: true },

    // ── String commands ────────────────────────────────────────────
    get: async (key) => { _maybeGC(); const e = _get(key); return e ? e.value : null; },

    set: async (key, value, opts) => {
      _maybeGC();
      if (opts && typeof opts === 'object') {
        if (opts.nx && _get(key)) return null;
        if (opts.xx && !_get(key)) return null;
        _set(key, value, opts.ex);
      } else {
        _set(key, value, undefined);
      }
      return 'OK';
    },

    setex: async (key, seconds, value) => { _maybeGC(); _set(key, value, seconds); return 'OK'; },

    del: async (...keys) => {
      let c = 0;
      for (const k of keys.flat()) { if (store.delete(k)) c++; }
      return c;
    },

    incr: async (key) => {
      _maybeGC();
      const e = _get(key);
      const next = (Number(e?.value) || 0) + 1;
      store.set(key, { value: String(next), expiresAt: e?.expiresAt || null });
      return next;
    },

    expire: async (key, seconds) => {
      const e = _get(key);
      if (!e) return 0;
      e.expiresAt = _now() + seconds * 1000;
      return 1;
    },

    ttl: async (key) => {
      const e = _get(key);
      if (!e) return -2;
      if (!e.expiresAt) return -1;
      return Math.max(0, Math.ceil((e.expiresAt - _now()) / 1000));
    },

    ping: async () => 'PONG',
    info: async () => '# In-memory fallback',

    exists: async (...keys) => keys.flat().reduce((n, k) => n + (_get(k) ? 1 : 0), 0),

    keys: async (pattern = '*') => {
      _maybeGC();
      const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').split('*').join('.*') + '$');
      const out = [];
      for (const [k] of store) { if (re.test(k) && _get(k)) out.push(k); }
      return out;
    },

    mget: async (...keys) => keys.flat().map((k) => { const e = _get(k); return e ? e.value : null; }),

    // ── Hash commands (simple Object per key) ──────────────────────
    hset: async (key, obj) => { const cur = store.get(key)?.value || {}; store.set(key, { value: { ...cur, ...obj }, expiresAt: null }); return Object.keys(obj).length; },
    hget: async (key, field) => { const e = _get(key); return e?.value?.[field] ?? null; },
    hgetall: async (key) => { const e = _get(key); return e?.value && typeof e.value === 'object' ? e.value : null; },
    hdel: async (key, ...fields) => {
      const e = _get(key); if (!e || typeof e.value !== 'object') return 0;
      let c = 0; for (const f of fields.flat()) { if (f in e.value) { delete e.value[f]; c++; } }
      return c;
    },

    // ── List commands ──────────────────────────────────────────────
    lpush: async (key, ...vals) => {
      const e = _get(key); const arr = Array.isArray(e?.value) ? e.value : [];
      arr.unshift(...vals.flat()); store.set(key, { value: arr, expiresAt: e?.expiresAt || null });
      return arr.length;
    },
    lrange: async (key, start, stop) => {
      const e = _get(key); const arr = Array.isArray(e?.value) ? e.value : [];
      return arr.slice(start, stop < 0 ? arr.length + stop + 1 : stop + 1);
    },

    // ── Set commands ──────────────────────────────────────────────
    setnx: async (key, value) => { if (_get(key)) return 0; _set(key, value); return 1; },
    sadd: async (key, ...vals) => {
      const e = _get(key); const s = e?.value instanceof Set ? e.value : new Set();
      let c = 0; for (const v of vals.flat()) { if (!s.has(v)) { s.add(v); c++; } }
      store.set(key, { value: s, expiresAt: e?.expiresAt || null }); return c;
    },
    srem: async (key, ...vals) => {
      const e = _get(key); if (!(e?.value instanceof Set)) return 0;
      let c = 0; for (const v of vals.flat()) { if (e.value.delete(v)) c++; }
      return c;
    },
    smembers: async (key) => { const e = _get(key); return e?.value instanceof Set ? [...e.value] : []; },

    scan: async () => ['0', []],
  };
}

const fallbackStub = createInMemoryFallback();

if (!REDIS_URL || !REDIS_TOKEN) {
  logger.warn('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not defined — Redis disabled, using in-memory fallback');

  // Multi-instance safety check — in-memory fallback is per-process only.
  // Auth tokens, OTP codes, rate-limits will diverge across replicas.
  const workerCount = parseInt(process.env.WEB_CONCURRENCY, 10) || 0;
  if (workerCount > 1) {
    logger.error(
      '🚨 CRITICAL: WEB_CONCURRENCY=%d but Redis is unavailable. ' +
      'In-memory fallback is NOT shared across workers — auth, OTP, and ' +
      'rate-limiting will be inconsistent. Configure Upstash Redis or set WEB_CONCURRENCY=1.',
      workerCount
    );
  }

  redis = fallbackStub;
} else {
  // Create Redis client with production settings
  const rawRedis = new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
    automaticRetry: true,
    enableAutoPipelining: true,
  });

  // Wrap in a proxy to catch exhausted quotas and shim missing commands
  let quotaReached = false;

  // ── Proactive quota monitoring ───────────────────────────────────────────
  const DAILY_REQUEST_LIMIT = parseInt(process.env.UPSTASH_DAILY_LIMIT, 10) || 10_000;
  // Divide limit by expected worker count so per-process alerts fire at the
  // correct global thresholds.  In cluster mode each worker only sees its own
  // traffic, so the per-process ceiling must be proportional.
  const WORKER_COUNT = parseInt(process.env.WEB_CONCURRENCY, 10) || require('os').cpus().length;
  const PER_PROCESS_LIMIT = Math.max(1, Math.floor(DAILY_REQUEST_LIMIT / Math.min(WORKER_COUNT, 8)));
  let dailyRequestCount = 0;
  let quotaWarned75 = false;
  let quotaWarned90 = false;
  let lastResetDate = new Date().toDateString();

  function trackRequest() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
      dailyRequestCount = 0;
      quotaWarned75 = false;
      quotaWarned90 = false;
      quotaReached = false;
      lastResetDate = today;
    }
    dailyRequestCount++;

    const pct = dailyRequestCount / PER_PROCESS_LIMIT;
    if (pct >= 0.9 && !quotaWarned90) {
      quotaWarned90 = true;
      logger.error('⚠️ Upstash Redis at ~90% daily quota (this worker)', {
        workerUsed: dailyRequestCount,
        perProcessLimit: PER_PROCESS_LIMIT,
        globalLimit: DAILY_REQUEST_LIMIT,
      });
    } else if (pct >= 0.75 && !quotaWarned75) {
      quotaWarned75 = true;
      logger.warn('⚠️ Upstash Redis at ~75% daily quota (this worker)', {
        workerUsed: dailyRequestCount,
        perProcessLimit: PER_PROCESS_LIMIT,
        globalLimit: DAILY_REQUEST_LIMIT,
      });
    }
  }

  // Expose quota stats for /metrics endpoint
  redis = {}; // placeholder, assigned below via Proxy

  redis = new Proxy(rawRedis, {
    get(target, prop) {
      // Expose quota stats
      if (prop === '__quotaStats') {
        return { used: dailyRequestCount, limit: DAILY_REQUEST_LIMIT, exhausted: quotaReached };
      }
      // Shim: Upstash SDK doesn't expose setex(key, seconds, value).
      // Translate to set(key, value, { ex: seconds }).
      if (prop === 'setex') {
        return async (key, seconds, value) => {
          if (quotaReached) return fallbackStub.setex(key, seconds, value);
          trackRequest();
          try {
            return await target.set(key, value, { ex: seconds });
          } catch (err) {
            if (err.message && err.message.includes('max requests limit exceeded')) {
              if (!quotaReached) {
                logger.error('❌ Upstash Redis Quota Exceeded! Switching to resilient in-memory fallback.');
                quotaReached = true;
              }
              return fallbackStub.setex(key, seconds, value);
            }
            throw err;
          }
        };
      }

      // Shim: ioredis-style set(key, value, "EX", seconds) → Upstash set(key, value, { ex })
      if (prop === 'set') {
        return async (key, value, ...rest) => {
          if (quotaReached) return fallbackStub.set(key, value, ...rest);
          trackRequest();
          let opts = rest[0];
          // Detect ioredis positional args: set(key, value, "EX", seconds [, "NX"/"XX"])
          if (typeof opts === 'string' && opts.toUpperCase() === 'EX') {
            const seconds = rest[1];
            const extra = rest[2];
            opts = { ex: seconds };
            if (typeof extra === 'string') {
              opts[extra.toLowerCase()] = true;
            }
          }
          try {
            return await target.set(key, value, opts);
          } catch (err) {
            if (err.message && err.message.includes('max requests limit exceeded')) {
              if (!quotaReached) {
                logger.error('❌ Upstash Redis Quota Exceeded! Switching to resilient in-memory fallback.');
                quotaReached = true;
              }
              return fallbackStub.set(key, value, ...rest);
            }
            throw err;
          }
        };
      }

      if (typeof target[prop] === 'function') {
        return async (...args) => {
          if (quotaReached && fallbackStub[prop]) {
            return fallbackStub[prop](...args);
          }
          trackRequest();
          try {
            return await target[prop](...args);
          } catch (err) {
            if (err.message && err.message.includes('max requests limit exceeded')) {
              if (!quotaReached) {
                logger.error('❌ Upstash Redis Quota Exceeded! Switching to resilient in-memory fallback.');
                quotaReached = true;
              }
              if (fallbackStub[prop]) return fallbackStub[prop](...args);
              return null;
            }
            // Transient network errors — fallback gracefully instead of crashing
            if (err.message && (
              err.message.includes('fetch failed') ||
              err.message.includes('ECONNREFUSED') ||
              err.message.includes('ETIMEDOUT') ||
              err.message.includes('ENOTFOUND') ||
              err.code === 'UND_ERR_CONNECT_TIMEOUT'
            )) {
              logger.warn('Upstash Redis transient error, using fallback', { method: prop, error: err.message });
              if (fallbackStub[prop]) return fallbackStub[prop](...args);
              return null;
            }
            throw err;
          }
        };
      }
      return target[prop];
    }
  });

  // Test connection on startup (non-blocking)
  (async () => {
    try {
      await redis.ping();
      logger.info('Upstash Redis connected successfully');
    } catch (error) {
      logger.error('Upstash Redis connection failed', { error: error.message });
      logger.warn('Redis connection failed — continuing without Redis. Token management will be limited.');
    }
  })();
}

module.exports = redis;