/**
 * ContactVerification Model
 *
 * Tracks Twilio-verified alternate contact phone numbers per seller.
 *
 * Business rule:
 *   - If contactPhone === user.phone (account phone) → auto-verified (no record needed)
 *   - If contactPhone !== user.phone → a verified record must exist here before publish
 *
 * Flow:
 *   1. Seller enters alternate number in product form
 *   2. POST /api/marketplace/contact/send-otp   → Twilio Verify sends OTP
 *   3. POST /api/marketplace/contact/verify-otp → Twilio checks code → upsert verified=true
 *   4. Product controller checks ContactVerification before allowing publish
 */

const mongoose = require("mongoose");

const contactVerificationSchema = new mongoose.Schema(
  {
    // The seller who verified this number
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // E.164 phone number being verified
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+[1-9]\d{6,14}$/, "Must be a valid E.164 phone number"],
    },

    // Country code for display (e.g. "+91")
    countryCode: {
      type: String,
      trim: true,
      default: null,
    },

    // Verification state
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },

    // Twilio Verify check SID — stored for audit trail
    verifySid: {
      type: String,
      default: null,
    },

    // Soft-revoke support (e.g. seller removes the number)
    revokedAt: {
      type: Date,
      default: null,
    },

    // Verifications expire after 1 year (seller must re-verify if they change devices)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  },
);

// One verification record per user+phone pair
contactVerificationSchema.index({ userId: 1, phone: 1 }, { unique: true });

// Fast lookup for "is this phone verified for this user?"
contactVerificationSchema.index({ userId: 1, phone: 1, verified: 1 });

// TTL: auto-delete *unverified* pending records after 24 hours
// (keeps the collection clean — failed OTP attempts don't linger)
contactVerificationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 86400,
    partialFilterExpression: { verified: false },
    name: "expire_unverified_24h",
  },
);

module.exports = mongoose.model("ContactVerification", contactVerificationSchema);
