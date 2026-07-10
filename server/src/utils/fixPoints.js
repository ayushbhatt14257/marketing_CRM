// Run ONCE after deploying: node src/utils/fixPoints.js
// Sets correct base points on User documents and resets daily claim
// so every user gets 2 pts on their next dashboard visit.

require('dotenv').config();
const mongoose = require('mongoose');

const thisMonth = (() => {
  const IST = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + IST);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
})();

// ─── SET CORRECT BASE POINTS HERE (excluding today's 2 pts) ────────────────
const POINTS_CONFIG = [
  { name: 'Ankit',   total: 14, monthly: 14 },
  { name: 'Harshit', total: 14, monthly: 14 },
  { name: 'Anirudh', total: 16, monthly: 16 },
  { name: 'Gautam',  total: 16, monthly: 16 },
  { name: 'Aditya',  total: 16, monthly: 16 },
  { name: 'sandeep', total: 6,  monthly: 6  },
  { name: 'test',    total: 4,  monthly: 4  },
];
// ────────────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  console.log('✓ Connected to MongoDB\n');

  const users = await db.collection('users').find({}).toArray();
  const notFound = [];

  for (const config of POINTS_CONFIG) {
    const user = users.find(u =>
      u.name.toLowerCase().trim() === config.name.toLowerCase().trim()
    );

    if (!user) {
      notFound.push(config.name);
      continue;
    }

    // Set points directly on User document
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          totalPoints: config.total,
          monthlyPoints: config.monthly,
          lastPointsMonth: thisMonth,
          lastDailyPointsDate: null, // null = they haven't claimed today yet → will get +2 on next visit
        },
      }
    );

    console.log(`✓ ${user.name}: totalPoints=${config.total}, monthlyPoints=${config.monthly}, lastDailyPointsDate=null`);
  }

  // Any user NOT in config — just reset their daily claim date so they can get points today
  const configNames = POINTS_CONFIG.map(c => c.name.toLowerCase().trim());
  const othersToReset = users.filter(u => !configNames.includes(u.name.toLowerCase().trim()));

  if (othersToReset.length > 0) {
    await db.collection('users').updateMany(
      { _id: { $in: othersToReset.map(u => u._id) } },
      { $set: { lastDailyPointsDate: null, lastPointsMonth: thisMonth } }
    );
    othersToReset.forEach(u => console.log(`✓ ${u.name}: lastDailyPointsDate reset (points unchanged)`));
  }

  if (notFound.length) {
    console.log(`\n⚠  Not found (check spelling): ${notFound.join(', ')}`);
  }

  console.log(`
✅ Done!
   Points set as configured above.
   When any user opens dashboard today → they get +2 points automatically.
   From tomorrow → +2 pts every day on first dashboard visit.
  `);

  process.exit(0);
}

run().catch(err => { console.error(err.message); process.exit(1); });
