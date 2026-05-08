const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
  getCategoryStats
} = require('../controllers/servicecategory.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { cacheResponseTracked, invalidateAfter } = require('../middleware/cache.middleware');
const { searchLimiter, postingLimiter } = require('../middleware/ratelimiter.middleware');
const {
  validateCreateServiceCategory,
  validateUpdateServiceCategory,
  validateServiceCategoryParams,
} = require('../validations/servicecategory.validation');

// Public routes — static paths BEFORE /:id wildcard
router.get('/', searchLimiter, cacheResponseTracked('serviceCategories', 3600), getAllCategories);
router.get('/stats', searchLimiter, cacheResponseTracked('serviceCategoriesStats', 3600), getCategoryStats);
router.get('/slug/:slug', searchLimiter, cacheResponseTracked('serviceCategoriesSlug', 3600), getCategoryBySlug);
router.get('/subcategories/:categoryId', searchLimiter, cacheResponseTracked('serviceCategoriesSub', 3600), getSubcategories);
router.get('/:id', searchLimiter, validateServiceCategoryParams, cacheResponseTracked('serviceCategories', 3600, 'detail'), getCategoryById);

// Admin only routes
router.post('/', protect, authorize('admin'), postingLimiter, validateCreateServiceCategory, invalidateAfter('serviceCategories'), createCategory);
router.put('/:id', protect, authorize('admin'), postingLimiter, validateServiceCategoryParams, validateUpdateServiceCategory, invalidateAfter('serviceCategories'), updateCategory);
router.delete('/:id', protect, authorize('admin'), postingLimiter, validateServiceCategoryParams, invalidateAfter('serviceCategories'), deleteCategory);

module.exports = router;