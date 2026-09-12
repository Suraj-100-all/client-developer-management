export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  clientId: string;
  client?: Client;
  createdByPmId: string;
  createdByPm?: User;
  taskCount?: number;
  completedTaskCount?: number;
  overdueTaskCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  taskNumber: number;
  title: string;
  description: string;
  projectId: string;
  project?: {
    id: string;
    title: string;
    createdByPmId: string;
  };
  assignedToDevId?: string;
  assignedDev?: User;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskActivityLog {
  id: string;
  taskId: string;
  taskNumber?: number;
  taskTitle?: string;
  projectId: string;
  projectName?: string;
  userId: string;
  userName: string;
  userRole: Role;
  actionType: 'STATUS_CHANGE' | 'ASSIGNMENT' | 'CREATED' | 'OVERDUE_FLAGGED' | 'DESCRIPTION_UPDATE';
  oldValue?: string;
  newValue?: string;
  formattedMessage: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  taskId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface FilterParams {
  status?: string;
  priority?: string;
  dueDateRange?: 'all' | 'overdue' | 'this_week' | 'upcoming';
  search?: string;
  projectId?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export type WsEventType =
  | 'presence:update'
  | 'activity:new'
  | 'task:status_updated'
  | 'task:created'
  | 'task:overdue'
  | 'project:created'
  | 'notification:new';

export interface WsMessage<T = unknown> {
  type: WsEventType;
  payload: T;
  timestamp: string;
}
