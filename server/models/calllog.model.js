const mongoose = require('mongoose');
const { Schema } = mongoose;

const callLogSchema = new Schema(
  {
    caller:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:      { type: String, enum: ['audio', 'video'], required: true },
    status:    { type: String, enum: ['missed', 'rejected', 'completed', 'failed'], default: 'missed' },
    duration:  { type: Number, default: 0 }, // seconds
    startedAt: { type: Date },
    endedAt:   { type: Date },
  },
  { timestamps: true }
);

callLogSchema.index({ caller: 1, createdAt: -1 });
callLogSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model('CallLog', callLogSchema);
