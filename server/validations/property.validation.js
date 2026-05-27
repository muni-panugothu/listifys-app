const Joi = require('joi');

const propertyValidationSchema = Joi.object({
  title: Joi.string().required().max(100).trim().messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 100 characters'
  }),
  description: Joi.string().required().max(5000).messages({
    'string.empty': 'Description is required',
    'string.max': 'Description cannot exceed 5000 characters'
  }),
  price: Joi.number().required().min(0).messages({
    'number.base': 'Price/Rent must be a number',
    'number.min': 'Price cannot be negative'
  }),
  category: Joi.string().valid('Properties', 'Rentals', 'Roommates').required(),
  subcategory: Joi.string().required(),
  location: Joi.string().required().trim(),
  lat: Joi.number().optional().allow(null, ''),
  lng: Joi.number().optional().allow(null, ''),
  images: Joi.array().items(Joi.string()).max(15).optional(),
  
  // Specific fields
  bedrooms: Joi.number().min(0).allow(null, '').optional(),
  bathrooms: Joi.number().min(0).allow(null, '').optional(),
  furnishing: Joi.string().valid('Fully Furnished', 'Semi-Furnished', 'Unfurnished', '').allow(null).optional(),
  squareFeet: Joi.number().min(0).allow(null, '').optional(),
  
  // Date comes in as string or date object
  availableFrom: Joi.alternatives().try(Joi.date(), Joi.string()).allow(null, '').optional(),
  
  // Roommates specifically
  genderPreference: Joi.string().valid('Any', 'Male Only', 'Female Only', '').allow(null).optional(),
  occupancy: Joi.string().valid('Single', 'Shared', 'Any', '').allow(null).optional(),
  petFriendly: Joi.alternatives().try(Joi.boolean(), Joi.string()).allow(null, '').optional(),
  
  features: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional().allow(null, '').custom((value, helpers) => {
      if (typeof value === 'string') {
          try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) return parsed;
              return [];
          } catch(e) {
              return [value];
          }
      }
      return value || [];
  }),

  // Optional
  phone: Joi.string().allow('', null).optional()
}).unknown(true);

const validateProperty = (data) => {
  return propertyValidationSchema.validate(data, { abortEarly: false, stripUnknown: true });
};

module.exports = {
  validateProperty
};
