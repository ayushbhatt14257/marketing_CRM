const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const FollowUpLog = require('../models/FollowUpLog');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { startOfTodayIST, endOfTodayIST, startOfWeekIST, startOfMonthIST } = require('../utils/dateHelpers');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveCustomer(name, userId) {
  const normalizedName = name.trim().toLowerCase();
  let customer = await Customer.findOne({ normalizedName });
  if (!customer) {
    customer = await Customer.create({ name: name.trim(), createdBy: userId });
  }
  return customer;
}

const createLead = asyncHandler(async (req, res) => {
  const {
    customerName, customerId, productIds, status,
    nextFollowUpDate, remark, todaysReport, lostReason,
    isNewCustomer, assignTo // assignTo: userId — admin only
  } = req.body;

  if (!productIds || !productIds.length) {
    return res.status(400).json({ message: 'At least one product is required' });
  }
  if (!status || !Lead.STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Valid status is required' });
  }
  if (status === 'follow_up_later' && !nextFollowUpDate) {
    return res.status(400).json({ message: 'Next follow-up date is required when status is Follow Up Later' });
  }
  if (!customerId && !customerName) {
    return res.status(400).json({ message: 'Customer name or customerId is required' });
  }

  // assignTo is only allowed for admins
  const ownerId = (assignTo && req.user.role === 'admin') ? assignTo : req.user._id;

  const customer = customerId
    ? await Customer.findById(customerId)
    : await resolveCustomer(customerName, req.user._id);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const lead = await Lead.create({
    customerId: customer._id,
    productIds: Array.isArray(productIds) ? productIds : [productIds],
    ownerId,
    isNewCustomer: !!isNewCustomer,
    currentStatus: status,
    nextFollowUpDate: (status === 'follow_up_later' || status === 'payment_talk') ? (nextFollowUpDate || null) : null,
    lostReason: status === 'not_now' ? lostReason || null : null,
  });

  await FollowUpLog.create({
    leadId: lead._id,
    authorId: req.user._id,
    statusAtEntry: status,
    remark: remark || '',
    todaysReport: todaysReport || '',
    nextFollowUpDateSet: (status === 'follow_up_later' || status === 'payment_talk') ? (nextFollowUpDate || null) : null,
  });

  // If admin assigned this lead to someone else, send them a notification
  if (assignTo && req.user.role === 'admin' && String(assignTo) !== String(req.user._id)) {
    await Notification.create({
      userId: assignTo,
      type: 'lead_assigned',
      refId: lead._id,
      message: `Admin assigned you a new lead: ${customer.name}`,
    });
  }

  await AuditLog.create({
    userId: req.user._id,
    action: 'lead.create',
    entityType: 'Lead',
    entityId: lead._id,
    diff: assignTo ? { assignedTo: assignTo } : null,
  });

  const populated = await Lead.findById(lead._id).populate('customerId productIds');
  res.status(201).json({ lead: populated });
});

const addFollowUp = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  if (String(lead.ownerId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You can only update your own leads' });
  }
  if (lead.currentStatus === 'not_now') {
    return res.status(400).json({ message: 'This lead is closed (Not Now) and cannot be reopened' });
  }

  const { status, nextFollowUpDate, remark, todaysReport, lostReason } = req.body;
  if (!status || !Lead.STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Valid status is required' });
  }
  if (status === 'follow_up_later' && !nextFollowUpDate) {
    return res.status(400).json({ message: 'Next follow-up date is required when status is Follow Up Later' });
  }

  lead.currentStatus = status;
  lead.nextFollowUpDate = (status === 'follow_up_later' || status === 'payment_talk') ? (nextFollowUpDate || null) : null;
  lead.lostReason = status === 'not_now' ? lostReason || null : null;
  lead.isFollowUpClosed = status === 'order_placed' || status === 'not_now';
  await lead.save();

  await FollowUpLog.create({
    leadId: lead._id,
    authorId: req.user._id,
    statusAtEntry: status,
    remark: remark || '',
    todaysReport: todaysReport || '',
    nextFollowUpDateSet: status === 'follow_up_later' ? nextFollowUpDate : null,
  });

  await AuditLog.create({
    userId: req.user._id,
    action: 'lead.followup_added',
    entityType: 'Lead',
    entityId: lead._id,
  });

  const populated = await Lead.findById(lead._id).populate('customerId productIds');
  res.json({ lead: populated });
});

