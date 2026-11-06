import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import adminRoutes from './routes/adminRoutes.js';
import adventureRoutes from './routes/adventureRoutes.js';
import authRoutes from './routes/authRoutes.js';
import checkInRoutes from './routes/checkInRoutes.js';
import locationRoutes from './routes/locationRoutes.js';

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

  app.use(
    config.uploads.publicPrefix,
    express.static(config.uploads.dir, {
      fallthrough: true,
      maxAge: '30d',
      immutable: true,
      setHeaders: (response) => {
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/adventures', adventureRoutes);
  app.use('/api/check-ins', checkInRoutes);
  app.use('/api/locations', locationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
