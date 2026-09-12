import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Clock, AlertTriangle, UserPlus, FileText } from 'lucide-react';
import type { NotificationItem } from '../types.js';
import { api } from '../services/api.js';
import { wsClient } from '../services/websocket.js';
import { useAuth } from '../context/AuthContext.js';

export const NotificationsDropdown: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user || !accessToken) return;
    try {
      setLoading(true);
      const data = await api.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    fetchNotifications();

    // Listen to real-time notification pushes via WebSocket (Requirement 5)
    const unsub = wsClient.on('notification:new', (msg: any) => {
      const newNotif = msg.payload as NotificationItem;
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      unsub();
    };
  }, [user, accessToken]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      const data = await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef} id="notifications-menu-container">
      <button
        id="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            id="notification-badge-count"
            className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold text-white bg-rose-600 rounded-full animate-pulse"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-dropdown-panel"
          className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white rounded-xl shadow-xl border border-stone-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                id="mark-all-read-btn"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500 flex flex-col items-center gap-2">
                <Bell className="w-6 h-6 text-stone-300" />
                No notifications right now
              </div>
            ) : (
              notifications.map((notif) => {
                const isOverdue = notif.title.toLowerCase().includes('overdue');
                const isAssigned = notif.title.toLowerCase().includes('assigned');
                const isReview = notif.title.toLowerCase().includes('review');

                return (
                  <div
                    key={notif.id}
                    id={`notification-item-${notif.id}`}
                    className={`p-3 text-xs transition-colors flex items-start gap-3 ${
                      notif.isRead ? 'bg-white opacity-75' : 'bg-blue-50/40 hover:bg-blue-50/70'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isOverdue
                          ? 'bg-rose-100 text-rose-700'
                          : isReview
                          ? 'bg-amber-100 text-amber-700'
                          : isAssigned
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {isOverdue ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isReview ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-semibold text-stone-900 truncate">{notif.title}</span>
                        <span className="text-[10px] text-stone-400 shrink-0 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-stone-600 leading-relaxed line-clamp-2">{notif.message}</p>
                    </div>

                    {!notif.isRead && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        className="text-stone-400 hover:text-stone-700 p-1 rounded transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="p-2 bg-stone-50 border-t border-stone-200 text-center text-[11px] text-stone-500">
            Real-time WebSocket Push · Persistent DB Store
          </div>
        </div>
      )}
    </div>
  );
};
