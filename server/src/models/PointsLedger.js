const mongoose = require('mongoose');

const pointsLedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    points: { type: Number, required: true },
    reason: {
      type: String,
      enum: ['lead_created', 'report_added', 'followup_on_time', 'followup_late', 'order_placed', 'streak_bonus'],
      required: true,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // leadId or followUpLogId
  },
  { timestamps: true }
);

pointsLedgerSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('PointsLedger', pointsLedgerSchema);
