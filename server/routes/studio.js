import { Router } from 'express';
import { authenticate, requireLevel } from '../middlewares/auth.js';
import * as studioCtrl from '../controllers/studioController.js';

const router = Router();

router.get('/dashboard', authenticate, studioCtrl.getDashboard);
router.get('/analytics/:uuid', authenticate, studioCtrl.getVideoAnalytics);

export default router;
