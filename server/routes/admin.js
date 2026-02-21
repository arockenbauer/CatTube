import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.js';
import * as adminCtrl from '../admin/adminController.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', adminCtrl.getAdminDashboard);
router.get('/users', adminCtrl.getUsers);
router.put('/users/:userId/level', adminCtrl.updateUserLevel);
router.post('/users/:userId/ban', adminCtrl.banUser);
router.post('/users/:userId/unban', adminCtrl.unbanUser);
router.post('/users/:userId/shadow-ban', adminCtrl.shadowBanUser);
router.get('/videos', adminCtrl.getVideos);
router.delete('/videos/:videoId', adminCtrl.adminDeleteVideo);
router.get('/reports', adminCtrl.getReports);
router.put('/reports/:reportId/resolve', adminCtrl.resolveReport);
router.get('/logs', adminCtrl.getLogs);

export default router;
