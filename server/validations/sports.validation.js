/**
 * Sports Validation Schemas
 */

const Joi = require("joi");
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
} = require("./common");

const SPORTS_SUBCATEGORIES = [
  "Exercise & Gym",
  "Outdoor Sports",
  "Indoor Sports",
  "Water Sports",
  "Cycling",
  "Camping & Hiking",
  "Fitness Accessories",
  "Team Sports",
];

const SPORT_TYPES = [
  "Cricket",
  "Football",
  "Badminton",
  "Tennis",
  "Basketball",
  "Swimming",
  "Running",
  "Yoga",
  "Boxing",
  "Hockey",
  "Table Tennis",
  "Gym & Fitness",
  "Cycling",
  "Hiking",
  "Skating",
  "Golf",
  "Other",
  "",
];

const AGE_GROUPS = ["Kids", "Adults", "All Ages", ""];

const createSportsSchema = Joi.object({
  title: title.required(),
  description: description.required(),
  price: price.required(),
  category: Joi.string().valid("Sports").default("Sports"),
  subcategory: Joi.string()
    .valid(...SPORTS_SUBCATEGORIES)
    .required()
    .messages({
      "any.only": `Subcategory must be one of: ${SPORTS_SUBCATEGORIES.join(", ")}`,
      "any.required": "Subcategory is required",
    }),
  condition: condition.default("Good"),
  location: location.required(),
  coordinates: coordinates,
  images: images,
  features: features,
  phone: phone,
  phoneCode: Joi.string().trim().max(8).allow(""),
  currency: Joi.string().trim().max(8).allow(""),

  brand: Joi.string().trim().max(100).allow(""),
  sportType: Joi.string()
    .valid(...SPORT_TYPES)
    .allow(""),
  size: Joi.string().trim().max(20).allow(""),
  material: Joi.string().trim().max(80).allow(""),
  color: Joi.string().trim().max(40).allow(""),
  weight: Joi.string().trim().max(40).allow(""),
  ageGroup: Joi.string()
    .valid(...AGE_GROUPS)
    .allow(""),
});

const updateSportsSchema = createSportsSchema.fork(
  ["title", "description", "price", "subcategory", "location"],
  (field) => field.optional(),
);

const querySportsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
    .valid(
      "newest",
      "price_asc",
      "price_desc",
      "createdAt",
      "-createdAt",
      "price",
      "-price",
    )
    .default("newest"),
  search: Joi.string().trim().max(200).allow(""),
  subcategory: Joi.string()
    .valid(...SPORTS_SUBCATEGORIES)
    .allow(""),
  condition: condition.optional(),
  sportType: Joi.string()
    .valid(...SPORT_TYPES)
    .allow(""),
  brand: Joi.string().trim().max(100).allow(""),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  location: Joi.string().trim().max(200).allow(""),
  ...geoQueryParams,
}).unknown(false);

const paramsIdSchema = Joi.object({
  id: mongoId.required(),
});

module.exports = {
  createSportsSchema,
  updateSportsSchema,
  querySportsSchema,
  paramsIdSchema,

  validateCreateSports: validate(createSportsSchema),
  validateUpdateSports: validate(updateSportsSchema),
  validateSportsQuery: validate(querySportsSchema, "query"),
  validateSportsParams: validate(paramsIdSchema, "params"),

  SPORTS_SUBCATEGORIES,
  SPORT_TYPES,
  AGE_GROUPS,
};
