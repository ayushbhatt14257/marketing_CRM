const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    category: { type: String, enum: ['fonfox', 'supreme'], required: true, default: 'fonfox' },
    isActive: { type: Boolean, default: true },
    // Physical stock on hand, maintained by Stock Manager/Admin via stock-in entries.
    // "Available to promise" is NOT stored here — it's always computed live as
    // totalStock minus what's reserved by active orders (see stockService.js).
    // Storing that as a cached number invites exactly the kind of drift bug we hit
    // with the points system; live calculation can't drift.
    totalStock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
