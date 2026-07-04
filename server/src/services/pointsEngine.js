const PointsLedger = require('../models/PointsLedger');
const { startOfTodayIST, endOfTodayIST } = require('../utils/dateHelpers');

// Points are awarded on the FIRST login of each day — not on lead entry.
// 2 points per day maximum, triggered by login.
const DAILY_POINTS = 2;

async function awardDailyLoginPoints(userId) {
  const todayStart = startOfTodayIST();
  const todayEnd = endOfTodayIST();

  // Check if already earned today
  const alreadyEarned = await PointsLedger.findOne({
    userId,
    reason: 'daily_login',
    createdAt: { $gte: todayStart, $lte: todayEnd },
  });

  if (alreadyEarned) return null; // Already got today's points

  return PointsLedger.create({ userId, points: DAILY_POINTS, reason: 'daily_login', refId: null });
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

module.exports = { awardDailyLoginPoints, getUserPointsSummary, DAILY_POINTS };
