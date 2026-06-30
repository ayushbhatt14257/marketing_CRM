const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // e.g. 'lead.create', 'lead.update', 'user.deactivate'
    entityType: { type: String, required: true }, // 'Lead', 'User', 'Product', etc.
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    diff: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
