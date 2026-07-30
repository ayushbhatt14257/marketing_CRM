const express = require('express');
const router = express.Router();
const { requireAuth, requireStockOrAdmin } = require('../middleware/auth');
const {
  createOrder,
  updateDraft,
  submitOrder,
  listOrders,
  getOrder,
  dispatchOrder,
  cancelRemaining,
} = require('../controllers/orderController');

router.use(requireAuth);

router.get('/', listOrders);
router.post('/', createOrder);
router.get('/:id', getOrder);
router.patch('/:id', updateDraft);
router.patch('/:id/submit', submitOrder);
router.patch('/:id/dispatch', requireStockOrAdmin, dispatchOrder);
router.patch('/:id/cancel-remaining', cancelRemaining);

module.exports = router;
