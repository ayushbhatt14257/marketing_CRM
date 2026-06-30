const Lead = require('../models/Lead');
const FollowUpLog = require('../models/FollowUpLog');
const User = require('../models/User');
const { getUserPointsSummary } = require('../services/pointsEngine');
const { startOfTodayIST, endOfTodayIST, startOfMonthIST } = require('../utils/dateHelpers');
const asyncHandler = require('../utils/asyncHandler');

const userStats = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const todayStart = startOfTodayIST();
  const todayEnd = endOfTodayIST();

  const [totalLeads, talkedToday, closedFollowUps, dueNow, points] = await Promise.all([
    Lead.countDocuments({ ownerId }),
    FollowUpLog.countDocuments({ authorId: ownerId, createdAt: { $gte: todayStart, $lte: todayEnd } }),
    Lead.countDocuments({ ownerId, isFollowUpClosed: true, currentStatus: { $in: ['order_placed', 'not_now'] } }),
    Lead.countDocuments({ ownerId, currentStatus: 'follow_up_later', nextFollowUpDate: { $lte: todayEnd } }),
    getUserPointsSummary(ownerId, startOfMonthIST()),
  ]);

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

  const users = await User.find({ role: 'user' }).select('name email isActive');

  const results = await Promise.all(
    users.map(async (user) => {
      const leadFilter = { ownerId: user._id };
      if (hasRange) leadFilter.createdAt = dateFilter;

      const [totalLeads, ordersPlaced, dueFollowUps, points] = await Promise.all([
        Lead.countDocuments(leadFilter),
        Lead.countDocuments({ ...leadFilter, currentStatus: 'order_placed' }),
        Lead.countDocuments({ ownerId: user._id, currentStatus: 'follow_up_later' }),
        getUserPointsSummary(user._id, startOfMonthIST()),
      ]);

      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        totalLeads,
        ordersPlaced,
        dueFollowUps,
        allTimePoints: points.allTimePoints,
        monthlyPoints: points.monthlyPoints,
      };
    })
  );

  res.json({ users: results });
});

module.exports = { userStats, adminStats, userPerformance };
