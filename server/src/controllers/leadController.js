const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const FollowUpLog = require('../models/FollowUpLog');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const { awardPoints } = require('../services/pointsEngine');
const { startOfTodayIST, endOfTodayIST, startOfWeekIST, startOfMonthIST } = require('../utils/dateHelpers');

// Find-or-create customer by name (name-only matching, per SRS decision)
async function resolveCustomer(name, userId) {
  const normalizedName = name.trim().toLowerCase();
  let customer = await Customer.findOne({ normalizedName });
  if (!customer) {
    customer = await Customer.create({ name: name.trim(), createdBy: userId });
  }
  return customer;
}

const createLead = asyncHandler(async (req, res) => {
  const { customerName, customerId, productId, status, nextFollowUpDate, remark, todaysReport } = req.body;

  if (!productId || !status) {
    return res.status(400).json({ message: 'Product and status are required' });
  }
  if (!Lead.STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  if (status === 'follow_up_later' && !nextFollowUpDate) {
    return res.status(400).json({ message: 'Next follow-up date is required when status is Follow Up Later' });
  }
  if (!customerId && !customerName) {
    return res.status(400).json({ message: 'Customer name or customerId is required' });
  }

  const customer = customerId
    ? await Customer.findById(customerId)
    : await resolveCustomer(customerName, req.user._id);

  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const lead = await Lead.create({
    customerId: customer._id,
    productId,
    ownerId: req.user._id,
    currentStatus: status,
    nextFollowUpDate: status === 'follow_up_later' ? nextFollowUpDate : null,
    lostReason: status === 'not_now' ? req.body.lostReason || null : null,
  });

  await FollowUpLog.create({
    leadId: lead._id,
    authorId: req.user._id,
    statusAtEntry: status,
    remark: remark || '',
    todaysReport: todaysReport || '',
    nextFollowUpDateSet: status === 'follow_up_later' ? nextFollowUpDate : null,
  });

  await awardPoints(req.user._id, 'lead_created', lead._id);
  await AuditLog.create({ userId: req.user._id, action: 'lead.create', entityType: 'Lead', entityId: lead._id });

  const populated = await Lead.findById(lead._id).populate('customerId productId');
  res.status(201).json({ lead: populated });
});

// Add a new follow-up activity entry to an existing lead (does NOT overwrite history)
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

  const wasOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < startOfTodayIST();

  lead.currentStatus = status;
  lead.nextFollowUpDate = status === 'follow_up_later' ? nextFollowUpDate : null;
  lead.lostReason = status === 'not_now' ? lostReason || null : null;
  lead.isFollowUpClosed = status !== 'follow_up_later';
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
    diff: { wasOverdue, newStatus: status },
  });

  const populated = await Lead.findById(lead._id).populate('customerId productId');
  res.json({ lead: populated });
});

const getLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id).populate('customerId productId ownerId', 'name email');
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

  let query = Lead.find(filter).populate('customerId productId').sort({ updatedAt: -1 });

  if (search) {
    // Search by customer name requires a join; simplest correct approach is to first match customers
    const Customer = require('../models/Customer');
    const matchingCustomers = await Customer.find({ normalizedName: { $regex: search.trim().toLowerCase() } }).select('_id');
    filter.customerId = { $in: matchingCustomers.map((c) => c._id) };
    query = Lead.find(filter).populate('customerId productId').sort({ updatedAt: -1 });
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [leads, total] = await Promise.all([
    query.skip(skip).limit(Number(limit)),
    Lead.countDocuments(filter),
  ]);

  res.json({ leads, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

const dueToday = asyncHandler(async (req, res) => {
  const leads = await Lead.find({
    ownerId: req.user._id,
    currentStatus: 'follow_up_later',
    nextFollowUpDate: { $lte: endOfTodayIST() }, // includes overdue + due today
  })
    .populate('customerId productId')
    .sort({ nextFollowUpDate: 1 });

  res.json({ leads });
});

module.exports = { createLead, addFollowUp, getLead, listLeads, dueToday };
