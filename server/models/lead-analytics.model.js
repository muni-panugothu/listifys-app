/**
 * LeadAnalytics Model
 *
 * Records every marketplace contact event (call click, WhatsApp click, chat open).
 *
 * Used for:
 *   - Seller dashboard: "X people tried to call you this week"
 *   - Platform analytics: most-called categories, peak call times
 *   - Fraud / spam detection: abnormal call click velocity on a single listing
 *   - Buyer behaviour analysis
 *
 * Privacy:
 *   - Contact phone is stored as SHA-256 hash only — never plaintext
 *   - Buyer identity linked by ObjectId (no PII in this collection)
 *   - Auto-deleted after 2 years via TTL index
 *
 * Supported listing models (matches mongoose model names):
 *   ForSale, Vehicle, Property, Job, Electronics, Mobile, Furniture,
 *   Fashion, Sport, Collectible, Pet, Book, Beauty, Other, Toy,
 *   TakeCare, Event, ServiceListing
 */

const mongoose = require("mongoose");
const crypto = require("crypto");

// ── Sub-schema: device context ────────────────────────────────────────────────
const deviceContextSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["ios", "android", "web", "unknown"],
      default: "unknown",
    },
    // Coarse IP (last octet zeroed for privacy)
    ipAddress: { type: String, default: null },
    userAgent:  { type: String, default: null },
    country:    { type: String, default: null },
  },
  { _id: false },
);

// ── Main schema ───────────────────────────────────────────────────────────────
const leadAnalyticsSchema = new mongoose.Schema(
  {
    // ── The listing that was contacted ──────────────────────────────────────
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    listingModel: {
      type: String,
      required: true,
      enum: [
        "ForSale", "Vehicle", "Property", "Job", "Electronics", "Mobile",
        "Furniture", "Fashion", "Sport", "Collectible", "Pet", "Book",
        "Beauty", "Other", "Toy", "TakeCare", "Event", "ServiceListing",
      ],
      default: "ForSale",
    },

    // ── Parties ─────────────────────────────────────────────────────────────
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Null for guest / unauthenticated buyers
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ── Contact info (privacy-safe) ─────────────────────────────────────────
    // SHA-256 hash of the E.164 phone number — never store plaintext
    contactPhoneHash: {
      type: String,
      required: true,
    },

    // ── Event type ──────────────────────────────────────────────────────────
    eventType: {
      type: String,
      enum: ["call_click", "whatsapp_click", "chat_open"],
      default: "call_click",
      index: true,
    },

    isAuthenticated: {
      type: Boolean,
      default: false,
    },

    // ── Device context ──────────────────────────────────────────────────────
    device: deviceContextSchema,
  },
  {
    timestamps: true,
  },
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Seller dashboard: "how many calls did I get this week?"
leadAnalyticsSchema.index({ sellerId: 1, createdAt: -1 });

// Listing detail: "how popular is this listing?"
leadAnalyticsSchema.index({ listingId: 1, eventType: 1, createdAt: -1 });

// Buyer history: "what did this user click?"
leadAnalyticsSchema.index({ buyerId: 1, createdAt: -1 });

// TTL: auto-delete records older than 2 years (63,072,000 seconds)
leadAnalyticsSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 63072000, name: "ttl_2y" },
);

// ── Static helpers ────────────────────────────────────────────────────────────

/**
 * Hash a phone number for safe storage.
 * @param {string} phone - E.164 phone number
 * @returns {string} - SHA-256 hex digest
 */
leadAnalyticsSchema.statics.hashPhone = function (phone) {
  return crypto
    .createHash("sha256")
    .update(phone.trim().toLowerCase())
    .digest("hex");
};

module.exports = mongoose.model("LeadAnalytics", leadAnalyticsSchema);
