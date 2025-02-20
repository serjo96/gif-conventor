import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

import config from './config/index';
import healthRoutes from './routes/health.routes';
import conversionRoutes from './routes/conversion.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { serverAdapter, basicAuthMiddleware } from './config/bull-board';

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Disposition']
}));

app.use(express.json());
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/health', healthRoutes);
app.use('/api/conversion', conversionRoutes);

// Bull Board UI with auth
app.use('/admin/queues', basicAuthMiddleware, serverAdapter.getRouter());

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server is running in ${config.nodeEnv} mode on port ${config.port}`);
});
