const mongoose = require('mongoose');

const pointsLedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    points: { type: Number, required: true },
    reason: {
      type: String,
      enum: ['daily_login', 'lead_created', 'report_added', 'followup_on_time', 'followup_late', 'order_placed', 'streak_bonus', 'admin_adjustment'],
      required: true,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // leadId or followUpLogId
    // IST calendar date ("YYYY-MM-DD") this entry belongs to — set for daily_login entries.
    // This is the authoritative dedup key: no more re-deriving the date from createdAt.
    dateKey: { type: String, default: null },
  },
  { timestamps: true }
);

pointsLedgerSchema.index({ userId: 1, createdAt: -1 });
// One daily_login entry per user per IST day — DB-level guarantee against double-award,
// and the attendance query can now match on dateKey directly instead of re-deriving it.
pointsLedgerSchema.index(
  { userId: 1, dateKey: 1, reason: 1 },
  { unique: true, partialFilterExpression: { reason: 'daily_login' } }
);

module.exports = mongoose.model('PointsLedger', pointsLedgerSchema);
