'use strict';

/**
 * RetryStrategy — per-domain retry configuration.
 *
 * Used by ConsumerService to decide how many retries a message gets,
 * and by RetryService to pick the correct delay tier.
 *
 * Domain strategies are resolved by the leading segment of the routing key:
 *   'payment.payment.failed'  →  PAYMENT strategy
 *   'booking.booking.created' →  BOOKING strategy
 *   'auth.user.created'       →  AUTH strategy
 */

const STRATEGIES = {
  PAYMENT: {
    maxRetries:     5,
    delays:         [1_000, 5_000, 30_000, 120_000, 300_000], // 1s→5s→30s→2m→5m
    backoffType:    'fixed',
    alertOnExhaust: true,   // page on-call when payment DLQ receives a message
  },

  BOOKING: {
    maxRetries:     4,
    delays:         [1_000, 10_000, 60_000, 300_000],          // 1s→10s→1m→5m
    backoffType:    'fixed',
    alertOnExhaust: true,
  },

  AUTH: {
    maxRetries:     3,
    delays:         [1_000, 10_000, 60_000],
    backoffType:    'exponential',
    alertOnExhaust: false,
  },

  LISTING: {
    maxRetries:     3,
    delays:         [1_000, 10_000, 60_000],
    backoffType:    'exponential',
    alertOnExhaust: false,
  },

  CHAT: {
    maxRetries:     3,
    delays:         [1_000, 10_000, 60_000],
    backoffType:    'exponential',
    alertOnExhaust: false,
  },

  NOTIFICATION: {
    maxRetries:     2,
    delays:         [1_000, 10_000],
    backoffType:    'exponential',
    alertOnExhaust: false,
  },

  ANALYTICS: {
    maxRetries:     1,
    delays:         [1_000],
    backoffType:    'fixed',
    alertOnExhaust: false,  // analytics loss is acceptable
  },

  DEFAULT: {
    maxRetries:     3,
    delays:         [1_000, 10_000, 60_000],
    backoffType:    'exponential',
    alertOnExhaust: false,
  },
};

/**
 * Resolve the retry strategy for a given routing key.
 * e.g. 'payment.payment.failed' → STRATEGIES.PAYMENT
 */
function resolveStrategy(routingKey = '') {
  const domain = routingKey.split('.')[0].toUpperCase();
  return STRATEGIES[domain] ?? STRATEGIES.DEFAULT;
}

/**
 * Return the delay (ms) for a specific retry attempt under a strategy.
 */
function getDelay(strategy, retryCount) {
  if (strategy.backoffType === 'exponential') {
    return Math.min(1_000 * 2 ** (retryCount - 1), 300_000);
  }
  const idx = Math.min(retryCount - 1, strategy.delays.length - 1);
  return strategy.delays[idx];
}

/**
 * Map a delay value to the nearest retry exchange name.
 */
function getRetryRoutingKey(delayMs) {
  if (delayMs <= 1_000)  return 'retry.1s';
  if (delayMs <= 10_000) return 'retry.10s';
  return 'retry.60s';
}

module.exports = { STRATEGIES, resolveStrategy, getDelay, getRetryRoutingKey };
