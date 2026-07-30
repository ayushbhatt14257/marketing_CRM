const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['lead_assigned', 'order_dispatched', 'general'], default: 'general' },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // leadId or orderId depending on type
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
