const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  const user = await User.findById(payload.sub).select('-passwordHash');
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Account not found or deactivated' });
  }

  req.user = user;
  next();
});

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const requireStockOrAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'stock_manager'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Stock manager or admin access required' });
  }
  next();
};

module.exports = { requireAuth, requireAdmin, requireStockOrAdmin };
