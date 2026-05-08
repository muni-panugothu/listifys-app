const mongoose = require('mongoose');

const serviceBookingSchema = new mongoose.Schema({
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceListing',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingNumber: {
    type: String,
    unique: true
  },
  serviceDetails: {
    title: String,
    description: String,
    price: Number,
    priceType: String
  },
  schedule: {
    date: {
      type: Date,
      required: true
    },
    startTime: String,
    endTime: String,
    duration: Number
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  customerDetails: {
    name: String,
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String
    },
    specialInstructions: String
  },
  location: {
    type: {
      type: String,
      enum: ['provider', 'customer', 'other'],
      required: true
    },
    address: String,
    coordinates: [Number]
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  payment: {
    method: {
      type: String,
      enum: ['online', 'cash', 'wallet']
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paymentId: String,
    paidAt: Date
  },
  timeline: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  review: {
    given: { type: Boolean, default: false },
    rating: Number,
    comment: String,
    givenAt: Date
  },
  cancellation: {
    reason: String,
    cancelledBy: {
      type: String,
      enum: ['customer', 'provider', 'system']
    },
    cancelledAt: Date,
    refundAmount: Number
  },
  reminders: {
    before24h: { type: Boolean, default: false },
    before1h: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes for frequent query patterns
serviceBookingSchema.index({ userId: 1, createdAt: -1 });
serviceBookingSchema.index({ providerId: 1, createdAt: -1 });
serviceBookingSchema.index({ status: 1 });
serviceBookingSchema.index({ bookingNumber: 1 }, { unique: true, sparse: true });

// Generate booking number before saving (retry on collision)
serviceBookingSchema.pre('save', async function() {
  if (!this.bookingNumber) {
    const prefix = 'SRV';
    for (let attempt = 0; attempt < 3; attempt++) {
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const candidate = `${prefix}${timestamp}${random}`;
      const exists = await mongoose.model('ServiceBooking').exists({ bookingNumber: candidate });
      if (!exists) {
        this.bookingNumber = candidate;
        break;
      }
    }
    if (!this.bookingNumber) {
      // Fallback: use ObjectId suffix for guaranteed uniqueness
      this.bookingNumber = `${prefix}${Date.now().toString().slice(-8)}${this._id.toString().slice(-4)}`;
    }
  }
  
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      note: `Booking ${this.status}`,
      updatedBy: this.userId
    });
    // Track that status just changed to completed (for post-save metrics)
    this._statusJustCompleted = this.status === 'completed';
  }
});

// Update provider metrics only when status first transitions to completed
serviceBookingSchema.post('save', async function(doc) {
  if (doc._statusJustCompleted && !doc.review.given) {
    const Provider = mongoose.model('ServiceProvider');
    await Provider.findByIdAndUpdate(doc.providerId, {
      $inc: {
        'metrics.completedBookings': 1,
        'metrics.hireCount': 1
      }
    });
  }
});

module.exports = mongoose.model('ServiceBooking', serviceBookingSchema);