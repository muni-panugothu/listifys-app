'use strict';

const connectionManager = require('./connection/connection.manager');
const { EXCHANGES, QUEUES } = require('./config/messaging.config');
const { logger } = require('../utils/logger');

// All DLQ names derived from the QUEUES config so this file stays in sync automatically
const ALL_DLQS = Object.values(QUEUES)
  .filter(q => q.dlq)
  .map(q => q.dlq);

/**
 * DeadLetterService — processes dead-letter queues for all domains.
 *
 * Default behaviour: log + increment metric for every dead-lettered message.
 *
 * Override per-domain by calling registerHandler() BEFORE startAll().
 * The booking.events.dlq and payment.events.dlq handlers in dlq.processor.js
 * do this to trigger critical alerts and persistence.
 *
 * Key rule: ALL DLQ consumers must ACK every message to prevent re-delivery loops.
 */
class DeadLetterService {
  constructor() {
    this._channel  = null;
    this._handlers = new Map(); // dlqName → async (dlqName, envelope, rawMsg) => void
  }

  /** Register a custom handler for a specific DLQ before startAll(). */
  registerHandler(dlqName, handler) {
    this._handlers.set(dlqName, handler);
  }

  /** Start consumers for every DLQ in the topology. */
  async startAll() {
    for (const dlqName of ALL_DLQS) {
      await this._startConsumer(dlqName);
    }
    logger.info('[DeadLetterService] ☠️  DLQ consumers active', { count: ALL_DLQS.length });
  }

  /** Return the current message depth of a DLQ (used by HealthMonitor). */
  async getDepth(dlqName) {
    const ch = await this._getChannel();
    if (!ch) return null;
    try {
      const { messageCount } = await ch.checkQueue(dlqName);
      return messageCount;
    } catch {
      return null;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  async _getChannel() {
    if (this._channel) return this._channel;
    // Low prefetch — DLQ processing is deliberate, not high-throughput
    this._channel = await connectionManager.createChannel('dlq-processor');
    if (!this._channel) return null;
    await this._channel.prefetch(5);
    this._channel.on('error', () => { this._channel = null; });
    this._channel.on('close', () => { this._channel = null; });
    return this._channel;
  }

  async _startConsumer(dlqName) {
    const ch = await this._getChannel();
    if (!ch) return;

    const handler = this._handlers.get(dlqName) ?? this._defaultHandler.bind(this);

    await ch.consume(dlqName, async (msg) => {
      if (!msg) return;

      let envelope;
      try {
        envelope = JSON.parse(msg.content.toString());
      } catch {
        envelope = { raw: msg.content.toString('base64') };
      }

      try {
        await handler(dlqName, envelope, msg);
      } catch (err) {
        logger.error('[DeadLetterService] DLQ handler threw', { dlqName, error: err.message });
      } finally {
        // ALWAYS ACK — nacking a DLQ message sends it back to the same DLQ (infinite loop)
        ch.ack(msg);
      }
    });
  }

  async _defaultHandler(dlqName, envelope) {
    logger.error('[DeadLetterService] Dead letter received', {
      dlq:         dlqName,
      messageId:   envelope.messageId,
      routingKey:  envelope.routingKey,
      retryCount:  envelope.retryCount,
      lastError:   envelope.lastError,
      deathReason: envelope.headers?.['x-death']?.[0]?.reason,
    });
    // Metrics updated by dlq.processor.js domain handlers
  }
}

module.exports = new DeadLetterService();
