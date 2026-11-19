import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './helpers/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import adminRoutes from './api/admin/adminRoutes.js';
import adventureRoutes from './api/adventures/adventureRoutes.js';
import authRoutes from './api/auth/authRoutes.js';
import checkInRoutes from './api/check-ins/checkInRoutes.js';
import conservationRoutes from './api/conservation/conservationRoutes.js';
import evidenceRoutes from './api/evidence/evidenceRoutes.js';
import locationRoutes from './api/locations/locationRoutes.js';
import uploadsRoutes from './api/uploads/uploadsRoutes.js';
import profileRoutes from './api/users/profileRoutes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      database:
        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  app.use(config.uploads.publicPrefix, uploadsRoutes);

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/adventures', adventureRoutes);
  app.use('/api/check-ins', checkInRoutes);
  app.use('/api', conservationRoutes);
  app.use('/api/evidence', evidenceRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/profile', profileRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
