import { Router } from 'express';
import {
  downloadEvidenceController,
  listEvidenceController,
  uploadEvidenceController,
} from './evidenceController.js';
import { authenticate } from '../../middlewares/auth.js';
import { uploadLimiter } from '../../middlewares/rateLimiters.js';
import { uploadEvidenceFile } from '../../middlewares/uploadEvidence.js';
import { requireAnyCapability } from '../../microservices/authorizationService.js';

const router = Router();

router.post(
  '/',
  authenticate,
  requireAnyCapability('evidence.upload'),
  uploadLimiter,
  uploadEvidenceFile,
  uploadEvidenceController,
);

router.get(
  '/',
  authenticate,
  requireAnyCapability('evidence.read.assigned'),
  listEvidenceController,
);

router.get(
  '/:id',
  authenticate,
  requireAnyCapability(
    'evidence.read.assigned',
    'evidence.read.audit',
    'evidence.upload',
  ),
  downloadEvidenceController,
);

export default router;
