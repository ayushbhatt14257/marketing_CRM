const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { userStats, adminStats, userPerformance, userDetail, claimDailyPoints, weeklyAttendance } = require('../controllers/dashboardController');

router.get('/user-stats', requireAuth, userStats);
router.get('/admin-stats', requireAuth, requireAdmin, adminStats);
router.get('/user-performance', requireAuth, requireAdmin, userPerformance);
router.get('/user-detail/:id', requireAuth, requireAdmin, userDetail);
router.post('/claim-daily-points', requireAuth, claimDailyPoints);
router.get('/weekly-attendance', requireAuth, requireAdmin, weeklyAttendance);

module.exports = router;
