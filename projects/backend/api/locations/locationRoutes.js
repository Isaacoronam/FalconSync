import { Router } from 'express';
import {
  getLocationBySlug,
  listLocations,
  listNearbyLocations,
} from './locationController.js';

const router = Router();

router.get('/', listLocations);
router.get('/near', listNearbyLocations);
router.get('/:slug', getLocationBySlug);

export default router;
