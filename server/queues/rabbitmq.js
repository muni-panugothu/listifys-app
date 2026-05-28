'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const amqp = require('amqplib');
const { logger } = require('../utils/logger');

// ── QUEUE DEFINITIONS (single source of truth) ────────────────────────────────
const QUEUES = {
  // ── Auth (high priority — OTPs expire fast) ────────────────────
  OTP:            { name: 'otp_queue',            dlq: 'otp_dlq',            priority: 10 },
  EMAIL:          { name: 'email_queue',           dlq: 'email_dlq',          priority: 5 },
  AUDIT_LOG:      { name: 'audit_log_queue',       dlq: 'audit_log_dlq',      priority: 1 },
  WELCOME:        { name: 'welcome_queue',         dlq: 'welcome_dlq',        priority: 3 },

  // ── Listings (medium priority) ────────────────────────────────
  LISTING_EVENTS: { name: 'listing_events_queue',  dlq: 'listing_events_dlq', priority: 5 },
  SEARCH_INDEX:   { name: 'search_index_queue',    dlq: 'search_index_dlq',   priority: 3 },
  IMAGE_CLEANUP:  { name: 'image_cleanup_queue',   dlq: 'image_cleanup_dlq',  priority: 2 },

  // ── Notifications / Social (high priority — real-time UX) ─────
  NOTIFICATION:   { name: 'notification_queue',    dlq: 'notification_dlq',   priority: 8 },

  // ── Bookings (high priority — money involved) ─────────────────
  // BOOKING has NO x-message-ttl — money-critical events must never silently expire.
  // The TTL override is applied per-queue during assertQueue (see connect()).
  BOOKING:        { name: 'booking_queue',         dlq: 'booking_dlq',        priority: 9, noTtl: true },

  // ── Chat (critical priority — real-time messaging reliability) ────
  CHAT_MESSAGES:  { name: 'chat_messages_queue',   dlq: 'chat_messages_dlq',  priority: 9 },
};


const EXCHANGE = {
  DLX: 'listify.dlx', // Dead-letter exchange
};

// ── METRICS — lightweight in-process counters ─────────────────────────────────
const metrics = {
  published: 0,
  consumed: 0,
  failed: 0,
  retried: 0,
  deadLettered: 0,
  circuitOpen: false,
  lastError: null,
  getStats() {
    return { ...this, uptime: process.uptime() };
  },
};

// ── CONNECTION STATE ───────────────────────────────────────────────────────────
let _connection      = null;
let _publishChannel  = null;  // Confirm channel — guarantees delivery
let _consumeChannel  = null;  // Separate channel — consumer crash won't kill publisher
let _reconnectTimer  = null;
let _isConnecting    = false;
let _reconnectAttempt = 0;
const MAX_RECONNECT_DELAY = 30_000; // 30s max backoff

