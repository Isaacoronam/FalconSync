import { Router } from 'express';
import {
  changePassword,
  login,
  logout,
  me,
  refresh,
  register,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireTrustedOrigin } from '../middlewares/origin.js';
import {
  loginLimiter,
  passwordLimiter,
  refreshLimiter,
  registerLimiter,
} from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/refresh', requireTrustedOrigin, refreshLimiter, refresh);
router.post('/logout', requireTrustedOrigin, logout);
router.get('/me', authenticate, me);
router.post(
  '/change-password',
  authenticate,
  passwordLimiter,
  changePassword,
);

export default router;
