const Joi = require("joi");

const BEAUTY_SUBCATEGORIES = [
  "Makeup",
  "Skincare",
  "Hair Care",
  "Fragrance",
  "Vitamins",
  "Personal Care",
];

const createBeautySchema = Joi.object({
  title: Joi.string().trim().max(200).required(),
  description: Joi.string().trim().min(20).required(),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid("Beauty").default("Beauty"),
  subcategory: Joi.string()
    .valid(...BEAUTY_SUBCATEGORIES)
    .required()
    .messages({
      "any.only": `Subcategory must be one of: ${BEAUTY_SUBCATEGORIES.join(", ")}`,
    }),
  condition: Joi.string().valid("New", "Like New", "Good", "Fair", "Used"),
  location: Joi.string().trim().required(),
  coordinates: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array().items(Joi.number()).length(2),
  }).optional(),
  images: Joi.array().items(Joi.string()).max(10),
  features: Joi.array().items(Joi.string().trim()),
  phone: Joi.string().trim().allow(""),
  phoneCode: Joi.string().trim().allow(""),
  currency: Joi.string().trim().allow(""),
  brand: Joi.string().trim().allow(""),
  skinType: Joi.string()
    .valid("All", "Oily", "Dry", "Combination", "Sensitive", "Normal", "")
    .allow(""),
  shade: Joi.string().trim().allow(""),
  volume: Joi.string().trim().allow(""),
  ingredients: Joi.string().trim().allow(""),
  expiryDate: Joi.string().trim().allow(""),
  gender: Joi.string().valid("Men", "Women", "Unisex", "").allow(""),
}).options({ stripUnknown: true });

const updateBeautySchema = Joi.object({
  title: Joi.string().trim().max(200),
  description: Joi.string().trim().min(20),
  price: Joi.number().min(0),
  subcategory: Joi.string()
    .valid(...BEAUTY_SUBCATEGORIES)
    .messages({
      "any.only": `Subcategory must be one of: ${BEAUTY_SUBCATEGORIES.join(", ")}`,
    }),
  condition: Joi.string().valid("New", "Like New", "Good", "Fair", "Used"),
  location: Joi.string().trim(),
  coordinates: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array().items(Joi.number()).length(2),
  }).optional(),
  images: Joi.array().items(Joi.string()).max(10),
  features: Joi.array().items(Joi.string().trim()),
  phone: Joi.string().trim().allow(""),
  phoneCode: Joi.string().trim().allow(""),
  currency: Joi.string().trim().allow(""),
  brand: Joi.string().trim().allow(""),
  skinType: Joi.string()
    .valid("All", "Oily", "Dry", "Combination", "Sensitive", "Normal", "")
    .allow(""),
  shade: Joi.string().trim().allow(""),
  volume: Joi.string().trim().allow(""),
  ingredients: Joi.string().trim().allow(""),
  expiryDate: Joi.string().trim().allow(""),
  gender: Joi.string().valid("Men", "Women", "Unisex", "").allow(""),
  status: Joi.string().valid("active", "sold", "expired", "removed"),
}).options({ stripUnknown: true });

const queryBeautySchema = Joi.object({
  search: Joi.string().trim().max(200).allow(""),
  subcategory: Joi.string().trim().allow(""),
  condition: Joi.string().trim().allow(""),
  minPrice: Joi.number().min(0).allow(""),
  maxPrice: Joi.number().min(0).allow(""),
  sort: Joi.string()
    .valid("newest", "oldest", "price_low", "price_high", "popular", "nearest")
    .allow(""),
  location: Joi.string().trim().allow(""),
  lat: Joi.number().min(-90).max(90).allow(""),
  lng: Joi.number().min(-180).max(180).allow(""),
  radius: Joi.number().min(0).allow(""),
  page: Joi.number().integer().min(1).allow(""),
  limit: Joi.number().integer().min(1).max(100).allow(""),
}).options({ stripUnknown: true });

const paramsIdSchema = Joi.object({
  id: Joi.string().required(),
});

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((d) => d.message),
      });
    }
    req[source] = value;
    next();
  };
};

module.exports = {
  validateCreateBeauty: validate(createBeautySchema),
  validateUpdateBeauty: validate(updateBeautySchema),
  validateQueryBeauty: validate(queryBeautySchema, "query"),
  validateParamsId: validate(paramsIdSchema, "params"),
};
