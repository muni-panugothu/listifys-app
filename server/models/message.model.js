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
    // Message delivery status: sent → delivered → read
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
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
  },
  {
    timestamps: true,
  }
);

// Index for fetching messages in a conversation chronologically
messageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
