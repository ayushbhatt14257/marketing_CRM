const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { searchCustomers, listAllCustomers, renameCustomer } = require('../controllers/customerController');

router.get('/', requireAuth, searchCustomers);
router.get('/all', requireAuth, requireAdmin, listAllCustomers);
router.put('/:id', requireAuth, requireAdmin, renameCustomer);

module.exports = router;
