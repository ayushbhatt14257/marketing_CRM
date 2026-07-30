const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Lead = require('../models/Lead');
const Product = require('../models/Product');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const {
  startOfWeekIST, startOfLastWeekIST, startOfMonthIST, startOfLastMonthIST,
} = require('../utils/dateHelpers');

// Shared query builder for "lead activity" style reports, with optional date range
function buildDateFilter(from, to) {
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return Object.keys(filter).length ? filter : null;
}

const leadActivityReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = buildDateFilter(from, to);
  const filter = dateFilter ? { createdAt: dateFilter } : {};

  const leads = await Lead.find(filter)
    .populate('customerId productIds ownerId', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ leads });
});

const productWiseReport = asyncHandler(async (req, res) => {
  const data = await Lead.aggregate([
    {
      $group: {
        _id: '$productId',
        totalLeads: { $sum: 1 },
        ordersPlaced: { $sum: { $cond: [{ $eq: ['$currentStatus', 'order_placed'] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $project: { productName: '$product.name', totalLeads: 1, ordersPlaced: 1 } },
    { $sort: { totalLeads: -1 } },
  ]);

  res.json({ products: data });
});

const followUpReport = asyncHandler(async (req, res) => {
  const leads = await Lead.find({ currentStatus: 'follow_up_later' })
    .populate('customerId productIds ownerId', 'name email')
    .sort({ nextFollowUpDate: 1 })
    .lean();

  res.json({ leads });
});

const orderConversionReport = asyncHandler(async (req, res) => {
  const [totalLeads, ordersPlaced, notNow, stillFollowingUp] = await Promise.all([
    Lead.countDocuments({}),
    Lead.countDocuments({ currentStatus: 'order_placed' }),
    Lead.countDocuments({ currentStatus: 'not_now' }),
    Lead.countDocuments({ currentStatus: 'follow_up_later' }),
  ]);

  const conversionRate = totalLeads > 0 ? ((ordersPlaced / totalLeads) * 100).toFixed(2) : '0.00';

  res.json({ totalLeads, ordersPlaced, notNow, stillFollowingUp, conversionRatePercent: conversionRate });
});

// Generic export endpoint: ?type=excel|csv|pdf&report=lead-activity (extend as needed)
const exportReport = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const leads = await Lead.find({}).populate('customerId productIds ownerId', 'name email').sort({ createdAt: -1 }).lean();

  const rows = leads.map((l) => ({
    customer: l.customerId?.name || '',
    product: (l.productIds || []).map((p) => p.name).join(', '),
    owner: l.ownerId?.name || '',
    status: l.currentStatus,
    nextFollowUpDate: l.nextFollowUpDate ? l.nextFollowUpDate.toISOString().slice(0, 10) : '',
    createdAt: l.createdAt.toISOString().slice(0, 10),
  }));

  if (type === 'csv') {
    const header = Object.keys(rows[0] || { customer: '', product: '', owner: '', status: '', nextFollowUpDate: '', createdAt: '' }).join(',');
    const body = rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=lead-report.csv');
    return res.send(`${header}\n${body}`);
  }

  if (type === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leads');
    sheet.columns = [
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Product', key: 'product', width: 20 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Next Follow-up', key: 'nextFollowUpDate', width: 16 },
      { header: 'Created', key: 'createdAt', width: 16 },
    ];
    sheet.addRows(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=lead-report.xlsx');
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (type === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=lead-report.pdf');
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);
    doc.fontSize(16).text('Lead Activity Report', { align: 'center' });
    doc.moveDown();
    rows.forEach((r) => {
      doc
        .fontSize(10)
        .text(`${r.customer} | ${r.product} | ${r.owner} | ${r.status} | Next: ${r.nextFollowUpDate || '-'} | Created: ${r.createdAt}`);
    });
    doc.end();
    return;
  }

  res.status(400).json({ message: 'Invalid export type. Use excel, csv, or pdf.' });
});

// Day-wise lead counts (admin view — optionally scoped to one user via ?userId=)
// e.g. { date: '2026-07-07', count: 4, ordersPlaced: 1 }
const leadsByDay = asyncHandler(async (req, res) => {
  const { from, to, userId } = req.query;
  const match = {};
  if (userId) match.ownerId = new mongoose.Types.ObjectId(userId);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const days = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 },
        ordersPlaced: { $sum: { $cond: [{ $eq: ['$currentStatus', 'order_placed'] }, 1, 0] } },
      },
    },
    { $sort: { _id: -1 } },
    { $project: { _id: 0, date: '$_id', count: 1, ordersPlaced: 1 } },
  ]);

  res.json({ days });
});

// GET /api/reports/analytics — consolidated data for the Deep Analysis dashboard.
// Admin only. Everything here is computed live from Lead/Order — nothing cached.
const analytics = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [trendRaw, totalLeads, ordersPlacedCount, productPerf, weekCounts, lastWeekCounts, monthCounts, lastMonthCounts] = await Promise.all([
    // Daily trend, last 30 days — leads entered vs orders placed that day
    Lead.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          leadsCount: { $sum: 1 },
          ordersCount: { $sum: { $cond: [{ $eq: ['$currentStatus', 'order_placed'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', leadsCount: 1, ordersCount: 1 } },
    ]),
    Lead.countDocuments({}),
    Lead.countDocuments({ currentStatus: 'order_placed' }),
    // Product-wise sales — approved vs dispatched quantity, from actual Orders
    Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          approvedQty: { $sum: '$items.approvedQty' },
          dispatchedQty: { $sum: '$items.dispatchedQty' },
        },
      },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { _id: 0, productName: '$product.name', approvedQty: 1, dispatchedQty: 1 } },
      { $sort: { approvedQty: -1 } },
      { $limit: 15 },
    ]),
    Lead.countDocuments({ createdAt: { $gte: startOfWeekIST() } }),
    Lead.countDocuments({ createdAt: { $gte: startOfLastWeekIST(), $lt: startOfWeekIST() } }),
    Lead.countDocuments({ createdAt: { $gte: startOfMonthIST() } }),
    Lead.countDocuments({ createdAt: { $gte: startOfLastMonthIST(), $lt: startOfMonthIST() } }),
  ]);

  const conversionRate = totalLeads > 0 ? Number(((ordersPlacedCount / totalLeads) * 100).toFixed(1)) : 0;

  res.json({
    trend: trendRaw,
    funnel: { totalLeads, ordersPlaced: ordersPlacedCount, conversionRate },
    productPerformance: productPerf,
    comparison: {
      thisWeek: weekCounts,
      lastWeek: lastWeekCounts,
      thisMonth: monthCounts,
      lastMonth: lastMonthCounts,
    },
  });
});

module.exports = { leadActivityReport, productWiseReport, followUpReport, orderConversionReport, exportReport, leadsByDay, analytics };
