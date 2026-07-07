// One-time fix script
// Run: node src/utils/fixPoints.js
//
// What it does:
// 1. Clears all existing pointsledger entries
// 2. Sets correct base points per user (as specified)
// 3. Resets lastDailyPointsDate = null so everyone gets today's 2 pts on next dashboard visit

require('dotenv').config();
const mongoose = require('mongoose');

// ─── CONFIGURE POINTS HERE ───────────────────────────────────────────────────
const POINTS_CONFIG = [
  { name: 'Ankit',   points: 8  },
  { name: 'Harshit', points: 8  },
  { name: 'Anirudh', points: 10 },
  { name: 'Gautam',  points: 10 },
  { name: 'Aditya',  points: 10 },
  // Add more users here if needed:
  // { name: 'Sandeep', points: 0 },
];
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;

  console.log('Connected to MongoDB\n');

  // Step 1: Clear all existing points ledger entries
  const deleted = await db.collection('pointsledgers').deleteMany({});
  console.log(`✓ Cleared ${deleted.deletedCount} existing pointsledger entries`);

  // Step 2: Set base points for each user
  const users = await db.collection('users').find({}).toArray();
  const entries = [];
  const notFound = [];

  for (const config of POINTS_CONFIG) {
    const user = users.find((u) =>
      u.name.toLowerCase().trim() === config.name.toLowerCase().trim()
    );

    if (!user) {
      notFound.push(config.name);
      continue;
    }

    if (config.points > 0) {
      entries.push({
        userId: user._id,
        points: config.points,
        reason: 'daily_login',
        refId: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'), // backdated — not today
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        __v: 0,
      });
    }
    console.log(`✓ ${user.name}: ${config.points} pts`);
  }

  if (notFound.length) {
    console.log(`\n⚠ Users not found (check spelling): ${notFound.join(', ')}`);
  }

  if (entries.length > 0) {
    await db.collection('pointsledgers').insertMany(entries);
  }

  // Step 3: Reset lastDailyPointsDate for ALL users → everyone gets today's 2 pts on next visit
  const updated = await db.collection('users').updateMany(
    {},
    { $set: { lastDailyPointsDate: null } }
  );
  console.log(`\n✓ Reset lastDailyPointsDate for ${updated.modifiedCount} users`);

  console.log('\n✅ Done! Now:');
  console.log('   - Points set as configured above');
  console.log('   - When any user visits dashboard today → +2 points automatically');
  console.log('   - From tomorrow → +2 pts every day on first dashboard visit\n');

  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
