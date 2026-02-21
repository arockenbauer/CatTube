import { Router } from 'express';
import multer from 'multer';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { authenticate, optionalAuth, requireLevel } from '../middlewares/auth.js';
import { rateLimitAction, rateLimitUpload } from '../middlewares/antiSpam.js';
import { validate, videoUploadSchema, videoUpdateSchema } from '../utils/validators.js';
import * as videoCtrl from '../controllers/videoController.js';
import config from '../config.js';

const tmpDir = join(config.uploadsDir, '_tmp');
mkdirSync(tmpDir, { recursive: true });

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (req, file, cb) => {
    if (config.allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format'));
    }
  }
});

const router = Router();

router.get('/', optionalAuth, videoCtrl.getVideos);
router.get('/shorts', optionalAuth, videoCtrl.getShorts);
router.get('/trending', optionalAuth, videoCtrl.getTrending);
router.get('/my', authenticate, videoCtrl.getMyVideos);
router.post('/upload', authenticate, rateLimitUpload, upload.single('video'), validate(videoUploadSchema), videoCtrl.uploadVideo);
router.get('/:uuid', optionalAuth, videoCtrl.getVideo);
router.get('/:uuid/status', optionalAuth, videoCtrl.getVideoStatus);
router.put('/:uuid', authenticate, validate(videoUpdateSchema), videoCtrl.updateVideo);
router.delete('/:uuid', authenticate, videoCtrl.deleteVideo);
router.post('/:uuid/view', optionalAuth, rateLimitAction, videoCtrl.recordView);
router.post('/:uuid/like', authenticate, rateLimitAction, videoCtrl.likeVideo);
router.post('/:uuid/dislike', authenticate, rateLimitAction, videoCtrl.dislikeVideo);

export default router;
