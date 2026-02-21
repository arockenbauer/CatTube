import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate, registerSchema, loginSchema, updateProfileSchema, resetPasswordSchema, newPasswordSchema } from '../utils/validators.js';
import { rateLimitAction } from '../middlewares/antiSpam.js';
import * as authCtrl from '../controllers/authController.js';

const router = Router();

router.post('/register', rateLimitAction, validate(registerSchema), authCtrl.register);
router.post('/login', rateLimitAction, validate(loginSchema), authCtrl.login);
router.post('/refresh', authCtrl.refreshToken);
router.get('/verify-email/:token', authCtrl.verifyEmail);
router.post('/forgot-password', rateLimitAction, validate(resetPasswordSchema), authCtrl.requestPasswordReset);
router.post('/reset-password', rateLimitAction, validate(newPasswordSchema), authCtrl.resetPassword);
router.get('/me', authenticate, authCtrl.getMe);
router.put('/profile', authenticate, validate(updateProfileSchema), authCtrl.updateProfile);
router.post('/logout', authenticate, authCtrl.logout);

export default router;
