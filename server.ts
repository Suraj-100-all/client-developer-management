import express from 'express';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import authRouter from './server/routes/auth.js';
import projectsRouter from './server/routes/projects.js';
import tasksRouter from './server/routes/tasks.js';
import activityRouter from './server/routes/activity.js';
import notificationsRouter from './server/routes/notifications.js';
import auditRouter from './server/routes/audit.js';
import { structuredErrorHandler } from './server/middleware.js';
import { wsManager } from './server/websocket.js';
import { overdueScheduler } from './server/scheduler.js';

dotenv.config();

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Core middlewares
  app.use(express.json());
  app.use(cookieParser());

  // CORS and iframe header middleware
  app.use((req, res, next) => {
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

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/audit', auditRouter);

  // Structured Error Handler
  app.use(structuredErrorHandler);

  // Initialize Real-Time WebSocket server on the HTTP server
  wsManager.init(server);

  // Initialize background scheduled overdue task processor
  overdueScheduler.start(30000); // scans every 30 seconds

  // Integrate Vite for SPA development or serve static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  process.on('uncaughtException', (err) => {
    console.error('[Velozity Server] Uncaught exception:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[Velozity Server] Unhandled rejection:', reason);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[Velozity App] HTTP and WebSocket server active at http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Velozity App] Server startup failed:', err);
  process.exit(1);
});
