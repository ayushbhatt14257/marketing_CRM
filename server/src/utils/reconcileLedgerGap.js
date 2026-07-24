// Run ONCE: node src/utils/reconcileLedgerGap.js
//
// Context: earlier manual corrections (fixPoints.js runs on 14/15 July, and possibly
// direct DB edits) set User.totalPoints directly without creating matching PointsLedger
// entries for the correction amount. Since the reports page now computes "this month"
// / "selected month" points strictly from the ledger (the real source of truth going
// forward), those old corrections show up as a gap — or in Gautam's case, a large
// negative number — when you filter to July.
//
// This script closes that gap ONCE: for every user, it compares their live
// User.totalPoints (assumed correct — this is the number that's been manually verified
// in conversation) against the sum of their PointsLedger entries, and inserts a single
// admin_adjustment entry for the difference. After this, ledger sum == totalPoints for
// everyone, and "Points (This Month)" / "Points (All-time)" will agree again.
//
// Safe to re-run — if a user's ledger already matches their totalPoints, it's skipped.

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  console.log('✓ Connected to MongoDB\n');

  const users = await db.collection('users').find({ role: 'user' }).toArray();

  for (const user of users) {
    const agg = await db.collection('pointsledgers').aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]).toArray();
    const ledgerSum = agg[0]?.total || 0;
    const trueTotal = user.totalPoints || 0;
    const gap = trueTotal - ledgerSum;

    if (gap === 0) {
      console.log(`✓ ${user.name}: already reconciled (ledger=${ledgerSum}, totalPoints=${trueTotal})`);
      continue;
    }

    await db.collection('pointsledgers').insertOne({
      userId: user._id,
      points: gap,
      reason: 'admin_adjustment',
      refId: null,
      dateKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ ${user.name}: ledger was ${ledgerSum}, totalPoints is ${trueTotal} → inserted ${gap > 0 ? '+' : ''}${gap} adjustment`);
  }

  console.log('\n✅ Done. Ledger sums now match totalPoints for everyone.');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
