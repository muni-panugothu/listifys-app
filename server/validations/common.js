/**
 * Common Validation Schemas & Helpers
 *
 * Shared rules reused across all listing validations:
 *   - title, description, price, location, images, phone
 *   - condition, status, pagination, mongoId
 */

const Joi = require('joi');

// ── Reusable field schemas ──────────────────────────────────────

const title = Joi.string().trim().min(3).max(200).messages({
  'string.min': 'Title must be at least 3 characters',
  'string.max': 'Title cannot exceed 200 characters',
  'any.required': 'Title is required',
});

const description = Joi.string().trim().min(20).max(5000).messages({
  'string.min': 'Description must be at least 20 characters',
  'string.max': 'Description cannot exceed 5000 characters',
  'any.required': 'Description is required',
});

const price = Joi.number().min(0).messages({
  'number.min': 'Price cannot be negative',
  'any.required': 'Price is required',
});

const location = Joi.string().trim().min(2).max(300).messages({
  'string.min': 'Location must be at least 2 characters',
  'any.required': 'Location is required',
});

const coordinates = Joi.object({
  type: Joi.string().valid('Point').default('Point'),
  coordinates: Joi.array().items(Joi.number()).length(2),
}).optional();

// Accept absolute URLs and internal proxy/image key paths returned by upload endpoints.
const imageUrl = Joi.string()
  .trim()
  .max(1200)
  .custom((value, helpers) => {
    if (!value) return value;

    // Internal proxy URL (default upload output): /api/images/<key>
    if (value.startsWith('/api/images/')) return value;

    // Relative key path fallback for legacy payloads.
    if (/^[a-zA-Z0-9/_\-.]+$/.test(value) && !value.includes(' ')) return value;

    // Absolute URL fallback.
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return value;
      }
    } catch (_) {
      // Joi custom must signal validation failure via helpers.error below.
    }

    return helpers.error('string.uri');
  })
  .messages({
    'string.uri': 'Image must be a valid URL or uploaded image path',
  });

const images = Joi.array().items(imageUrl).max(6).messages({
  'array.max': 'Maximum 6 images allowed',
});

const phone = Joi.string().trim().max(20).pattern(/^[+\d\s()-]*$/).allow('').messages({
  'string.pattern.base': 'Phone must contain only digits, spaces, +, () and -',
});

const condition = Joi.string().valid('New', 'Like New', 'Good', 'Fair', 'Used').messages({
  'any.only': 'Condition must be one of: New, Like New, Good, Fair, Used',
});

const status = Joi.string().valid('active', 'sold', 'expired', 'removed').messages({
  'any.only': 'Status must be one of: active, sold, expired, removed',
});

const mongoId = Joi.string().pattern(/^([0-9a-fA-F]{24}|[a-zA-Z0-9][\w-]{1,200})$/).messages({
  'string.pattern.base': 'Invalid ID format',
});

const features = Joi.array().items(Joi.string().trim().max(200)).max(20).messages({
  'array.max': 'Maximum 20 features allowed',
});

const geoQueryParams = {
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  radius: Joi.number().min(0).max(10000000), // radius in km or meters depending on backend (usually km in our ref)
};

// ── Pagination schema for GET queries ───────────────────────────

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('createdAt', '-createdAt', 'price', '-price', 'title', '-title').default('-createdAt'),
  search: Joi.string().trim().max(200).allow(''),
  ...geoQueryParams,
}).unknown(true);

// ── Joi validation middleware factory ───────────────────────────

/**
 * Express middleware factory — validates req[source] against a Joi schema.
 * @param {Joi.ObjectSchema} schema
 * @param {'body'|'query'|'params'} source
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
    }

    req[source] = value;
    next();
  };
}

module.exports = {
  title,
  description,
  price,
  location,
  coordinates,
  imageUrl,
  images,
  phone,
  condition,
  status,
  mongoId,
  features,
  geoQueryParams,
  paginationSchema,
  validate,
};
