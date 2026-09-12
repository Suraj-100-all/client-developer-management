import { Router, Response } from 'express';
import { db, ProjectRecord } from '../db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware.js';
import { wsManager } from '../websocket.js';

const router = Router();

// GET /api/projects/clients (Admin & PM)
router.get('/clients', requireAuth, requireRole(['ADMIN', 'PROJECT_MANAGER']), (_req: AuthenticatedRequest, res: Response): void => {
  const clients = Array.from(db.clients.values());
  res.json({ clients });
});

// GET /api/projects
// Role-Based Filtering enforced at API level:
// - Admin: All projects
// - PM: Only projects created by this PM
// - Developer: 403 Forbidden (A Developer must not be able to reach PM's data)
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;

  if (user.role === 'DEVELOPER') {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied: Developers do not have permission to browse project portfolios.',
      statusCode: 403,
    });
    return;
  }

  let projectsList: ProjectRecord[] = [];

  if (user.role === 'ADMIN') {
    projectsList = Array.from(db.projects.values());
  } else if (user.role === 'PROJECT_MANAGER') {
    // PM can only manage projects they created
    projectsList = Array.from(db.projects.values()).filter(
      (p) => p.createdByPmId === user.userId
    );
  }

  // Enrich with client info, task counts, overdue counts
  const enriched = projectsList.map((p) => {
    const client = db.clients.get(p.clientId);
    const pm = db.users.get(p.createdByPmId);
    const tasks = Array.from(db.tasks.values()).filter((t) => t.projectId === p.id);
    const completedTasks = tasks.filter((t) => t.status === 'DONE');
    const overdueTasks = tasks.filter((t) => t.isOverdue);

    return {
      ...p,
      client,
      createdByPm: pm ? { id: pm.id, name: pm.name, email: pm.email, role: pm.role } : undefined,
      taskCount: tasks.length,
      completedTaskCount: completedTasks.length,
      overdueTaskCount: overdueTasks.length,
    };
  });

  res.json({ projects: enriched });
});

// GET /api/projects/:id
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const project = db.projects.get(req.params.id);

  if (!project) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Project not found',
      statusCode: 404,
    });
    return;
  }

  // Security check: If Developer, forbid. If PM, must be creator.
  if (user.role === 'DEVELOPER') {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied: Developers cannot inspect project administrative data.',
      statusCode: 403,
    });
    return;
  }

  if (user.role === 'PROJECT_MANAGER' && project.createdByPmId !== user.userId) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Forbidden: You cannot access or view another Project Manager\'s project.',
      statusCode: 403,
    });
    return;
  }

  const client = db.clients.get(project.clientId);
  const pm = db.users.get(project.createdByPmId);
  const tasks = Array.from(db.tasks.values()).filter((t) => t.projectId === project.id);

  res.json({
    project: {
      ...project,
      client,
      createdByPm: pm ? { id: pm.id, name: pm.name, email: pm.email, role: pm.role } : undefined,
      taskCount: tasks.length,
      completedTaskCount: tasks.filter((t) => t.status === 'DONE').length,
      overdueTaskCount: tasks.filter((t) => t.isOverdue).length,
    },
  });
});

// POST /api/projects (Admin & PM only)
router.post('/', requireAuth, requireRole(['ADMIN', 'PROJECT_MANAGER']), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { title, description, clientId } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Project title is required and must be non-empty',
      statusCode: 400,
    });
    return;
  }

  if (!clientId || !db.clients.has(clientId)) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Valid client ID is required',
      statusCode: 400,
    });
    return;
  }

  const now = new Date().toISOString();
  const newProject: ProjectRecord = {
    id: `proj-${Date.now()}`,
    title: title.trim(),
    description: description ? description.trim() : '',
    clientId,
    createdByPmId: user.userId, // Project creator
    createdAt: now,
    updatedAt: now,
  };

  db.projects.set(newProject.id, newProject);

  const client = db.clients.get(clientId);
  const enrichedProject = {
    ...newProject,
    client,
    taskCount: 0,
    completedTaskCount: 0,
    overdueTaskCount: 0,
  };

  // Broadcast WebSocket event
  wsManager.broadcastProjectCreated(enrichedProject);

  res.status(201).json({
    project: enrichedProject,
    message: 'Project created successfully',
  });
});

export default router;
