const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Lead = require('../models/Lead');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

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
    .populate('customerId productId ownerId', 'name email')
    .sort({ createdAt: -1 });

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
    .populate('customerId productId ownerId', 'name email')
    .sort({ nextFollowUpDate: 1 });

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
  const leads = await Lead.find({}).populate('customerId productId ownerId', 'name email').sort({ createdAt: -1 });

  const rows = leads.map((l) => ({
    customer: l.customerId?.name || '',
    product: l.productId?.name || '',
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

module.exports = { leadActivityReport, productWiseReport, followUpReport, orderConversionReport, exportReport };
