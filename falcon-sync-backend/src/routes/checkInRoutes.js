import { Router } from 'express';
import { createCheckIn } from '../controllers/checkInController.js';
import { authenticate } from '../middlewares/auth.js';
import { checkInLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/', checkInLimiter, authenticate, createCheckIn);

export default router;
