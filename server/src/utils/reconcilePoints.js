// Run: node src/utils/reconcilePoints.js
//
// 1) DIAGNOSTIC (always runs): compares User.totalPoints against the sum of
//    PointsLedger entries for that user, and prints any mismatch. This does NOT
//    change any data — it's just visibility into how far the old bug let things drift.
//
// 2) BACKFILL (opt-in, edit MANUAL_BACKFILL below): inserts a missing daily_login
//    ledger entry for a specific user + IST date, for cases where you know for a fact
//    someone logged in that day (e.g. from server logs, WhatsApp screenshots, etc.)
//    but the ledger entry never got written because of the old bug. This does NOT
//    touch User.totalPoints — that was almost certainly already correct (the bug was
//    the ledger write failing silently after the User update succeeded), so backfilling
//    the ledger just repairs the attendance calendar to match reality.
//
// ─────────────────────────────────────────────────────────────────────────────
// Fill this in with confirmed cases only, then re-run. Leave empty to skip this step.
const MANUAL_BACKFILL = [
  // { name: 'Gautam', date: '2026-07-11' },
  // { name: 'Ankit',  date: '2026-07-11' },
];
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  console.log('✓ Connected to MongoDB\n');

  console.log('── Diagnostic: User.totalPoints vs PointsLedger sum ──\n');
  const users = await db.collection('users').find({ role: 'user' }).toArray();

  for (const user of users) {
    const agg = await db.collection('pointsledgers').aggregate([
      { $match: { userId: user._id } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]).toArray();
    const ledgerTotal = agg[0]?.total || 0;
    const userTotal = user.totalPoints || 0;
    const match = ledgerTotal === userTotal ? '✓' : '⚠ MISMATCH';
    console.log(`${match}  ${user.name.padEnd(12)} User.totalPoints=${userTotal}  ledgerSum=${ledgerTotal}`);
  }

  if (MANUAL_BACKFILL.length === 0) {
    console.log('\nNo manual backfill entries configured — skipping. Edit MANUAL_BACKFILL in this file to add confirmed missing attendance days.');
    return process.exit(0);
  }

  console.log('\n── Backfilling confirmed missing attendance days ──\n');
  for (const entry of MANUAL_BACKFILL) {
    const user = users.find((u) => u.name.toLowerCase().trim() === entry.name.toLowerCase().trim());
    if (!user) {
      console.log(`⚠  User not found: ${entry.name}`);
      continue;
    }
    try {
      await db.collection('pointsledgers').insertOne({
        userId: user._id,
        points: 0, // 0 — this repairs the attendance calendar only; it does not re-award points
        reason: 'daily_login',
        refId: null,
        dateKey: entry.date,
        createdAt: new Date(`${entry.date}T12:00:00+05:30`),
        updatedAt: new Date(),
      });
      console.log(`✓ Backfilled attendance: ${user.name} — ${entry.date}`);
    } catch (err) {
      if (err.code === 11000) {
        console.log(`•  ${user.name} — ${entry.date}: entry already exists, skipped`);
      } else {
        console.log(`⚠  ${user.name} — ${entry.date}: failed (${err.message})`);
      }
    }
  }

  console.log('\n✅ Done.');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
