'use strict';

const { EXCHANGES } = require('./config/messaging.config');
const { logger }    = require('../utils/logger');

/**
 * RetryService — delayed retry via the TTL + DLX pattern.
 *
 * How it works:
 *  1. Failed message → publish to listify.retry.Xs exchange with routing key 'retry.Xs'
 *  2. Message sits in retry.Xs.q for X seconds (x-message-ttl)
 *  3. When TTL expires, RabbitMQ dead-letters it back to listify.topic
 *     (because retry.Xs.q has x-dead-letter-exchange = listify.topic)
 *  4. The ORIGINAL routing key is preserved in the 'CC' / x-first-death headers,
 *     but we explicitly set it in the envelope so consumers can restore it.
 *
 * Retry schedule:
 *   retryCount 1 → 1 s  (transient glitch)
 *   retryCount 2 → 10 s (brief outage)
 *   retryCount 3 → 60 s (longer outage / rate limit)
 */

const RETRY_SCHEDULE = [
  { retryCount: 1, exchange: null, routingKey: 'retry.1s',  label: '1s'  },
  { retryCount: 2, exchange: null, routingKey: 'retry.10s', label: '10s' },
  { retryCount: 3, exchange: null, routingKey: 'retry.60s', label: '60s' },
];

// Lazily resolve exchange names from config (avoids circular require at module load)
function resolveExchange(label) {
  if (label === '1s')  return EXCHANGES.RETRY_1S.name;
  if (label === '10s') return EXCHANGES.RETRY_10S.name;
  return EXCHANGES.RETRY_60S.name;
}

class RetryService {
  constructor() {
    this._producer = null; // lazy to avoid circular dep
  }

  _getProducer() {
    if (!this._producer) this._producer = require('./ProducerService');
    return this._producer;
  }

  /**
   * Schedule a failed message for delayed re-delivery.
   *
   * @param {string} originalRoutingKey  e.g. 'auth.user.created'
   * @param {object} payload             Original payload
   * @param {object} envelopeMeta        Spread of the failed message's envelope fields
   */
  async scheduleRetry(originalRoutingKey, payload, envelopeMeta = {}) {
    const retryCount = envelopeMeta.retryCount ?? 1;
    const slot = RETRY_SCHEDULE.find(s => s.retryCount === retryCount)
               ?? RETRY_SCHEDULE[RETRY_SCHEDULE.length - 1];

    const exchange = resolveExchange(slot.label);

    const retryEnvelope = {
      ...envelopeMeta,
      payload,
      routingKey:  originalRoutingKey,   // restored by consumer after TTL expiry
      retryCount,
      retriedAt:   new Date().toISOString(),
    };

    const ok = await this._getProducer().publish(
      slot.routingKey,
      retryEnvelope,
      {
        exchange,
        retryCount,
        correlationId: envelopeMeta.correlationId,
        traceId:       envelopeMeta.traceId,
        headers: {
          'x-retry-count':          retryCount,
          'x-original-routing-key': originalRoutingKey,
          'x-last-error':           envelopeMeta.lastError ?? 'unknown',
          'x-retried-at':           new Date().toISOString(),
        },
      },
    );

    if (ok) {
      logger.info('[RetryService] Scheduled retry', {
        originalRoutingKey,
        retryCount,
        exchange,
        delay: slot.label,
      });
    } else {
      logger.error('[RetryService] Failed to schedule retry', {
        originalRoutingKey, retryCount,
      });
    }

    return ok;
  }
}

module.exports = new RetryService();
