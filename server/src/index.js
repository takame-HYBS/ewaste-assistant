import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { optionalAuth } from './middleware/auth.js';
import { HttpError } from './validate.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import deviceRoutes from './routes/devices.js';
import { forDevice as assessmentsForDevice, standalone as assessmentRoutes } from './routes/assessments.js';
import { forDevice as actionsForDevice, standalone as actionRoutes } from './routes/actions.js';
import locationRoutes from './routes/locations.js';
import statsRoutes from './routes/stats.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(optionalAuth);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoryRoutes);
  // Order matters: the nested /:id/assessments and /:id/actions routes must sit beside the device CRUD.
  app.use('/api/devices', assessmentsForDevice, actionsForDevice, deviceRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/actions', actionRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'That value is already in use.' });
    if (err.code === '23503') return res.status(409).json({ error: 'This record is linked to other data and cannot be changed that way.' });
    if (err.code === '23514' || err.code === '22P02' || err.code === '22003') {
      return res.status(400).json({ error: 'One of the values is not valid.' });
    }
    if (err.name === 'MulterError') {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 5 MB).' : 'Could not read the upload.';
      return res.status(400).json({ error: msg });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side.' });
  });

  return app;
}

// Start listening only when run directly, so tests can import createApp().
if (import.meta.url === `file://${process.argv[1]}`) {
  createApp().listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
}
