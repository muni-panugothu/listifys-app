'use strict';

const { randomUUID } = require('crypto');
const connectionManager = require('./connection/connection.manager');
const { EXCHANGES, PREFETCH, MESSAGE_VERSION } = require('./config/messaging.config');
const { logger } = require('../utils/logger');

// Circuit breaker constants
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS  = 30000;

/**
 * ProducerService — publisher with:
 *  - Confirm channels (broker-level delivery guarantee)
 *  - Circuit breaker (prevents hammering a dead broker)
 *  - Message envelopes (versioning, traceId, correlationId, idempotency key)
 *  - Topic, direct, fanout, and analytics publish
 *  - Batch publish (single confirm round-trip for multiple messages)
 */
class ProducerService {
  constructor() {
    this._channel          = null;
    this._circuitFailCount = 0;
    this._circuitOpenUntil = 0;
  }

  // ── Channel ────────────────────────────────────────────────────────────────

  async _getChannel() {
    if (this._channel) return this._channel;

    this._channel = await connectionManager.createConfirmChannel('producer');
    if (!this._channel) return null;

    await this._channel.prefetch(PREFETCH.PUBLISH);

    this._channel.on('error', (err) => {
      logger.error('[ProducerService] Channel error', { error: err.message });
      this._channel = null;
      this._recordFailure();
    });
    this._channel.on('close', () => {
      this._channel = null;
    });

    return this._channel;
  }

  // ── Circuit Breaker ───────────────────────────────────────────────────────

  _isOpen() {
    if (this._circuitFailCount >= CIRCUIT_THRESHOLD) {
      if (Date.now() < this._circuitOpenUntil) return true;
      this._circuitFailCount = Math.floor(CIRCUIT_THRESHOLD / 2); // half-open
    }
    return false;
  }

  _recordSuccess() {
    this._circuitFailCount = 0;
  }

  _recordFailure() {
    this._circuitFailCount++;
    if (this._circuitFailCount >= CIRCUIT_THRESHOLD) {
      this._circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
      logger.warn('[ProducerService] Circuit breaker OPEN — pausing publishes 30s');
    }
  }

  // ── Message Envelope ──────────────────────────────────────────────────────

  /**
   * Builds a versioned message envelope with full tracing metadata.
   * Consumers can use these fields for idempotency, deduplication, and tracing.
   */
  _buildEnvelope(routingKey, payload, opts = {}) {
    const messageId     = opts.messageId     ?? randomUUID();
    const correlationId = opts.correlationId ?? randomUUID();
    const traceId       = opts.traceId       ?? randomUUID();

    const envelope = {
      version:       MESSAGE_VERSION,
      messageId,
      correlationId,
      traceId,
      routingKey,
      timestamp:     new Date().toISOString(),
      retryCount:    opts.retryCount ?? 0,
      originService: process.env.SERVICE_NAME ?? 'listify-api',
      payload,
    };

    const properties = {
      persistent:      true,
      contentType:     'application/json',
      contentEncoding: 'utf-8',
      messageId,
      correlationId,
      timestamp:       Math.floor(Date.now() / 1000),
      type:            routingKey,
      appId:           process.env.SERVICE_NAME ?? 'listify-api',
      headers: {
        'x-version':       MESSAGE_VERSION,
        'x-trace-id':      traceId,
        'x-retry-count':   opts.retryCount ?? 0,
        'x-origin':        process.env.SERVICE_NAME ?? 'listify-api',
        ...(opts.headers ?? {}),
      },
    };

    return { envelope, properties, messageId };
  }

  // ── Core Publish ──────────────────────────────────────────────────────────

  /**
   * Publish an event to a topic exchange.
   *
   * @param {string} routingKey  e.g. 'auth.user.created'
   * @param {object} payload     Event data
   * @param {object} [opts]      correlationId, traceId, retryCount, exchange, headers
   * @returns {Promise<boolean>} true if broker confirmed delivery
   */
  async publish(routingKey, payload, opts = {}) {
    if (this._isOpen()) {
      logger.debug('[ProducerService] Circuit open — skipped', { routingKey });
      return false;
    }

    try {
      const ch = await this._getChannel();
      if (!ch) {
        this._recordFailure();
        logger.warn('[ProducerService] No channel', { routingKey });
        return false;
      }

      const exchange = opts.exchange ?? EXCHANGES.TOPIC.name;
      const { envelope, properties, messageId } = this._buildEnvelope(routingKey, payload, opts);

      ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(envelope)), properties);
      await ch.waitForConfirms();

      this._recordSuccess();
      logger.debug('[ProducerService] 📤 Confirmed', { exchange, routingKey, messageId });
      return true;
    } catch (err) {
      this._recordFailure();
      logger.error('[ProducerService] Publish error', { routingKey, error: err.message });
      return false;
    }
  }

  /** Broadcast to ALL bound queues (fanout exchange). */
  async publishBroadcast(payload, opts = {}) {
    return this.publish('', payload, { ...opts, exchange: EXCHANGES.FANOUT.name });
  }

  /** High-volume analytics events (separate exchange to isolate load). */
  async publishAnalytics(routingKey, payload, opts = {}) {
    return this.publish(routingKey, payload, { ...opts, exchange: EXCHANGES.ANALYTICS.name });
  }

  /**
   * Batch publish multiple events in a single confirm round-trip.
   * More efficient than N sequential publish() calls.
   *
   * @param {string}   exchange
   * @param {{ routingKey: string, payload: object }[]} events
   * @param {object}   [opts]
   */
  async publishBatch(exchange, events, opts = {}) {
    if (!events?.length) return true;
    if (this._isOpen()) return false;

    try {
      const ch = await this._getChannel();
      if (!ch) { this._recordFailure(); return false; }

      for (const { routingKey, payload } of events) {
        const { envelope, properties } = this._buildEnvelope(routingKey, payload, opts);
        ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(envelope)), properties);
      }

      await ch.waitForConfirms();
      this._recordSuccess();
      logger.debug('[ProducerService] 📤 Batch confirmed', { exchange, count: events.length });
      return true;
    } catch (err) {
      this._recordFailure();
      logger.error('[ProducerService] Batch publish error', { exchange, error: err.message });
      return false;
    }
  }
}

module.exports = new ProducerService();
