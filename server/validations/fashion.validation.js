/**
 * Fashion Validation Schemas
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

const FASHION_SUBCATEGORIES = [
  "Men's Clothing",
  "Women's Clothing",
  'Kids Clothing',
  'Footwear',
  'Watches',
  'Accessories',
];

const FASHION_GENDERS = ['Men', 'Women', 'Kids', 'Unisex', ''];

const createFashionSchema = Joi.object({
  title: title.required(),
  description: description.required(),
  price: price.required(),
  category: Joi.string().valid('Fashion').default('Fashion'),
  subcategory: Joi.string().valid(...FASHION_SUBCATEGORIES).required().messages({
    'any.only': `Subcategory must be one of: ${FASHION_SUBCATEGORIES.join(', ')}`,
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
  size: Joi.string().trim().max(20).allow(''),
  gender: Joi.string().valid(...FASHION_GENDERS).allow(''),
  fabricType: Joi.string().trim().max(80).allow(''),
  color: Joi.string().trim().max(40).allow(''),
});

const updateFashionSchema = createFashionSchema.fork(
  ['title', 'description', 'price', 'subcategory', 'location'],
  (field) => field.optional()
);

const queryFashionSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
    .valid('newest', 'price_asc', 'price_desc', 'createdAt', '-createdAt', 'price', '-price')
    .default('newest'),
  search: Joi.string().trim().max(200).allow(''),
  subcategory: Joi.string().valid(...FASHION_SUBCATEGORIES).allow(''),
  gender: Joi.string().valid(...FASHION_GENDERS).allow(''),
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
  createFashionSchema,
  updateFashionSchema,
  queryFashionSchema,
  paramsIdSchema,

  validateCreateFashion: validate(createFashionSchema),
  validateUpdateFashion: validate(updateFashionSchema),
  validateFashionQuery: validate(queryFashionSchema, 'query'),
  validateFashionParams: validate(paramsIdSchema, 'params'),

  FASHION_SUBCATEGORIES,
  FASHION_GENDERS,
};
