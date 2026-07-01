const mongoose = require('mongoose');

const LEAD_STATUSES = ['order_placed', 'follow_up_later', 'payment_talk', 'not_now'];

const leadSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // Changed from single productId to array — supports multiple products per lead
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // New/existing customer flag — tracked per lead entry
    isNewCustomer: { type: Boolean, default: false },

    currentStatus: { type: String, enum: LEAD_STATUSES, required: true },
    nextFollowUpDate: { type: Date, default: null },
    lostReason: { type: String, default: null },
    isFollowUpClosed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

leadSchema.index({ ownerId: 1, nextFollowUpDate: 1 });
leadSchema.index({ ownerId: 1, currentStatus: 1 });

leadSchema.statics.STATUSES = LEAD_STATUSES;

module.exports = mongoose.model('Lead', leadSchema);
