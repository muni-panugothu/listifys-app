const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    maxlength: [100, 'Business name cannot exceed 100 characters']
  },
  businessRegistrationNumber: {
    type: String,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory'
  }],
  subcategories: [{
    type: String
  }],
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [50, 'Description must be at least 50 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  servicesOffered: [{
    name: String,
    description: String,
    price: Number,
    priceType: {
      type: String,
      enum: ['fixed', 'hourly', 'daily', 'project'],
      default: 'fixed'
    },
    estimatedDuration: Number,
    isActive: { type: Boolean, default: true }
  }],
  pricing: {
    startingPrice: {
      type: Number,
      required: true,
      min: 0
    },
    priceLabel: String,
    currency: {
      type: String,
      default: 'INR'
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: String,
    state: String,
    pincode: String
  },
  serviceArea: [{
    type: String,
    enum: ['local', 'city', 'state', 'national']
  }],
  availability: {
    days: [{
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      slots: [{
        start: String,
        end: String,
        isAvailable: Boolean
      }]
    }],
    is24x7: { type: Boolean, default: false },
    holidays: [Date]
  },
  verification: {
    isVerified: { type: Boolean, default: false },
    documents: [{
      type: String,
      url: String,
      verified: { type: Boolean, default: false }
    }],
    backgroundCheck: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
    distribution: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 }
    }
  },
  metrics: {
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 },
    hireCount: { type: Number, default: 0 },
    yearsInBusiness: { type: Number, default: 0 }
  },
  badge: {
    type: String,
    enum: ['Top Pro', 'Great value', 'Exceptional', null],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  socialLinks: {
    website: String,
    facebook: String,
    instagram: String,
    twitter: String,
    linkedin: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
serviceProviderSchema.index({ location: '2dsphere' });
serviceProviderSchema.index({ 'categories': 1 });
serviceProviderSchema.index({ 'ratings.average': -1 });
serviceProviderSchema.index({ 'metrics.hireCount': -1 });
serviceProviderSchema.index({ 'pricing.startingPrice': 1 });

// Virtual for reviews
serviceProviderSchema.virtual('reviews', {
  ref: 'ServiceReview',
  localField: '_id',
  foreignField: 'providerId',
  options: { sort: { createdAt: -1 }, limit: 10 }
});

// Virtual for recent bookings
serviceProviderSchema.virtual('recentBookings', {
  ref: 'ServiceBooking',
  localField: '_id',
  foreignField: 'providerId',
  options: { sort: { createdAt: -1 }, limit: 5 }
});

// Method to update rating
serviceProviderSchema.methods.updateRating = async function() {
  const Review = mongoose.model('ServiceReview');
  const result = await Review.aggregate([
    { $match: { providerId: this._id } },
    { $group: {
      _id: null,
      avgRating: { $avg: '$rating' },
      count: { $sum: 1 },
      distribution: {
        $push: '$rating'
      }
    }}
  ]);

  if (result.length > 0) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    result[0].distribution.forEach(r => {
      if (distribution[r]) distribution[r]++;
    });

    this.ratings = {
      average: Math.round(result[0].avgRating * 10) / 10,
      count: result[0].count,
      distribution
    };
    await this.save();
  }
};

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);