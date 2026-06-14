const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "follow", "message", "listing_saved", "listing_sold", "new_listing",
        "booking_created", "booking_confirmed", "booking_completed", "booking_cancelled",
        "booking", "review_received", "offer_received", "offer_accepted", "offer_rejected",
        "price_drop", "promotion", "flash_sale", "engagement_digest", "re_engagement",
        "system", "silent",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    // ── Rich notification fields ──────────────────────────────────────────────
    imageUrl:  { type: String, default: null },   // big picture / banner
    iconUrl:   { type: String, default: null },   // sender avatar
    route:     { type: String, default: null },   // deep-link route
    routeParams: { type: mongoose.Schema.Types.Mixed, default: null },
    actions:   { type: mongoose.Schema.Types.Mixed, default: null }, // CTA buttons array
    groupKey:  { type: String, default: null },   // notification group
    // ── Analytics fields ─────────────────────────────────────────────────────
    /** Whether the FCM push was dispatched */
    pushSent:   { type: Boolean, default: false },
    /** When Notifee showed the notification on device */
    shownAt:    { type: Date, default: null },
    /** When user tapped the notification body */
    clickedAt:  { type: Date, default: null },
    /** actionId pressed (e.g. 'add_to_cart', 'view_offer') */
    ctaClicked: { type: String, default: null },
    /** When user dismissed the notification */
    dismissedAt: { type: Date, default: null },
    // ── Legacy metadata ───────────────────────────────────────────────────────
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Fast unread queries
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// TTL — auto-delete after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("Notification", notificationSchema);
