// Run ONCE after deploying new User schema with totalPoints/monthlyPoints
// node src/utils/migratePoints.js
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  console.log('Connected\n');

  const users = await db.collection('users').find({}).toArray();

  for (const user of users) {
    // Sum all points from ledger
    const agg = await db.collection('pointsledgers').aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]).toArray();

    const totalPoints = agg[0]?.total || 0;

    // Current month sum
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthAgg = await db.collection('pointsledgers').aggregate([
      { $match: { userId: user._id, createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]).toArray();

    const monthlyPoints = monthAgg[0]?.total || 0;
    const lastPointsMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { totalPoints, monthlyPoints, lastPointsMonth } }
    );

    console.log(`✓ ${user.name}: total=${totalPoints}, monthly=${monthlyPoints}`);
  }

  console.log('\n✅ Migration complete! Points are now stored on User documents.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
