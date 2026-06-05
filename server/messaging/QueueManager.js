'use strict';

const connectionManager = require('./connection/connection.manager');
const { EXCHANGES, QUEUES } = require('./config/messaging.config');
const { logger } = require('../utils/logger');

/**
 * QueueManager — declares the full RabbitMQ topology on startup.
 *
 * Topology order (required by AMQP):
 *  1. Declare all exchanges
 *  2. Declare all DLQs (plain, no args)
 *  3. Bind DLQs → DLX
 *  4. Declare main queues (with x-dead-letter-exchange → DLX)
 *  5. Bind main queues → their exchanges with routing keys
 */
class QueueManager {
  constructor() {
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;

    const conn = await connectionManager.connect();
    if (!conn) {
      logger.warn('[QueueManager] No connection — topology setup skipped');
      return;
    }

    // Use a dedicated short-lived channel for topology setup only
    const ch = await conn.createConfirmChannel().catch(() => null);
    if (!ch) {
      logger.error('[QueueManager] Failed to create setup channel');
      return;
    }

    try {
      await this._declareExchanges(ch);
      await this._declareQueues(ch);
      await this._bindQueues(ch);
      this._initialized = true;
      logger.info('[QueueManager] ✅ Full topology declared', {
        exchanges: Object.keys(EXCHANGES).length,
        queues:    Object.keys(QUEUES).length,
      });
    } catch (err) {
      logger.error('[QueueManager] Topology declaration failed', { error: err.message });
      throw err;
    } finally {
      await ch.close().catch(() => {});
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  async _declareExchanges(ch) {
    for (const [key, ex] of Object.entries(EXCHANGES)) {
      await ch.assertExchange(ex.name, ex.type, ex.options);
      logger.debug(`[QueueManager] Exchange: ${ex.name} (${ex.type})`);
    }
  }

  async _declareQueues(ch) {
    for (const [key, qDef] of Object.entries(QUEUES)) {
      if (qDef.dlq) {
        // Declare DLQ first — plain durable queue, no special args
        await this._safeAssert(ch, qDef.dlq, { durable: true });
        // Bind DLQ → DLX using the main queue name as routing key
        await ch.bindQueue(qDef.dlq, EXCHANGES.DLX.name, qDef.name);
        logger.debug(`[QueueManager] DLQ: ${qDef.dlq} → ${EXCHANGES.DLX.name} [${qDef.name}]`);
      }
      // Declare main queue
      await this._safeAssert(ch, qDef.name, qDef.options, conn => {
        // If channel was closed by PRECONDITION_FAILED, reopen it
        return conn.createConfirmChannel();
      });
    }
  }

  async _bindQueues(ch) {
    for (const [key, qDef] of Object.entries(QUEUES)) {
      if (!qDef.exchange || !qDef.routingKeys) continue;
      for (const rk of qDef.routingKeys) {
        await ch.bindQueue(qDef.name, qDef.exchange, rk);
        logger.debug(`[QueueManager] Binding: ${qDef.name} ← ${qDef.exchange} [${rk}]`);
      }
    }
  }

  /**
   * Safe assertQueue: if the broker returns PRECONDITION_FAILED (queue already
   * exists with different arguments — common on CloudAMQP shared plans), log
   * and continue rather than crashing the server.
   */
  async _safeAssert(ch, name, opts) {
    try {
      await ch.assertQueue(name, opts);
    } catch (err) {
      logger.warn(`[QueueManager] assertQueue conflict "${name}" — using existing queue`, {
        error: err.message,
      });
      // PRECONDITION_FAILED closes the channel — recreate from the connection
      const conn = connectionManager._connection;
      if (conn) {
        try {
          const newCh = await conn.createConfirmChannel();
          // Replace ch reference on the caller's object isn't possible here,
          // but subsequent binds use the new channel if we reassign it.
          Object.assign(ch, newCh);
        } catch { /* ignore */ }
      }
    }
  }

  reset() {
    this._initialized = false;
  }
}

module.exports = new QueueManager();
