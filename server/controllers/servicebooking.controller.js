const ServiceBooking = require('../models/servicebooking.model');
const ServiceListing = require('../models/servicelisting.model');
const ServiceProvider = require('../models/serviceprovider.model');
const { logger } = require('../utils/logger');

// ── RabbitMQ Producers ───────────────────────────────────────────
const { publishBookingNotification } = require('../queues/producers/notification.producer');

exports.createBooking = async (req, res) => {
  try {
    const { listingId, serviceDetails, schedule, quantity, customerDetails, location, payment } = req.body;
    
    const listing = await ServiceListing.findById(listingId);
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });

    // Derive providerId from the listing — never trust the client
    const providerId = listing.providerId;
    if (!providerId) return res.status(400).json({ success: false, message: 'Listing has no provider' });

    // Calculate total price structure
    const basePrice = listing.pricing.basePrice;
    const subtotal = basePrice * (quantity || 1);
    const tax = subtotal * 0.18; // assuming 18% GST or similar
    const total = subtotal + tax;
    
    const booking = await ServiceBooking.create({
      listingId,
      providerId,
      userId: req.user._id,
      serviceDetails: {
        title: listing.title,
        description: listing.description,
        price: basePrice,
        priceType: listing.pricing.priceType,
        ...serviceDetails
      },
      schedule,
      quantity,
      pricing: {
        subtotal,
        tax,
        total,
        currency: 'INR'
      },
      customerDetails: {
        name: req.user.name || '',
        email: req.user.email,
        ...customerDetails
      },
      location,
      payment: payment || { method: 'online', status: 'pending' },
      status: 'pending'
    });

    res.status(201).json({ success: true, data: booking });

    // ✅ Non-blocking: notify provider of new booking via RabbitMQ
    publishBookingNotification({
      booking: { _id: booking._id, userId: req.user._id, providerId, serviceDetails: { title: listing.title } },
      event:  'created',
      actor:   req.user._id.toString(),
    }).catch(() => {});
  } catch (error) {
    logger.error('Error in createBooking:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const bookings = await ServiceBooking.find(filter)
      .populate('providerId', 'businessName')
      .populate('listingId', 'title images')
      .sort('-createdAt')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await ServiceBooking.countDocuments(filter);

    res.json({
      success: true,
      count: bookings.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getProviderBookings = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ userId: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

    const { status } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const filter = { providerId: provider._id };
    if (status) filter.status = status;

    const bookings = await ServiceBooking.find(filter)
      .populate('userId', 'name profileImage phone')
      .populate('listingId', 'title images')
      .sort('-createdAt')
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await ServiceBooking.countDocuments(filter);

    res.json({
      success: true,
      count: bookings.length,
      total,
      data: bookings,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id)
      .populate({
        path: 'providerId',
        select: 'businessName userId category',
        populate: { path: 'userId', select: 'name email profileImage' }
      })
      .populate('listingId', 'title images')
      .populate('userId', 'name email phone profileImage');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Ensure authorized
    const isUser = booking.userId._id.toString() === req.user._id.toString();
    const isProvider = booking.providerId && booking.providerId.userId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isUser && !isProvider && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const booking = await ServiceBooking.findById(req.params.id).populate('providerId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isUser = booking.userId.toString() === req.user._id.toString();
    const isProvider = booking.providerId && booking.providerId.userId.toString() === req.user._id.toString();

    if (!isUser && !isProvider) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (isUser && !['cancelled'].includes(status)) {
      return res.status(403).json({ success: false, message: 'Users can only cancel bookings' });
    }

    booking.status = status;
    booking.timeline = booking.timeline || [];
    
    // Custom note if provided, else hook adds it automatically
    if (note) {
      booking.timeline.push({
        status,
        note,
        updatedBy: req.user._id
      });
    }
    
    await booking.save();

    res.json({ success: true, data: booking });

    // ✅ Non-blocking: notify relevant party of status change
    publishBookingNotification({
      booking,
      event: status,
      actor: req.user._id.toString(),
    }).catch(() => {});
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await ServiceBooking.findById(req.params.id).populate('providerId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isUser = booking.userId.toString() === req.user._id.toString();
    const isProvider = booking.providerId && booking.providerId.userId.toString() === req.user._id.toString();

    if (!isUser && !isProvider) return res.status(403).json({ success: false, message: 'Unauthorized' });
    if (booking.status === 'completed' || booking.status === 'cancelled') {
        return res.status(400).json({ success: false, message: `Booking already ${booking.status}` });
    }

    booking.status = 'cancelled';
    booking.cancellation = {
      reason: reason || 'Cancelled by ' + (isUser ? 'customer' : 'provider'),
      cancelledBy: isUser ? 'customer' : 'provider',
      cancelledAt: new Date()
    };
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getBookingTimeline = async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id)
      .select('timeline status bookingNumber userId providerId')
      .populate('timeline.updatedBy', 'name profileImage');
    
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Only the customer, provider, or admin may view the timeline
    const uid = req.user._id.toString();
    const isOwner = booking.userId?.toString() === uid || booking.providerId?.toString() === uid;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }
    
    res.json({ success: true, data: booking.timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
