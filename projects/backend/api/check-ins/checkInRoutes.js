import { Router } from 'express';
import { createCheckIn } from './checkInController.js';
import { authenticate } from '../../middlewares/auth.js';
import { checkInLimiter } from '../../middlewares/rateLimiters.js';
import { uploadImage } from '../../middlewares/uploadImage.js';

const router = Router();

router.post('/', checkInLimiter, authenticate, uploadImage, createCheckIn);

export default router;
