const mongoose = require('mongoose');

const engagementNotificationLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campaign: { type: String, required: true, index: true },
    title: String,
    body: String,
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

engagementNotificationLogSchema.index({ userId: 1, sentAt: -1 });

module.exports = mongoose.model('EngagementNotificationLog', engagementNotificationLogSchema);
