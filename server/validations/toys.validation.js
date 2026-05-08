/**
 * Toys Validation Schemas
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

const TOY_SUBCATEGORIES = [
  'Video Games',
  'Puzzles',
  'RC Toys',
  'Soft Toys & Dolls',
  'Building Toys',
  'Baby Toys',
  'Action Figures',
  'Other',
];

const BATTERY_REQUIRED_OPTIONS = ['Yes', 'No', 'Not Sure', ''];

const createToySchema = Joi.object({
  title: title.required(),
  description: description.required(),
  price: price.required(),
  category: Joi.string().valid('Toys').default('Toys'),
  subcategory: Joi.string().valid(...TOY_SUBCATEGORIES).required().messages({
    'any.only': `Subcategory must be one of: ${TOY_SUBCATEGORIES.join(', ')}`,
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
  ageGroup: Joi.string().trim().max(60).allow(''),
  material: Joi.string().trim().max(100).allow(''),
  batteryRequired: Joi.string().valid(...BATTERY_REQUIRED_OPTIONS).allow(''),
  playMode: Joi.string().trim().max(60).allow(''),
  numberOfPieces: Joi.string().trim().max(20).allow(''),
  characterTheme: Joi.string().trim().max(100).allow(''),
  color: Joi.string().trim().max(40).allow(''),
});

const updateToySchema = createToySchema.fork(
  ['title', 'description', 'price', 'subcategory', 'location'],
  (field) => field.optional()
);

const queryToySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
    .valid('newest', 'price_asc', 'price_desc', 'createdAt', '-createdAt', 'price', '-price')
    .default('newest'),
  search: Joi.string().trim().max(200).allow(''),
  subcategory: Joi.string().valid(...TOY_SUBCATEGORIES).allow(''),
  condition: condition.optional(),
  brand: Joi.string().trim().max(100).allow(''),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  location: Joi.string().trim().max(200).allow(''),
  ...geoQueryParams,
}).unknown(false);

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createToySchema,
  updateToySchema,
  queryToySchema,
  paramsIdSchema,

  validateCreateToy: validate(createToySchema),
  validateUpdateToy: validate(updateToySchema),
  validateToyQuery: validate(queryToySchema, 'query'),
  validateToyParams: validate(paramsIdSchema, 'params'),

  TOY_SUBCATEGORIES,
  BATTERY_REQUIRED_OPTIONS,
};
