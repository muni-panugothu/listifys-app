/**
 * ForSale Validation Schemas
 *
 * Covers Mobiles, Furniture, Fashion, Books & Sports listings.
 */

const Joi = require('joi');
const {
  title, description, price, location, coordinates,
  images, phone, condition, features, mongoId, validate, geoQueryParams,
} = require('./common');

// ── Enum constants ──────────────────────────────────────────────

const FORSALE_CATEGORIES = [
  'Mobiles',
  'Furniture',
  'Fashion',
  'Books, Sports',
  'Books',
  'Sports',
  'Toys & Games',
  'Collectibles',
  'Pets',
  'Beauty',
  'Others',
];

const FORSALE_SUBCATEGORIES = [
  'Mobile Phones', 'Accessories', 'Tablets',
  'Sofas & Dining', 'Beds & Wardrobes', 'Tables & Chairs', 'Home Decor', 'Office Furniture',
  "Men's Clothing", "Women's Clothing", 'Kids Clothing', 'Footwear', 'Watches',
  'Fiction', 'Non-Fiction', "Children's Books", 'Textbooks', 'Comics', 'Magazines',
  'Exercise', 'Camping', 'Bikes', 'Sports Equipment', 'Hunting', 'Fishing',
  'Books', 'Gym & Fitness', 'Musical Instruments', 'Hobbies', 'Cycling',
  'Video Games', 'Puzzles', 'RC Toys', 'Soft Toys & Dolls', 'Building Toys', 'Baby Toys', 'Action Figures', 'Other',
  'Antiques', 'Art', 'Coins', 'Memorabilia', 'Vintage', 'Stamps',
  'Dog Supplies', 'Cat Supplies', 'Bird Supplies', 'Fish Supplies', 'Reptile Supplies',
  'Makeup', 'Skincare', 'Hair Care', 'Fragrance', 'Vitamins', 'Personal Care',
  'Other Items',
];

const ASSEMBLY_VALUES = ['Yes', 'No', ''];
const GENDER_VALUES = ['Men', 'Women', 'Kids', 'Unisex', ''];

// ── Create schema ───────────────────────────────────────────────

const createForSaleSchema = Joi.object({
  title: title.required(),
  description: description.required(),
  price: price.required(),
  category: Joi.string().valid(...FORSALE_CATEGORIES).required().messages({
    'any.only': `Category must be one of: ${FORSALE_CATEGORIES.join(', ')}`,
    'any.required': 'Category is required',
  }),
  subcategory: Joi.string().valid(...FORSALE_SUBCATEGORIES).required().messages({
    'any.only': `Subcategory must be one of: ${FORSALE_SUBCATEGORIES.join(', ')}`,
    'any.required': 'Subcategory is required',
  }),
  condition: condition.default('Good'),
  location: location.required(),
  coordinates: coordinates,
  images: images,
  features: features,
  phone: phone,

  // Mobiles
  brand: Joi.string().trim().max(100).allow(''),
  model: Joi.string().trim().max(100).allow(''),
  storage: Joi.string().trim().max(50).allow(''),
  ram: Joi.string().trim().max(30).allow(''),
  screenSize: Joi.string().trim().max(50).allow(''),
  batteryHealth: Joi.string().trim().max(30).allow(''),
  warranty: Joi.string().trim().max(50).allow(''),
  color: Joi.string().trim().max(50).allow(''),

  // Furniture
  material: Joi.string().trim().max(100).allow(''),
  dimensions: Joi.string().trim().max(100).allow(''),
  weight: Joi.string().trim().max(30).allow(''),
  assemblyRequired: Joi.string().valid(...ASSEMBLY_VALUES).allow(''),
  numberOfPieces: Joi.string().trim().max(10).allow(''),

  // Fashion
  size: Joi.string().trim().max(30).allow(''),
  gender: Joi.string().valid(...GENDER_VALUES).allow(''),
  fabricType: Joi.string().trim().max(100).allow(''),

  // Books & Sports
  author: Joi.string().trim().max(200).allow(''),
  isbn: Joi.string().trim().max(20).allow(''),
  publisher: Joi.string().trim().max(200).allow(''),
  edition: Joi.string().trim().max(50).allow(''),
  sportType: Joi.string().trim().max(100).allow(''),
});

// ── Update schema ───────────────────────────────────────────────

const updateForSaleSchema = createForSaleSchema.fork(
  ['title', 'description', 'price', 'category', 'subcategory', 'location'],
  (field) => field.optional()
);

// ── Query schema ────────────────────────────────────────────────

const queryForSaleSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('createdAt', '-createdAt', 'price', '-price').default('-createdAt'),
  search: Joi.string().trim().max(200).allow(''),
  category: Joi.string().valid(...FORSALE_CATEGORIES).allow(''),
  subcategory: Joi.string().valid(...FORSALE_SUBCATEGORIES).allow(''),
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
  createForSaleSchema,
  updateForSaleSchema,
  queryForSaleSchema,
  paramsIdSchema,

  validateCreateForSale: validate(createForSaleSchema),
  validateUpdateForSale: validate(updateForSaleSchema),
  validateForSaleQuery: validate(queryForSaleSchema, 'query'),
  validateForSaleParams: validate(paramsIdSchema, 'params'),

  FORSALE_CATEGORIES,
  FORSALE_SUBCATEGORIES,
  ASSEMBLY_VALUES,
  GENDER_VALUES,
};
