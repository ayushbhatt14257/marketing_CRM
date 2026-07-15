const mongoose = require('mongoose');

// One-time (idempotent) cleanup: collapse duplicate daily_login entries for the
// same (userId, dateKey) down to one before the unique index tries to build.
// Duplicates can happen from manual fixes run before this index existed (like the
// July 14 correction) — safe to run every startup since it's a no-op once clean.
async function dedupeDailyLoginLedger() {
  const coll = mongoose.connection.collection('pointsledgers');
  const dupGroups = await coll.aggregate([
    { $match: { reason: 'daily_login', dateKey: { $type: 'string' } } },
    { $group: { _id: { userId: '$userId', dateKey: '$dateKey' }, ids: { $push: '$_id' }, count: { $sum: 1 }, maxPoints: { $max: '$points' } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  if (dupGroups.length === 0) return;

  console.log(`⚙ Cleaning up ${dupGroups.length} duplicate daily_login ledger entr${dupGroups.length === 1 ? 'y' : 'ies'} before index build...`);
  for (const group of dupGroups) {
    // Keep one entry, carrying forward the highest points value seen among the
    // duplicates (so we never silently drop an actually-earned +2), delete the rest.
    const [keepId, ...deleteIds] = group.ids;
    await coll.updateOne({ _id: keepId }, { $set: { points: group.maxPoints } });
    await coll.deleteMany({ _id: { $in: deleteIds } });
  }
  console.log('✓ Ledger cleanup complete.');
}

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    await dedupeDailyLoginLedger();

    // Explicitly (re)build indexes for every registered model and surface any
    // failure loudly. Mongoose's automatic index build on first use fails silently
    // on conflicting/duplicate existing data — that silent failure is exactly what
    // let the daily-points duplicate-award bug through undetected before.
    for (const modelName of mongoose.modelNames()) {
      try {
        await mongoose.model(modelName).syncIndexes();
      } catch (err) {
        console.error(`⚠ INDEX BUILD FAILED for model "${modelName}": ${err.message}`);
        console.error('  This model is running WITHOUT its intended index/constraints. Fix the underlying data conflict and redeploy.');
      }
    }
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
