'use strict';
/**
 * ── Circuit Breaker ─────────────────────────────────────────────────────────
 * Production-grade circuit breaker pattern (Netflix Hystrix-inspired).
 *
 * When an external dependency (Elasticsearch, Redis, S3, RabbitMQ) starts
 * failing, the circuit "opens" and immediately returns a fallback instead
 * of waiting for timeouts. This prevents cascade failures under 10k+ load.
 *
 * States:
 *   CLOSED  → Normal operation — requests pass through
 *   OPEN    → Dependency is down — fail fast, return fallback
 *   HALF_OPEN → Testing recovery — allow one probe request through
 *
 * Usage:
 *   const breaker = new CircuitBreaker({ name: 'elasticsearch', timeout: 3000 });
 *   const result = await breaker.fire(() => esClient.search(query), fallbackValue);
 */
const { logger } = require('./logger');

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
  /**
   * @param {Object} opts
   * @param {string} opts.name            – Human-readable name for logging
   * @param {number} [opts.failureThreshold=5]  – Failures before opening
   * @param {number} [opts.resetTimeout=30000]  – Ms before trying half-open
   * @param {number} [opts.timeout=5000]        – Per-request timeout (ms)
   * @param {number} [opts.halfOpenMax=1]       – Probes allowed in half-open
   * @param {number} [opts.successThreshold=2]  – Successes in half-open to close
   * @param {number} [opts.monitorWindow=60000] – Sliding window for failure count
   */
  constructor({
    name,
    failureThreshold = 5,
    resetTimeout = 30_000,
    timeout = 5_000,
    halfOpenMax = 1,
    successThreshold = 2,
    monitorWindow = 60_000,
  } = {}) {
    this.name = name || 'unknown';
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.timeout = timeout;
    this.halfOpenMax = halfOpenMax;
    this.successThreshold = successThreshold;
    this.monitorWindow = monitorWindow;

    this.state = STATE.CLOSED;
    this._failures = [];        // timestamps of recent failures
    this._lastFailure = 0;
    this._halfOpenInFlight = 0;
    this._halfOpenSuccesses = 0;

    // Stats
    this._stats = { total: 0, success: 0, failure: 0, shortCircuited: 0, timeout: 0 };
  }

  /**
   * Execute a function through the circuit breaker.
   * @param {Function} fn          – Async function to execute
   * @param {*}        [fallback]  – Value to return when circuit is open
   * @returns {Promise<*>}
   */
  async fire(fn, fallback = null) {
    this._stats.total++;

    // ── OPEN: Fail fast ──
    if (this.state === STATE.OPEN) {
      if (Date.now() - this._lastFailure >= this.resetTimeout) {
        this._transitionTo(STATE.HALF_OPEN);
      } else {
        this._stats.shortCircuited++;
        return fallback;
      }
    }

    // ── HALF_OPEN: Allow limited probes ──
    if (this.state === STATE.HALF_OPEN) {
      if (this._halfOpenInFlight >= this.halfOpenMax) {
        this._stats.shortCircuited++;
        return fallback;
      }
      this._halfOpenInFlight++;
    }

    // ── Execute with timeout ──
    try {
      const result = await this._executeWithTimeout(fn);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      return fallback;
    }
  }

  /**
   * Check if the circuit is currently allowing requests.
   */
  isAvailable() {
    if (this.state === STATE.CLOSED) return true;
    if (this.state === STATE.OPEN) {
      return Date.now() - this._lastFailure >= this.resetTimeout;
    }
    return this._halfOpenInFlight < this.halfOpenMax;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      ...this._stats,
      recentFailures: this._failures.length,
    };
  }

  // ── Private ──

  async _executeWithTimeout(fn) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._stats.timeout++;
        reject(new Error(`Circuit breaker timeout (${this.timeout}ms)`));
      }, this.timeout);

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  _onSuccess() {
    this._stats.success++;
    if (this.state === STATE.HALF_OPEN) {
      this._halfOpenInFlight--;
      this._halfOpenSuccesses++;
      if (this._halfOpenSuccesses >= this.successThreshold) {
        this._transitionTo(STATE.CLOSED);
      }
    }
  }

  _onFailure(err) {
    this._stats.failure++;
    this._lastFailure = Date.now();

    if (this.state === STATE.HALF_OPEN) {
      this._halfOpenInFlight--;
      this._transitionTo(STATE.OPEN);
      return;
    }

    // Sliding window: only count recent failures
    const now = Date.now();
    this._failures.push(now);
    this._failures = this._failures.filter(t => now - t < this.monitorWindow);

    if (this._failures.length >= this.failureThreshold) {
      this._transitionTo(STATE.OPEN);
    }
  }

  _transitionTo(newState) {
    if (this.state === newState) return;
    const prev = this.state;
    this.state = newState;

    if (newState === STATE.CLOSED) {
      this._failures = [];
      this._halfOpenSuccesses = 0;
      this._halfOpenInFlight = 0;
    } else if (newState === STATE.HALF_OPEN) {
      this._halfOpenSuccesses = 0;
      this._halfOpenInFlight = 0;
    }

    logger.warn(`[CircuitBreaker:${this.name}] ${prev} → ${newState}`, {
      stats: this._stats,
    });
  }
}

// ── Singleton registry for application-wide circuit breakers ──
const breakers = new Map();

/**
 * Get or create a named circuit breaker.
 * @param {string} name
 * @param {Object} [opts] – CircuitBreaker constructor options
 * @returns {CircuitBreaker}
 */
function getBreaker(name, opts = {}) {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker({ name, ...opts }));
  }
  return breakers.get(name);
}

/**
 * Get stats for all circuit breakers (for /health/ready endpoint).
 */
function getAllBreakerStats() {
  const stats = {};
  for (const [name, breaker] of breakers) {
    stats[name] = breaker.getStats();
  }
  return stats;
}

module.exports = { CircuitBreaker, getBreaker, getAllBreakerStats, STATE };
