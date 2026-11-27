import { Router } from 'express';
import {
  getAssistantStatusController,
  queryTechnicalAssistant,
  queryTouristAssistant,
} from './assistantController.js';
import { authenticate } from '../../middlewares/auth.js';
import { assistantLimiter } from '../../middlewares/rateLimiters.js';
import { requireAnyCapability } from '../../microservices/authorizationService.js';

const router = Router();

router.get('/status', getAssistantStatusController);
router.post('/tourist/query', assistantLimiter, queryTouristAssistant);
router.post(
  '/inspection/query',
  authenticate,
  requireAnyCapability('assistant.inspection'),
  assistantLimiter,
  queryTechnicalAssistant,
);

export default router;
