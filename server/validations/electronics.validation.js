/**
 * Electronics Validation Schemas
 *
 * Covers create, update, and query validations for the Electronics model.
 */

const Joi = require('joi');
const {
  title, description, price, location, coordinates,
  images, phone, condition, features, mongoId, validate, geoQueryParams,
} = require('./common');

// ── Enum constants (mirrors model) ──────────────────────────────

const ELECTRONICS_SUBCATEGORIES = [
  'TVs, Video - Audio',
  'Kitchen & Other Appliances',
  'Fridges',
  'Washing Machines',
  'ACs',
  'Computers & Laptops',
  'Computer Accessories',
  'Hard Disks, Printers & Monitors',
  'Cameras & Lenses',
];

const WARRANTY_VALUES = ['Under Warranty', 'Expired', 'No Warranty', ''];
const ENERGY_RATINGS = ['1 Star', '2 Star', '3 Star', '4 Star', '5 Star', ''];

// ── Create schema ───────────────────────────────────────────────

const createElectronicsSchema = Joi.object({
  title: title.required(),
  description: description.required(),
  price: price.required(),
  category: Joi.string().valid('Electronics').default('Electronics'),
  subcategory: Joi.string().valid(...ELECTRONICS_SUBCATEGORIES).required().messages({
    'any.only': `Subcategory must be one of: ${ELECTRONICS_SUBCATEGORIES.join(', ')}`,
    'any.required': 'Subcategory is required',
  }),
  condition: condition.default('Good'),
  location: location.required(),
  coordinates: coordinates,
  images: images,
  features: features,
  phone: phone,

  // Product-specific
  brand: Joi.string().trim().max(100).allow(''),
  model: Joi.string().trim().max(100).allow(''),
  warranty: Joi.string().valid(...WARRANTY_VALUES).allow(''),
  purchaseYear: Joi.number().integer().min(2000).max(new Date().getFullYear()).allow(null),

  // TV / Audio
  screenSize: Joi.string().trim().max(50).allow(''),
  displayType: Joi.string().trim().max(50).allow(''),

  // Computers & Laptops
  processor: Joi.string().trim().max(100).allow(''),
  ram: Joi.string().trim().max(30).allow(''),
  storage: Joi.string().trim().max(50).allow(''),

  // Fridges / Washing Machines / ACs
  capacity: Joi.string().trim().max(50).allow(''),
  energyRating: Joi.string().valid(...ENERGY_RATINGS).allow(''),

  // Cameras
  megapixels: Joi.string().trim().max(30).allow(''),
  lensType: Joi.string().trim().max(100).allow(''),

  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  countryCode: Joi.string().trim().max(8).allow('').optional(),
  imageUrls: Joi.array().items(Joi.string().trim()).max(6).optional(),
});

// ── Update schema (all fields optional) ─────────────────────────

const updateElectronicsSchema = createElectronicsSchema.fork(
  ['title', 'description', 'price', 'subcategory', 'location'],
  (field) => field.optional()
);

// ── Query / filter schema ───────────────────────────────────────

const queryElectronicsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('createdAt', '-createdAt', 'price', '-price').default('-createdAt'),
  search: Joi.string().trim().max(200).allow(''),
  subcategory: Joi.string().valid(...ELECTRONICS_SUBCATEGORIES).allow(''),
  condition: condition.optional(),
  brand: Joi.string().trim().max(100).allow(''),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  location: Joi.string().trim().max(200).allow(''),
  ...geoQueryParams,
}).unknown(true);

// ── Param schema ────────────────────────────────────────────────

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createElectronicsSchema,
  updateElectronicsSchema,
  queryElectronicsSchema,
  paramsIdSchema,

  // Pre-built middleware
  validateCreateElectronics: validate(createElectronicsSchema),
  validateUpdateElectronics: validate(updateElectronicsSchema),
  validateElectronicsQuery: validate(queryElectronicsSchema, 'query'),
  validateElectronicsParams: validate(paramsIdSchema, 'params'),

  // Enums for reuse
  ELECTRONICS_SUBCATEGORIES,
  WARRANTY_VALUES,
  ENERGY_RATINGS,
};
