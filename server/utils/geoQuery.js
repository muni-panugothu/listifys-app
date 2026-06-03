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
 * - If the filter already has a location text AND lat/lng → use $or (text OR geo)
 *   This is the critical path: listings saved with text-only location (no GPS)
 *   are found by the text branch; listings with GPS are found by the geo branch.
 * - If ONLY lat/lng (no location text) → still use $or but with the geo branch only,
 *   plus a fallback that allows docs WITHOUT a coordinates field (covers text-only listings).
 * - If no lat/lng → no-op (return all listings unfiltered by location)
 *
 * @param {object} filter - MongoDB filter (may already have $text / location)
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
    // No text location filter provided.
    // Use $or: listings WITH valid coordinates in range, OR listings with NO
    // coordinates field at all (those are text-only and should not be excluded
    // just because the caller didn't supply a location string).
    const locationOr = {
      $or: [
        { coordinates: geoCondition },
        { coordinates: { $exists: false } },
        { 'coordinates.coordinates': { $exists: false } },
      ],
    };

    if (filter.$and) {
      filter.$and.push(locationOr);
    } else {
      filter.$and = [locationOr];
    }
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

module.exports = { applyGeoFilter, buildSortOption, escapeRegex, buildLocationRegex, applyCountryFilter };

/**
 * Apply an ISO country code filter to a MongoDB filter object.
 * Only adds the filter when countryCode is a non-empty string.
 *
 * @param {object} filter - MongoDB filter object (mutated in place)
 * @param {string|undefined} countryCode - ISO 3166-1 alpha-2 code (e.g. "IN", "US")
 */
function applyCountryFilter(filter, countryCode) {
  if (countryCode && typeof countryCode === 'string') {
    const cc = countryCode.toUpperCase().trim();
    // Use $or so listings created before countryCode was required still appear.
    // Once all documents carry a countryCode this fallback can be removed.
    const countryCondition = {
      $or: [
        { countryCode: cc },
        { countryCode: { $exists: false } },
        { countryCode: null },
        { countryCode: '' },
      ],
    };
    if (filter.$and) {
      filter.$and.push(countryCondition);
    } else {
      filter.$and = [countryCondition];
    }
  }
}

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
