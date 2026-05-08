/**
 * Service Category Validation Schemas
 */

const Joi = require('joi');
const { mongoId, validate } = require('./common');

const subcategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  slug: Joi.string().trim().lowercase().max(100).allow(''),
  description: Joi.string().trim().max(500).allow(''),
  icon: Joi.string().trim().max(200).allow(''),
  isActive: Joi.boolean().default(true),
  meta: Joi.object({
    fields: Joi.array().items(Joi.object({
      name: Joi.string().trim().max(100),
      type: Joi.string().valid('text', 'number', 'select', 'checkbox', 'radio', 'date', 'time', 'textarea'),
      required: Joi.boolean(),
      options: Joi.array().items(Joi.string()),
      placeholder: Joi.string().trim().max(200),
    })).max(30),
    filters: Joi.array().items(Joi.object({
      name: Joi.string().trim().max(100),
      type: Joi.string().trim().max(50),
      options: Joi.array().items(Joi.string()),
    })).max(20),
  }).optional(),
});

const createServiceCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Category name is required',
    'string.min': 'Category name must be at least 2 characters',
  }),
  slug: Joi.string().trim().lowercase().max(100).allow(''),
  description: Joi.string().trim().max(500).allow(''),
  icon: Joi.string().trim().max(200).allow('', null),
  image: Joi.string().trim().max(500).required().messages({
    'any.required': 'Category image is required',
  }),
  subcategories: Joi.array().items(subcategorySchema).max(50),
  parentCategory: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null),
  level: Joi.number().integer().min(0).max(5).default(0),
  order: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  featured: Joi.boolean().default(false),
  seo: Joi.object({
    title: Joi.string().trim().max(200).allow(''),
    description: Joi.string().trim().max(500).allow(''),
    keywords: Joi.array().items(Joi.string().trim().max(50)).max(20),
  }).optional(),
});

const updateServiceCategorySchema = createServiceCategorySchema.fork(
  ['name', 'image'],
  (field) => field.optional()
);

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createServiceCategorySchema,
  updateServiceCategorySchema,
  subcategorySchema,
  paramsIdSchema,

  validateCreateServiceCategory: validate(createServiceCategorySchema),
  validateUpdateServiceCategory: validate(updateServiceCategorySchema),
  validateServiceCategoryParams: validate(paramsIdSchema, 'params'),
};
