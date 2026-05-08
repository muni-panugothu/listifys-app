/**
 * Elasticsearch Search Service — Production-Grade (Flipkart/Amazon-style)
 *
 * KEY DESIGN:
 *   - UNIFIED INDEX: All 18 categories in one index (listify_products) with _entity field
 *   - DYNAMIC FIELD EXTRACTION: Reads ALL fields from MongoDB docs automatically —
 *     no manual per-entity field mapping. New fields in MongoDB auto-appear in search.
 *   - MULTI-STRATEGY SEARCH: exact → phrase → fuzzy → cross_fields cascade
 *   - AUTOCOMPLETE: search_as_you_type + edge_ngram for instant suggestions
 *   - REAL-TIME SYNC: MongoDB Change Streams auto-sync inserts/updates/deletes
 *   - BACKGROUND REINDEX: Full MongoDB → ES sync on startup (non-blocking)
 *
 * All operations are no-ops when Elasticsearch is not connected.
 */

'use strict';

const { getClient, getIsConnected, UNIFIED_INDEX } = require('../config/elasticsearch');
const { logger } = require('../utils/logger');

// ── Fields to EXCLUDE from ES indexing (internal/binary/security) ──
const EXCLUDED_FIELDS = new Set([
  '_id', '__v', 'savedBy', 'userId', 'password', 'resetToken',
  'resetTokenExpiry', 'twoFactorSecret', 'devices', 'loginHistory',
  'stats', 'pricing',
]);

// ── Fields that are objects and need special handling ──
const OBJECT_LOCATION_FIELDS = new Set(['location']);
const OBJECT_IMAGE_FIELDS = new Set(['images']);
const OBJECT_AVAILABILITY_FIELDS = new Set(['availability']);

/**
 * Dynamically extract a flat ES document from ANY MongoDB document.
 * No hardcoded per-entity field lists — reads every field automatically.
 *
 * Handles:
 *   - location objects ({type, coordinates, address}) → extract address string
 *   - image objects ([{url, isPrimary}]) → extract URL strings
 *   - availability objects ({schedule, recurring}) → extract recurring string
 *   - ObjectId refs → toString()
 *   - Arrays of strings → pass through
 *   - Nested objects → skip (ES dynamic mapping handles simple types)
 */
function extractDocument(entity, mongoDoc) {
  const doc = { _entity: entity };

  // Inject entity name as category if not already present, so searching
  // "properties" or "electronics" matches documents from that category.
  const raw = mongoDoc.toObject ? mongoDoc.toObject() : mongoDoc;
  if (!raw.category) {
    doc.category = entity;
  }

  for (const [key, value] of Object.entries(raw)) {
    if (EXCLUDED_FIELDS.has(key)) continue;
    if (value === null || value === undefined) continue;

    // Location: extract address string from GeoJSON
    if (OBJECT_LOCATION_FIELDS.has(key) && typeof value === 'object' && !Array.isArray(value)) {
      doc[key] = value.address || value.city || '';
      // Also grab coordinates if they exist inside location
      if (value.coordinates && Array.isArray(value.coordinates) && value.coordinates.length === 2) {
         doc.coordinates = [value.coordinates[0], value.coordinates[1]];
      } else if (value.type === 'Point' && Array.isArray(value.coordinates) && value.coordinates.length === 2) {
         doc.coordinates = [value.coordinates[0], value.coordinates[1]];
      }
      continue;
    }
    
    // Handle coordinates at root level
    if (key === 'coordinates' && value) {
      if (Array.isArray(value.coordinates) && value.coordinates.length === 2) {
        doc.coordinates = [value.coordinates[0], value.coordinates[1]];
      } else if (Array.isArray(value) && value.length === 2) {
        doc.coordinates = [value[0], value[1]];
      }
      continue;
    }

    // Images: extract URL strings from [{url, isPrimary}]
    if (OBJECT_IMAGE_FIELDS.has(key) && Array.isArray(value)) {
      doc[key] = value
        .map(img => (typeof img === 'string' ? img : (img?.url || '')))
        .filter(Boolean);
      continue;
    }

    // Availability: extract string from {recurring, schedule}
    if (OBJECT_AVAILABILITY_FIELDS.has(key) && typeof value === 'object' && !Array.isArray(value)) {
      doc[key] = value.recurring || '';
      continue;
    }

    // ObjectId → string
    if (value && typeof value === 'object' && value._bsontype === 'ObjectId') {
      doc[key] = value.toString();
      continue;
    }

    // Mongoose ObjectId refs (seller, userId, etc.)
    if (key === 'seller' && value) {
      doc.sellerId = value.toString();
      continue;
    }

    // Skip complex nested objects (pricing, stats, etc.) — except arrays
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      continue;
    }

    // Arrays of objects (e.g. features: [String]) — pass through if simple
    if (Array.isArray(value)) {
      const simplified = value.map(item => {
        if (typeof item === 'string' || typeof item === 'number') return item;
        if (item && typeof item === 'object' && item._bsontype === 'ObjectId') return item.toString();
        return null;
      }).filter(v => v !== null);
      if (simplified.length > 0) doc[key] = simplified;
      continue;
    }

    // Primitives (string, number, boolean, Date)
    doc[key] = value;
  }

  return doc;
}

