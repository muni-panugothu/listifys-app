/**
 * Jobs Validation Schemas
 *
 * Validates create, update, and query requests for the Job model.
 * All fields mirror job.model.js constraints exactly.
 */

const Joi = require('joi');
const {
  title, description, price, location, coordinates,
  images, phone, condition, mongoId, validate, geoQueryParams,
} = require('./common');

// ── Enum constants (mirrors model) ──────────────────────────────

const JOB_SUBCATEGORIES = ['IT Jobs', 'Non IT Jobs', 'Part Time', 'Contract Type'];
const JOB_TYPES = ['Full Time', 'Part Time', 'Contract', 'Freelance', 'Internship', ''];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Freelance', 'Internship', ''];
const WORK_MODES = ['On-site', 'Remote', 'Hybrid', ''];
const SALARY_TYPES = ['hourly', 'daily', 'weekly', 'monthly', 'yearly', ''];

// ── Create schema ────────────────────────────────────────────────

const createJobSchema = Joi.object({
  title: title.required(),
  description: description.required(),
  // price is optional for jobs (represents salary range indicator)
  price: price.optional().default(0),
  category: Joi.string().valid('Jobs').default('Jobs'),
  subcategory: Joi.string().valid(...JOB_SUBCATEGORIES).required().messages({
    'any.only': `Subcategory must be one of: ${JOB_SUBCATEGORIES.join(', ')}`,
    'any.required': 'Job subcategory is required',
  }),
  condition: condition.default('Good'),
  location: location.required(),
  coordinates: coordinates,
  images: images,
  phone: phone,

  // Company details
  companyName: Joi.string().trim().max(120).allow(''),
  companyWebsite: Joi.string().trim().max(200).uri({ scheme: ['http', 'https'] }).allow('').messages({
    'string.uri': 'Company website must be a valid URL (http/https)',
  }),
  companyEmail: Joi.string().trim().max(120).email({ tlds: { allow: false } }).allow('').messages({
    'string.email': 'Company email must be a valid email address',
  }),
  applyLink: Joi.string().trim().max(500).uri({ scheme: ['http', 'https'] }).allow('').messages({
    'string.uri': 'Apply link must be a valid URL (http/https)',
  }),

  // Role details
  jobType: Joi.string().valid(...JOB_TYPES).allow(''),
  experience: Joi.string().trim().max(80).allow(''),
  education: Joi.string().trim().max(150).allow(''),
  employmentType: Joi.string().valid(...EMPLOYMENT_TYPES).allow(''),
  workMode: Joi.string().valid(...WORK_MODES).allow(''),

  // Salary
  salary: Joi.object({
    min: Joi.number().min(0).default(0),
    max: Joi.number().min(0).default(0),
    type: Joi.string().valid(...SALARY_TYPES).default('monthly'),
  }).optional(),
  salaryMin: Joi.number().min(0).optional(),
  salaryMax: Joi.number().min(Joi.ref('salaryMin')).optional().messages({
    'number.ref': 'Maximum salary must be greater than minimum salary',
  }),
  salaryType: Joi.string().valid(...SALARY_TYPES).allow(''),

  // Other
  industry: Joi.string().trim().max(100).allow(''),
  department: Joi.string().trim().max(100).allow(''),
  positions: Joi.number().integer().min(1).max(999).optional(),
  noticePeriod: Joi.string().trim().max(50).allow(''),
  currency: Joi.string().trim().max(8).allow(''),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
});

// ── Update schema (all fields optional) ─────────────────────────

const updateJobSchema = createJobSchema.fork(
  ['title', 'description', 'subcategory', 'location'],
  (field) => field.optional(),
);

// ── Query / filter schema ────────────────────────────────────────

const queryJobSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
    .valid('createdAt', '-createdAt', 'price', '-price', 'newest')
    .default('-createdAt'),
  search: Joi.string().trim().max(200).allow(''),
  subcategory: Joi.string().valid(...JOB_SUBCATEGORIES).allow(''),
  jobType: Joi.string().valid(...JOB_TYPES).allow(''),
  workMode: Joi.string().valid(...WORK_MODES).allow(''),
  employmentType: Joi.string().valid(...EMPLOYMENT_TYPES).allow(''),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  location: Joi.string().trim().max(200).allow(''),
  ...geoQueryParams,
}).unknown(true);

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createJobSchema,
  updateJobSchema,
  queryJobSchema,
  paramsIdSchema,

  validateCreateJob: validate(createJobSchema),
  validateUpdateJob: validate(updateJobSchema),
  validateJobQuery: validate(queryJobSchema, 'query'),
  validateJobParams: validate(paramsIdSchema, 'params'),

  JOB_SUBCATEGORIES,
  JOB_TYPES,
  EMPLOYMENT_TYPES,
  WORK_MODES,
  SALARY_TYPES,
};
