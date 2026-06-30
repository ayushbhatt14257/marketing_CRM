const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-passwordHash -resetPasswordToken -resetPasswordExpires').sort({ createdAt: -1 });
  res.json({ users });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = name.trim();

  const [existingByEmail, existingByName] = await Promise.all([
    User.findOne({ email: normalizedEmail }),
    User.findOne({ name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }),
  ]);

  if (existingByEmail) {
    return res.status(409).json({ message: 'A user with this email already exists' });
  }
  if (existingByName) {
    return res.status(409).json({ message: `A user named "${normalizedName}" already exists. Use a different name or check if this is a duplicate.` });
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    passwordHash,
    role: role === 'admin' ? 'admin' : 'user',
  });

  await AuditLog.create({ userId: req.user._id, action: 'user.create', entityType: 'User', entityId: user._id });

  res.status(201).json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive },
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const before = { name: user.name, email: user.email, role: user.role };

  if (name) user.name = name;
  if (email) user.email = email.toLowerCase().trim();
  if (role && ['admin', 'user'].includes(role)) user.role = role;

  await user.save();
  await AuditLog.create({
    userId: req.user._id,
    action: 'user.update',
    entityType: 'User',
    entityId: user._id,
    diff: { before, after: { name: user.name, email: user.email, role: user.role } },
  });

  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });
});

const setActiveStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.isActive = !!isActive;
  await user.save();

  await AuditLog.create({
    userId: req.user._id,
    action: isActive ? 'user.activate' : 'user.deactivate',
    entityType: 'User',
    entityId: user._id,
  });

  res.json({ message: `User ${isActive ? 'activated' : 'deactivated'}` });
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Admin-triggered reset: generate a temporary password directly (simpler than email flow for internal tool)
  const tempPassword = crypto.randomBytes(6).toString('hex');
  user.passwordHash = await User.hashPassword(tempPassword);
  await user.save();

  await AuditLog.create({ userId: req.user._id, action: 'user.reset_password', entityType: 'User', entityId: user._id });

  // Returned directly to the admin to relay to the employee (internal tool, small team)
  res.json({ message: 'Password reset', tempPassword });
});

module.exports = { listUsers, createUser, updateUser, setActiveStatus, resetUserPassword };
