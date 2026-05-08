/**
 * Shared geo-query utility — handles the MongoDB limitation where
 * $nearSphere and $text CANNOT be used together in the same query.
 *
 * Strategy: when both search text AND geo filter are present,
 * we use $geoWithin (a simple geometry filter) instead of $nearSphere.
 * $geoWithin IS compatible with $text and other query operators.
 *
 * When ONLY geo is used (no $text), we use $nearSphere for native
 * nearest-first ordering.
 */

/**
 * Apply geo filter to a MongoDB filter object.
 * 
 * RULES:
 * - If the filter already has $text AND lat/lng → use $geoWithin (compatible)
 * - If NO $text and lat/lng → use $nearSphere (nearest-first ordering)
 * - If no lat/lng → no-op
 *
 * @param {object} filter - MongoDB filter (may already have $text)
 * @param {number|string} lat
 * @param {number|string} lng
 * @param {number|string} radiusKm - default 50 km
 */
function applyGeoFilter(filter, lat, lng, radiusKm = 50) {
  if (!lat || !lng) return;

  const numLat = Number(lat);
  const numLng = Number(lng);
  const maxDistMeters = (Number(radiusKm) || 50) * 1000;
  
  const radiusRadians = maxDistMeters / 6378100; // Earth radius in meters
  const geoCondition = {
    $geoWithin: {
      $centerSphere: [[numLng, numLat], radiusRadians],
    },
  };

  // If a text-based location filter already exists, use OR logic:
  // match by EITHER text location OR geo coordinates.
  // This ensures listings without stored coordinates still appear via text match,
  // while listings with coordinates are matched by proximity.
  const locationKey = filter.location
    ? 'location'
    : filter['location.address']
      ? 'location.address'
      : null;

  if (locationKey) {
    const textFilter = filter[locationKey];
    delete filter[locationKey];

    const locationOr = {
      $or: [
        { [locationKey]: textFilter },
        { coordinates: geoCondition },
      ],
    };

    // If $and already exists (from other conditions), push to it
    if (filter.$and) {
      filter.$and.push(locationOr);
    } else {
      filter.$and = [locationOr];
    }
  } else {
    // No text location filter — just add geo filter directly
    filter.coordinates = geoCondition;
  }
}

/**
 * Build sort options. When sort=nearest and geo is active without $text,
 * return empty sort to let $nearSphere's natural order win.
 *
 * @param {string} sort - 'newest' | 'price_asc' | 'price_desc' | 'nearest' | 'oldest'
 * @param {boolean} hasGeo - whether lat/lng were provided
 * @param {boolean} hasText - whether $text search is active
 * @returns {object} MongoDB sort option
 */
function buildSortOption(sort, hasGeo = false, hasText = false) {
  if (sort === 'nearest' && hasGeo && !hasText) return {}; // $nearSphere natural order
  if (sort === 'price_asc') return { price: 1 };
  if (sort === 'price_desc') return { price: -1 };
  if (sort === 'oldest') return { createdAt: 1 };
  return { createdAt: -1 }; // default: newest
}

module.exports = { applyGeoFilter, buildSortOption, escapeRegex, buildLocationRegex };

/**
 * Escape regex special characters in a user-supplied string
 * to prevent ReDoS and over-matching when used in MongoDB $regex.
 */
function escapeRegex(str) {
  if (!str) return '';
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a location filter that matches ANY part of a comma-separated
 * location string (e.g. "Uppal, Hyderabad, Telangana" → /Uppal|Hyderabad|Telangana/i).
 *
 * This is far more tolerant than matching the full string as a substring,
 * because stored locations may only contain the city or sublocality.
 *
 * @param {string} locationStr - raw location string from the client
 * @returns {{ $regex: string, $options: string }} MongoDB regex filter
 */
function buildLocationRegex(locationStr) {
  if (!locationStr) return null;
  const parts = String(locationStr)
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .map(escapeRegex);
  if (parts.length === 0) return null;
  return { $regex: parts.join('|'), $options: 'i' };
}
