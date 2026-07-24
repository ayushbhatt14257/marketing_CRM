const Lead = require('../models/Lead');
const FollowUpLog = require('../models/FollowUpLog');
const User = require('../models/User');
const PointsLedger = require('../models/PointsLedger');
const { getUserPointsSummary } = require('../services/pointsEngine');
const { startOfTodayIST, endOfTodayIST, startOfMonthIST } = require('../utils/dateHelpers');
const asyncHandler = require('../utils/asyncHandler');

const userStats = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const todayStart = startOfTodayIST();
  const todayEnd = endOfTodayIST();

  const [totalLeads, talkedToday, closedFollowUps, dueNow, userDoc] = await Promise.all([
    Lead.countDocuments({ ownerId }),
    FollowUpLog.countDocuments({ authorId: ownerId, createdAt: { $gte: todayStart, $lte: todayEnd } }),
    Lead.countDocuments({ ownerId, isFollowUpClosed: true, currentStatus: { $in: ['order_placed', 'not_now'] } }),
    Lead.countDocuments({ ownerId, currentStatus: 'follow_up_later', nextFollowUpDate: { $lte: todayEnd } }),
    User.findById(ownerId).select('totalPoints monthlyPoints lastPointsMonth'),
  ]);

  // Auto-reset monthly if new month
  const { getUserPointsSummary } = require('../services/pointsEngine');
  const points = await getUserPointsSummary(ownerId);

  res.json({
    totalLeads,
    talkedToday,
    closedFollowUps,
    dueNow,
    currentPoints: points.allTimePoints,
    monthlyPoints: points.monthlyPoints,
  });
});

const adminStats = asyncHandler(async (req, res) => {
  const todayEnd = endOfTodayIST();

  const [totalUsers, activeUsers, totalLeads, dueToday, ordersPlaced, pendingFollowUps, closedFollowUps] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'user', isActive: true }),
    Lead.countDocuments({}),
    Lead.countDocuments({ currentStatus: 'follow_up_later', nextFollowUpDate: { $lte: todayEnd } }),
    Lead.countDocuments({ currentStatus: 'order_placed' }),
    Lead.countDocuments({ currentStatus: 'follow_up_later' }),
    Lead.countDocuments({ isFollowUpClosed: true }),
  ]);

  res.json({ totalUsers, activeUsers, totalLeads, dueToday, ordersPlaced, pendingFollowUps, closedFollowUps });
});

// Per-user performance breakdown for admin (used by the User Performance Monitoring screen)
const userPerformance = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);
  const hasRange = Object.keys(dateFilter).length > 0;

  const users = await User.find({ role: 'user' }).select('name email isActive totalPoints monthlyPoints lastPointsMonth');

  // When a specific period is selected, points for that period come straight from the
  // ledger (the real source of truth) rather than the live monthlyPoints cache — that
  // cache only ever reflects the *current* month, so it can't answer "how many points
  // did this user earn in August" once August is over. One grouped query for everyone,
  // rather than per-user, to keep this cheap.
  let periodPointsByUser = {};
  if (hasRange) {
    const agg = await PointsLedger.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: { _id: '$userId', total: { $sum: '$points' } } },
    ]);
    agg.forEach((r) => { periodPointsByUser[String(r._id)] = r.total; });
  }

  const results = await Promise.all(
    users.map(async (user) => {
      const leadFilter = { ownerId: user._id };
      if (hasRange) leadFilter.createdAt = dateFilter;

      const [totalLeads, ordersPlaced, dueFollowUps, lowDaysAgg] = await Promise.all([
        Lead.countDocuments(leadFilter),
        Lead.countDocuments({ ...leadFilter, currentStatus: 'order_placed' }),
        Lead.countDocuments({ ownerId: user._id, currentStatus: 'follow_up_later' }),
        // Days this user worked (entered >=1 lead) but stayed under the 7-leads/day target.
        Lead.aggregate([
          { $match: leadFilter },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $lt: 7 } } },
          { $count: 'days' },
        ]),
      ]);

      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        totalLeads,
        ordersPlaced,
        dueFollowUps,
        lowLeadDays: lowDaysAgg[0]?.days || 0,
        allTimePoints: user.totalPoints || 0,
        monthlyPoints: hasRange ? (periodPointsByUser[String(user._id)] || 0) : (user.monthlyPoints || 0),
      };
    })
  );

  res.json({ users: results });
});

module.exports = { userStats, adminStats, userPerformance };

