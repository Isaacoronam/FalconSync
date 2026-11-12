import { Router } from 'express';
import {
  addAdminAdventureStop,
  archiveAdminAdventure,
  createAdminAdventure,
  deleteAdminAdventureStop,
  getAdminAdventure,
  listAdminAdventures,
  publishAdminAdventure,
  reorderAdminAdventureStops,
  restoreAdminAdventure,
  updateAdminAdventure,
  updateAdminAdventureStop,
} from '../controllers/adminAdventureController.js';
import {
  createAdminLocation,
  deleteAdminLocation,
  deleteAdminLocationImage,
  getAdminLocation,
  listAdminLocations,
  listAuditLog,
  restoreAdminLocation,
  rotateLocationCheckInToken,
  updateAdminLocation,
  uploadAdminLocationImage,
} from '../controllers/adminLocationController.js';
import { getAdminSummary } from '../controllers/adminController.js';
import { listAdminUsers } from '../controllers/adminUserController.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { uploadLocationImage } from '../middlewares/uploadImage.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/summary', getAdminSummary);
router.get('/users', listAdminUsers);

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
router.post('/locations/:id/qr/rotate', rotateLocationCheckInToken);

router.get('/adventures', listAdminAdventures);
router.post('/adventures', createAdminAdventure);
router.get('/adventures/:id', getAdminAdventure);
router.patch('/adventures/:id', updateAdminAdventure);
router.delete('/adventures/:id', archiveAdminAdventure);
router.post('/adventures/:id/publish', publishAdminAdventure);
router.post('/adventures/:id/archive', archiveAdminAdventure);
router.post('/adventures/:id/restore', restoreAdminAdventure);
router.put('/adventures/:id/stops/reorder', reorderAdminAdventureStops);
router.post('/adventures/:id/stops', addAdminAdventureStop);
router.patch('/adventures/:id/stops/:stopId', updateAdminAdventureStop);
router.delete('/adventures/:id/stops/:stopId', deleteAdminAdventureStop);

router.get('/audit', listAuditLog);

export default router;
