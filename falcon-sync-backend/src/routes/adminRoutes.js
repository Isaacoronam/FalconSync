import { Router } from 'express';
import {
  createAdminLocation,
  deleteAdminLocation,
  deleteAdminLocationImage,
  getAdminLocation,
  listAdminLocations,
  listAuditLog,
  restoreAdminLocation,
  updateAdminLocation,
  uploadAdminLocationImage,
} from '../controllers/adminLocationController.js';
import { getAdminSummary } from '../controllers/adminController.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { uploadLocationImage } from '../middlewares/uploadImage.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/summary', getAdminSummary);

router.get('/locations', listAdminLocations);
router.get('/locations/:id', getAdminLocation);
router.post('/locations', createAdminLocation);
router.patch('/locations/:id', updateAdminLocation);
router.delete('/locations/:id', deleteAdminLocation);
router.post('/locations/:id/restore', restoreAdminLocation);
router.post(
  '/locations/:id/images',
  uploadLocationImage,
  uploadAdminLocationImage,
);
router.delete('/locations/:id/images', deleteAdminLocationImage);

router.get('/audit', listAuditLog);

export default router;
