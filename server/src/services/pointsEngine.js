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

  // First check — fast path
  const user = await User.findById(userId).select('lastDailyPointsDate');
  if (user?.lastDailyPointsDate === today) return null; // already got points today

  // Update only if date is different — atomic
  const result = await User.findOneAndUpdate(
    { _id: userId, lastDailyPointsDate: { $ne: today } },
    { $set: { lastDailyPointsDate: today } },
    { new: true } // return the UPDATED document
  );

  // If result is null OR result's date is NOT today → another concurrent request won the race
  if (!result || result.lastDailyPointsDate !== today) return null;

  // Successfully updated — create ledger entry
  try {
    await PointsLedger.create({
      userId,
      points: DAILY_POINTS,
      reason: 'daily_login',
      refId: null,
    });
  } catch {
    // Not critical
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
