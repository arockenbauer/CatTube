import { Router } from 'express';
import { authenticate, optionalAuth } from '../middlewares/auth.js';
import { rateLimitAction } from '../middlewares/antiSpam.js';
import * as channelCtrl from '../controllers/channelController.js';

const router = Router();

router.get('/subscriptions', authenticate, channelCtrl.getSubscriptions);
router.get('/feed', authenticate, channelCtrl.getSubscriptionFeed);
router.get('/:username', optionalAuth, channelCtrl.getChannel);
router.get('/:username/videos', optionalAuth, channelCtrl.getChannelVideos);
router.post('/:username/subscribe', authenticate, rateLimitAction, channelCtrl.subscribe);

export default router;
