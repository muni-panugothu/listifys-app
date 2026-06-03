/**
 * Mobiles Validation Schemas
 */

const Joi = require('joi');
const {
  title,
  description,
  price,
  location,
  coordinates,
  images,
  phone,
  condition,
  features,
  mongoId,
  validate,
  geoQueryParams,
} = require('./common');

const MOBILE_SUBCATEGORIES = [
  'Mobile Phones',
  'Tablets',
  'Accessories',
  'Cases & Covers',
  'Chargers & Cables',
  'Earphones & Headphones',
  'Power Banks',
  'Smart Watches & Bands',
  'Memory Cards & Storage',
  'Screen Guards & Protectors',
  'Bluetooth Speakers',
  'Selfie Sticks & Tripods',
  'Other Accessories',
];
const WARRANTY_OPTIONS = ['Under Warranty', 'Expired', 'No Warranty', ''];

const createMobileSchema = Joi.object({
  title: title.required(),
  description: description.required(),
  price: price.required(),
  category: Joi.string().valid('Mobiles').default('Mobiles'),
  subcategory: Joi.string().valid(...MOBILE_SUBCATEGORIES).required().messages({
    'any.only': `Subcategory must be one of: ${MOBILE_SUBCATEGORIES.join(', ')}`,
    'any.required': 'Subcategory is required',
  }),
  condition: condition.default('Good'),
  location: location.required(),
  coordinates: coordinates,
  images: images,
  features: features,
  phone: phone,
  phoneCode: Joi.string().trim().max(8).allow(''),
  currency: Joi.string().trim().max(8).allow(''),

  brand: Joi.string().trim().max(100).allow(''),
  model: Joi.string().trim().max(100).allow(''),
  storage: Joi.string().trim().max(40).allow(''),
  ram: Joi.string().trim().max(40).allow(''),
  screenSize: Joi.string().trim().max(40).allow(''),
  batteryHealth: Joi.string().trim().max(40).allow(''),
  warranty: Joi.string().valid(...WARRANTY_OPTIONS).allow(''),
  color: Joi.string().trim().max(40).allow(''),

  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  countryCode: Joi.string().trim().max(8).allow('').optional(),
  imageUrls: Joi.array().items(Joi.string().trim()).max(6).optional(),
});

const updateMobileSchema = createMobileSchema.fork(
  ['title', 'description', 'price', 'subcategory', 'location'],
  (field) => field.optional()
);

const queryMobileSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
    .valid('newest', 'price_asc', 'price_desc', 'createdAt', '-createdAt', 'price', '-price')
    .default('newest'),
  search: Joi.string().trim().max(200).allow(''),
  subcategory: Joi.string().valid(...MOBILE_SUBCATEGORIES).allow(''),
  condition: condition.optional(),
  brand: Joi.string().trim().max(100).allow(''),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  location: Joi.string().trim().max(200).allow(''),
  ...geoQueryParams,
}).unknown(true);

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createMobileSchema,
  updateMobileSchema,
  queryMobileSchema,
  paramsIdSchema,

  validateCreateMobile: validate(createMobileSchema),
  validateUpdateMobile: validate(updateMobileSchema),
  validateMobileQuery: validate(queryMobileSchema, 'query'),
  validateMobileParams: validate(paramsIdSchema, 'params'),

  MOBILE_SUBCATEGORIES,
  WARRANTY_OPTIONS,
};
