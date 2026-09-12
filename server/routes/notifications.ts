import { Router, Response } from 'express';
import { db } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware.js';

const router = Router();

// GET /api/notifications
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const userNotifs = Array.from(db.notifications.values())
    .filter((n) => n.userId === user.userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = userNotifs.filter((n) => !n.isRead).length;

  res.json({
    notifications: userNotifs,
    unreadCount,
  });
});

// PATCH /api/notifications/:id/read (mark single read)
router.patch('/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;
  const notif = db.notifications.get(req.params.id);

  if (!notif) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found', statusCode: 404 });
    return;
  }

  if (notif.userId !== user.userId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this notification', statusCode: 403 });
    return;
  }

  notif.isRead = true;

  const userNotifs = Array.from(db.notifications.values()).filter((n) => n.userId === user.userId);
  const unreadCount = userNotifs.filter((n) => !n.isRead).length;

  res.json({
    notification: notif,
    unreadCount,
  });
});

// PATCH /api/notifications/read-all (mark all read)
router.patch('/read-all', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = req.user!;

  for (const notif of db.notifications.values()) {
    if (notif.userId === user.userId) {
      notif.isRead = true;
    }
  }

  res.json({
    success: true,
    unreadCount: 0,
    message: 'All notifications marked as read',
  });
});

export default router;