const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id).populate('customerId productIds ownerId', 'name email');
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  if (String(lead.ownerId._id || lead.ownerId) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to view this lead' });
  }

  const history = await FollowUpLog.find({ leadId: lead._id }).populate('authorId', 'name').sort({ createdAt: -1 });
  res.json({ lead, history });
});

const listLeads = asyncHandler(async (req, res) => {
  const { range, from, to, search, status, page = 1, limit = 25 } = req.query;
  const filter = { ownerId: req.user._id };

  if (status && Lead.STATUSES.includes(status)) filter.currentStatus = status;

  if (range === 'today') {
    filter.createdAt = { $gte: startOfTodayIST(), $lte: endOfTodayIST() };
  } else if (range === 'week') {
    filter.createdAt = { $gte: startOfWeekIST() };
  } else if (range === 'month') {
    filter.createdAt = { $gte: startOfMonthIST() };
  } else if (range === 'custom' && from && to) {
    filter.createdAt = { $gte: new Date(from), $lte: new Date(to) };
  }

  if (search) {
    const matchingCustomers = await Customer.find({
      normalizedName: { $regex: escapeRegex(search.trim().toLowerCase()) }
    }).select('_id');
    filter.customerId = { $in: matchingCustomers.map((c) => c._id) };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [leads, total] = await Promise.all([
    Lead.find(filter).populate('customerId productIds').sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)),
    Lead.countDocuments(filter),
  ]);

  // Attach latest remark from FollowUpLog to each lead
  const leadIds = leads.map((l) => l._id);
  const latestLogs = await FollowUpLog.aggregate([
    { $match: { leadId: { $in: leadIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$leadId', remark: { $first: '$remark' }, createdAt: { $first: '$createdAt' } } },
  ]);

  const logMap = {};
  latestLogs.forEach((l) => { logMap[String(l._id)] = l.remark; });

  const leadsWithRemark = leads.map((l) => ({
    ...l.toObject(),
    lastRemark: logMap[String(l._id)] || '',
  }));

  res.json({ leads: leadsWithRemark, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

const dueToday = asyncHandler(async (req, res) => {
  const leads = await Lead.find({
    ownerId: req.user._id,
    currentStatus: 'follow_up_later',
    nextFollowUpDate: { $lte: endOfTodayIST() },
  })
    .populate('customerId productIds')
    .sort({ nextFollowUpDate: 1 });

  res.json({ leads });
});

module.exports = { createLead, addFollowUp, getLead, listLeads, dueToday };

// All pending follow-ups for the user — sorted by date (overdue first, then upcoming)
// Used by the dashboard "Follow-up Pipeline" section
const followUpPipeline = asyncHandler(async (req, res) => {
  const leads = await Lead.find({
    ownerId: req.user._id,
    currentStatus: 'follow_up_later',
  })
    .populate('customerId productIds')
    .sort({ nextFollowUpDate: 1 }); // earliest first (overdue at top)

  // Tag each lead: overdue, due-today, or upcoming
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tagged = leads.map((lead) => {
    const followDate = new Date(lead.nextFollowUpDate);
    let tag;
    if (followDate < todayStart) tag = 'overdue';
    else if (followDate <= today) tag = 'due-today';
    else tag = 'upcoming';
    return { ...lead.toObject(), tag };
  });

  res.json({ leads: tagged });
});

module.exports = { createLead, addFollowUp, getLead, listLeads, dueToday, followUpPipeline };
