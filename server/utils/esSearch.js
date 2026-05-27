'use strict';

const SearchService = require('../services/search.service');
const { logger } = require('./logger');
const { getBreaker } = require('./circuitBreaker');

// Circuit breaker for Elasticsearch — prevents cascade failures when ES is down.
// At 10k concurrent users, without this every request would wait for ES timeout
// before falling back to MongoDB, creating a 5-second delay for ALL users.
const esBreaker = getBreaker('elasticsearch', {
  failureThreshold: 3,
  resetTimeout: 30_000,
  timeout: 5_000,
  successThreshold: 2,
});

/**
 * Elasticsearch-first search with MongoDB hydration.
 *
 * Uses ES for relevance-ranked text search, then fetches full documents
 * from MongoDB (with population, projection, etc.) to preserve the exact
 * response format the frontend expects.
 *
 * Returns { docs, pagination } or null if ES is unavailable / errors.
 *
 * @param {Object} opts
 * @param {string}  opts.entity       - ES entity name (e.g. 'electronics')
 * @param {Object}  opts.searchParams - Passed directly to SearchService.search()
 * @param {Object}  opts.Model        - Mongoose model
 * @param {Object}  [opts.projection] - MongoDB field projection
 * @param {Array}   [opts.populate]   - Array of { path, select } for .populate()
 * @returns {Promise<{docs: Array, pagination: Object}|null>}
 */
async function esHydratedSearch({
  entity,
  searchParams,
  Model,
  projection,
  populate = [{ path: 'seller', select: 'name profileImage' }],
}) {
  if (!searchParams.query || !SearchService.isAvailable()) return null;

  // Circuit breaker: if ES has been failing, skip immediately (< 1ms)
  // instead of waiting for timeout (5s). Falls back to MongoDB regex.
  if (!esBreaker.isAvailable()) return null;

  try {
    const result = await esBreaker.fire(
      () => SearchService.search({ ...searchParams, entity }),
      null, // fallback on circuit open
    );
    if (!result || !Array.isArray(result.listings)) return null;

    const esIds = result.listings.map(l => l._id);

    // Zero-hit query is still a valid ES response. Return empty docs so
    // callers keep ES as the source instead of falling back to Mongo regex.
    if (esIds.length === 0) {
      return { docs: [], pagination: result.pagination };
    }

    // Hydrate from MongoDB — preserves populated refs, projections, savedBy, etc.
    let q = Model.find({ _id: { $in: esIds } });
    if (projection) q = q.select(projection);
    for (const p of populate) {
      q = q.populate(p.path, p.select);
    }
    const docs = await q.lean();

    // Reorder to match ES relevance ranking
    const orderMap = new Map(esIds.map((id, i) => [id, i]));
    docs.sort(
      (a, b) =>
        (orderMap.get(a._id.toString()) ?? 999) -
        (orderMap.get(b._id.toString()) ?? 999),
    );

    return { docs, pagination: result.pagination };
  } catch (err) {
    logger.error(`[ES] Hydrated search error for ${entity}:`, err.message);
    return null;
  }
}

module.exports = { esHydratedSearch };
