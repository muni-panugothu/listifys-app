'use strict';

const mongoose = require('mongoose');

const sellerReviewSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['published', 'hidden'],
      default: 'published',
    },
  },
  { timestamps: true },
);

sellerReviewSchema.index({ seller: 1, reviewer: 1 }, { unique: true });
sellerReviewSchema.index({ seller: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('SellerReview', sellerReviewSchema);
