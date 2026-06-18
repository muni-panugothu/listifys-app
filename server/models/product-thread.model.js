'use strict';
/**
 * ProductThread — one thread per (conversation × product).
 *
 * Design:
 *  - A Conversation is 1 per buyer–seller pair.
 *  - Every distinct product the buyer contacts the seller about spawns
 *    one ProductThread inside that Conversation.
 *  - Messages reference the thread so the UI can render each product
 *    as a separate collapsible section.
 */
const mongoose = require('mongoose');

const LISTING_TYPES = [
  'electronics', 'vehicles', 'mobiles', 'furniture', 'fashion', 'sports',
  'collectibles', 'pets', 'toys', 'books', 'beauty', 'others', 'forsale',
  'properties', 'rentals', 'jobs', 'events', 'services', 'roommates', 'takecare',
];

const productThreadSchema = new mongoose.Schema(
  {
    // Parent conversation (buyer–seller pair)
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    // ── Product snapshot ──────────────────────────────────────────────────────
    product: {
      productId:   { type: mongoose.Schema.Types.ObjectId, required: true },
      productType: { type: String, enum: LISTING_TYPES, required: true },
      title:       { type: String, trim: true, maxlength: 300, default: null },
      price:       { type: Number, default: null },
      image:       { type: String, default: null },
      currency:    { type: String, default: '₹', maxlength: 10 },
    },

    // ── Participants ──────────────────────────────────────────────────────────
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['active', 'closed', 'sold', 'expired'],
      default: 'active',
      index:   true,
    },
    closedReason: {
      type:    String,
      enum:    ['sold', 'expired', 'user_closed', 'deleted', null],
      default: null,
    },
    startedAt:     { type: Date, default: Date.now },
    closedAt:      { type: Date, default: null },
    lastMessageAt: { type: Date, default: Date.now, index: true },

    // ── Offer state (latest / active offer) ───────────────────────────────────
    offerStatus: {
      type:    String,
      enum:    ['none', 'pending', 'accepted', 'declined', 'countered'],
      default: 'none',
    },
    activeOffer: {
      amount:     { type: Number, default: null },
      currency:   { type: String, default: '₹' },
      offeredBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      offeredAt:  { type: Date, default: null },
    },

    // ── Per-user unread within this thread ────────────────────────────────────
    unreadCounts: {
      type:    Map,
      of:      Number,
      default: {},
    },

    // ── Message stats ─────────────────────────────────────────────────────────
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// One thread per conversation + product
productThreadSchema.index(
  { conversation: 1, 'product.productId': 1 },
  { unique: true },
);
productThreadSchema.index({ conversation: 1, status: 1 });
productThreadSchema.index({ conversation: 1, lastMessageAt: -1 });

module.exports = mongoose.model('ProductThread', productThreadSchema);
