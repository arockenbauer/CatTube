import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as dlCtrl from '../controllers/downloadController.js';

const router = Router();

router.post('/token/:uuid', authenticate, dlCtrl.generateDownloadToken);
router.get('/:token', dlCtrl.downloadVideo);

export default router;
