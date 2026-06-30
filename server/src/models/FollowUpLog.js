const mongoose = require('mongoose');

const followUpLogSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    statusAtEntry: { type: String, enum: ['order_placed', 'follow_up_later', 'not_now'], required: true },
    remark: { type: String, default: '' },
    todaysReport: { type: String, default: '' },
    nextFollowUpDateSet: { type: Date, default: null },
  },
  { timestamps: true }
);

followUpLogSchema.index({ leadId: 1, createdAt: -1 });

module.exports = mongoose.model('FollowUpLog', followUpLogSchema);
