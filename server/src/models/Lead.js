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
// Powers the Customers page and Book Match feature, which both look up "how many
// leads does this customer have" for every customer — was an unindexed full scan.
leadSchema.index({ customerId: 1 });
// Powers day-wise/date-range reports across all leads (Leads by Day, exports).
leadSchema.index({ createdAt: -1 });

leadSchema.statics.STATUSES = LEAD_STATUSES;

module.exports = mongoose.model('Lead', leadSchema);
