import { Router } from 'express';
import {
  createTelegramLinkCodeController,
  getTelegramLinkController,
  unlinkTelegramController,
} from './telegramController.js';
import { authenticate } from '../../middlewares/auth.js';
import { channelLinkLimiter } from '../../middlewares/rateLimiters.js';

const router = Router();

router.get('/telegram', authenticate, getTelegramLinkController);
router.post(
  '/telegram/link-code',
  authenticate,
  channelLinkLimiter,
  createTelegramLinkCodeController,
);
router.delete('/telegram', authenticate, unlinkTelegramController);

export default router;
