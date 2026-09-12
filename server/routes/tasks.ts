import { Router, Response } from 'express';
import { db, TaskRecord, TaskActivityLogRecord, NotificationRecord } from '../db.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware.js';
import { wsManager } from '../websocket.js';
import type { TaskStatus, TaskPriority } from '../../src/types.js';

const router = Router();

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

// GET /api/tasks
// Filtering supported: status, priority, dueDateRange, search, projectId
// Role-enforced at API level:
// - DEVELOPER: only tasks assigned to them (assignedToDevId === req.user.userId)
// - PM: only tasks belonging to projects they created
// - ADMIN: all tasks
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { status, priority, dueDateRange, search, projectId } = req.query;

  let allTasks = Array.from(db.tasks.values());

  // 1. Role-based isolation
  if (user.role === 'DEVELOPER') {
    allTasks = allTasks.filter((t) => t.assignedToDevId === user.userId);
  } else if (user.role === 'PROJECT_MANAGER') {
    // PM can only see tasks from projects they created
    const myProjectIds = new Set(
      Array.from(db.projects.values())
        .filter((p) => p.createdByPmId === user.userId)
        .map((p) => p.id)
    );
    allTasks = allTasks.filter((t) => myProjectIds.has(t.projectId));
  }

  // 2. Query Filters (Shareable via URL parameters)
  if (status && typeof status === 'string' && status !== 'ALL') {
    allTasks = allTasks.filter((t) => t.status === status);
  }

  if (priority && typeof priority === 'string' && priority !== 'ALL') {
    allTasks = allTasks.filter((t) => t.priority === priority);
  }

  if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
    allTasks = allTasks.filter((t) => t.projectId === projectId);
  }

  const now = new Date();
  if (dueDateRange === 'overdue') {
    allTasks = allTasks.filter((t) => t.isOverdue || (new Date(t.dueDate) < now && t.status !== 'DONE'));
  } else if (dueDateRange === 'this_week') {
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    allTasks = allTasks.filter((t) => {
      const due = new Date(t.dueDate);
      return due >= now && due <= endOfWeek && t.status !== 'DONE';
    });
  } else if (dueDateRange === 'upcoming') {
    allTasks = allTasks.filter((t) => new Date(t.dueDate) >= now && t.status !== 'DONE');
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const q = search.toLowerCase().trim();
    allTasks = allTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        String(t.taskNumber).includes(q)
    );
  }

  // Sorting for Developer dashboard: sorted by priority then due date
  const priorityOrder: Record<TaskPriority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  if (user.role === 'DEVELOPER') {
    allTasks.sort((a, b) => {
      const pDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  } else {
    // Default sort by created or updated
    allTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  const enriched = allTasks.map((t) => db.getEnrichedTask(t));
  res.json({ tasks: enriched });
});

// GET /api/tasks/:id
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const task = db.tasks.get(req.params.id);

  if (!task) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found', statusCode: 404 });
    return;
  }

  const project = db.projects.get(task.projectId);

  // Security Check: Developer can ONLY view task if assigned to them!
  if (user.role === 'DEVELOPER' && task.assignedToDevId !== user.userId) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied: Developers cannot view tasks assigned to other developers.',
      statusCode: 403,
    });
    return;
  }

  // Security Check: PM can ONLY view task if project was created by them!
  if (user.role === 'PROJECT_MANAGER' && project?.createdByPmId !== user.userId) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied: Project Managers cannot view tasks in other PMs\' projects.',
      statusCode: 403,
    });
    return;
  }

  res.json({ task: db.getEnrichedTask(task) });
});

