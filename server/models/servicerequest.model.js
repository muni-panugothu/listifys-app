const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    minlength: 20,
    maxlength: 2000
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory',
    required: true
  },
  subcategory: String,
  budget: {
    min: Number,
    max: Number,
    isNegotiable: { type: Boolean, default: true }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    address: String,
    city: String,
    state: String
  },
  timeline: {
    startDate: Date,
    endDate: Date,
    isFlexible: { type: Boolean, default: true }
  },
  requirements: [String],
  attachments: [{
    url: String,
    name: String
  }],
  status: {
    type: String,
    enum: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'open'
  },
  assignedTo: {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceProvider'
    },
    assignedAt: Date
  },
  offers: [{
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceProvider'
    },
    price: Number,
    message: String,
    timeline: String,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  views: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 14*24*60*60*1000)
  }
}, {
  timestamps: true
});

// Indexes
serviceRequestSchema.index({ location: '2dsphere' });
serviceRequestSchema.index({ category: 1, status: 1 });
serviceRequestSchema.index({ userId: 1 });
serviceRequestSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);