import { Router } from 'express';
import { optionalAuth } from '../middlewares/auth.js';
import { getRecommendations, getShortsRecommendations } from '../algorithms/recommendation.js';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const videoId = req.query.videoId || null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const recommendations = await getRecommendations(userId, videoId, limit);
    res.json({ videos: recommendations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

router.get('/shorts', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const shorts = await getShortsRecommendations(userId, limit);
    res.json({ videos: shorts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get shorts recommendations' });
  }
});

export default router;