// POST /api/tasks (Admin & PM only)
router.post('/', requireAuth, requireRole(['ADMIN', 'PROJECT_MANAGER']), (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { title, description, projectId, assignedToDevId, priority, dueDate } = req.body;

  // Validation
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Task title is required', statusCode: 400 });
    return;
  }

  if (!projectId || !db.projects.has(projectId)) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Valid project ID is required', statusCode: 400 });
    return;
  }

  const project = db.projects.get(projectId)!;
  // If user is PM, they can ONLY create tasks in projects THEY created
  if (user.role === 'PROJECT_MANAGER' && project.createdByPmId !== user.userId) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Forbidden: You cannot create tasks in another Project Manager\'s project.',
      statusCode: 403,
    });
    return;
  }

  if (!dueDate || isNaN(Date.parse(dueDate))) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Valid due date is required', statusCode: 400 });
    return;
  }

  const validPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const taskPriority: TaskPriority = validPriorities.includes(priority) ? priority : 'MEDIUM';

  const now = new Date();
  const taskNumber = db.getNextTaskNumber();
  const isOverdue = new Date(dueDate) < now;

  const newTask: TaskRecord = {
    id: `task-${Date.now()}`,
    taskNumber,
    title: title.trim(),
    description: description ? description.trim() : '',
    projectId,
    assignedToDevId: assignedToDevId || undefined,
    status: 'TODO',
    priority: taskPriority,
    dueDate: new Date(dueDate).toISOString(),
    isOverdue,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  db.tasks.set(newTask.id, newTask);

  // Store activity log in DB (not derived!)
  const assignedDev = newTask.assignedToDevId ? db.users.get(newTask.assignedToDevId) : undefined;
  const assignmentText = assignedDev ? ` and assigned to ${assignedDev.name}` : '';
  const activity: TaskActivityLogRecord = {
    id: `act-${Date.now()}`,
    taskId: newTask.id,
    projectId: newTask.projectId,
    userId: user.userId,
    actionType: 'CREATED',
    newValue: 'TODO',
    formattedMessage: `${user.name} created Task #${newTask.taskNumber} "${newTask.title}"${assignmentText}`,
    createdAt: now.toISOString(),
  };
  db.activityLogs.unshift(activity);

  // In-app notification if assigned to developer
  if (newTask.assignedToDevId) {
    const notif: NotificationRecord = {
      id: `notif-${Date.now()}`,
      userId: newTask.assignedToDevId,
      taskId: newTask.id,
      title: 'New Task Assigned',
      message: `${user.name} assigned you to Task #${newTask.taskNumber}: "${newTask.title}".`,
      isRead: false,
      createdAt: now.toISOString(),
    };
    db.notifications.set(notif.id, notif);
    // Real-time WebSocket push to developer
    wsManager.sendNotificationToUser(newTask.assignedToDevId, notif);
  }

  // Real-time broadcast
  const enriched = db.getEnrichedTask(newTask);
  wsManager.broadcastTaskCreated(enriched);
  wsManager.broadcastRoleFilteredActivity(activity);

  res.status(201).json({
    task: enriched,
    message: 'Task created successfully',
  });
});

// PATCH /api/tasks/:id/status
// Update status: To Do / In Progress / In Review / Done
// Security: Developer can only update if assigned to them!
// Activity log must be stored in DB and broadcast via WebSocket.
// PM receives notification when task is moved to 'In Review'.
router.patch('/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const { status } = req.body;

  const validStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      statusCode: 400,
    });
    return;
  }

  const task = db.tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found', statusCode: 404 });
    return;
  }

  const project = db.projects.get(task.projectId);

  // Developer Authorization Check: CANNOT update other devs' tasks!
  if (user.role === 'DEVELOPER' && task.assignedToDevId !== user.userId) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Forbidden: You can only update the status of tasks assigned directly to you.',
      statusCode: 403,
    });
    return;
  }

  // PM Authorization Check: CANNOT update tasks from other PM's projects!
  if (user.role === 'PROJECT_MANAGER' && project?.createdByPmId !== user.userId) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Forbidden: You cannot modify tasks in another Project Manager\'s project.',
      statusCode: 403,
    });
    return;
  }

  const oldStatus = task.status;
  if (oldStatus === status) {
    res.json({ task: db.getEnrichedTask(task), message: 'No status change' });
    return;
  }

  const now = new Date().toISOString();
  task.status = status;
  task.updatedAt = now;

  // Format activity log as required: "Ravi moved Task #12 from In Progress → In Review · 2 mins ago"
  const formattedMessage = `${user.name} moved Task #${task.taskNumber} from ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[status]}`;

  const activity: TaskActivityLogRecord = {
    id: `act-${Date.now()}`,
    taskId: task.id,
    projectId: task.projectId,
    userId: user.userId,
    actionType: 'STATUS_CHANGE',
    oldValue: oldStatus,
    newValue: status,
    formattedMessage,
    createdAt: now,
  };

  // Stored in database, not derived
  db.activityLogs.unshift(activity);

  // NOTIFICATION REQUIREMENT:
  // "When a task they own is moved to In Review, the PM receives a notification"
  if (status === 'IN_REVIEW' && project?.createdByPmId) {
    const pmNotification: NotificationRecord = {
      id: `notif-review-${Date.now()}`,
      userId: project.createdByPmId,
      taskId: task.id,
      title: 'Task Ready for Review',
      message: `${user.name} moved Task #${task.taskNumber} "${task.title}" to In Review for your approval.`,
      isRead: false,
      createdAt: now,
    };
    db.notifications.set(pmNotification.id, pmNotification);
    wsManager.sendNotificationToUser(project.createdByPmId, pmNotification);
  }

  const enriched = db.getEnrichedTask(task);

  // Broadcast real-time updates:
  // 1. To all viewing users: live status update without page refresh
  wsManager.broadcastTaskStatusUpdated(enriched);
  // 2. Role-filtered activity stream
  wsManager.broadcastRoleFilteredActivity(activity);

  res.json({
    task: enriched,
    activity,
    message: 'Task status updated successfully',
  });
});

export default router;