// ── CORE: CONNECT ──────────────────────────────────────────────────────────────
const connect = async () => {
  if (_isConnecting) return null;
  if (_connection && _publishChannel) return _publishChannel;

  _isConnecting = true;

  try {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
      logger.warn('[RabbitMQ] RABBITMQ_URL not set — queue system disabled');
      _isConnecting = false;
      return null;
    }

    _connection = await amqp.connect(url, {
      heartbeat: 30,              // faster dead-connection detection
      timeout:   10_000,          // 10s connection timeout
    });

    // Confirm channel for publishers — broker acks every publish
    _publishChannel = await _connection.createConfirmChannel();
    await _publishChannel.prefetch(50);    // Higher prefetch for throughput under load

    // Separate channel for consumers — isolation from publisher errors
    _consumeChannel = await _connection.createChannel();
    await _consumeChannel.prefetch(20);    // Higher consumer prefetch for 10k+ users

    // Attach channel listeners BEFORE queue declarations so broker-side assertion
    // failures do not surface as uncaught channel errors.
    _publishChannel.on('error', (err) => {
      logger.error('[RabbitMQ] Publish channel error', { error: err.message });
      _publishChannel = null;
    });
    _publishChannel.on('close', () => {
      logger.warn('[RabbitMQ] Publish channel closed');
      _publishChannel = null;
    });

    _consumeChannel.on('error', (err) => {
      logger.error('[RabbitMQ] Consumer channel error', { error: err.message });
      _consumeChannel = null;
      _scheduleReconnect();
    });
    _consumeChannel.on('close', () => {
      logger.warn('[RabbitMQ] Consumer channel closed');
      _consumeChannel = null;
    });

    // ── Declare the Dead-Letter Exchange first
    await _publishChannel.assertExchange(EXCHANGE.DLX, 'direct', { durable: true });

    // ── Declare all queues + their Dead-Letter Queues (DLQs)
    // NOTE: x-max-priority removed — existing queues on CloudAMQP were created
    // without it, and RabbitMQ returns PRECONDITION_FAILED if queue arguments
    // differ from what was originally declared.
    for (const { name, dlq, noTtl } of Object.values(QUEUES)) {
      try {
        await _publishChannel.assertQueue(dlq, { durable: true });
        await _publishChannel.bindQueue(dlq, EXCHANGE.DLX, name);
        // noTtl: true means messages never auto-expire (used for BOOKING queue)
        const queueArgs = {
          'x-dead-letter-exchange':    EXCHANGE.DLX,
          'x-dead-letter-routing-key': name,
          ...(noTtl ? {} : { 'x-message-ttl': 300_000 }), // skip TTL for money-critical queues
        };
        await _publishChannel.assertQueue(name, {
          durable: true,
          arguments: queueArgs,
        });
      } catch (assertErr) {
        // PRECONDITION_FAILED closes the channel — recreate and continue
        logger.warn(`[RabbitMQ] Queue assertion failed for ${name} (queue may already exist with different args)`, { error: assertErr.message });
        try {
          _publishChannel = await _connection.createConfirmChannel();
          await _publishChannel.prefetch(50);
          _publishChannel.on('error', (err) => {
            logger.error('[RabbitMQ] Publish channel error', { error: err.message });
            _publishChannel = null;
          });
          _publishChannel.on('close', () => {
            logger.warn('[RabbitMQ] Publish channel closed');
            _publishChannel = null;
          });
        } catch (chErr) {
          logger.error(`[RabbitMQ] Failed to recreate channel after assertion failure`, { error: chErr.message });
          break;
        }
      }
    }

    _isConnecting = false;
    _reconnectAttempt = 0; // Reset backoff on success
    logger.info('✅ [RabbitMQ] Connected — confirm channel + consumer channel ready');

    // ── Connection-level error handling
    _connection.on('error', (err) => {
      logger.error('[RabbitMQ] Connection error', { error: err.message });
      _scheduleReconnect();
    });
    _connection.on('close', () => {
      logger.warn('[RabbitMQ] Connection closed — scheduling reconnect');
      _connection     = null;
      _publishChannel = null;
      _consumeChannel = null;
      _scheduleReconnect();
    });

    return _publishChannel;
  } catch (err) {
    _isConnecting   = false;
    _connection     = null;
    _publishChannel = null;
    _consumeChannel = null;
    logger.error('[RabbitMQ] Failed to connect', { error: err.message });
    _scheduleReconnect();
    return null;
  }
};

const _scheduleReconnect = () => {
  if (_reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** _reconnectAttempt, MAX_RECONNECT_DELAY);
  _reconnectAttempt++;
  logger.info(`[RabbitMQ] Reconnecting in ${delay}ms (attempt ${_reconnectAttempt})`);
  _reconnectTimer = setTimeout(async () => {
    _reconnectTimer = null;
    await connect();
  }, delay);
};

// ── Lazy channel recovery (if only the publish channel died) ───────────────────
const _getPublishChannel = async () => {
  if (_publishChannel) return _publishChannel;
  if (_connection) {
    try {
      _publishChannel = await _connection.createConfirmChannel();
      await _publishChannel.prefetch(10);
      _publishChannel.on('error', (err) => {
        logger.error('[RabbitMQ] Publish channel error (recovered)', { error: err.message });
        _publishChannel = null;
      });
      _publishChannel.on('close', () => { _publishChannel = null; });
      return _publishChannel;
    } catch {
      return await connect();
    }
  }
  return await connect();
};

