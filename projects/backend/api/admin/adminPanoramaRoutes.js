import { Router } from 'express';
import {
  adminPanoramaImageController,
  adminPanoramaThumbnailController,
  approvePanoramaController,
  archivePanoramaController,
  createPanoramaController,
  getAdminPanoramaController,
  listAdminPanoramasController,
  publishPanoramaController,
  updatePanoramaController,
} from '../panoramas/panoramaController.js';
import { authenticate } from '../../middlewares/auth.js';
import { uploadLimiter } from '../../middlewares/rateLimiters.js';
import { uploadPanoramaImage } from '../../middlewares/uploadPanorama.js';
import { requireAnyCapability } from '../../microservices/authorizationService.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyCapability('panorama.manage', 'panorama.publish'),
  listAdminPanoramasController,
);

router.post(
  '/',
  requireAnyCapability('panorama.manage'),
  uploadLimiter,
  uploadPanoramaImage,
  createPanoramaController,
);

router.get(
  '/:id/image',
  requireAnyCapability('panorama.manage', 'panorama.publish'),
  adminPanoramaImageController,
);

router.get(
  '/:id/thumbnail',
  requireAnyCapability('panorama.manage', 'panorama.publish'),
  adminPanoramaThumbnailController,
);

router.get(
  '/:id',
  requireAnyCapability('panorama.manage', 'panorama.publish'),
  getAdminPanoramaController,
);

router.patch(
  '/:id',
  requireAnyCapability('panorama.manage'),
  updatePanoramaController,
);

router.post(
  '/:id/approve',
  requireAnyCapability('panorama.publish', 'panorama.manage'),
  approvePanoramaController,
);

router.post(
  '/:id/publish',
  requireAnyCapability('panorama.publish', 'panorama.manage'),
  publishPanoramaController,
);

router.post(
  '/:id/archive',
  requireAnyCapability('panorama.publish', 'panorama.manage'),
  archivePanoramaController,
);

export default router;
