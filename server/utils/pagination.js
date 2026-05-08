/**
 * Pagination Utility — Advanced, high-speed pagination helpers.
 *
 * Features:
 * - Safe parsing with configurable caps to prevent abuse
 * - Page 1: parallel countDocuments + find for total/pages metadata
 * - Page > 1: fetch limit+1, skip expensive countDocuments (O(1) hasMore check)
 * - Consistent response shape across all endpoints
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse and sanitize pagination params from req.query.
 *
 * @param {Object} query          – req.query object
 * @param {Object} [defaults]     – optional overrides
 * @param {number} [defaults.limit]    – default per-page (default: 20)
 * @param {number} [defaults.maxLimit] – max per-page cap  (default: 100)
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query, defaults = {}) {
  const limit = Math.min(
    Math.max(Number(query.limit) || defaults.limit || DEFAULT_LIMIT, 1),
    defaults.maxLimit || MAX_LIMIT,
  );
  const page = Math.max(Number(query.page) || 1, 1);
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Execute an optimised paginated query.
 *
 * Page 1  → parallel find + countDocuments (returns total, totalPages)
 * Page >1 → fetch limit+1 rows, no count (returns hasMore flag only)
 *
 * @param {Object} opts
 * @param {import('mongoose').Model} opts.model     – Mongoose model
 * @param {Object}                    opts.filter    – MongoDB filter
 * @param {Object}                   [opts.sort]     – Sort spec (default: { createdAt: -1 })
 * @param {string|Object}           [opts.select]   – Field projection
 * @param {Array}                    [opts.populate] – Array of populate specs
 * @param {number}                    opts.page      – Current page (1-based)
 * @param {number}                    opts.limit     – Items per page
 * @returns {Promise<{ items: Array, pagination: Object }>}
 */
async function paginatedFind({
  model,
  filter,
  sort = { createdAt: -1 },
  select,
  populate = [],
  page,
  limit,
}) {
  const skip = (page - 1) * limit;

  const buildQuery = (lim) => {
    let q = model.find(filter);
    if (select) q = q.select(select);
    q = q.sort(sort).skip(skip).limit(lim);
    for (const pop of populate) {
      q = q.populate(pop);
    }
    return q.lean();
  };

  let items, total, pagination;

  if (page > 1) {
    // Optimisation: skip expensive countDocuments on subsequent pages.
    // Fetch limit+1 to detect next page without a full count scan.
    items = await buildQuery(limit + 1);
    const hasMore = items.length > limit;
    if (hasMore) items = items.slice(0, limit);
    pagination = { page, limit, hasMore };
  } else {
    // Page 1: parallel count + find for full metadata
    [items, total] = await Promise.all([
      buildQuery(limit),
      model.countDocuments(filter),
    ]);
    pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: limit < total,
    };
  }

  return { items, pagination };
}

module.exports = { parsePagination, paginatedFind };
