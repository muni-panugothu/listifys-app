/**
 * Furniture Validation Schemas
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

const FURNITURE_SUBCATEGORIES = [
  'Sofas & Dining',
  'Beds & Wardrobes',
  'Tables & Chairs',
  'Home Decor',
  'Office Furniture',
  'Wardrobes & Storage',
  'Kitchen Furniture',
  'Outdoor & Garden Furniture',
  'Kids Furniture',
  'Lighting & Lamps',
  'Curtains & Blinds',
  'Rugs & Carpets',
  'Other Furniture',
];

const createFurnitureSchema = Joi.object({
  title: title.required(),
  description: description.required(),
  price: price.required(),
  category: Joi.string().valid('Furniture').default('Furniture'),
  subcategory: Joi.string().valid(...FURNITURE_SUBCATEGORIES).required().messages({
    'any.only': `Subcategory must be one of: ${FURNITURE_SUBCATEGORIES.join(', ')}`,
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

  material: Joi.string().trim().max(120).allow(''),
  dimensions: Joi.string().trim().max(120).allow(''),
  weight: Joi.string().trim().max(60).allow(''),
  assemblyRequired: Joi.string().valid('Yes', 'No', '').allow(''),
  numberOfPieces: Joi.string().trim().max(20).allow(''),
  color: Joi.string().trim().max(40).allow(''),

  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  countryCode: Joi.string().trim().max(8).allow('').optional(),
  imageUrls: Joi.array().items(Joi.string().trim()).max(6).optional(),
});

const updateFurnitureSchema = createFurnitureSchema.fork(
  ['title', 'description', 'price', 'subcategory', 'location'],
  (field) => field.optional()
);

const queryFurnitureSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
    .valid('newest', 'price_asc', 'price_desc', 'createdAt', '-createdAt', 'price', '-price')
    .default('newest'),
  search: Joi.string().trim().max(200).allow(''),
  subcategory: Joi.string().valid(...FURNITURE_SUBCATEGORIES).allow(''),
  condition: condition.optional(),
  material: Joi.string().trim().max(120).allow(''),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  location: Joi.string().trim().max(200).allow(''),
  ...geoQueryParams,
}).unknown(true);

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createFurnitureSchema,
  updateFurnitureSchema,
  queryFurnitureSchema,
  paramsIdSchema,

  validateCreateFurniture: validate(createFurnitureSchema),
  validateUpdateFurniture: validate(updateFurnitureSchema),
  validateFurnitureQuery: validate(queryFurnitureSchema, 'query'),
  validateFurnitureParams: validate(paramsIdSchema, 'params'),

  FURNITURE_SUBCATEGORIES,
};