// Full detail for one user — used by admin clicking a user in Reports
const userDetail = asyncHandler(async (req, res) => {
  const Lead = require('../models/Lead');
  const FollowUpLog = require('../models/FollowUpLog');
  const User = require('../models/User');
  const { getUserPointsSummary } = require('../services/pointsEngine');
  const { startOfMonthIST, endOfTodayIST } = require('../utils/dateHelpers');

  const userId = new (require('mongoose').Types.ObjectId)(req.params.id);

  const user = await User.findById(userId).select('-passwordHash -resetPasswordToken -resetPasswordExpires');
  if (!user) return res.status(404).json({ message: 'User not found' });

  // All leads for this user, with populated customer + products
  const leads = await Lead.find({ ownerId: userId })
    .populate('customerId productIds')
    .sort({ updatedAt: -1 });

  // Attach latest remark to each lead
  const leadIds = leads.map((l) => l._id);
  const latestLogs = await FollowUpLog.aggregate([
    { $match: { leadId: { $in: leadIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$leadId', remark: { $first: '$remark' }, statusAtEntry: { $first: '$statusAtEntry' }, createdAt: { $first: '$createdAt' } } },
  ]);
  const logMap = {};
  latestLogs.forEach((l) => { logMap[String(l._id)] = l; });

  const leadsWithRemark = leads.map((l) => ({
    ...l.toObject(),
    lastLog: logMap[String(l._id)] || null,
  }));

  // Recent activity — all followup logs across all leads (last 50)
  const recentActivity = await FollowUpLog.find({ leadId: { $in: leadIds } })
    .populate({ path: 'leadId', populate: { path: 'customerId', select: 'name' } })
    .sort({ createdAt: -1 })
    .limit(50);

  // Stats
  const [totalLeads, ordersPlaced, followUpsPending, followUpsClosed, newCustomers, todayTalked] = await Promise.all([
    Lead.countDocuments({ ownerId: userId }),
    Lead.countDocuments({ ownerId: userId, currentStatus: 'order_placed' }),
    Lead.countDocuments({ ownerId: userId, currentStatus: 'follow_up_later' }),
    Lead.countDocuments({ ownerId: userId, isFollowUpClosed: true }),
    Lead.countDocuments({ ownerId: userId, isNewCustomer: true }),
    FollowUpLog.countDocuments({ authorId: userId, createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
  ]);

  const uniqueCustomerIds = [...new Set(leads.map((l) => String(l.customerId?._id)))];

  res.json({
    user,
    stats: {
      totalLeads,
      ordersPlaced,
      followUpsPending,
      followUpsClosed,
      newCustomers,
      todayTalked,
      conversionRate: totalLeads > 0 ? ((ordersPlaced / totalLeads) * 100).toFixed(1) : '0.0',
      uniqueCustomers: uniqueCustomerIds.length,
      allTimePoints: user.totalPoints || 0,
      monthlyPoints: user.monthlyPoints || 0,
    },
    leads: leadsWithRemark,
    recentActivity,
  });
});

// Called by dashboard on every page load — awards 2 pts only on first visit of the day.
// Works whether user just logged in OR was already logged in from a previous session.
const claimDailyPoints = asyncHandler(async (req, res) => {
  const { awardDailyLoginPoints } = require('../services/pointsEngine');
  const result = await awardDailyLoginPoints(req.user._id);
  res.json({
    awarded: result !== null,
    points: result ? result.points : 0,
  });
});

// Weekly day-wise attendance for all users — uses PointsLedger daily_login entries
// as the attendance proxy (one entry per user per day = they visited dashboard that day)
const weeklyAttendance = asyncHandler(async (req, res) => {
  const PointsLedger = require('../models/PointsLedger');

  // Build last 7 days array (IST-aware)
  const IST = 5.5 * 60 * 60 * 1000;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + IST - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    days.push({
      label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
      dayName: d.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' }),
      dateKey: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
      start: dayStart,
      end: dayEnd,
    });
  }

  const users = await User.find({ role: 'user' }).select('name email isActive totalPoints monthlyPoints lastPointsMonth');
  const weekStart = days[0].start;
  const weekEnd = days[days.length - 1].end;

  // Get all daily_login ledger entries for the week
  const entries = await PointsLedger.find({
    reason: 'daily_login',
    createdAt: { $gte: weekStart, $lte: weekEnd },
  });

  // Map userId+dateKey → present.
  // Prefer the stored dateKey (authoritative, set at write time); fall back to
  // deriving it from createdAt for older entries written before dateKey existed.
  const attendanceMap = {};
  entries.forEach((e) => {
    const uid = String(e.userId);
    let dk = e.dateKey;
    if (!dk) {
      const d = new Date(e.createdAt.getTime() + IST);
      dk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
    if (!attendanceMap[uid]) attendanceMap[uid] = {};
    attendanceMap[uid][dk] = true;
  });

  const result = users.map((u) => {
    const uid = String(u._id);
    const presence = days.map((d) => attendanceMap[uid]?.[d.dateKey] || false);
    return {
      userId: u._id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      presence,
      activeDays: presence.filter(Boolean).length,
    };
  });

  res.json({ days: days.map((d) => ({ label: d.label, dayName: d.dayName, dateKey: d.dateKey })), users: result });
});

module.exports = { userStats, adminStats, userPerformance, userDetail, claimDailyPoints, weeklyAttendance };
