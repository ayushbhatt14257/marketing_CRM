const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  leadActivityReport,
  productWiseReport,
  followUpReport,
  orderConversionReport,
  exportReport,
} = require('../controllers/reportController');

router.use(requireAuth, requireAdmin);

router.get('/lead-activity', leadActivityReport);
router.get('/product-wise', productWiseReport);
router.get('/followups', followUpReport);
router.get('/order-conversion', orderConversionReport);
router.get('/export', exportReport);

module.exports = router;
