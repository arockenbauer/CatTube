import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate, reportSchema } from '../utils/validators.js';
import * as notifCtrl from '../controllers/notificationController.js';

const router = Router();

router.get('/', authenticate, notifCtrl.getNotifications);
router.put('/all/read', authenticate, notifCtrl.markRead);
router.put('/:id/read', authenticate, notifCtrl.markRead);
router.get('/history', authenticate, notifCtrl.getHistory);
router.post('/report', authenticate, validate(reportSchema), notifCtrl.reportContent);

export default router;
