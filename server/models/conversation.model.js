const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
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
    // Optional: link conversation to a specific listing
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

// Ensure only one conversation per pair of participants + listing
conversationSchema.index(
  { participants: 1, "listing.listingId": 1, "listing.listingType": 1 },
  { unique: false }
);

module.exports = mongoose.model("Conversation", conversationSchema);
