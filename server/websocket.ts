import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import url from 'url';
import { verifyAccessToken, TokenPayload } from './auth.js';
import { db, TaskActivityLogRecord, NotificationRecord } from './db.js';
import type { WsMessage } from '../src/types.js';

interface AuthenticatedSocket extends WebSocket {
  user?: TokenPayload;
  isAlive?: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  // Map of userId -> Set of active sockets (supports multiple browser tabs for same user)
  private userSockets: Map<string, Set<AuthenticatedSocket>> = new Map();

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('error', (err) => {
      console.error('[WSS] WebSocketServer instance error caught:', err);
    });

    this.wss.on('connection', (ws: AuthenticatedSocket, req) => {
      ws.isAlive = true;

      // Check token in query param (?token=xxx)
      const parsedUrl = url.parse(req.url || '', true);
      const token = parsedUrl.query.token as string | undefined;

      if (token) {
        const payload = verifyAccessToken(token);
        if (payload) {
          this.attachUser(ws, payload);
        }
      }

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'auth' && parsed.token) {
            const payload = verifyAccessToken(parsed.token);
            if (payload) {
              this.attachUser(ws, payload);
              // Send confirmation
              this.sendToSocket(ws, {
                type: 'presence:update',
                payload: {
                  authenticated: true,
                  user: payload,
                  ...this.getPresenceStats(),
                },
                timestamp: new Date().toISOString(),
              });
            }
          } else if (parsed.type === 'ping') {
            this.sendToSocket(ws, {
              type: 'presence:update',
              payload: { pong: true, ...this.getPresenceStats() },
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          // ignore malformed packets
        }
      });

      ws.on('close', () => {
        this.detachUser(ws);
      });

      ws.on('error', () => {
        this.detachUser(ws);
      });
    });

    // Heartbeat ping interval to prune dead sockets
    setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((wsClient) => {
        const socket = wsClient as AuthenticatedSocket;
        if (socket.isAlive === false) {
          this.detachUser(socket);
          return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping();
      });
    }, 30000);
  }

  private attachUser(ws: AuthenticatedSocket, user: TokenPayload) {
    ws.user = user;
    if (!this.userSockets.has(user.userId)) {
      this.userSockets.set(user.userId, new Set());
    }
    this.userSockets.get(user.userId)!.add(ws);

    // Broadcast updated presence to all connected clients
    this.broadcastPresence();
  }

  private detachUser(ws: AuthenticatedSocket) {
    if (ws.user) {
      const userSet = this.userSockets.get(ws.user.userId);
      if (userSet) {
        userSet.delete(ws);
        if (userSet.size === 0) {
          this.userSockets.delete(ws.user.userId);
        }
      }
    }
    this.broadcastPresence();
  }

  public getPresenceStats() {
    const onlineUserIds = Array.from(this.userSockets.keys());
    return {
      onlineCount: onlineUserIds.length,
      onlineUserIds,
    };
  }

  // Live presence update broadcast
  public broadcastPresence() {
    const stats = this.getPresenceStats();
    const msg: WsMessage = {
      type: 'presence:update',
      payload: stats,
      timestamp: new Date().toISOString(),
    };
    this.broadcast(msg);
  }

  // Safe send
  private sendToSocket(ws: AuthenticatedSocket, message: WsMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast to all connected clients
  public broadcast(message: WsMessage) {
    if (!this.wss) return;
    const serialized = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
  }

  // Broadcast task status update to all viewing clients
  public broadcastTaskStatusUpdated(task: any) {
    const msg: WsMessage = {
      type: 'task:status_updated',
      payload: task,
      timestamp: new Date().toISOString(),
    };
    this.broadcast(msg);
  }

  // Broadcast task created
  public broadcastTaskCreated(task: any) {
    const msg: WsMessage = {
      type: 'task:created',
      payload: task,
      timestamp: new Date().toISOString(),
    };
    this.broadcast(msg);
  }

  // Broadcast project created
  public broadcastProjectCreated(project: any) {
    const msg: WsMessage = {
      type: 'project:created',
      payload: project,
      timestamp: new Date().toISOString(),
    };
    this.broadcast(msg);
  }

  /**
   * CRITICAL REQUIREMENT: Real-Time Role-Filtered Activity Feed
   * - Admin sees activity across all projects in a single global feed
   * - PM sees activity only from their own projects
   * - Developer sees activity only on tasks assigned to them
   */
  public broadcastRoleFilteredActivity(activity: TaskActivityLogRecord) {
    if (!this.wss) return;

    const task = db.tasks.get(activity.taskId);
    const project = db.projects.get(activity.projectId);
    const assignedDevId = task?.assignedToDevId;
    const projectPmId = project?.createdByPmId;

    const enrichedActivity = {
      ...activity,
      taskNumber: task?.taskNumber,
      taskTitle: task?.title,
      projectName: project?.title,
    };

    const message: WsMessage = {
      type: 'activity:new',
      payload: enrichedActivity,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      const socket = client as AuthenticatedSocket;
      if (socket.readyState !== WebSocket.OPEN || !socket.user) return;

      const { role, userId } = socket.user;

      // 1. Admin receives all events
      if (role === 'ADMIN') {
        socket.send(serialized);
        return;
      }

      // 2. Project Manager receives events only for projects they created
      if (role === 'PROJECT_MANAGER' && projectPmId === userId) {
        socket.send(serialized);
        return;
      }

      // 3. Developer receives events only for tasks assigned to them
      if (role === 'DEVELOPER' && assignedDevId === userId) {
        socket.send(serialized);
        return;
      }
    });
  }

  // Push targeted notification to a specific user
  public sendNotificationToUser(userId: string, notification: NotificationRecord) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return;

    const msg: WsMessage = {
      type: 'notification:new',
      payload: notification,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(msg);
    sockets.forEach((s) => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(serialized);
      }
    });
  }
}

export const wsManager = new WebSocketManager();
