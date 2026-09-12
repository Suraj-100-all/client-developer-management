import type {
  User,
  Project,
  Task,
  TaskActivityLog,
  NotificationItem,
  Client,
  FilterParams,
} from '../types.js';

let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;

if (typeof window !== 'undefined') {
  try {
    currentAccessToken = localStorage.getItem('velozity_access_token');
    currentRefreshToken = localStorage.getItem('velozity_refresh_token');
  } catch {}
}

export const setAccessToken = (token: string | null) => {
  currentAccessToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        localStorage.setItem('velozity_access_token', token);
      } else {
        localStorage.removeItem('velozity_access_token');
      }
    } catch {}
  }
};

export const setRefreshToken = (token: string | null) => {
  currentRefreshToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        localStorage.setItem('velozity_refresh_token', token);
      } else {
        localStorage.removeItem('velozity_refresh_token');
      }
    } catch {}
  }
};

export const getAccessToken = () => {
  if (currentAccessToken) return currentAccessToken;
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('velozity_access_token');
    } catch {}
  }
  return null;
};

export const getRefreshToken = () => {
  if (currentRefreshToken) return currentRefreshToken;
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('velozity_refresh_token');
    } catch {}
  }
  return null;
};

export class ApiError extends Error {
  statusCode: number;
  error: string;
  details?: unknown;

  constructor(message: string, statusCode: number, error: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include', // Include HttpOnly cookies (refreshToken)
    });
  } catch (err: any) {
    // If credentials: 'include' was rejected by browser iframe sandbox, fallback to default credentials
    try {
      res = await fetch(endpoint, {
        ...options,
        headers,
      });
    } catch (fallbackErr: any) {
      throw new ApiError(
        fallbackErr?.message || err?.message || 'Network connection failed',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // Handle 401 unauthorized with auto refresh attempt
  if (res.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/refresh')) {
    try {
      const storedRefreshToken = getRefreshToken();
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setAccessToken(data.accessToken);
        if (data.refreshToken) {
          setRefreshToken(data.refreshToken);
        }
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        const retryRes = await fetch(endpoint, {
          ...options,
          headers,
          credentials: 'include',
        });
        if (!retryRes.ok) {
          const errData = await retryRes.json().catch(() => ({}));
          throw new ApiError(errData.message || 'Request failed', retryRes.status, errData.error || 'REQUEST_FAILED');
        }
        return retryRes.json();
      } else {
        // Refresh token itself was rejected; clear stale token so app can heal
        setAccessToken(null);
        setRefreshToken(null);
      }
    } catch {
      // Refresh failed, fall through to error
    }
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new ApiError(
      errData.message || 'An error occurred while processing your request',
      res.status,
      errData.error || 'API_ERROR',
      errData.details
    );
  }

  return res.json();
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const res = await request<{ user: User; accessToken: string; refreshToken?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(res.accessToken);
    if (res.refreshToken) {
      setRefreshToken(res.refreshToken);
    }
    return res;
  },

  refresh: async (token?: string) => {
    const rfToken = token || getRefreshToken();
    const res = await request<{ user: User; accessToken: string; refreshToken?: string }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: rfToken }),
    });
    setAccessToken(res.accessToken);
    if (res.refreshToken) {
      setRefreshToken(res.refreshToken);
    }
    return res;
  },

  logout: async () => {
    setAccessToken(null);
    setRefreshToken(null);
    return request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  getCurrentUser: () =>
    request<{ user: User }>('/api/auth/me'),

  switchUser: async (userId: string) => {
    const res = await request<{ user: User; accessToken: string; refreshToken?: string }>('/api/auth/switch', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setAccessToken(res.accessToken);
    if (res.refreshToken) {
      setRefreshToken(res.refreshToken);
    }
    return res;
  },

  getUsers: (role?: string) =>
    request<{ users: User[] }>(`/api/auth/users${role ? `?role=${role}` : ''}`),

  // Projects
  getProjects: () =>
    request<{ projects: Project[] }>('/api/projects'),

  getProject: (id: string) =>
    request<{ project: Project }>(`/api/projects/${id}`),

  createProject: (data: { title: string; description: string; clientId: string }) =>
    request<{ project: Project; message: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getClients: () =>
    request<{ clients: Client[] }>('/api/projects/clients'),

  // Tasks
  getTasks: (filters?: FilterParams) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.dueDateRange) params.append('dueDateRange', filters.dueDateRange);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.projectId) params.append('projectId', filters.projectId);

    const queryString = params.toString();
    return request<{ tasks: Task[] }>(`/api/tasks${queryString ? `?${queryString}` : ''}`);
  },

  getTask: (id: string) =>
    request<{ task: Task }>(`/api/tasks/${id}`),

  createTask: (data: {
    title: string;
    description: string;
    projectId: string;
    assignedToDevId?: string;
    priority: string;
    dueDate: string;
  }) =>
    request<{ task: Task; message: string }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTaskStatus: (taskId: string, status: string) =>
    request<{ task: Task; activity: TaskActivityLog; message: string }>(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Activity Feed
  getActivityFeed: (limit = 20, projectId?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (projectId) params.append('projectId', projectId);
    return request<{ activities: TaskActivityLog[]; totalCount: number; catchupCount: number }>(
      `/api/activity?${params.toString()}`
    );
  },

  // Notifications
  getNotifications: () =>
    request<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),

  markNotificationRead: (id: string) =>
    request<{ notification: NotificationItem; unreadCount: number }>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllNotificationsRead: () =>
    request<{ success: boolean; unreadCount: number }>('/api/notifications/read-all', {
      method: 'PATCH',
    }),

  // Security Audit
  getSecurityStatus: () =>
    request<any>('/api/audit/security-status'),

  // Direct raw request helper for security testing
  rawRequest: async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (currentAccessToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${currentAccessToken}`;
    }
    const res = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  },
};
