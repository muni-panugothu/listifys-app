const ServiceCategory = require('../models/servicecategory.model');
const { logger } = require('../utils/logger');

const CATEGORY_ALLOWED_FIELDS = [
  'name', 'description', 'icon', 'image', 'subcategories',
  'parentCategory', 'order', 'isActive', 'featured', 'seo',
];

exports.getAllCategories = async (req, res) => {
  try {
    const { activeOnly = true } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    
    const filter = activeOnly === 'true' ? { isActive: true } : {};
    
    const categories = await ServiceCategory.find(filter)
      .sort('order')
      .populate('parentCategory', 'name')
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await ServiceCategory.countDocuments(filter);
    
    res.json({
      success: true,
      count: categories.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: categories
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await ServiceCategory.findById(req.params.id)
      .populate('parentCategory');
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    res.json({ success: true, data: category });
  } catch (error) {
    logger.error('Error fetching category:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getCategoryBySlug = async (req, res) => {
  try {
    const category = await ServiceCategory.findOne({ slug: req.params.slug });
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    res.json({ success: true, data: category });
  } catch (error) {
    logger.error('Error fetching category by slug:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const data = {};
    for (const key of CATEGORY_ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const category = await ServiceCategory.create(data);
    logger.info(`Category created: ${category.name} by ${req.user._id}`);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    logger.error('Error creating category:', error);
    res.status(400).json({ success: false, message: 'Failed to create category' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const data = {};
    for (const key of CATEGORY_ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const category = await ServiceCategory.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    logger.info(`Category updated: ${category.name} by ${req.user._id}`);
    res.json({ success: true, data: category });
  } catch (error) {
    logger.error('Error updating category:', error);
    res.status(400).json({ success: false, message: 'Internal server error' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await ServiceCategory.findByIdAndDelete(req.params.id);
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    logger.info(`Category deleted: ${category.name} by ${req.user._id}`);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    logger.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getSubcategories = async (req, res) => {
  try {
    const category = await ServiceCategory.findById(req.params.categoryId);
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    res.json({
      success: true,
      data: category.subcategories.filter(sub => sub.isActive !== false)
    });
  } catch (error) {
    logger.error('Error fetching subcategories:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getCategoryStats = async (req, res) => {
  try {
    const stats = await ServiceCategory.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'serviceproviders',
          localField: '_id',
          foreignField: 'categories',
          as: 'providers'
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          image: 1,
          providerCount: { $size: '$providers' },
          subcategoryCount: { $size: '$subcategories' }
        }
      },
      { $sort: { providerCount: -1 } }
    ]);
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching category stats:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};