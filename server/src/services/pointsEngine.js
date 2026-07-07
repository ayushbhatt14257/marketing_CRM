const PointsLedger = require('../models/PointsLedger');
const User = require('../models/User');

const DAILY_POINTS = 2;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Track via User.lastDailyPointsDate — completely independent of PointsLedger entries.
// Atomic findOneAndUpdate ensures no race conditions.
async function awardDailyLoginPoints(userId) {
  const today = todayIST();

  // Atomically check-and-update: only update if lastDailyPointsDate !== today
  const updated = await User.findOneAndUpdate(
    { _id: userId, lastDailyPointsDate: { $ne: today } },
    { $set: { lastDailyPointsDate: today } },
    { new: false } // returns null if no doc matched (meaning already claimed today)
  );

  if (!updated) return null; // lastDailyPointsDate was already today — no points

  // User was updated — create the ledger entry for history/leaderboard
  try {
    await PointsLedger.create({
      userId,
      points: DAILY_POINTS,
      reason: 'daily_login',
      refId: null,
    });
  } catch {
    // Ledger insert failed — not critical, points tracking via User field is already done
  }

  return { points: DAILY_POINTS };
}

async function getUserPointsSummary(userId, monthStart) {
  const [allTime, monthly] = await Promise.all([
    PointsLedger.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]),
    PointsLedger.aggregate([
      { $match: { userId, createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]),
  ]);

  return {
    allTimePoints: allTime[0]?.total || 0,
    monthlyPoints: monthly[0]?.total || 0,
  };
}

module.exports = { awardDailyLoginPoints, getUserPointsSummary, DAILY_POINTS, todayIST };
