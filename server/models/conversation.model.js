const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    // Exactly 2 participants — buyer & seller (ordered by ObjectId for uniqueness)
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // ── Thread counters (denormalised for fast inbox query) ─────────────────
    threadCount:       { type: Number, default: 0 },
    activeThreadCount: { type: Number, default: 0 },
    // ── Last-active product context (set to the most-recently-touched thread) ─
    // Kept for backward-compat with existing inbox cards. New code uses ProductThread.
    listing: {
      listingId: { type: mongoose.Schema.Types.ObjectId, default: null },
      listingType: {
        type: String,
        enum: ["electronics", "vehicles", "mobiles", "furniture", "fashion", "sports", "collectibles", "pets", "toys", "books", "beauty", "others", "forsale", "properties", "rentals", "jobs", "events", "services", "roommates", "takecare", null],
        default: null,
      },
      listingTitle: { type: String, default: null },
      listingPrice: { type: Number, default: null },
      listingImage: { type: String, default: null },
      currency: { type: String, default: "₹" },
    },
    // Track unread counts per participant
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookup: "find all conversations for a user"
conversationSchema.index({ participants: 1, updatedAt: -1 });

// Listing context on a thread (one conversation per participant pair in app logic)
conversationSchema.index(
  { participants: 1, "listing.listingId": 1, "listing.listingType": 1 },
  { unique: false }
);

module.exports = mongoose.model("Conversation", conversationSchema);
