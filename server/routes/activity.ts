import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware.js';

const router = Router();

// GET /api/activity
// Missed Event Catchup from DB:
// Fetches the last 20 activity logs from database with role-based filtering:
// - Admin: all logs
// - PM: only logs for projects created by this PM
// - Developer: only logs for tasks assigned to this developer
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
  const projectId = req.query.projectId as string | undefined;

  let logs = db.activityLogs;

  if (projectId) {
    logs = logs.filter((l) => l.projectId === projectId);
  }

  // Enforce role-filtered view on DB query
  if (user.role === 'DEVELOPER') {
    // Developer only sees activity on tasks assigned to them
    logs = logs.filter((l) => {
      const task = db.tasks.get(l.taskId);
      return task?.assignedToDevId === user.userId;
    });
  } else if (user.role === 'PROJECT_MANAGER') {
    // PM only sees activity from their own projects
    const myProjectIds = new Set(
      Array.from(db.projects.values())
        .filter((p) => p.createdByPmId === user.userId)
        .map((p) => p.id)
    );
    logs = logs.filter((l) => myProjectIds.has(l.projectId));
  }

  // Sort descending by timestamp
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Slice to requested limit (default 20 for missed catchup)
  const sliced = logs.slice(0, limit);

  // Enrich with user and task details
  const enriched = sliced.map((l) => {
    const actor = db.users.get(l.userId);
    const task = db.tasks.get(l.taskId);
    const project = db.projects.get(l.projectId);

    return {
      ...l,
      userName: actor?.name || 'System',
      userRole: actor?.role || 'ADMIN',
      taskNumber: task?.taskNumber,
      taskTitle: task?.title,
      projectName: project?.title,
    };
  });

  res.json({
    activities: enriched,
    totalCount: logs.length,
    catchupCount: enriched.length,
  });
});

export default router;
