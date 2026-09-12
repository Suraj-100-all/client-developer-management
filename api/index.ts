import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRouter from '../server/routes/auth.js';
import projectsRouter from '../server/routes/projects.js';
import tasksRouter from '../server/routes/tasks.js';
import activityRouter from '../server/routes/activity.js';
import notificationsRouter from '../server/routes/notifications.js';
import auditRouter from '../server/routes/audit.js';
import { structuredErrorHandler } from '../server/middleware.js';

dotenv.config();

const app = express();

app.use(express.json());
app.use(cookieParser());

// CORS and iframe headers
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Health check endpoint
const handleHealth = (_req: Request, res: Response) => {
  res.json({ status: 'ok', serverless: true, time: new Date().toISOString() });
};
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// Mount routes with and without /api prefix to support both Vercel rewrite modes
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

app.use('/api/projects', projectsRouter);
app.use('/projects', projectsRouter);

app.use('/api/tasks', tasksRouter);
app.use('/tasks', tasksRouter);

app.use('/api/activity', activityRouter);
app.use('/activity', activityRouter);

app.use('/api/notifications', notificationsRouter);
app.use('/notifications', notificationsRouter);

app.use('/api/audit', auditRouter);
app.use('/audit', auditRouter);

app.use(structuredErrorHandler);

export default app;
