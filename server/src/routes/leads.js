const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createLead, addFollowUp, getLead, listLeads, dueToday, followUpPipeline, leadsByDayForUser } = require('../controllers/leadController');

router.use(requireAuth);

router.get('/', listLeads);
router.post('/', createLead);
router.get('/due-today', dueToday);
router.get('/pipeline', followUpPipeline);
router.get('/by-day', leadsByDayForUser);
router.get('/:id', getLead);
router.post('/:id/followups', addFollowUp);

module.exports = router;
