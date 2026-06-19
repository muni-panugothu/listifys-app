const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: function () {
        return !Array.isArray(this.attachments) || this.attachments.length === 0;
      },
      default: "",
      trim: true,
      maxlength: [10000, "Message cannot exceed 10000 characters"],
    },
    attachments: [
      {
        name: { type: String, trim: true, maxlength: 255 },
        url: { type: String, required: true, trim: true },
        key: { type: String, trim: true },
        mimeType: { type: String, trim: true, maxlength: 120 },
        size: { type: Number, min: 0 },
        type: {
          type: String,
          enum: ["image", "video", "audio", "document", "other"],
          default: "other",
        },
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        emoji: {
          type: String,
          required: true,
          trim: true,
          maxlength: 16,
        },
      },
    ],
    // ── Client-supplied idempotency key (set by the app when sending) ───────
    // Used to dedupe retries on network flap and to reconcile the optimistic
    // bubble with the server-saved message without relying on the (still
    // unknown) server _id.
    clientMessageId: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null,
    },
    // Aggregate status. For 1:1 product threads this is enough; the
    // per-user `deliveryReceipts` below keeps group support possible later.
    //   sending  → only used by the client; never written here
    //   sent     → persisted on the server, recipient not yet reached
    //   delivered→ at least one recipient has the message on device
    //   read     → at least one recipient has opened the thread
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    deliveredAt: { type: Date, default: null },
    readAt:      { type: Date, default: null },
    // Legacy id-only arrays — kept for backward compat. New code should
    // read/write the timestamped `deliveryReceipts` below.
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Per-user receipt timestamps. One sub-doc per (recipient) user.
    deliveryReceipts: [
      {
        user:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        deliveredAt:  { type: Date, default: null },
        readAt:       { type: Date, default: null },
      },
    ],
    // Soft delete
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    // ── Product-thread context ──────────────────────────────────────────────
    productThread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductThread",
      default: null,
      index: true,
    },
    // ── Message type ───────────────────────────────────────────────────────
    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "document", "offer", "system"],
      default: "text",
    },
    // ── Offer payload (only when messageType === "offer") ─────────────────
    offerData: {
      amount:   { type: Number, default: null },
      currency: { type: String, default: "₹" },
      status:   { type: String, enum: ["pending", "accepted", "declined", "countered", null], default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Index for fetching messages in a conversation chronologically
messageSchema.index({ conversation: 1, createdAt: 1 });
// Index for fetching messages within a product thread
messageSchema.index({ productThread: 1, createdAt: 1 });
// Catch-up scans: "give me my undelivered/unread messages in this thread"
messageSchema.index({ productThread: 1, status: 1 });
// "On reconnect, fetch all messages I sent that are still pending status"
messageSchema.index({ conversation: 1, sender: 1, status: 1 });
// Idempotent send dedup — sparse so old docs without the field are unaffected.
messageSchema.index(
  { sender: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
);

module.exports = mongoose.model("Message", messageSchema);
