const ServiceListing = require('../models/servicelisting.model');
const ServiceCategory = require('../models/servicecategory.model');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const { parsePagination, paginatedFind } = require('../utils/pagination');
const S3Service = require('../services/s3.service');
const { escapeRegex } = require('../utils/geoQuery');
const { esHydratedSearch } = require('../utils/esSearch');

// ── RabbitMQ Producers ─────────────────────────────────────────────────────────
const {
  publishListingCreated,
  publishListingUpdated,
  publishListingDeleted,
  publishImageCleanup,
} = require('../queues/producers/listing.producer');

const normalizePriceType = (rawPriceType) => {
  const value = String(rawPriceType || '').trim().toLowerCase();
  if (!value) return 'fixed';

  const map = {
    fixed: 'fixed',
    hourly: 'hourly',
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
    project: 'project',
    'per project': 'project',
    'per visit': 'daily',
    negotiable: 'fixed',
  };

  return map[value] || 'fixed';
};

// Normalize image URLs
const normaliseImages = (listing) => {
  if (!listing) return listing;
  if (listing.images && Array.isArray(listing.images)) {
    listing.images = listing.images.map(img => {
      if (typeof img === 'string') return S3Service.toProxyUrl(img);
      if (img.url) {
        img.url = S3Service.toProxyUrl(img.url);
        return img;
      }
      return img;
    });
  }
  return listing;
};

