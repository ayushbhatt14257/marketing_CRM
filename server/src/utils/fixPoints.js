// Run ONCE now: node src/utils/fixPoints.js
//
// Sets each user's points to the manually-confirmed correct total (as told by admin),
// and makes sure TODAY does not add another +2 on top of that — points resume
// normally (+2/day) starting tomorrow.
//
// How the freeze works: the points engine now gates daily-login awards on a
// PointsLedger entry for (userId, todayIST, reason='daily_login') existing — not on
// the User.lastDailyPointsDate field. So this script also ensures a 0-point ledger
// entry exists for today for each listed user, so a later dashboard visit today
// can't award anything more. Tomorrow's IST date won't match, so the normal +2 flow
// just works again with no further action needed.

require('dotenv').config();
const mongoose = require('mongoose');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function todayIST() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
const today = todayIST();
const thisMonth = today.slice(0, 7);

// ─── CONFIRMED CORRECT TOTALS (as of today, 14 July 2026) ──────────────────
const POINTS_CONFIG = [
  { name: 'Ankit',   total: 22 },
  { name: 'Harshit', total: 24 },
  { name: 'sandeep', total: 12 },
  { name: 'Anirudh', total: 26 },
  { name: 'Aditya',  total: 26 },
  { name: 'Gautam',  total: 26 },
];
// Assumes these totals are also this month's totals (monthlyPoints = totalPoints).
// Edit below if any user's monthly figure should differ from their all-time total.
// ──────────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  console.log(`✓ Connected to MongoDB — freezing points as of IST date ${today}\n`);

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

    const monthly = config.monthly ?? config.total;

    // Set the correct totals directly.
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          totalPoints: config.total,
          monthlyPoints: monthly,
          lastPointsMonth: thisMonth,
          lastDailyPointsDate: today,
        },
      }
    );

    // Make sure today is "claimed" in the ledger too, so a later dashboard visit
    // today can't add another +2. Zero points — this entry exists purely to block
    // duplicate awards, the actual total was just set above.
    try {
      await db.collection('pointsledgers').insertOne({
        userId: user._id,
        points: 0,
        reason: 'daily_login',
        refId: null,
        dateKey: today,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✓ ${user.name}: totalPoints=${config.total}, monthlyPoints=${monthly} — today (${today}) frozen`);
    } catch (err) {
      if (err.code === 11000) {
        console.log(`✓ ${user.name}: totalPoints=${config.total}, monthlyPoints=${monthly} — today already had an entry, left as-is`);
      } else {
        console.log(`⚠ ${user.name}: totals set, but ledger freeze failed (${err.message})`);
      }
    }
  }

  if (notFound.length) {
    console.log(`\n⚠  Not found (check spelling): ${notFound.join(', ')}`);
  }

  console.log(`
✅ Done!
   Totals corrected as configured above.
   Today (${today}) will NOT add any more points for these users.
   From tomorrow → +2 pts resumes normally on first dashboard visit, as usual.
  `);

  process.exit(0);
}

run().catch(err => { console.error(err.message); process.exit(1); });

