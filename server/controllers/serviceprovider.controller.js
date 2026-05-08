const mongoose = require('mongoose');
const ServiceProvider = require('../models/serviceprovider.model');
const User = require('../models/user.model');
const { logger } = require('../utils/logger');
const { escapeRegex } = require('../utils/geoQuery');

const PROVIDER_ALLOWED_FIELDS = [
  'businessName', 'description', 'categories', 'subcategories',
  'servicesOffered', 'pricing', 'location', 'serviceArea',
  'availability', 'socialLinks', 'contactInfo', 'images',
  'workingHours', 'tags',
];
const PROVIDER_ALLOWED_SORTS = [
  'ratings.average', 'pricing.startingPrice', 'metrics.hireCount', 'createdAt',
];

exports.getProviders = async (req, res) => {
  try {
    const { 
      category, 
      subcategory, 
      city, 
      minRating, 
      maxPrice,
      sort = 'ratings.average',
      order = 'desc'
    } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    
    const filter = { isActive: true };
    
    if (category) filter.categories = category;
    if (subcategory) filter.subcategories = subcategory;
    if (city) filter['location.city'] = { $regex: escapeRegex(city), $options: 'i' };
    if (minRating) filter['ratings.average'] = { $gte: parseFloat(minRating) };
    if (maxPrice) filter['pricing.startingPrice'] = { $lte: parseFloat(maxPrice) };
    
    const safeSort = PROVIDER_ALLOWED_SORTS.includes(sort) ? sort : 'ratings.average';
    const sortOptions = {};
    sortOptions[safeSort] = order === 'desc' ? -1 : 1;
    
    const providers = await ServiceProvider.find(filter)
      .populate('userId', 'name profileImage')
      .sort(sortOptions)
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await ServiceProvider.countDocuments(filter);
    
    res.json({
      success: true,
      count: providers.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: providers
    });
  } catch (error) {
    logger.error('Error fetching providers:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getProviderById = async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.params.id)
      .populate('userId', 'name profileImage');
    
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    
    res.json({ success: true, data: provider });
  } catch (error) {
    logger.error('Error fetching provider:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getProviderProfile = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ userId: req.user._id });
    
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }
    
    res.json({ success: true, data: provider });
  } catch (error) {
    logger.error('Error fetching provider profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch providers' });
  }
};

exports.createProviderProfile = async (req, res) => {
  try {
    const existing = await ServiceProvider.findOne({ userId: req.user._id });
    
    if (existing) {
      return res.status(400).json({ success: false, message: 'Provider profile already exists' });
    }
    
    const providerData = { userId: req.user._id };
    for (const key of PROVIDER_ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) providerData[key] = req.body[key];
    }
    
    const provider = await ServiceProvider.create(providerData);
    
    // Update user role
    await User.findByIdAndUpdate(req.user._id, { role: 'provider' });
    
    logger.info(`Provider profile created: ${provider.businessName} by ${req.user._id}`);
    res.status(201).json({ success: true, data: provider });
  } catch (error) {
    logger.error('Error creating provider profile:', error);
    res.status(400).json({ success: false, message: 'Internal server error' });
  }
};

exports.updateProviderProfile = async (req, res) => {
  try {
    const updateData = {};
    for (const key of PROVIDER_ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    const provider = await ServiceProvider.findOneAndUpdate(
      { userId: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }
    
    logger.info(`Provider profile updated: ${provider.businessName} by ${req.user._id}`);
    res.json({ success: true, data: provider });
  } catch (error) {
    logger.error('Error updating provider profile:', error);
    res.status(400).json({ success: false, message: 'Internal server error' });
  }
};

exports.getProviderListings = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const Listing = mongoose.model('ServiceListing');
    
    const filter = { providerId: req.params.id };
    if (status) filter.status = status;
    
    const listings = await Listing.find(filter)
      .populate('category', 'name slug')
      .sort('-createdAt')
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await Listing.countDocuments(filter);
    
    res.json({
      success: true,
      count: listings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: listings
    });
  } catch (error) {
    logger.error('Error fetching provider listings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getProviderReviews = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const Review = mongoose.model('ServiceReview');
    
    const reviews = await Review.find({ providerId: req.params.id })
      .populate('userId', 'name profileImage')
      .sort('-createdAt')
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await Review.countDocuments({ providerId: req.params.id });
    
    res.json({
      success: true,
      count: reviews.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: reviews
    });
  } catch (error) {
    logger.error('Error fetching provider reviews:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getProviderAvailability = async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.params.id)
      .select('availability');
    
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    
    res.json({ success: true, data: provider.availability });
  } catch (error) {
    logger.error('Error fetching availability:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOneAndUpdate(
      { userId: req.user._id },
      { availability: req.body },
      { new: true, runValidators: true }
    );
    
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }
    
    logger.info(`Availability updated for provider ${provider._id}`);
    res.json({ success: true, data: provider });
  } catch (error) {
    logger.error('Error updating availability:', error);
    res.status(400).json({ success: false, message: 'Internal server error' });
  }
};

exports.toggleProviderStatus = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ userId: req.user._id });
    
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }
    
    provider.isActive = !provider.isActive;
    await provider.save();
    
    logger.info(`Provider status toggled: ${provider.businessName} -> ${provider.isActive}`);
    res.json({ success: true, data: provider });
  } catch (error) {
    logger.error('Error toggling provider status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getNearbyProviders = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 5000, limit = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
    }
    
    const radiusKm = parseInt(maxDistance) / 1000; // maxDistance comes in meters
    const providers = await ServiceProvider.find({
      location: {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            radiusKm / 6378.1,
          ],
        },
      },
      isActive: true,
    })
    .limit(parseInt(limit))
    .populate('userId', 'name email profileImage');
    
    res.json({
      success: true,
      count: providers.length,
      data: providers
    });
  } catch (error) {
    logger.error('Error fetching nearby providers:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};