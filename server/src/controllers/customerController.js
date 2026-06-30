const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');

const searchCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  if (!search || search.trim().length < 2) {
    return res.json({ customers: [] });
  }

  const normalized = search.trim().toLowerCase();
  // Prefix match for autocomplete-as-you-type (2-3 chars per spec)
  const customers = await Customer.find({ normalizedName: { $regex: `^${escapeRegex(normalized)}` } })
    .limit(10)
    .sort({ name: 1 });

  res.json({ customers });
});

// Admin-only: full customer directory with lead counts, so admins can see who's in the
// system and spot accidental duplicates created by name-only matching (e.g. typo variants).
const listAllCustomers = asyncHandler(async (req, res) => {
  const customers = await Customer.aggregate([
    {
      $lookup: {
        from: 'leads',
        localField: '_id',
        foreignField: 'customerId',
        as: 'leads',
      },
    },
    {
      $project: {
        name: 1,
        createdAt: 1,
        leadCount: { $size: '$leads' },
      },
    },
    { $sort: { name: 1 } },
  ]);

  res.json({ customers });
});

// Admin-only: rename a customer (e.g. fix a typo like "Rohit Shrama" -> "Rohit Sharma").
// Existing leads stay linked via customerId, so history isn't affected.
const renameCustomer = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }

  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const before = customer.name;
  customer.name = name.trim();
  await customer.save(); // pre-validate hook re-derives normalizedName

  await AuditLog.create({
    userId: req.user._id,
    action: 'customer.rename',
    entityType: 'Customer',
    entityId: customer._id,
    diff: { before, after: customer.name },
  });

  res.json({ customer });
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { searchCustomers, listAllCustomers, renameCustomer };