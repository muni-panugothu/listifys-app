/**
 * Redis-backed store for express-rate-limit.
 * Uses Upstash Redis for distributed rate limit state across cluster workers.
 * Falls back gracefully if Redis is unavailable — allows requests through.
 */
const redis = require('../config/redis');
const { logger } = require('../utils/logger');

class RedisRateLimitStore {
  constructor(windowMs, prefix = 'erl:', options = {}) {
    this.windowMs = windowMs;
    this.prefix = prefix;
    this.failClosed = Boolean(options.failClosed);
  }

  // Required by express-rate-limit v7+
  init(/* options */) {}

  _key(key) {
    return `${this.prefix}${key}`;
  }

  async increment(key) {
    try {
      const redisKey = this._key(key);
      const totalHits = await redis.incr(redisKey);

      if (totalHits === 1) {
        await redis.expire(redisKey, Math.ceil(this.windowMs / 1000));
      }

      const ttl = await redis.ttl(redisKey);
      const resetTime = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : this.windowMs));

      return { totalHits, resetTime };
    } catch (err) {
      if (this.failClosed) {
        logger.error('RedisRateLimitStore increment error — failing closed:', err.message);
        return {
          totalHits: Number.MAX_SAFE_INTEGER,
          resetTime: new Date(Date.now() + this.windowMs),
        };
      }

      logger.error('RedisRateLimitStore increment error — failing open:', err.message);
      return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    try {
      const redisKey = this._key(key);
      const [currentRaw, ttl] = await Promise.all([
        redis.get(redisKey),
        redis.ttl(redisKey),
      ]);

      const current = Number.parseInt(currentRaw, 10);
      if (!Number.isFinite(current) || current <= 0) {
        return;
      }

      const nextValue = current - 1;

      if (nextValue <= 0) {
        await redis.del(redisKey);
        return;
      }

      const ttlSeconds = ttl > 0 ? ttl : Math.ceil(this.windowMs / 1000);
      await redis.setex(redisKey, ttlSeconds, String(nextValue));
    } catch {
      // Non-critical — fail silently
    }
  }

  async resetKey(key) {
    try {
      await redis.del(this._key(key));
    } catch {
      // Non-critical
    }
  }
}

module.exports = RedisRateLimitStore;
