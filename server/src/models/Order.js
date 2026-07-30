const mongoose = require('mongoose');

const ORDER_STATUSES = ['pending_approval', 'approved', 'dispatched', 'done'];

// One line item per product in the order.
// approvedQty: what the team member confirmed with the customer (this is what
//   reserves stock — see stockService.js).
// dispatchedQty: cumulative amount actually sent out by the Stock Manager so far.
// cancelledQty: amount explicitly released from the remaining (undispatched)
//   balance via the "Reduce/Cancel Remaining" action — NOT the same as dispatched.
// Remaining/pending for this item = approvedQty - dispatchedQty - cancelledQty.
const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    approvedQty: { type: Number, required: true, min: 0 },
    dispatchedQty: { type: Number, default: 0, min: 0 },
    cancelledQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const dispatchEventSchema = new mongoose.Schema(
  {
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{ productId: mongoose.Schema.Types.ObjectId, qty: Number }],
    dispatchedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    deliveryDate: { type: Date, default: null },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending_approval', required: true },
    dispatchHistory: { type: [dispatchEventSchema], default: [] },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdBy: 1, status: 1 });

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model('Order', orderSchema);
