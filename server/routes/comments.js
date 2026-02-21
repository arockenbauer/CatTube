import { Router } from 'express';
import { authenticate, optionalAuth } from '../middlewares/auth.js';
import { rateLimitAction } from '../middlewares/antiSpam.js';
import { validate, commentSchema } from '../utils/validators.js';
import * as commentCtrl from '../controllers/commentController.js';

const router = Router();

router.get('/video/:uuid', optionalAuth, commentCtrl.getComments);
router.get('/:commentId/replies', optionalAuth, commentCtrl.getReplies);
router.post('/video/:uuid', authenticate, rateLimitAction, validate(commentSchema), commentCtrl.addComment);
router.delete('/:commentId', authenticate, commentCtrl.deleteComment);
router.post('/:commentId/like', authenticate, rateLimitAction, commentCtrl.likeComment);
router.post('/:commentId/pin', authenticate, commentCtrl.pinComment);

export default router;
