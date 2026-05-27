/**
 * Vehicles Validation Schemas
 *
 * Covers create, update, and query validations for the Vehicle model.
 * Supports subcategory-specific fields: Cars, Bikes, Cycle, Spare Parts.
 */

const Joi = require('joi');
const {
  title, description, price, location, coordinates,
  images, phone, condition, features, mongoId, validate, geoQueryParams,
} = require('./common');

// ── Enum constants (mirrors model) ──────────────────────────────

const VEHICLE_SUBCATEGORIES = ['Cars', 'Bikes', 'Cycle', 'Spare Parts'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'LPG', ''];
const TRANSMISSIONS = ['Manual', 'Automatic', ''];
const OWNERSHIPS = ['1st Owner', '2nd Owner', '3rd Owner', '4th+ Owner', ''];
const CYCLE_TYPES = ['Mountain', 'Road', 'Hybrid', 'BMX', 'Kids', 'Folding', 'Electric', 'Cruiser', ''];
const COMPATIBLE_VEHICLES = ['Car', 'Bike', 'Cycle', 'Universal', ''];
const PART_CATEGORIES = [
  'Engine Parts', 'Body Parts', 'Electrical', 'Suspension', 'Brakes',
  'Tyres & Wheels', 'Interior', 'Exterior', 'Exhaust', 'Filters', 'Other', '',
];

// ── Create schema ───────────────────────────────────────────────

const createVehicleSchema = Joi.object({
  title: title.required(),
  description: description.required(),
  price: price.required(),
  category: Joi.string().valid('Vehicles').default('Vehicles'),
  subcategory: Joi.string().valid(...VEHICLE_SUBCATEGORIES).required().messages({
    'any.only': `Subcategory must be one of: ${VEHICLE_SUBCATEGORIES.join(', ')}`,
    'any.required': 'Subcategory is required',
  }),
  condition: condition.default('Good'),
  location: location.required(),
  coordinates: coordinates,
  images: images,
  features: features,
  phone: phone,

  // Common vehicle fields
  brand: Joi.string().trim().max(100).allow(''),
  model: Joi.string().trim().max(100).allow(''),
  variant: Joi.string().trim().max(100).allow(''),
  year: Joi.string().trim().max(4).pattern(/^\d{4}$/).allow('').messages({
    'string.pattern.base': 'Year must be a 4-digit number',
  }),
  kmDriven: Joi.string().trim().max(30).allow(''),
  color: Joi.string().trim().max(50).allow(''),

  // Cars / Bikes
  fuelType: Joi.string().valid(...FUEL_TYPES).allow(''),
  transmission: Joi.string().valid(...TRANSMISSIONS).allow(''),
  ownership: Joi.string().valid(...OWNERSHIPS).allow(''),

  // Bikes
  engineCC: Joi.string().trim().max(20).allow(''),

  // Cycles
  cycleType: Joi.string().valid(...CYCLE_TYPES).allow(''),
  gearCount: Joi.string().trim().max(10).allow(''),
  frameSize: Joi.string().trim().max(20).allow(''),

  // Spare Parts
  compatibleVehicle: Joi.string().valid(...COMPATIBLE_VEHICLES).allow(''),
  partCategory: Joi.string().valid(...PART_CATEGORIES).allow(''),
});

// ── Update schema (all fields optional) ─────────────────────────

const updateVehicleSchema = createVehicleSchema.fork(
  ['title', 'description', 'price', 'subcategory', 'location'],
  (field) => field.optional()
);

// ── Query / filter schema ───────────────────────────────────────

const queryVehicleSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('createdAt', '-createdAt', 'price', '-price').default('-createdAt'),
  search: Joi.string().trim().max(200).allow(''),
  subcategory: Joi.string().valid(...VEHICLE_SUBCATEGORIES).allow(''),
  condition: condition.optional(),
  brand: Joi.string().trim().max(100).allow(''),
  fuelType: Joi.string().valid(...FUEL_TYPES).allow(''),
  transmission: Joi.string().valid(...TRANSMISSIONS).allow(''),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  minYear: Joi.number().integer().min(1900),
  maxYear: Joi.number().integer().max(new Date().getFullYear() + 1),
  location: Joi.string().trim().max(200).allow(''),
  ...geoQueryParams,
}).unknown(true);

// ── Param schema ────────────────────────────────────────────────

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createVehicleSchema,
  updateVehicleSchema,
  queryVehicleSchema,
  paramsIdSchema,

  validateCreateVehicle: validate(createVehicleSchema),
  validateUpdateVehicle: validate(updateVehicleSchema),
  validateVehicleQuery: validate(queryVehicleSchema, 'query'),
  validateVehicleParams: validate(paramsIdSchema, 'params'),

  VEHICLE_SUBCATEGORIES,
  FUEL_TYPES,
  TRANSMISSIONS,
  OWNERSHIPS,
  CYCLE_TYPES,
  COMPATIBLE_VEHICLES,
  PART_CATEGORIES,
};
