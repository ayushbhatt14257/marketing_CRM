const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parseSheet, matchParties, exportBookMatch } = require('../controllers/bookMatchController');

router.use(requireAuth, requireAdmin);

router.post('/parse', parseSheet);
router.post('/match', matchParties);
router.post('/export', exportBookMatch);

module.exports = router;