// ── CIRCUIT BREAKER — prevents hammering a dead broker ─────────────────────
let _circuitFailCount = 0;
const CIRCUIT_THRESHOLD = 5;     // open after 5 consecutive failures
const CIRCUIT_RESET_MS  = 30_000; // try again after 30s
let _circuitOpenUntil   = 0;

const _checkCircuit = () => {
  if (_circuitFailCount >= CIRCUIT_THRESHOLD) {
    if (Date.now() < _circuitOpenUntil) {
      metrics.circuitOpen = true;
      return false; // Circuit is open — reject immediately
    }
    // Half-open: allow one attempt
    _circuitFailCount = Math.floor(CIRCUIT_THRESHOLD / 2);
  }
  return true;
};

const _recordCircuitSuccess = () => {
  _circuitFailCount = 0;
  metrics.circuitOpen = false;
};

const _recordCircuitFailure = () => {
  _circuitFailCount++;
  if (_circuitFailCount >= CIRCUIT_THRESHOLD) {
    _circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
    metrics.circuitOpen = true;
    logger.warn('[RabbitMQ] Circuit breaker OPEN — skipping publishes for 30s');
  }
};

// ── CORE: PUBLISH ──────────────────────────────────────────────────────────────
/**
 * Publish a message to a named queue.
 * Messages are persistent (survive broker restarts).
 * A unique messageId is generated for idempotency tracking.
 * Supports priority levels (0-10, higher = processed first).
 *
 * @param {string} queueName - e.g. 'otp_queue'
 * @param {object} payload   - JSON-serialisable object
 * @param {object} [opts]    - amqplib publish options override
 * @returns {boolean} true if enqueued, false if unavailable (non-blocking fail)
 */
const publish = async (queueName, payload, opts = {}) => {
  try {
    // Circuit breaker check
    if (!_checkCircuit()) {
      logger.debug(`[RabbitMQ] Circuit open — publish skipped: ${queueName}`);
      return false;
    }

    const ch = await _getPublishChannel();
    if (!ch) {
      _recordCircuitFailure();
      logger.warn(`[RabbitMQ] Publish skipped (no channel): ${queueName}`, {
        payloadType: payload?.type,
      });
      return false; // Non-blocking: fail silently so API still responds
    }

    const messageId = `${queueName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const message   = Buffer.from(JSON.stringify({ ...payload, _messageId: messageId }));

    // Look up default priority for this queue
    const queueDef = Object.values(QUEUES).find(q => q.name === queueName);
    const defaultPriority = queueDef?.priority || 5;

    ch.sendToQueue(queueName, message, {
      persistent:   true,     // survive broker restart
      contentType:  'application/json',
      messageId,
      timestamp:    Math.floor(Date.now() / 1000),
      priority:     opts.priority ?? defaultPriority,  // Priority queue support
      headers: {
        retryCount: 0,         // workers increment this on failure
      },
      ...opts,
    });

    // Wait for broker-level delivery confirmation (confirm channel guarantee)
    await ch.waitForConfirms();

    _recordCircuitSuccess();
    metrics.published++;
    logger.debug(`[RabbitMQ] 📤 Confirmed on ${queueName}`, { messageId, priority: opts.priority ?? defaultPriority });
    return true;
  } catch (err) {
    _recordCircuitFailure();
    metrics.failed++;
    logger.error(`[RabbitMQ] Publish error on ${queueName}`, { error: err.message });
    return false;
  }
};

/**
 * Batch publish multiple messages to the same queue.
 * More efficient than individual publishes — single confirm round-trip.
 *
 * @param {string}   queueName - target queue
 * @param {object[]} payloads  - array of JSON-serialisable objects
 * @param {object}   [opts]    - amqplib publish options override
 * @returns {boolean} true if all enqueued
 */
const publishBatch = async (queueName, payloads, opts = {}) => {
  if (!payloads || payloads.length === 0) return true;

  try {
    if (!_checkCircuit()) return false;

    const ch = await _getPublishChannel();
    if (!ch) {
      _recordCircuitFailure();
      return false;
    }

    const queueDef = Object.values(QUEUES).find(q => q.name === queueName);
    const defaultPriority = queueDef?.priority || 5;

    for (const payload of payloads) {
      const messageId = `${queueName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const message = Buffer.from(JSON.stringify({ ...payload, _messageId: messageId }));

      ch.sendToQueue(queueName, message, {
        persistent: true,
        contentType: 'application/json',
        messageId,
        timestamp: Math.floor(Date.now() / 1000),
        priority: opts.priority ?? defaultPriority,
        headers: { retryCount: 0 },
        ...opts,
      });
    }

    await ch.waitForConfirms();

    _recordCircuitSuccess();
    metrics.published += payloads.length;
    logger.debug(`[RabbitMQ] 📤 Batch confirmed ${payloads.length} msgs on ${queueName}`);
    return true;
  } catch (err) {
    _recordCircuitFailure();
    metrics.failed += payloads.length;
    logger.error(`[RabbitMQ] Batch publish error on ${queueName}`, { error: err.message });
    return false;
  }
};

