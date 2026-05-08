/**
 * Whitelist request body fields — prevents mass assignment attacks.
 *
 * Fields like `seller`, `status`, `views`, `savedBy`, `featured`,
 * `sellerRating`, `sellerReviews`, `slug`, `createdAt`, `updatedAt`
 * must NEVER be set from user input.
 *
 * @param {object} body - req.body
 * @param {string[]} allowedFields - fields the user may set
 * @returns {object} sanitized object with only allowed keys
 */
function sanitizeBody(body, allowedFields) {
  const sanitized = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      sanitized[key] = body[key];
    }
  }
  return sanitized;
}

// ── Common listing fields every category shares ──────────────
const COMMON_LISTING_FIELDS = [
  'title', 'description', 'price', 'subcategory', 'condition',
  'location', 'coordinates', 'images', 'features',
  'phone', 'phoneCode', 'currency',
];

// ── Per-category extra fields ────────────────────────────────
const CATEGORY_FIELDS = {
  Beauty: ['brand', 'skinType', 'shade', 'volume', 'ingredients', 'expiryDate', 'gender'],
  Books: ['author', 'isbn', 'publisher', 'edition', 'language', 'pages'],
  Collectibles: ['brand', 'era', 'material', 'color', 'rarity', 'authenticity', 'origin'],
  Fashion: ['brand', 'size', 'gender', 'fabricType', 'color'],
  Furniture: ['material', 'dimensions', 'weight', 'assemblyRequired', 'numberOfPieces', 'color'],
  Mobiles: ['brand', 'model', 'storage', 'ram', 'screenSize', 'batteryHealth', 'warranty', 'color'],
  Others: [],
  Pets: ['breed', 'petAge', 'gender', 'vaccinated', 'trained', 'color', 'weight'],
  Sports: ['brand', 'sportType', 'size', 'material', 'color', 'weight', 'ageGroup'],
  Toys: ['brand', 'ageGroup', 'material', 'batteryRequired', 'playMode', 'numberOfPieces', 'characterTheme', 'color'],
  Properties: [
    'bedrooms', 'bathrooms', 'furnishing', 'squareFeet',
    'availableFrom', 'genderPreference', 'occupancy',
    'petFriendly', 'propertyType',
  ],
};

/**
 * Get allowed fields for a category (common + category-specific).
 * @param {string} category - e.g. "Beauty", "Books"
 * @returns {string[]}
 */
function getAllowedFields(category) {
  const extra = CATEGORY_FIELDS[category] || [];
  return [...COMMON_LISTING_FIELDS, ...extra];
}

module.exports = { sanitizeBody, getAllowedFields, COMMON_LISTING_FIELDS, CATEGORY_FIELDS };
