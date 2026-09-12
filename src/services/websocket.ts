import type { WsMessage, WsEventType } from '../types.js';

type MessageHandler = (message: WsMessage) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private listeners: Map<WsEventType | '*', Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private connectionStatusListeners: Set<(connected: boolean) => void> = new Set();

  public connect(token: string) {
    this.token = token;

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        // Socket is open, safely send auth update
        this.sendRaw({ type: 'auth', token });
        return;
      }
      if (this.socket.readyState === WebSocket.CONNECTING) {
        // Socket is currently establishing connection; onopen will send token
        return;
      }
      // Socket is closing or closed: clean up before reconnecting
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyStatus(true);
        // Send auth confirmation safely
        if (this.token) {
          this.sendRaw({ type: 'auth', token: this.token });
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);
          this.dispatch(message);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        this.notifyStatus(false);
      };
    } catch (err) {
      console.error('[WS] Connection init error:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.notifyStatus(false);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.token) return;

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  public on(event: WsEventType | '*', handler: MessageHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  public onStatusChange(callback: (connected: boolean) => void): () => void {
    this.connectionStatusListeners.add(callback);
    callback(this.isConnected);
    return () => {
      this.connectionStatusListeners.delete(callback);
    };
  }

  private notifyStatus(status: boolean) {
    this.connectionStatusListeners.forEach((cb) => cb(status));
  }

  private dispatch(message: WsMessage) {
    const specificHandlers = this.listeners.get(message.type);
    if (specificHandlers) {
      specificHandlers.forEach((handler) => handler(message));
    }

    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }

  public sendRaw(data: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
      } catch (err) {
        console.warn('[WS] Send failed:', err);
      }
    }
    return false;
  }
}

export const wsClient = new WebSocketClient();
