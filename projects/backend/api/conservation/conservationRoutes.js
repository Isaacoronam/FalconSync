import { Router } from 'express';
import {
  addFindingController,
  closeInspectionController,
  convertReportController,
  createHeritageAssetController,
  createInspectionController,
  createReportController,
  getInspectionController,
  getReportController,
  listActiveInspectorsController,
  listInspectionsController,
  listOwnReportsController,
  listPublicHeritageAssets,
  listReportsForTriageController,
  proposeInterventionController,
  resumeInspectionController,
  reviewInspectionController,
  startInspectionController,
  submitInspectionController,
  transitionInterventionController,
  triageReportController,
} from './conservationController.js';
import { authenticate } from '../../middlewares/auth.js';
import { reportLimiter } from '../../middlewares/rateLimiters.js';
import { requireAnyCapability } from '../../microservices/authorizationService.js';

const router = Router();

router.get('/heritage-assets', listPublicHeritageAssets);
router.post(
  '/heritage-assets',
  authenticate,
  requireAnyCapability('asset.manage'),
  createHeritageAssetController,
);

router.post(
  '/reports',
  authenticate,
  requireAnyCapability('report.create'),
  reportLimiter,
  createReportController,
);
router.get(
  '/reports/mine',
  authenticate,
  requireAnyCapability('report.read.own'),
  listOwnReportsController,
);
router.get(
  '/reports/queue',
  authenticate,
  requireAnyCapability('report.triage', 'report.read.all'),
  listReportsForTriageController,
);
router.get(
  '/reports/:id',
  authenticate,
  requireAnyCapability('report.read.own', 'report.read.all', 'audit.read'),
  getReportController,
);
router.patch(
  '/reports/:id/triage',
  authenticate,
  requireAnyCapability('report.triage'),
  triageReportController,
);
router.post(
  '/reports/:id/convert',
  authenticate,
  requireAnyCapability('report.triage'),
  convertReportController,
);

router.get(
  '/inspections',
  authenticate,
  requireAnyCapability('inspection.read.assigned', 'inspection.read.audit'),
  listInspectionsController,
);
router.get(
  '/inspectors',
  authenticate,
  requireAnyCapability('inspection.create', 'report.triage'),
  listActiveInspectorsController,
);
router.post(
  '/inspections',
  authenticate,
  requireAnyCapability('inspection.create'),
  createInspectionController,
);
router.get(
  '/inspections/:id',
  authenticate,
  requireAnyCapability('inspection.read.assigned', 'inspection.read.audit'),
  getInspectionController,
);
router.post(
  '/inspections/:id/start',
  authenticate,
  requireAnyCapability('inspection.execute'),
  startInspectionController,
);
router.post(
  '/inspections/:id/resume',
  authenticate,
  requireAnyCapability('inspection.execute'),
  resumeInspectionController,
);
router.post(
  '/inspections/:id/findings',
  authenticate,
  requireAnyCapability('finding.propose'),
  addFindingController,
);
router.post(
  '/inspections/:id/submit',
  authenticate,
  requireAnyCapability('inspection.execute'),
  submitInspectionController,
);
router.post(
  '/inspections/:id/review',
  authenticate,
  requireAnyCapability('inspection.review'),
  reviewInspectionController,
);
router.post(
  '/inspections/:id/close',
  authenticate,
  requireAnyCapability('inspection.close'),
  closeInspectionController,
);
router.post(
  '/inspections/:id/interventions',
  authenticate,
  requireAnyCapability('intervention.propose'),
  proposeInterventionController,
);
router.patch(
  '/interventions/:id',
  authenticate,
  requireAnyCapability('intervention.propose', 'intervention.verify'),
  transitionInterventionController,
);

export default router;