// @desc    Get all service listings
// @route   GET /api/services/listings
exports.getListings = async (req, res) => {
  try {
    const { category, subcategory, minPrice, maxPrice, search, location } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    
    const filter = { status: 'active', visibility: 'public' };

    // ── Elasticsearch-first search (MongoDB regex fallback below) ──
    if (search) {
      const esResult = await esHydratedSearch({
        entity: 'services',
        searchParams: { query: search, location, sort: 'relevance', page, limit },
        Model: ServiceListing,
        populate: [{ path: 'userId', select: 'name profileImage' }, { path: 'category', select: 'name' }],
      });

      if (esResult) {
        esResult.docs.forEach(normaliseImages);
        res.setHeader('X-Search-Source', 'elasticsearch');
        return res.status(200).json({
          success: true,
          data: esResult.docs,
          pagination: esResult.pagination,
        });
      }
    }
    
    if (search) {
      const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } },
      ];
    }
    
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        // Try matching by name first (exact, case-insensitive)
        let catObj = await ServiceCategory.findOne({ name: { $regex: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        // If not found by name, try matching by slug
        if (!catObj) {
          const slug = category.toLowerCase().replace(/\s+/g, '-');
          catObj = await ServiceCategory.findOne({ slug: slug });
        }
        if (catObj) filter.category = catObj._id;
      }
    }
    
    if (subcategory) {
      // Support slug-style (e.g. "personal-trainer") and name-style (e.g. "Personal Trainer")
      const subName = subcategory.replace(/-/g, ' ');
      filter.subcategory = { $regex: new RegExp(`^${subName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }
    if (minPrice || maxPrice) {
      filter['pricing.basePrice'] = {};
      if (minPrice) filter['pricing.basePrice'].$gte = Number(minPrice);
      if (maxPrice) filter['pricing.basePrice'].$lte = Number(maxPrice);
    }
    if (location) filter['location.address'] = { $regex: escapeRegex(location), $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    
    const [listings, total] = await Promise.all([
      ServiceListing.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name profileImage')
        .populate('category', 'name')
        .lean(),
      ServiceListing.countDocuments(filter)
    ]);
    
    listings.forEach(normaliseImages);
    
    res.status(200).json({
      success: true,
      data: listings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error in getListings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Get service listing by ID
exports.getListingById = async (req, res) => {
  try {
    const param = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(param);
    
    const listing = isObjectId
      ? await ServiceListing.findById(param)
          .populate('userId', 'name profileImage')
          .populate('category', 'name')
          .lean()
      : await ServiceListing.findOne({ slug: param, status: 'active' })
          .populate('userId', 'name profileImage')
          .populate('category', 'name')
          .lean();
      
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    
    normaliseImages(listing);
    res.status(200).json({ success: true, data: listing });
  } catch (error) {
    logger.error('Error in getListingById:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Create service listing
exports.createListing = async (req, res) => {
  try {
    const {
      title, description, category, subcategory, price, location, phone, phoneCode, currency, images, lat, lng,
      condition,
      // Service-specific fields
      serviceType, experience, availability, priceType,
      serviceArea, certification, languages, teamSize,
      turnaroundTime, portfolioLink,
    } = req.body;

    const normalisedImages = Array.isArray(images)
      ? images
          .map((img) => {
            if (typeof img === 'string' && img.trim()) return { url: img.trim() };
            if (img && typeof img === 'object' && typeof img.url === 'string' && img.url.trim()) {
              return {
                url: img.url.trim(),
                publicId: img.publicId || '',
                isPrimary: !!img.isPrimary,
              };
            }
            return null;
          })
          .filter(Boolean)
      : [];

    const availabilityObject =
      availability && typeof availability === 'object' && !Array.isArray(availability)
        ? availability
        : undefined;
    const availabilityText = typeof availability === 'string' ? availability.trim() : '';
    const normalizedPriceType = normalizePriceType(priceType);
    const isNegotiable = String(priceType || '').trim().toLowerCase() === 'negotiable';
    
    // Validate category – accept ObjectId OR name string
    let catId = category;
    if (!mongoose.Types.ObjectId.isValid(catId)) {
      const catObj = await ServiceCategory.findOne({ name: category });
      if (catObj) catId = catObj._id;
      else {
        // For hardcoded "Services" category in PostAd, create/find a generic one
        let genericCat = await ServiceCategory.findOne({ name: 'Services' });
        if (!genericCat) {
          genericCat = await ServiceCategory.create({
            name: 'Services',
            slug: 'services',
            image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&h=400&fit=crop',
            subcategories: []
          });
        }
        catId = genericCat._id;
      }
    }
    
    const sellerName = req.user.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : req.user.email?.split('@')[0] || 'User';
    
    const listing = await ServiceListing.create({
      userId: req.user._id,
      title,
      description,
      category: catId,
      subcategory,
      pricing: {
        basePrice: Number(price),
        priceType: normalizedPriceType,
        negotiable: isNegotiable,
      },
      location: {
        type: 'Point',
        coordinates: lat && lng ? [Number(lng), Number(lat)] : undefined,
        address: location || ''
      },
      phone,
      phoneCode,
      currency,
      images: normalisedImages,
      availability: availabilityObject,
      // Service-specific
      serviceType: serviceType || '',
      experience: experience || '',
      serviceAvailability: availabilityText,
      priceType: priceType || 'fixed',
      serviceArea: serviceArea || '',
      certification: certification || '',
      languages: languages || '',
      teamSize: teamSize || '',
      turnaroundTime: turnaroundTime || '',
      portfolioLink: portfolioLink || '',
      seller: req.user._id.toString(),
      sellerName,
    });
    
    const populated = await ServiceListing.findById(listing._id)
      .populate('userId', 'name profileImage')
      .populate('category', 'name').lean();
      
    normaliseImages(populated);
    res.status(201).json({ success: true, data: populated });

    // ✅ Background via RabbitMQ (non-blocking)
    publishListingCreated({
      entity: 'services',
      listing: populated,
      userId: req.user._id.toString(),
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(() => {});
  } catch (error) {
    logger.error('Error in createListing:', error);
    res.status(500).json({ success: false, message: 'Internal server error' || 'Failed to create listing' });
  }
};

// Update
exports.updateListing = async (req, res) => {
  try {
    const listing = await ServiceListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: 'Not found' });
    if (listing.userId.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Unauthorized' });
    
    const allowed = [
      'title', 'description', 'category', 'subcategory', 'price', 'pricing', 'images', 'location', 'status',
      'phone', 'phoneCode', 'currency',
      'serviceType', 'experience', 'availability', 'serviceAvailability',
      'priceType', 'serviceArea', 'certification', 'languages', 'teamSize',
      'turnaroundTime', 'portfolioLink', 'lat', 'lng'
    ];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        if (field === 'price') {
          listing.pricing = { 
            ...listing.pricing,
            basePrice: Number(req.body.price) 
          };
        } else if (field === 'images' && Array.isArray(req.body.images)) {
          listing.images = req.body.images.map(img => 
            typeof img === 'string' ? { url: img } : img
          );
        } else if (field === 'availability' || field === 'serviceAvailability') {
          const incoming = req.body[field];
          if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
            listing.availability = incoming;
          } else if (typeof incoming === 'string') {
            listing.serviceAvailability = incoming;
          }
        } else if (field === 'location') {
          if (typeof req.body.location === 'object') {
            listing.location = {
              ...listing.location,
              ...req.body.location
            };
          } else if (typeof req.body.location === 'string') {
            listing.location.address = req.body.location;
          }
        } else if (field === 'lat' || field === 'lng') {
          if (!listing.location.coordinates) listing.location.coordinates = [0, 0];
          if (field === 'lat') listing.location.coordinates[1] = Number(req.body.lat);
          if (field === 'lng') listing.location.coordinates[0] = Number(req.body.lng);
          listing.markModified('location.coordinates');
        } else if (field === 'category') {
          if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
            const catObj = await ServiceCategory.findOne({ name: req.body.category });
            if (catObj) listing.category = catObj._id;
          } else {
            listing.category = req.body.category;
          }
        } else {
          listing[field] = req.body[field];
        }
      }
    }

    // Handle priceType if updated separately or via price logic
    if (req.body.priceType) {
      const normalizedPriceType = normalizePriceType(req.body.priceType);
      const isNegotiable =
        String(req.body.priceType || '').trim().toLowerCase() === 'negotiable';
      listing.pricing = {
        ...listing.pricing,
        priceType: normalizedPriceType,
        negotiable: isNegotiable
      };
    }

    await listing.save();
    
    res.status(200).json({ success: true, data: listing });

    // ✅ Background via RabbitMQ (non-blocking)
    publishListingUpdated({
      entity: 'services',
      listing: listing.toObject(),
      userId: req.user._id.toString(),
      ip: req.ip,
    }).catch(() => {});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete
exports.deleteListing = async (req, res) => {
  try {
    const listing = await ServiceListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: 'Not found' });
    if (listing.userId.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Unauthorized' });
    
    const listingData = listing.toObject();
    const imageUrls = (listingData.images || []).map(img => img.url || img).filter(Boolean);

    await ServiceListing.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });

    // ✅ Background via RabbitMQ (non-blocking)
    publishListingDeleted({
      entity: 'services',
      listingId: req.params.id,
      listing: listingData,
      userId: req.user._id.toString(),
    }).catch(() => {});

    if (imageUrls.length > 0) {
      publishImageCleanup({ imageUrls }).catch(() => {});
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get My Listings
exports.getMyListings = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { limit: 20 });
    const { items, pagination } = await paginatedFind({
      model: ServiceListing,
      filter: { userId: req.user._id },
      populate: [{ path: 'category', select: 'name slug' }],
      page,
      limit,
    });
    items.forEach(normaliseImages);
    res.status(200).json({ success: true, data: items, pagination });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get Saved Listings
exports.getSavedListings = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { limit: 20 });
    const { items, pagination } = await paginatedFind({
      model: ServiceListing,
      filter: { savedBy: req.user._id },
      populate: [{ path: 'category', select: 'name slug' }],
      page,
      limit,
    });
    items.forEach(normaliseImages);
    res.status(200).json({ success: true, data: items, pagination });
  } catch (err) {
     res.status(500).json({ success: false, message: err.message });
  }
};

// Toggle Save — atomic update for speed
exports.toggleSaveListing = async (req, res) => {
  try {
    const userId = req.user._id;
    const listingId = req.params.id;
    
    // Check if already saved using a lean query (fast)
    const listing = await ServiceListing.findById(listingId).select('savedBy').lean();
    if (!listing) return res.status(404).json({ success: false, message: 'Not found' });
    
    const isSaved = listing.savedBy?.some(id => id.toString() === userId.toString());
    
    // Atomic update — no race conditions, no full doc load
    if (isSaved) {
      await ServiceListing.updateOne({ _id: listingId }, { $pull: { savedBy: userId } });
    } else {
      await ServiceListing.updateOne({ _id: listingId }, { $addToSet: { savedBy: userId } });
    }
    
    res.status(200).json({ success: true, saved: !isSaved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Upload Images
exports.uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'No images' });
    const imageUrls = [];
    for (const file of req.files) {
      const result = await S3Service.uploadListingImage(file.buffer, req.user._id.toString(), file.mimetype, 'services');
      imageUrls.push(result.imageUrl);
    }
    res.status(200).json({ success: true, imageUrls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Increment Views
exports.incrementViews = async (req, res) => {
  try {
     const mongoose = require('mongoose');
     if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
       return res.status(400).json({ success: false, message: 'Invalid ID' });
     }
     await ServiceListing.updateOne(
       { _id: req.params.id },
       { $inc: { 'stats.views': 1 } }
     );
     res.status(200).json({ success: true });
  } catch (err) {
     res.status(500).json({ success: false });
  }
};

// Nearby
exports.getNearbyListings = async (req, res) => {
  try {
     const { lat, lng, maxDistance = 5000 } = req.query;
     if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat/lng required' });
     const userLat = Number(lat);
     const userLng = Number(lng);
     if (isNaN(userLat) || isNaN(userLng)) {
       return res.status(400).json({ success: false, message: 'Invalid coordinates' });
     }
     const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
     
     const radiusKm = Number(maxDistance) / 1000;
     const listings = await ServiceListing.find({
       location: {
         $geoWithin: {
           $centerSphere: [
             [userLng, userLat],
             radiusKm / 6378.1,
           ],
         },
       },
       status: 'active',
       visibility: 'public'
     }).populate('category', 'name').limit(safeLimit).lean();
     
     listings.forEach(normaliseImages);
     res.status(200).json({ success: true, data: listings });
  } catch (err) {
     res.status(500).json({ success: false, message: 'Failed to fetch nearby listings' });
  }
};
