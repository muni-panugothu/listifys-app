'use strict';

const amqp           = require('amqplib');
const { EventEmitter } = require('events');
const { logger }     = require('../../utils/logger');

const MAX_RECONNECT_DELAY = 30_000; // 30 s
const HEARTBEAT           = 30;     // s
const CONNECT_TIMEOUT     = 15_000; // 15 s
const MAX_RECONNECT_ATTEMPTS = 50;

/**
 * ConnectionManager — singleton connection lifecycle for RabbitMQ.
 *
 * Responsibilities:
 *  - Connect / reconnect with exponential backoff (max 30s)
 *  - Expose createChannel / createConfirmChannel
 *  - Emit 'connected' / 'disconnected' events so services can react
 *  - Graceful shutdown without hanging amqplib.close()
 */
class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    this._connection       = null;
    this._isConnecting     = false;
    this._reconnectTimer   = null;
    this._reconnectAttempt = 0;
    this._shuttingDown     = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async connect() {
    if (this._isConnecting)  return this._connection;
    if (this._connection)    return this._connection;
    if (this._shuttingDown)  return null;

    this._isConnecting = true;

    try {
      const url = process.env.RABBITMQ_URL;
      if (!url) {
        logger.warn('[ConnectionManager] RABBITMQ_URL not set — messaging disabled');
        this._isConnecting = false;
        return null;
      }

      this._connection = await amqp.connect(url, {
        heartbeat: HEARTBEAT,
        timeout:   CONNECT_TIMEOUT,
      });

      this._isConnecting     = false;
      this._reconnectAttempt = 0;

      this._connection.on('error', (err) => {
        logger.error('[ConnectionManager] Connection error', { error: err.message });
        this._handleDisconnect();
      });

      this._connection.on('close', () => {
        if (!this._shuttingDown) {
          logger.warn('[ConnectionManager] Connection closed — will reconnect');
          this._handleDisconnect();
        }
      });

      logger.info('[ConnectionManager] ✅ RabbitMQ connected');
      this.emit('connected');
      return this._connection;
    } catch (err) {
      this._isConnecting = false;
      this._connection   = null;
      logger.error('[ConnectionManager] Connection failed', { error: err.message });
      this._scheduleReconnect();
      return null;
    }
  }

  /** Create a regular channel. Pass a name for diagnostics. */
  async createChannel(name = null) {
    const conn = await this.connect();
    if (!conn) return null;
    return this._wrapChannel(conn.createChannel(), name);
  }

  /** Create a publisher confirm channel. Pass a name for diagnostics. */
  async createConfirmChannel(name = null) {
    const conn = await this.connect();
    if (!conn) return null;
    return this._wrapChannel(conn.createConfirmChannel(), name);
  }

  isConnected() {
    return this._connection !== null;
  }

  async close() {
    this._shuttingDown = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._connection) {
      await Promise.race([
        this._connection.close(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('close-timeout')), 3_000)),
      ]).catch(() => {});
      this._connection = null;
    }
    logger.info('[ConnectionManager] Connection closed gracefully');
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _handleDisconnect() {
    this._connection = null;
    this.emit('disconnected');
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this._reconnectTimer || this._shuttingDown) return;
    if (this._reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('[ConnectionManager] Max reconnect attempts reached — giving up');
      return;
    }

    const delay = Math.min(1_000 * 2 ** this._reconnectAttempt, MAX_RECONNECT_DELAY);
    this._reconnectAttempt++;

    logger.info(`[ConnectionManager] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempt})`);
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      await this.connect();
    }, delay);
  }

  async _wrapChannel(channelPromise, name) {
    try {
      const ch = await channelPromise;
      ch.on('error', (err) => {
        logger.error('[ConnectionManager] Channel error', { name, error: err.message });
      });
      ch.on('close', () => {
        logger.debug('[ConnectionManager] Channel closed', { name });
      });
      return ch;
    } catch (err) {
      logger.error('[ConnectionManager] Failed to create channel', { name, error: err.message });
      return null;
    }
  }
}

module.exports = new ConnectionManager();
