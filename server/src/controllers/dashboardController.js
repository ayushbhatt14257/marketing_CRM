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
  const [totalLeads, ordersPlaced, followUpsPending, followUpsClosed, newCustomers, todayTalked, points] = await Promise.all([
    Lead.countDocuments({ ownerId: userId }),
    Lead.countDocuments({ ownerId: userId, currentStatus: 'order_placed' }),
    Lead.countDocuments({ ownerId: userId, currentStatus: 'follow_up_later' }),
    Lead.countDocuments({ ownerId: userId, isFollowUpClosed: true }),
    Lead.countDocuments({ ownerId: userId, isNewCustomer: true }),
    FollowUpLog.countDocuments({ authorId: userId, createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
    getUserPointsSummary(userId, startOfMonthIST()),
  ]);

  // Unique customers this user has talked to
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
      allTimePoints: points.allTimePoints,
      monthlyPoints: points.monthlyPoints,
    },
    leads: leadsWithRemark,
    recentActivity,
  });
});

module.exports = { userStats, adminStats, userPerformance, userDetail };