class SearchService {

  // ══════════════════════════════════════════════════════════
  //  Index a single listing (called on create / update)
  // ══════════════════════════════════════════════════════════
  static async indexListing(entity, listing) {
    if (!getIsConnected()) return;

    const client = getClient();
    if (!listing) return;

    try {
      const id = (listing._id || listing.id).toString();
      const doc = extractDocument(entity, listing);

      await client.index({
        index: UNIFIED_INDEX,
        id: `${entity}_${id}`,
        document: doc,
        refresh: 'wait_for',
      });

      logger.info(`[ES] Indexed ${entity}: ${id}`);
    } catch (err) {
      logger.error(`[ES] Index error for ${entity}:`, err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Remove a listing from the index
  // ══════════════════════════════════════════════════════════
  static async removeListing(entity, id) {
    if (!getIsConnected()) return;

    const client = getClient();

    try {
      await client.delete({
        index: UNIFIED_INDEX,
        id: `${entity}_${id.toString()}`,
        refresh: 'wait_for',
      });
      logger.info(`[ES] Removed ${entity}: ${id}`);
    } catch (err) {
      if (err.meta?.statusCode !== 404) {
        logger.error(`[ES] Remove error for ${entity}:`, err.message);
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  SEARCH — Multi-strategy (Flipkart/Amazon-grade)
  //
  //  Strategy cascade:
  //    1. Exact phrase match on title (highest boost)
  //    2. multi_match on all text fields with synonyms + fuzzy
  //    3. Autocomplete (edge_ngram) fallback for partial words
  //    4. cross_fields for multi-word queries across fields
  // ══════════════════════════════════════════════════════════
  static async search({
    query = '',
    entity = 'all',
    category,
    condition,
    minPrice,
    maxPrice,
    location,
    lat,
    lng,
    radius = 50,
    brand,
    fuelType,
    transmission,
    sort = 'relevance',
    page = 1,
    limit = 50,
  } = {}) {
    if (!getIsConnected()) return null;

    const client = getClient();

    try {
      const must = [];
      const should = [];
      const filter = [{ term: { status: 'active' } }];

      // ── Entity filter ──
      if (entity && entity !== 'all') {
        filter.push({ term: { _entity: entity } });
      }

      // ── Text search: multi-strategy cascade ──
      if (query && query.trim()) {
        const q = query.trim();

        // Strategy 1: Exact phrase match on title (highest score)
        should.push({
          match_phrase: {
            title: { query: q, boost: 10 },
          },
        });

        // Strategy 2: search_as_you_type on title (instant typeahead)
        should.push({
          multi_match: {
            query: q,
            type: 'bool_prefix',
            fields: ['title.suggest', 'title.suggest._2gram', 'title.suggest._3gram'],
            boost: 5,
          },
        });

        // Strategy 3: Full-text with synonyms + fuzzy on all searchable fields
        must.push({
          multi_match: {
            query: q,
            fields: [
              'title^4',
              'title.autocomplete^2',
              'brand^3',
              'brand.autocomplete^1.5',
              'category^2',
              'category.autocomplete',
              'subcategory^2',
              'subcategory.autocomplete',
              'description^1.5',
              'location',
              'location.autocomplete',
              'sellerName',
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
            prefix_length: 1,
            operator: 'or',
            minimum_should_match: '50%',
          },
        });

        // Strategy 4: cross_fields for multi-word queries (e.g. "samsung galaxy s21")
        if (q.includes(' ')) {
          should.push({
            multi_match: {
              query: q,
              fields: ['title^3', 'brand^2', 'model^2', 'subcategory', 'description'],
              type: 'cross_fields',
              operator: 'and',
              boost: 3,
            },
          });
        }

        // Strategy 5: Autocomplete fallback on all .autocomplete sub-fields
        should.push({
          multi_match: {
            query: q,
            fields: ['title.autocomplete^2', 'brand.autocomplete', 'subcategory.autocomplete', 'category.autocomplete', 'location.autocomplete'],
            type: 'best_fields',
            boost: 1,
          },
        });
      }

      // ── Filters ──
      if (category) {
        const cats = category.split(',').map(c => c.trim());
        filter.push({ terms: { 'subcategory.keyword': cats } });
      }
      if (condition) {
        const conds = condition.split(',').map(c => c.trim());
        filter.push({ terms: { condition: conds } });
      }
      if (minPrice || maxPrice) {
        const range = {};
        if (minPrice) range.gte = Number(minPrice);
        if (maxPrice) range.lte = Number(maxPrice);
        filter.push({ range: { price: range } });
      }
      if (location) {
        must.push({
          multi_match: {
            query: location,
            fields: ['location', 'location.autocomplete'],
            fuzziness: 'AUTO',
          },
        });
      }
      
      if (lat && lng) {
        filter.push({
          geo_distance: {
            distance: `${Number(radius) || 50}km`,
            coordinates: [Number(lng), Number(lat)]
          }
        });
      }
      
      if (brand) filter.push({ term: { 'brand.keyword': brand } });
      if (fuelType) filter.push({ term: { 'fuelType.keyword': fuelType } });
      if (transmission) filter.push({ term: { 'transmission.keyword': transmission } });

      // ── Sort ──
      let sortOption;
      switch (sort) {
        case 'nearest':
          if (lat && lng) {
            sortOption = [
              {
                _geo_distance: {
                  coordinates: [Number(lng), Number(lat)],
                  order: 'asc',
                  unit: 'km',
                  distance_type: 'arc'
                }
              }
            ];
          } else {
             sortOption = [{ createdAt: 'desc' }];
          }
          break;
        case 'price_asc':  sortOption = [{ price: 'asc' }]; break;
        case 'price_desc': sortOption = [{ price: 'desc' }]; break;
        case 'oldest':     sortOption = [{ createdAt: 'asc' }]; break;
        case 'views':      sortOption = [{ views: 'desc' }]; break;
        case 'relevance':
        default:
          sortOption = query ? [{ _score: 'desc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }];
      }

      const from = (Number(page) - 1) * Number(limit);

      const searchBody = {
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            should,
            filter,
          },
        },
        sort: sortOption,
        from,
        size: Number(limit),
        highlight: {
          fields: {
            title: { pre_tags: ['<mark>'], post_tags: ['</mark>'] },
            description: { pre_tags: ['<mark>'], post_tags: ['</mark>'], fragment_size: 150 },
            'brand': { pre_tags: ['<mark>'], post_tags: ['</mark>'] },
          },
        },
      };

      const result = await client.search({ index: UNIFIED_INDEX, ...searchBody });

      const hits = result.hits.hits.map(hit => {
        let distance = null;
        if (hit.sort && sort === 'nearest') {
          distance = hit.sort[0];
          if (distance) distance = Math.round(distance * 10) / 10;
        }
        return {
          _id: hit._id.replace(/^[a-z]+_/, ''),
          ...hit._source,
          _score: hit._score,
          _highlights: hit.highlight || {},
          distance
        };
      });

      const total = typeof result.hits.total === 'object'
        ? result.hits.total.value
        : result.hits.total;

      return {
        listings: hits,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / Number(limit)),
          limit: Number(limit),
        },
        source: 'elasticsearch',
      };
    } catch (err) {
      logger.error('[ES] Search error:', err.message);
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════
  //  AUTOCOMPLETE — Instant suggestions (Amazon/Flipkart-style)
  //
  //  Uses: search_as_you_type + edge_ngram + phrase_prefix
  //  Returns: title, price, thumbnail, entity for each match
  // ══════════════════════════════════════════════════════════
  static async suggest(query, { entity = 'all', limit = 8 } = {}) {
    if (!getIsConnected() || !query) return [];

    const client = getClient();

    try {
      const filter = [{ term: { status: 'active' } }];
      if (entity && entity !== 'all') {
        filter.push({ term: { _entity: entity } });
      }

      const result = await client.search({
        index: UNIFIED_INDEX,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query.trim(),
                  type: 'bool_prefix',
                  fields: [
                    'title.suggest',
                    'title.suggest._2gram',
                    'title.suggest._3gram',
                    'title.autocomplete^2',
                    'brand.autocomplete',
                    'subcategory.autocomplete',
                    'category.autocomplete',
                  ],
                },
              },
            ],
            filter,
          },
        },
        _source: ['title', 'price', 'location', 'images', 'brand', 'model', 'subcategory', 'currency', '_entity', 'slug'],
        size: Number(limit),
        collapse: { field: 'title.keyword', inner_hits: { name: 'by_entity', size: 0 } },
      });

      return result.hits.hits.map(hit => ({
        _id: hit._id.replace(/^[a-z]+_/, ''),
        title: hit._source.title,
        price: hit._source.price,
        currency: hit._source.currency,
        location: hit._source.location,
        thumbnail: hit._source.images?.[0] || null,
        brand: hit._source.brand,
        model: hit._source.model,
        subcategory: hit._source.subcategory,
        slug: hit._source.slug,
        _entity: hit._source._entity,
      }));
    } catch (err) {
      // collapse may not be supported on all versions — retry without
      if (err.message?.includes('collapse') || err.meta?.statusCode === 400) {
        try {
          const filter = [{ term: { status: 'active' } }];
          if (entity && entity !== 'all') filter.push({ term: { _entity: entity } });

          const result = await client.search({
            index: UNIFIED_INDEX,
            query: {
              bool: {
                must: [{
                  multi_match: {
                    query: query.trim(),
                    type: 'bool_prefix',
                    fields: ['title.suggest', 'title.suggest._2gram', 'title.suggest._3gram', 'title.autocomplete^2', 'brand.autocomplete'],
                  },
                }],
                filter,
              },
            },
            _source: ['title', 'price', 'location', 'images', 'brand', 'model', 'subcategory', 'currency', '_entity', 'slug'],
            size: Number(limit),
          });

          return result.hits.hits.map(hit => ({
            _id: hit._id.replace(/^[a-z]+_/, ''),
            title: hit._source.title,
            price: hit._source.price,
            currency: hit._source.currency,
            location: hit._source.location,
            thumbnail: hit._source.images?.[0] || null,
            brand: hit._source.brand,
            model: hit._source.model,
            subcategory: hit._source.subcategory,
            slug: hit._source.slug,
            _entity: hit._source._entity,
          }));
        } catch (retryErr) {
          logger.error('[ES] Suggest retry error:', retryErr.message);
          return [];
        }
      }
      logger.error('[ES] Suggest error:', err.message);
      return [];
    }
  }

  // ══════════════════════════════════════════════════════════
  //  BULK INDEX — Full sync from MongoDB → ES
  //  Called on startup (background) and admin /reindex endpoint
  // ══════════════════════════════════════════════════════════
  static async bulkIndex(entity, listings) {
    if (!getIsConnected()) return { indexed: 0 };

    const client = getClient();

    try {
      const operations = listings.flatMap(listing => {
        const id = (listing._id || listing.id).toString();
        const doc = extractDocument(entity, listing);
        return [
          { index: { _index: UNIFIED_INDEX, _id: `${entity}_${id}` } },
          doc,
        ];
      });

      if (operations.length === 0) return { indexed: 0 };

      // Chunk into batches of 500 docs to avoid payload limits
      const BATCH_SIZE = 1000; // 500 docs × 2 (action + doc)
      let totalIndexed = 0;
      let totalErrors = 0;

      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = operations.slice(i, i + BATCH_SIZE);
        const result = await client.bulk({ operations: batch, refresh: false });

        const indexed = result.items?.filter(it => it.index?.status < 300).length || 0;
        const errors = result.items?.filter(it => it.index?.status >= 300).length || 0;
        totalIndexed += indexed;
        totalErrors += errors;

        if (errors > 0) {
          const sampleError = result.items.find(it => it.index?.status >= 300);
          logger.warn(`[ES] Bulk batch errors for ${entity}:`, sampleError?.index?.error?.reason?.slice(0, 200));
        }
      }

      // Final refresh after all batches
      await client.indices.refresh({ index: UNIFIED_INDEX });

      logger.info(`[ES] Bulk indexed ${totalIndexed} ${entity} listings (${totalErrors} errors)`);
      return { indexed: totalIndexed, errors: totalErrors };
    } catch (err) {
      logger.error(`[ES] Bulk index error for ${entity}:`, err.message);
      return { indexed: 0, error: err.message };
    }
  }

  // ══════════════════════════════════════════════════════════
  //  BACKGROUND REINDEX — Syncs all MongoDB data to ES on startup
  //  Non-blocking: runs in background after server starts
  // ══════════════════════════════════════════════════════════
  static async backgroundReindex(MODEL_MAP) {
    if (!getIsConnected()) return;

    logger.info('[ES] Starting background reindex...');
    const startTime = Date.now();
    let totalDocs = 0;

    for (const [entity, Model] of Object.entries(MODEL_MAP)) {
      try {
        const count = await Model.countDocuments({ status: 'active' });
        if (count === 0) continue;

        // Stream in batches for large collections
        const BATCH = 500;
        let skip = 0;
        let entityTotal = 0;

        while (skip < count) {
          const docs = await Model.find({ status: 'active' })
            .skip(skip)
            .limit(BATCH)
            .lean();

          if (docs.length === 0) break;
          const result = await SearchService.bulkIndex(entity, docs);
          entityTotal += result.indexed || 0;
          skip += BATCH;
        }

        totalDocs += entityTotal;
        logger.info(`[ES] Reindexed ${entity}: ${entityTotal}/${count}`);
      } catch (err) {
        logger.error(`[ES] Background reindex error for ${entity}:`, err.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`[ES] Background reindex complete: ${totalDocs} documents in ${elapsed}s`);
  }

  // ══════════════════════════════════════════════════════════
  //  CHANGE STREAMS — Real-time MongoDB → ES sync
  //
  //  Watches all collections for insert/update/delete and
  //  auto-syncs to Elasticsearch in real-time.
  //  This is the "Flipkart/Amazon" way — zero manual indexing calls needed.
  // ══════════════════════════════════════════════════════════
  static startChangeStreams(MODEL_MAP) {
    if (!getIsConnected()) {
      logger.info('[ES] Skipping change streams — ES not connected');
      return;
    }

    for (const [entity, Model] of Object.entries(MODEL_MAP)) {
      try {
        const stream = Model.watch([], {
          fullDocument: 'updateLookup',
          fullDocumentBeforeChange: undefined,
        });

        stream.on('change', async (change) => {
          try {
            switch (change.operationType) {
              case 'insert':
              case 'update':
              case 'replace': {
                const doc = change.fullDocument;
                if (!doc) break;

                // Only index active listings
                if (doc.status && doc.status !== 'active') {
                  await SearchService.removeListing(entity, doc._id);
                } else {
                  await SearchService.indexListing(entity, doc);
                }
                break;
              }

              case 'delete': {
                const id = change.documentKey?._id;
                if (id) await SearchService.removeListing(entity, id);
                break;
              }
            }
          } catch (err) {
            logger.error(`[ES] Change stream handler error for ${entity}:`, err.message);
          }
        });

        stream.on('error', (err) => {
          logger.error(`[ES] Change stream error for ${entity}:`, err.message);
          // Auto-restart after 5 seconds
          setTimeout(() => {
            logger.info(`[ES] Restarting change stream for ${entity}...`);
            SearchService.startChangeStreams({ [entity]: Model });
          }, 5000);
        });

        logger.info(`[ES] Change stream started for ${entity}`);
      } catch (err) {
        logger.error(`[ES] Failed to start change stream for ${entity}:`, err.message);
      }
    }
  }

  static isAvailable() {
    return getIsConnected();
  }
}

module.exports = SearchService;

