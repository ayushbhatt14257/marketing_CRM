const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getNotifications, markAllRead, markOneRead } = require('../controllers/notificationController');

router.use(requireAuth);
router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markOneRead);

module.exports = router;
