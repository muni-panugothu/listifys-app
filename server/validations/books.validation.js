const Joi = require("joi");

const BOOK_SUBCATEGORIES = [
  "Fiction",
  "Non-Fiction",
  "Children's Books",
  "Textbooks",
  "Comics",
  "Magazines",
  "Academic & Study",
  "Self Help",
  "Biography & Memoir",
  "Science & Technology",
  "History & Politics",
  "Religion & Spirituality",
  "Art & Photography",
  "Travel & Adventure",
  "Other Books",
];

const createBookSchema = Joi.object({
  title: Joi.string().trim().max(200).required(),
  description: Joi.string().trim().min(20).required(),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid("Books").default("Books"),
  subcategory: Joi.string()
    .valid(...BOOK_SUBCATEGORIES)
    .required()
    .messages({
      "any.only": `Subcategory must be one of: ${BOOK_SUBCATEGORIES.join(", ")}`,
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
  author: Joi.string().trim().allow(""),
  isbn: Joi.string().trim().allow(""),
  publisher: Joi.string().trim().allow(""),
  edition: Joi.string().trim().allow(""),
  language: Joi.string().trim().allow(""),
  pages: Joi.string().trim().allow(""),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
}).options({ stripUnknown: true });

const updateBookSchema = Joi.object({
  title: Joi.string().trim().max(200),
  description: Joi.string().trim().min(20),
  price: Joi.number().min(0),
  subcategory: Joi.string()
    .valid(...BOOK_SUBCATEGORIES)
    .messages({
      "any.only": `Subcategory must be one of: ${BOOK_SUBCATEGORIES.join(", ")}`,
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
  author: Joi.string().trim().allow(""),
  isbn: Joi.string().trim().allow(""),
  publisher: Joi.string().trim().allow(""),
  edition: Joi.string().trim().allow(""),
  language: Joi.string().trim().allow(""),
  pages: Joi.string().trim().allow(""),
  status: Joi.string().valid("active", "sold", "expired", "removed"),
}).options({ stripUnknown: true });

const queryBookSchema = Joi.object({
  search: Joi.string().trim().max(200).allow(""),
  category: Joi.string().trim().allow(""),
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
  validateCreateBook: validate(createBookSchema),
  validateUpdateBook: validate(updateBookSchema),
  validateQueryBook: validate(queryBookSchema, "query"),
  validateParamsId: validate(paramsIdSchema, "params"),
};