// ── CORE: CONSUME ─────────────────────────────────────────────────────────────
/**
 * Register a consumer on a queue.
 * Automatically ACK on success, NACK with retry on failure.
 * After MAX_RETRIES, messages are sent to DLQ automatically.
 *
 * @param {string}   queueName  - queue to consume from
 * @param {Function} handler    - async (payload, msg) => void
 * @param {object}   [opts]
 * @param {number}   [opts.maxRetries=3]
 */
const consume = async (queueName, handler, { maxRetries = 3 } = {}) => {
  // Ensure connection + channels exist, then use the consumer channel
  if (!_consumeChannel) await connect();
  const ch = _consumeChannel;
  if (!ch) {
    logger.warn(`[RabbitMQ] Consumer skipped (no channel): ${queueName}`);
    return;
  }

  await ch.consume(queueName, async (msg) => {
    if (!msg) return;

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      logger.error('[RabbitMQ] Failed to parse message — sending to DLQ', {
        queue: queueName,
      });
      ch.nack(msg, false, false); // Dead-letter immediately (don't requeue)
      return;
    }

    const retryCount = (msg.properties.headers?.retryCount ?? 0);

    try {
      await handler(payload, msg);
      ch.ack(msg); // ✅ Success
      metrics.consumed++;
    } catch (err) {
      logger.error(`[RabbitMQ] Handler failed on ${queueName}`, {
        error:       err.message,
        retryCount,
        messageId:   payload._messageId,
      });

      if (retryCount < maxRetries) {
        metrics.retried++;
        // Re-publish with incremented retry count (exponential backoff delay)
        const delay = Math.min(1000 * 2 ** retryCount, 30_000);
        setTimeout(() => {
          publish(queueName, payload, {
            headers: { retryCount: retryCount + 1 },
          });
        }, delay);
        ch.ack(msg); // Ack original, re-queued above
      } else {
        metrics.deadLettered++;
        logger.warn(`[RabbitMQ] Max retries reached — sending to DLQ`, {
          queue:     queueName,
          messageId: payload._messageId,
        });
        ch.nack(msg, false, false); // ❌ Dead-letter
      }
    }
  });

  logger.info(`[RabbitMQ] 👂 Consumer registered on ${queueName}`);
};

// ── GRACEFUL SHUTDOWN ──────────────────────────────────────────────────────────
const close = async () => {
  try {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
    if (_publishChannel)  await _publishChannel.close().catch(() => {});
    if (_consumeChannel)  await _consumeChannel.close().catch(() => {});
    if (_connection) {
      // Race against a 3-second timeout — amqplib.close() hangs when the
      // broker is unreachable (waiting for server CloseOk that never arrives).
      await Promise.race([
        _connection.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('close timeout')), 3000)),
      ]).catch(() => {});
    }
    _publishChannel = null;
    _consumeChannel = null;
    _connection     = null;
    logger.info('[RabbitMQ] Connection closed gracefully');
  } catch (err) {
    logger.error('[RabbitMQ] Error during close', { error: err.message });
  }
};

module.exports = { connect, publish, publishBatch, consume, close, QUEUES, metrics };
