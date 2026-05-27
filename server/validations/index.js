/**
 * Validations Index
 *
 * Central export for all validation schemas and middleware.
 *
 * Usage in routes:
 *   const { validateCreateElectronics } = require('../validations');
 *   router.post('/', validateCreateElectronics, controller.create);
 */

const common = require('./common');
const electronics = require('./electronics.validation');
const vehicles = require('./vehicles.validation');
const forSale = require('./forsale.validation');
const events = require('./events.validation');
const mobile = require('./mobile.validation');
const furniture = require('./furniture.validation');
const fashion = require('./fashion.validation');
const toys = require('./toys.validation');
const serviceCategory = require('./servicecategory.validation');
const serviceListing = require('./servicelisting.validation');

module.exports = {
  // Shared helpers
  validate: common.validate,
  paginationSchema: common.paginationSchema,

  // Electronics
  ...electronics,

  // Vehicles
  ...vehicles,

  // ForSale
  ...forSale,

  // Events
  ...events,

  // Mobiles
  ...mobile,

  // Furniture
  ...furniture,

  // Fashion
  ...fashion,

  // Toys
  ...toys,

  // Service Category
  ...serviceCategory,

  // Service Listing
  ...serviceListing,
};
