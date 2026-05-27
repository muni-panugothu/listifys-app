/**
 * Service Listing Validation Schemas
 */

const Joi = require('joi');
const { mongoId, validate } = require('./common');

const PRICE_TYPES = ['fixed', 'Fixed', 'Hourly', 'hourly', 'Daily', 'daily', 'Per Visit', 'Per Project', 'Monthly', 'monthly', 'Negotiable', 'project', 'weekly'];
const STATUS_VALUES = ['active', 'inactive', 'suspended', 'expired'];
const VISIBILITY_VALUES = ['public', 'private'];
const RECURRING_VALUES = ['none', 'daily', 'weekly', 'monthly'];

// Accept full URLs and internal image proxy/key paths returned by upload endpoints.
const imagePathSchema = Joi.string().trim().min(1).max(1200);

const createServiceListingSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200).required().messages({
    'string.min': 'Title must be at least 5 characters',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required',
  }),
  description: Joi.string().trim().min(50).max(5000).required().messages({
    'string.min': 'Description must be at least 50 characters',
    'string.max': 'Description cannot exceed 5000 characters',
    'any.required': 'Description is required',
  }),
  category: Joi.string().trim().max(200).required().messages({
    'any.required': 'Category is required',
  }),
  subcategory: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Subcategory is required',
  }),
  serviceType: Joi.alternatives().try(
    Joi.object({
      name: Joi.string().trim().max(100),
      description: Joi.string().trim().max(500),
    }),
    Joi.string().trim().max(100).allow('')
  ).optional(),
  pricing: Joi.object({
    basePrice: Joi.number().min(0).required(),
    priceType: Joi.string().valid(...PRICE_TYPES).default('fixed'),
    negotiable: Joi.boolean().default(false),
    discount: Joi.number().min(0).max(100).optional(),
  }).optional(),
  // Flat price field (used by PostAd form, controller maps to pricing.basePrice)
  price: Joi.number().min(0).optional(),
  images: Joi.alternatives().try(
    Joi.array().items(
      Joi.object({
        url: imagePathSchema.required(),
        publicId: Joi.string().allow(''),
        isPrimary: Joi.boolean().default(false),
      })
    ).max(10),
    Joi.array().items(imagePathSchema).max(10)
  ).optional(),
  phone: Joi.string().trim().max(20).pattern(/^[+\d\s()-]*$/).allow(''),
  phoneCode: Joi.string().trim().max(10).allow(''),
  currency: Joi.string().trim().max(10).allow(''),
  location: Joi.alternatives().try(
    Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      address: Joi.string().trim().max(300).allow(''),
      city: Joi.string().trim().max(100).allow(''),
      state: Joi.string().trim().max(100).allow(''),
      pincode: Joi.string().trim().max(10).allow(''),
      landmark: Joi.string().trim().max(200).allow(''),
    }),
    Joi.string().trim().max(300)
  ).required(),
  // Flat lat/lng fields (used by PostAd form)
  lat: Joi.number().min(-90).max(90).allow(null).empty('').empty('null').empty('undefined').optional(),
  lng: Joi.number().min(-180).max(180).allow(null).empty('').empty('null').empty('undefined').optional(),
  condition: Joi.string().trim().max(50).allow(''),
  availability: Joi.alternatives().try(
    Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
      recurring: Joi.string().valid(...RECURRING_VALUES).default('none'),
      schedule: Joi.array().items(Joi.object({
        day: Joi.string().trim().max(20),
        startTime: Joi.string().trim().max(10),
        endTime: Joi.string().trim().max(10),
      })).max(7),
    }),
    Joi.string().trim().max(100).allow('')
  ).optional(),

  // Extra service fields
  experience: Joi.string().trim().max(100).allow(''),
  serviceAvailability: Joi.string().trim().max(100).allow(''),
  priceType: Joi.string().valid(...PRICE_TYPES).allow(''),
  serviceArea: Joi.string().trim().max(200).allow(''),
  certification: Joi.string().trim().max(200).allow(''),
  languages: Joi.string().trim().max(200).allow(''),
  teamSize: Joi.string().trim().max(50).allow(''),
  turnaroundTime: Joi.string().trim().max(100).allow(''),
  portfolioLink: Joi.string().uri().max(500).allow(''),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(15),
  visibility: Joi.string().valid(...VISIBILITY_VALUES).default('public'),
  specifications: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
});

const updateServiceListingSchema = createServiceListingSchema.fork(
  ['title', 'description', 'category', 'subcategory', 'location'],
  (field) => field.optional()
);

const queryServiceListingSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('createdAt', '-createdAt', 'pricing.basePrice', '-pricing.basePrice').default('-createdAt'),
  search: Joi.string().trim().max(200).allow(''),
  category: Joi.string().trim().max(200).allow(''),
  subcategory: Joi.string().trim().max(100).allow(''),
  status: Joi.string().valid(...STATUS_VALUES).allow(''),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  city: Joi.string().trim().max(100).allow(''),
  lat: Joi.number().min(-90).max(90).allow(null).empty('').empty('null').empty('undefined').optional(),
  lng: Joi.number().min(-180).max(180).allow(null).empty('').empty('null').empty('undefined').optional(),
  radius: Joi.number().min(0).max(50000).default(5000),
  location: Joi.string().trim().max(200).allow(''),
  activeOnly: Joi.string().valid('true', 'false').allow(''),
}).unknown(false);

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createServiceListingSchema,
  updateServiceListingSchema,
  queryServiceListingSchema,
  paramsIdSchema,

  validateCreateServiceListing: validate(createServiceListingSchema),
  validateUpdateServiceListing: validate(updateServiceListingSchema),
  validateServiceListingQuery: validate(queryServiceListingSchema, 'query'),
  validateServiceListingParams: validate(paramsIdSchema, 'params'),

  PRICE_TYPES,
  STATUS_VALUES,
  VISIBILITY_VALUES,
  RECURRING_VALUES,
};
