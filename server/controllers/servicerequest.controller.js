const ServiceRequest = require('../models/servicerequest.model');
const ServiceProvider = require('../models/serviceprovider.model');
const { logger } = require('../utils/logger');

exports.createRequest = async (req, res) => {
  try {
    const { title, description, category, subcategory, budget, location, timeline, requirements, attachments } = req.body;
    
    let locationObj = null;
    if (location && location.lng && location.lat) {
      locationObj = {
        type: 'Point',
        coordinates: [Number(location.lng), Number(location.lat)],
        address: location.address,
        city: location.city,
        state: location.state,
      };
    } else if (location && (location.address || location.city)) {
      locationObj = { address: location.address, city: location.city, state: location.state };
    }

    const request = await ServiceRequest.create({
      userId: req.user._id,
      title,
      description,
      category,
      subcategory,
      budget,
      location: locationObj,
      timeline,
      requirements,
      attachments,
      status: 'open'
    });

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    logger.error('Error creating service request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const { category, status } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const filter = { expiresAt: { $gt: new Date() } };
    
    if (status) filter.status = status;
    else filter.status = 'open';
    
    if (category) filter.category = category;

    const requests = await ServiceRequest.find(filter)
      .populate('userId', 'name profileImage')
      .populate('category', 'name')
      .sort('-createdAt')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await ServiceRequest.countDocuments(filter);

    res.json({
      success: true,
      count: requests.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: requests
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getRequestById = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id)
      .populate('userId', 'name profileImage')
      .populate('category', 'name')
      .populate('offers.providerId', 'businessName ratings badge userId');

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // Only the requester, an offering provider, or an admin may view full details
    const uid = req.user._id.toString();
    const isRequester = request.userId?._id?.toString() === uid || request.userId?.toString() === uid;
    const isOfferingProvider = request.offers?.some(o => o.providerId?.toString() === uid || o.providerId?._id?.toString() === uid);
    if (!isRequester && !isOfferingProvider && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
    }

    // Atomic view increment
    await ServiceRequest.updateOne({ _id: request._id }, { $inc: { views: 1 } });

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.userId.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Unauthorized' });

    const allowed = ['title', 'description', 'budget', 'timeline', 'requirements', 'status'];
    allowed.forEach(field => {
       if (req.body[field] !== undefined) request[field] = req.body[field];
    });

    await request.save();
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.deleteRequest = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.userId.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Unauthorized' });

    await ServiceRequest.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Request deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.makeOffer = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'open') return res.status(400).json({ success: false, message: 'Request is no longer open' });

    const { price, message, timeline } = req.body;
    
    const existingOfferIndex = request.offers.findIndex(o => o.providerId.toString() === provider._id.toString());
    if (existingOfferIndex !== -1) {
       request.offers[existingOfferIndex].price = price;
       request.offers[existingOfferIndex].message = message;
       request.offers[existingOfferIndex].timeline = timeline;
    } else {
       request.offers.push({
         providerId: provider._id,
         price,
         message,
         timeline
       });
    }

    await request.save();
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.acceptOffer = async (req, res) => {
  try {
    const request = await ServiceRequest.findOne({ 'offers._id': req.params.offerId });
    if (!request) return res.status(404).json({ success: false, message: 'Offer not found' });
    if (request.userId.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Unauthorized' });

    const offer = request.offers.id(req.params.offerId);
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });

    offer.status = 'accepted';
    request.status = 'assigned';
    request.assignedTo = {
       providerId: offer.providerId,
       assignedAt: new Date()
    };

    request.offers.forEach(o => {
       if (o._id.toString() !== offer._id.toString()) o.status = 'rejected';
    });

    await request.save();
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const requests = await ServiceRequest.find(filter)
      .populate('category', 'name')
      .sort('-createdAt')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await ServiceRequest.countDocuments(filter);

    res.json({
      success: true,
      count: requests.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: requests
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getRequestsForProvider = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const filter = { 
      status: 'open', 
      expiresAt: { $gt: new Date() },
      category: { $in: provider.categories || [] }
    };

    const requests = await ServiceRequest.find(filter)
      .populate('userId', 'name profileImage')
      .populate('category', 'name')
      .sort('-createdAt')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await ServiceRequest.countDocuments(filter);

    res.json({
      success: true,
      count: requests.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: requests
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
