const User = require('../models/User');
const PointsLedger = require('../models/PointsLedger');

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

  // Fast check — already claimed today?
  const user = await User.findById(userId).select('lastDailyPointsDate lastPointsMonth totalPoints monthlyPoints');
  if (user?.lastDailyPointsDate === today) return null;

  const isNewMonth = user?.lastPointsMonth !== thisMonth;

  // Atomic update on User — only proceeds if date is still different
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

  if (!result) return null; // race condition — another request already claimed

  // ALSO create PointsLedger entry — this is what attendance tracking reads
  try {
    await PointsLedger.create({
      userId,
      points: DAILY_POINTS,
      reason: 'daily_login',
      refId: null,
    });
  } catch (err) {
    // Non-critical — User.totalPoints is already updated above
    console.error('PointsLedger insert failed:', err.message);
  }

  return { points: DAILY_POINTS };
}

async function adjustPoints(userId, delta, reason = 'admin_adjustment') {
  // Admin manually adjusts user points (+ or -)
  const thisMonth = thisMonthIST();

  const user = await User.findById(userId).select('lastPointsMonth monthlyPoints totalPoints');
  const isNewMonth = user?.lastPointsMonth !== thisMonth;

  const update = {
    $inc: {
      totalPoints: delta,
      monthlyPoints: isNewMonth ? 0 : delta,
    },
    $set: { lastPointsMonth: thisMonth },
  };
  if (isNewMonth) update.$set.monthlyPoints = Math.max(0, delta);

  const updated = await User.findByIdAndUpdate(userId, update, { new: true });

  // Log in ledger for history
  if (delta !== 0) {
    await PointsLedger.create({
      userId,
      points: delta,
      reason: 'admin_adjustment',
      refId: null,
    }).catch(() => {});
  }

  return { totalPoints: updated.totalPoints, monthlyPoints: updated.monthlyPoints };
}

async function getUserPointsSummary(userId) {
  const user = await User.findById(userId).select('totalPoints monthlyPoints lastPointsMonth');
  if (!user) return { allTimePoints: 0, monthlyPoints: 0 };

  const thisMonth = thisMonthIST();
  if (user.lastPointsMonth && user.lastPointsMonth !== thisMonth) {
    await User.findByIdAndUpdate(userId, {
      $set: { monthlyPoints: 0, lastPointsMonth: thisMonth },
    });
    return { allTimePoints: user.totalPoints, monthlyPoints: 0 };
  }

  return {
    allTimePoints: user.totalPoints || 0,
    monthlyPoints: user.monthlyPoints || 0,
  };
}

module.exports = { awardDailyLoginPoints, adjustPoints, getUserPointsSummary, DAILY_POINTS, todayIST };
