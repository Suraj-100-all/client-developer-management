import { db, TaskActivityLogRecord, NotificationRecord } from './db.js';
import { wsManager } from './websocket.js';

class OverdueTaskScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  public start(intervalMs: number = 30000) {
    if (this.timer) return;

    // Run initial scan right away
    this.checkOverdueTasks();

    // Schedule background periodic job (every 30 seconds)
    this.timer = setInterval(() => {
      this.checkOverdueTasks();
    }, intervalMs);

    console.log(`[Scheduler] Overdue task background job running every ${intervalMs / 1000}s`);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkOverdueTasks() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      let newlyOverdueCount = 0;

      for (const task of db.tasks.values()) {
        // Condition: Task is not Done, due date is in the past, and not yet flagged as overdue
        if (task.status !== 'DONE' && !task.isOverdue) {
          const dueDate = new Date(task.dueDate);
          if (dueDate < now) {
            task.isOverdue = true;
            task.updatedAt = now.toISOString();
            newlyOverdueCount += 1;

            const project = db.projects.get(task.projectId);

            // Record DB activity log (not derived!)
            const activity: TaskActivityLogRecord = {
              id: `act-overdue-${Date.now()}-${task.id}`,
              taskId: task.id,
              projectId: task.projectId,
              userId: 'usr-admin-1', // System admin actor
              actionType: 'OVERDUE_FLAGGED',
              oldValue: 'false',
              newValue: 'true',
              formattedMessage: `System background scheduler flagged Task #${task.taskNumber} as Overdue`,
              createdAt: now.toISOString(),
            };
            db.activityLogs.unshift(activity);

            // Broadcast role-filtered activity
            wsManager.broadcastRoleFilteredActivity(activity);

            // Notify assigned Developer
            if (task.assignedToDevId) {
              const devNotification: NotificationRecord = {
                id: `notif-overdue-dev-${Date.now()}-${task.id}`,
                userId: task.assignedToDevId,
                taskId: task.id,
                title: 'Task Overdue Alert',
                message: `Task #${task.taskNumber} "${task.title}" is past its due date.`,
                isRead: false,
                createdAt: now.toISOString(),
              };
              db.notifications.set(devNotification.id, devNotification);
              wsManager.sendNotificationToUser(task.assignedToDevId, devNotification);
            }

            // Notify Project PM
            if (project?.createdByPmId) {
              const pmNotification: NotificationRecord = {
                id: `notif-overdue-pm-${Date.now()}-${task.id}`,
                userId: project.createdByPmId,
                taskId: task.id,
                title: 'Task Overdue Alert',
                message: `Task #${task.taskNumber} "${task.title}" in project "${project.title}" is overdue.`,
                isRead: false,
                createdAt: now.toISOString(),
              };
              db.notifications.set(pmNotification.id, pmNotification);
              wsManager.sendNotificationToUser(project.createdByPmId, pmNotification);
            }

            // Broadcast task update
            wsManager.broadcastTaskStatusUpdated(db.getEnrichedTask(task));
          }
        }
      }

      if (newlyOverdueCount > 0) {
        console.log(`[Scheduler] Flagged ${newlyOverdueCount} tasks as Overdue in background job.`);
      }
    } catch (err) {
      console.error('[Scheduler] Error in overdue task background scan:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const overdueScheduler = new OverdueTaskScheduler();
