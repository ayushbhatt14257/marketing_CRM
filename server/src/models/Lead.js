const mongoose = require('mongoose');

const LEAD_STATUSES = ['order_placed', 'follow_up_later', 'not_now'];

const leadSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    currentStatus: { type: String, enum: LEAD_STATUSES, required: true },
    nextFollowUpDate: { type: Date, default: null },
    lostReason: { type: String, default: null }, // only relevant if currentStatus === 'not_now'; lead is terminal once set

    isFollowUpClosed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Fast lookups for "due today / overdue" per user
leadSchema.index({ ownerId: 1, nextFollowUpDate: 1 });
leadSchema.index({ ownerId: 1, currentStatus: 1 });

leadSchema.statics.STATUSES = LEAD_STATUSES;

module.exports = mongoose.model('Lead', leadSchema);
