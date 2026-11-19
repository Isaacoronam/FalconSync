import express from 'express';
import { config } from '../../helpers/env.js';

const uploadsRoutes = express.Router();

uploadsRoutes.use(
  express.static(config.uploads.dir, {
    fallthrough: true,
    maxAge: '30d',
    immutable: true,
    setHeaders: (response) => {
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }),
);

export default uploadsRoutes;
