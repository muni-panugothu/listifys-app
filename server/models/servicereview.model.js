const mongoose = require('mongoose');

const serviceReviewSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceBooking',
    required: false,
    sparse: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: true
  },
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceListing'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 1000
  },
  pros: [String],
  cons: [String],
  images: [{
    url: String,
    publicId: String
  }],
  response: {
    comment: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  verified: {
    type: Boolean,
    default: false
  },
  helpful: {
    count: { type: Number, default: 0 },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  reported: {
    isReported: { type: Boolean, default: false },
    reports: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      reportedAt: { type: Date, default: Date.now }
    }]
  },
  status: {
    type: String,
    enum: ['published', 'hidden', 'flagged'],
    default: 'published'
  }
}, {
  timestamps: true
});

// Indexes for frequent query patterns
serviceReviewSchema.index({ providerId: 1, status: 1, createdAt: -1 });
serviceReviewSchema.index({ listingId: 1, status: 1 });
serviceReviewSchema.index({ userId: 1 });

// Update provider rating after review is saved
serviceReviewSchema.post('save', async function(doc) {
  const Provider = mongoose.model('ServiceProvider');
  const provider = await Provider.findById(doc.providerId);
  if (provider) {
    await provider.updateRating();
  }
});

module.exports = mongoose.model('ServiceReview', serviceReviewSchema);