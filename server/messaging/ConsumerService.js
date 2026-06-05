'use strict';

const connectionManager = require('./connection/connection.manager');
const { PREFETCH } = require('./config/messaging.config');
const { logger } = require('../utils/logger');

// In-memory deduplication window
const DEDUP_WINDOW_MS = 5 * 60 * 1000;  // 5 min
const _processed      = new Map();       // messageId → timestamp

// Clean expired dedup entries every minute to prevent unbounded growth
setInterval(() => {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  for (const [id, ts] of _processed) {
    if (ts < cutoff) _processed.delete(id);
  }
}, 60_000).unref();

/**
 * ConsumerService — manages all AMQP consumers.
 *
 * Features:
 *  - Per-queue isolated channels (a consumer error doesn't affect other queues)
 *  - In-memory message deduplication (5-min window using messageId)
 *  - Automatic retry scheduling via RetryService on handler failure
 *  - Max-retry enforcement → nack to DLQ when exhausted
 *  - Structured log context on every consumed message
 */
class ConsumerService {
  constructor() {
    this._channels = new Map(); // queueName → channel
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register a consumer on a queue.
   *
   * @param {string}   queueName
   * @param {Function} handler          async (payload, envelope, rawMsg) => void
   * @param {object}   [opts]
   * @param {number}   [opts.maxRetries=3]     Max retries before DLQ
   * @param {boolean}  [opts.deduplicate=true]  Skip duplicate messageIds
   * @param {number}   [opts.prefetch]          Override per-channel prefetch
   */
  async consume(queueName, handler, opts = {}) {
    const { maxRetries = 3, deduplicate = true, prefetch } = opts;

    const ch = await this._getChannel(queueName);
    if (!ch) {
      logger.warn('[ConsumerService] No channel — consumer not registered', { queue: queueName });
      return;
    }

    if (prefetch != null) await ch.prefetch(prefetch);

    await ch.consume(queueName, async (msg) => {
      if (!msg) return; // Consumer cancelled

      // ── Parse envelope ────────────────────────────────────────────────────
      let envelope;
      try {
        envelope = JSON.parse(msg.content.toString());
      } catch {
        logger.error('[ConsumerService] Malformed message — dead-lettering', { queue: queueName });
        ch.nack(msg, false, false);
        return;
      }

      const {
        messageId,
        correlationId,
        traceId,
        retryCount = 0,
        routingKey,
        payload,
      } = envelope;

      // ── Deduplication ─────────────────────────────────────────────────────
      if (deduplicate && messageId) {
        if (_processed.has(messageId)) {
          logger.debug('[ConsumerService] Duplicate — acking without processing', {
            messageId, queue: queueName,
          });
          ch.ack(msg);
          return;
        }
        _processed.set(messageId, Date.now());
      }

      // ── Dispatch to handler ───────────────────────────────────────────────
      const start = Date.now();
      try {
        await handler(payload, envelope, msg);
        ch.ack(msg);
        logger.debug('[ConsumerService] ✅ Processed', {
          messageId,
          queue:      queueName,
          routingKey,
          ms:         Date.now() - start,
        });
      } catch (err) {
        logger.error('[ConsumerService] Handler error', {
          queue:        queueName,
          routingKey,
          messageId,
          correlationId,
          retryCount,
          error:        err.message,
        });

        if (retryCount < maxRetries) {
          // Re-queue with incremented retryCount via RetryService
          const RetryService = require('./RetryService');
          await RetryService.scheduleRetry(routingKey, payload, {
            ...envelope,
            retryCount: retryCount + 1,
            lastError:  err.message,
          });
          ch.ack(msg); // ACK original — retried copy is published separately
        } else {
          logger.warn('[ConsumerService] Max retries exhausted — dead-lettering', {
            messageId, queue: queueName, routingKey,
          });
          ch.nack(msg, false, false); // → DLQ via x-dead-letter-exchange
        }
      }
    });

    logger.info('[ConsumerService] 👂 Consumer registered', { queue: queueName });
  }

  /** Gracefully close all consumer channels. */
  async closeAll() {
    for (const [name, ch] of this._channels) {
      await ch.close().catch(() => {});
    }
    this._channels.clear();
    logger.info('[ConsumerService] All consumers closed');
  }

  // ── Private ────────────────────────────────────────────────────────────────

  async _getChannel(queueName) {
    if (this._channels.has(queueName)) return this._channels.get(queueName);

    const ch = await connectionManager.createChannel(`consumer:${queueName}`);
    if (!ch) return null;

    await ch.prefetch(PREFETCH.CONSUME);
    this._channels.set(queueName, ch);

    ch.on('error', (err) => {
      logger.error('[ConsumerService] Channel error', { queue: queueName, error: err.message });
      this._channels.delete(queueName);
    });
    ch.on('close', () => this._channels.delete(queueName));

    return ch;
  }
}

module.exports = new ConsumerService();
