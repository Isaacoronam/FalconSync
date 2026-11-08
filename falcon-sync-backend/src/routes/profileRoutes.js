import { Router } from 'express';
import {
  deleteMyAvatar,
  getMyAvatar,
  getMyCheckInPhoto,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
} from '../controllers/profileController.js';
import { authenticate } from '../middlewares/auth.js';
import { uploadLimiter } from '../middlewares/rateLimiters.js';
import { uploadImage } from '../middlewares/uploadImage.js';

const router = Router();

router.use(authenticate);

router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);
router.get('/avatar', getMyAvatar);
router.post('/avatar', uploadLimiter, uploadImage, uploadMyAvatar);
router.delete('/avatar', deleteMyAvatar);
router.get('/check-ins/:checkInId/photo', getMyCheckInPhoto);

export default router;
