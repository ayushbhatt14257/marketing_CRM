const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin, requireStockOrAdmin } = require('../middleware/auth');
const { listProducts, createProduct, updateProduct, deleteProduct, stockIn } = require('../controllers/productController');

router.get('/', requireAuth, listProducts);
router.post('/', requireAuth, requireAdmin, createProduct);
router.put('/:id', requireAuth, requireAdmin, updateProduct);
router.delete('/:id', requireAuth, requireAdmin, deleteProduct);
router.post('/:id/stock-in', requireAuth, requireStockOrAdmin, stockIn);

module.exports = router;
