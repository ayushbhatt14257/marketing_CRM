const multer = require('multer');
const ExcelJS = require('exceljs');
const stringSimilarity = require('string-similarity');
const Customer = require('../models/Customer');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Memory storage only — the file is parsed in-process and never written to disk or DB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
const uploadSingle = upload.single('file');

function normalize(str) {
  return String(str || '').trim().toLowerCase();
}

// Small hand-rolled CSV parser (handles quoted fields with embedded commas) —
// avoids pulling in a whole extra dependency for something this simple.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

// POST /api/book-match/parse — accepts an uploaded .xlsx/.csv, returns raw
// headers + rows so the frontend can map columns before anything is matched.
const parseSheet = [
  uploadSingle,
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const name = req.file.originalname.toLowerCase();
    let grid = [];

    if (name.endsWith('.csv')) {
      grid = parseCSV(req.file.buffer.toString('utf8'));
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return res.status(400).json({ message: 'No sheet found in file' });
      sheet.eachRow((row) => {
        const cells = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          cells.push(cell.value != null ? String(cell.value).trim() : '');
        });
        if (cells.some((c) => c !== '')) grid.push(cells);
      });
    } else {
      return res.status(400).json({ message: 'Only .xlsx and .csv files are supported' });
    }

    if (grid.length === 0) return res.status(400).json({ message: 'File appears to be empty' });
    if (grid.length > 2001) grid = grid.slice(0, 2001); // headers + 2000 rows, sanity cap

    const [headers, ...rows] = grid;
    res.json({ headers, rows });
  }),
];

// POST /api/book-match/match — { userId, entries: [{ partyName, credit, debit }] }
// Fuzzy-matches each party name against every Customer in the CRM and reports back
// who (if anyone) already has leads against that customer. Nothing is written to the DB.
const matchParties = asyncHandler(async (req, res) => {
  const { userId, entries } = req.body;
  if (!userId || !Array.isArray(entries)) {
    return res.status(400).json({ message: 'userId and entries[] are required' });
  }

  const targetUser = await User.findById(userId).select('name');
  if (!targetUser) return res.status(404).json({ message: 'User not found' });

  const [customers, users] = await Promise.all([
    Customer.aggregate([
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'customerId',
          as: 'leads',
        },
      },
      { $project: { name: 1, normalizedName: 1, ownerIds: '$leads.ownerId' } },
    ]),
    User.find({}).select('name'),
  ]);

  const userNameById = {};
  users.forEach((u) => { userNameById[String(u._id)] = u.name; });

  const customerNames = customers.map((c) => c.normalizedName);

  const results = entries.map((entry) => {
    const partyName = String(entry.partyName || '').trim();
    const normalized = normalize(partyName);

    let suggestions = [];
    if (normalized && customerNames.length > 0) {
      const { ratings } = stringSimilarity.findBestMatch(normalized, customerNames);
      suggestions = ratings
        .map((r, idx) => ({ ...r, customer: customers[idx] }))
        .filter((r) => r.rating >= 0.3)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3)
        .map((r) => {
          const ownerIds = r.customer.ownerIds || [];
          const targetCount = ownerIds.filter((id) => String(id) === String(userId)).length;
          const otherOwnerCounts = {};
          ownerIds.forEach((id) => {
            if (String(id) !== String(userId)) {
              const nm = userNameById[String(id)] || 'Unknown';
              otherOwnerCounts[nm] = (otherOwnerCounts[nm] || 0) + 1;
            }
          });
          return {
            customerId: r.customer._id,
            customerName: r.customer.name,
            confidence: Math.round(r.rating * 100),
            leadCountForUser: targetCount,
            totalLeadCount: ownerIds.length,
            otherOwners: Object.entries(otherOwnerCounts).map(([name, count]) => ({ name, count })),
          };
        });
    }

    return {
      partyName,
      credit: entry.credit ?? '',
      debit: entry.debit ?? '',
      suggestions,
    };
  });

  res.json({ targetUserName: targetUser.name, results });
});

// POST /api/book-match/export — takes the admin's finalized review rows and streams
// back an .xlsx. Purely a formatting step; nothing here is persisted either.
const exportBookMatch = asyncHandler(async (req, res) => {
  const { rows, targetUserName } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows[] is required' });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Book Match');
  sheet.columns = [
    { header: 'Party Name', key: 'partyName', width: 28 },
    { header: 'Matched Customer', key: 'matchedCustomer', width: 28 },
    { header: 'Status', key: 'status', width: 20 },
    { header: `${targetUserName || 'User'}'s Leads`, key: 'leadCountForUser', width: 16 },
    { header: 'Also Owned By', key: 'otherOwners', width: 24 },
    { header: 'Credit', key: 'credit', width: 14 },
    { header: 'Debit', key: 'debit', width: 14 },
  ];
  sheet.addRows(
    rows.map((r) => ({
      partyName: r.partyName,
      matchedCustomer: r.matchedCustomer || '',
      status: r.status,
      leadCountForUser: r.leadCountForUser ?? '',
      otherOwners: (r.otherOwners || []).join(', '),
      credit: r.credit,
      debit: r.debit,
    }))
  );
  sheet.getRow(1).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=book-match-report.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = { parseSheet, matchParties, exportBookMatch };
