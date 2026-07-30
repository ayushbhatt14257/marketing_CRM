const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  leadActivityReport,
  productWiseReport,
  followUpReport,
  orderConversionReport,
  exportReport,
  leadsByDay,
  analytics,
} = require('../controllers/reportController');

router.use(requireAuth, requireAdmin);

router.get('/lead-activity', leadActivityReport);
router.get('/product-wise', productWiseReport);
router.get('/followups', followUpReport);
router.get('/order-conversion', orderConversionReport);
router.get('/export', exportReport);
router.get('/leads-by-day', leadsByDay);
router.get('/analytics', analytics);

module.exports = router;
