import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireAnyCapability } from '../../microservices/authorizationService.js';
import { listSources } from './sourceController.js';

const router = Router();

router.get('/', authenticate, requireAnyCapability('source.read'), listSources);

export default router;
