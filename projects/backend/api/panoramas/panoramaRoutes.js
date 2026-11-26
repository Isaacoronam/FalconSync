import { Router } from 'express';
import {
  getPublicPanoramaController,
  listPublicPanoramasController,
  publicPanoramaImageController,
  publicPanoramaThumbnailController,
} from './panoramaController.js';

const router = Router();

router.get('/', listPublicPanoramasController);
router.get('/:id/image', publicPanoramaImageController);
router.get('/:id/thumbnail', publicPanoramaThumbnailController);
router.get('/:id', getPublicPanoramaController);

export default router;
