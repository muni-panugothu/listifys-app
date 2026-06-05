'use strict';
/**
 * ── MongoDB Compound Index Optimization ─────────────────────────────────────
 * Ensures optimal compound indexes exist for all hot query patterns.
 *
 * At 10k+ concurrent users, missing indexes cause full collection scans
 * that saturate MongoDB's CPU and kill latency for everyone.
 *
 * Run on startup (idempotent — createIndex is a no-op if index exists).
 *
 * Index Strategy:
 *   - Every getAll() query uses: { status: 1, createdAt: -1 }
 *   - Search queries use: { status: 1, title: 'text', description: 'text' }
 *   - Geo queries use: { status: 1, location: '2dsphere' }
 *   - Category filters use: { status: 1, category: 1, createdAt: -1 }
 *   - Price range queries use: { status: 1, price: 1 }
 *   - Seller queries use: { seller: 1, status: 1, createdAt: -1 }
 *   - Slug lookups use: { slug: 1 } (unique)
 */
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// ── Index definitions per collection ──
// Each entry: { collection, indexes: [{ fields, options }] }
const INDEX_DEFINITIONS = [
  // ── Common pattern for ALL listing collections ──
  ...([
    'forsales', 'electronics', 'mobiles', 'furnitures', 'fashions',
    'sports', 'collectibles', 'pets', 'books', 'beauties', 'others',
    'toys', 'jobs', 'vehicles', 'takecares', 'events', 'properties',
  ].map(collection => ({
    collection,
    indexes: [
      // Primary listing query: active listings, newest first
      { fields: { status: 1, createdAt: -1 }, options: { name: 'idx_status_created', background: true } },
      // Home feed query: active listings scoped to the user's country
      { fields: { status: 1, countryCode: 1, createdAt: -1 }, options: { name: 'idx_status_country_created', background: true } },
      // Seller's listings (my-listings page)
      { fields: { seller: 1, status: 1, createdAt: -1 }, options: { name: 'idx_seller_status_created', background: true } },
      // Slug lookup (detail page)
      { fields: { slug: 1 }, options: { name: 'idx_slug', unique: true, sparse: true, background: true } },
      // Price range queries
      { fields: { status: 1, price: 1, createdAt: -1 }, options: { name: 'idx_status_price_created', background: true } },
      // View count for popular/trending
      { fields: { status: 1, views: -1 }, options: { name: 'idx_status_views', background: true } },
      // Geo queries (location-based search)
      { fields: { 'location.coordinates': '2dsphere' }, options: { name: 'idx_location_geo', background: true, sparse: true } },
    ],
  }))),

  // ── Users collection ──
  {
    collection: 'users',
    indexes: [
      { fields: { email: 1 }, options: { name: 'idx_email', unique: true, background: true } },
      { fields: { status: 1, createdAt: -1 }, options: { name: 'idx_status_created', background: true } },
      { fields: { role: 1, status: 1 }, options: { name: 'idx_role_status', background: true } },
    ],
  },

  // ── Chat messages ──
  {
    collection: 'messages',
    indexes: [
      { fields: { chatRoom: 1, createdAt: -1 }, options: { name: 'idx_chatroom_created', background: true } },
      { fields: { sender: 1, createdAt: -1 }, options: { name: 'idx_sender_created', background: true } },
    ],
  },

  // ── Chat rooms ──
  {
    collection: 'chatrooms',
    indexes: [
      { fields: { participants: 1, updatedAt: -1 }, options: { name: 'idx_participants_updated', background: true } },
    ],
  },

  // ── Notifications ──
  {
    collection: 'notifications',
    indexes: [
      { fields: { recipient: 1, read: 1, createdAt: -1 }, options: { name: 'idx_recipient_read_created', background: true } },
      { fields: { recipient: 1, createdAt: -1 }, options: { name: 'idx_recipient_created', background: true } },
    ],
  },
];

/**
 * Ensure all compound indexes exist. Idempotent — safe to run on every startup.
 * Runs in background so it doesn't block server startup.
 */
async function ensureIndexes() {
  if (mongoose.connection.readyState !== 1) {
    logger.warn('[Indexes] MongoDB not ready — skipping index optimization');
    return;
  }

  const db = mongoose.connection.db;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const { collection, indexes } of INDEX_DEFINITIONS) {
    for (const { fields, options } of indexes) {
      try {
        // Check if collection exists first
        const collections = await db.listCollections({ name: collection }).toArray();
        if (collections.length === 0) {
          skipped++;
          continue;
        }

        await db.collection(collection).createIndex(fields, options);
        created++;
      } catch (err) {
        // Ignore "index already exists with different options" errors
        if (err.code === 85 || err.code === 86) {
          skipped++;
        } else {
          errors++;
          logger.warn(`[Indexes] Failed to create index on ${collection}`, {
            fields: JSON.stringify(fields),
            error: err.message,
          });
        }
      }
    }
  }

  logger.info(`[Indexes] Optimization complete: ${created} created, ${skipped} skipped, ${errors} errors`);
}

module.exports = { ensureIndexes };
