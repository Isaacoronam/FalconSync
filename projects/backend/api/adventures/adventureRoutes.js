import { Router } from 'express';
import {
  getAdventureProgress,
  getPublicAdventureBySlug,
  listPublicAdventures,
} from './adventureController.js';
import { authenticate } from '../../middlewares/auth.js';

const router = Router();

router.get('/', listPublicAdventures);
router.get('/:slug/progress', authenticate, getAdventureProgress);
router.get('/:slug', getPublicAdventureBySlug);

export default router;
