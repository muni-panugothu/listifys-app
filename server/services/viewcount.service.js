/**
 * Write-Back View Counter Service
 *
 * Implements the WRITE-BACK (write-behind) caching pattern for view counts.
 * Instead of writing to MongoDB on every view or every 50 views per listing,
 * this service buffers ALL view increments in memory and flushes them to
 * MongoDB in a single batch operation periodically.
 *
 * Pattern: View → Memory Buffer → Periodic Batch Flush → MongoDB
 *
 * Benefits:
 *   - Reduces MongoDB write operations by 95%+
 *   - No per-request latency for view tracking
 *   - Resilient to Redis failures (memory buffer is primary)
 *   - Batch writes are more efficient than individual updates
 */

const { logger } = require('../utils/logger');

class ViewCountService {
  constructor() {
    // Buffer: { "forsale:listingId": count, "electronics:listingId": count }
    this._buffer = new Map();

    // Model references (set during init)
    this._models = {};

    // Flush config — tuned for 10k+ concurrent users
    // Shorter flush interval means less data loss if process crashes,
    // but more frequent DB writes. 15s is the sweet spot for high-traffic.
    this._flushIntervalMs = 15_000; // 15 seconds (down from 30s)
    this._timer = null;
    this._maxBufferSize = 10_000; // Force flush if buffer exceeds this

    // Stats
    this._stats = { totalViews: 0, flushes: 0, errors: 0 };
  }

  /**
   * Initialize with Mongoose models and start the flush timer.
   */
  init(models) {
    this._models = models; // { forsale: ForSaleModel, electronics: ElectronicsModel, vehicles: VehicleModel }

    this._timer = setInterval(() => this.flush(), this._flushIntervalMs);
    if (this._timer.unref) this._timer.unref();

    logger.info('[ViewCounter] Write-back view counter initialized (flush every 15s)');
  }

  /**
   * Record a view (write to memory buffer only — no DB/Redis call).
   * Auto-flushes if buffer exceeds threshold (prevents memory issues under spike traffic).
   */
  recordView(entity, listingId) {
    const key = `${entity}:${listingId}`;
    this._buffer.set(key, (this._buffer.get(key) || 0) + 1);
    this._stats.totalViews++;

    // Auto-flush if buffer is too large (10k+ users viewing different listings)
    if (this._buffer.size > this._maxBufferSize) {
      this.flush().catch(() => {});
    }
  }

  /**
   * Flush all buffered views to MongoDB in batch.
   */
  async flush() {
    if (this._buffer.size === 0) return;

    // Snapshot and clear the buffer atomically
    const snapshot = new Map(this._buffer);
    this._buffer.clear();

    // Group by entity for batch updates
    const grouped = {};
    for (const [key, count] of snapshot) {
      const [entity, listingId] = key.split(':');
      if (!grouped[entity]) grouped[entity] = [];
      grouped[entity].push({ listingId, count });
    }

    for (const [entity, updates] of Object.entries(grouped)) {
      const Model = this._models[entity];
      if (!Model) {
        logger.error(`[ViewCounter] No model for entity: ${entity}`);
        this._stats.errors++;
        continue;
      }

      try {
        // Use bulkWrite for maximum efficiency (single round-trip to MongoDB)
        const ops = updates.map(({ listingId, count }) => ({
          updateOne: {
            filter: { _id: listingId },
            update: { $inc: { views: count } },
          },
        }));

        await Model.bulkWrite(ops, { ordered: false });

        logger.debug(
          `[ViewCounter] Flushed ${updates.length} view updates for ${entity} ` +
          `(${updates.reduce((s, u) => s + u.count, 0)} total views)`
        );
      } catch (err) {
        logger.error(`[ViewCounter] Flush error for ${entity}:`, err.message);
        this._stats.errors++;

        // Re-buffer failed updates so they aren't lost
        for (const { listingId, count } of updates) {
          const key = `${entity}:${listingId}`;
          this._buffer.set(key, (this._buffer.get(key) || 0) + count);
        }
      }
    }

    this._stats.flushes++;
  }

  /**
   * Get current stats.
   */
  getStats() {
    return {
      ...this._stats,
      pendingViews: this._buffer.size,
    };
  }

  /**
   * Stop the flush timer and do a final flush.
   */
  async shutdown() {
    if (this._timer) clearInterval(this._timer);
    await this.flush();
    logger.info('[ViewCounter] Shutdown complete, final flush done');
  }
}

// Singleton
const viewCounter = new ViewCountService();

module.exports = viewCounter;
