const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { listUsers, createUser, updateUser, setActiveStatus, resetUserPassword, adjustUserPoints } = require('../controllers/userController');

router.use(requireAuth, requireAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/active-status', setActiveStatus);
router.put('/:id/reset-password', resetUserPassword);
router.put('/:id/adjust-points', adjustUserPoints);

module.exports = router;
