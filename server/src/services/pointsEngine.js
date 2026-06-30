const PointsLedger = require('../models/PointsLedger');

// v1 rule set: 2 points per lead created, nothing else.
// Kept as a service (not inline in controllers) so richer rules (on-time follow-up,
// order conversion bonuses, streaks) can be added later without touching controller code.
const POINT_VALUES = {
  lead_created: 2,
};

async function awardPoints(userId, reason, refId = null) {
  const points = POINT_VALUES[reason];
  if (!points) return null; // reason not active in v1 ruleset

  return PointsLedger.create({ userId, points, reason, refId });
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

module.exports = { awardPoints, getUserPointsSummary, POINT_VALUES };
