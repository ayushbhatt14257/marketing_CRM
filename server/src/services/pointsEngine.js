const User = require('../models/User');

const DAILY_POINTS = 2;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function todayIST() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function thisMonthIST() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function awardDailyLoginPoints(userId) {
  const today = todayIST();
  const thisMonth = thisMonthIST();

  // Check if already claimed today — fast read
  const user = await User.findById(userId).select('lastDailyPointsDate lastPointsMonth');
  if (user?.lastDailyPointsDate === today) return null;

  // New month — reset monthlyPoints
  const isNewMonth = user?.lastPointsMonth !== thisMonth;

  // Atomic update — only if date is still different
  const result = await User.findOneAndUpdate(
    { _id: userId, lastDailyPointsDate: { $ne: today } },
    {
      $set: {
        lastDailyPointsDate: today,
        lastPointsMonth: thisMonth,
        ...(isNewMonth ? { monthlyPoints: DAILY_POINTS } : {}),
      },
      $inc: {
        totalPoints: DAILY_POINTS,
        ...(isNewMonth ? {} : { monthlyPoints: DAILY_POINTS }),
      },
    },
    { new: true }
  );

  if (!result) return null; // another request already claimed

  return { points: DAILY_POINTS };
}

async function getUserPointsSummary(userId) {
  const user = await User.findById(userId).select('totalPoints monthlyPoints lastPointsMonth');
  if (!user) return { allTimePoints: 0, monthlyPoints: 0 };

  // Auto-reset monthly if new month
  const thisMonth = thisMonthIST();
  if (user.lastPointsMonth && user.lastPointsMonth !== thisMonth) {
    await User.findByIdAndUpdate(userId, {
      $set: { monthlyPoints: 0, lastPointsMonth: thisMonth }
    });
    return { allTimePoints: user.totalPoints, monthlyPoints: 0 };
  }

  return {
    allTimePoints: user.totalPoints || 0,
    monthlyPoints: user.monthlyPoints || 0,
  };
}

module.exports = { awardDailyLoginPoints, getUserPointsSummary, DAILY_POINTS, todayIST };
