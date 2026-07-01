const PointsLedger = require('../models/PointsLedger');
const { startOfTodayIST, endOfTodayIST } = require('../utils/dateHelpers');

// v1 rule: 2 points per day maximum — not per lead entry.
// A user can create 10 leads in a day and still only gets 2 points total for that day.
// This prevents point-farming by spamming entries.
const DAILY_POINTS = 2;
const DAILY_REASON = 'lead_created';

async function awardPoints(userId, reason, refId = null) {
  if (reason !== DAILY_REASON) return null;

  // Check if user already earned points today (IST)
  const todayStart = startOfTodayIST();
  const todayEnd = endOfTodayIST();

  const alreadyEarned = await PointsLedger.findOne({
    userId,
    reason: DAILY_REASON,
    createdAt: { $gte: todayStart, $lte: todayEnd },
  });

  if (alreadyEarned) return null; // Already got today's points

  return PointsLedger.create({ userId, points: DAILY_POINTS, reason, refId });
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

module.exports = { awardPoints, getUserPointsSummary, DAILY_POINTS };
