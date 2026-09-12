import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  ArrowRight,
  Clock,
  Database,
  Radio,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import type { TaskActivityLog } from '../types.js';
import { api } from '../services/api.js';
import { wsClient } from '../services/websocket.js';
import { useAuth } from '../context/AuthContext.js';

interface ActivityFeedProps {
  projectId?: string;
  maxEvents?: number;
  compact?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  projectId,
  maxEvents = 20,
  compact = false,
}) => {
  const { user, role, accessToken } = useAuth();
  const [activities, setActivities] = useState<TaskActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCatchupLoaded, setIsCatchupLoaded] = useState(false);
  const [newIncomingCount, setNewIncomingCount] = useState(0);

  // Requirement: "If a user is offline and comes back, they must see the last 20 activity events they missed — this must be fetched from the database, not cached in memory"
  const fetchDbCatchupActivities = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const res = await api.getActivityFeed(maxEvents, projectId);
      setActivities(res.activities);
      setIsCatchupLoaded(true);
      setNewIncomingCount(0);
    } catch (err) {
      console.error('Failed to fetch activity feed from database:', err);
    } finally {
      setLoading(false);
    }
  }, [maxEvents, projectId, accessToken]);

  useEffect(() => {
    fetchDbCatchupActivities();

    // Listen to real-time role-filtered WebSocket activity events
    const unsub = wsClient.on('activity:new', (msg: any) => {
      const newActivity = msg.payload as TaskActivityLog;

      // Ensure event applies to this project if filtered
      if (!projectId || newActivity.projectId === projectId) {
        setActivities((prev) => [newActivity, ...prev.slice(0, 49)]); // Keep last 50
        setNewIncomingCount((c) => c + 1);
      }
    });

    return () => {
      unsub();
    };
  }, [fetchDbCatchupActivities, projectId]);

  const formatRelativeTime = (isoString: string) => {
    const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'ADMIN':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">Admin</span>;
      case 'PROJECT_MANAGER':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">PM</span>;
      case 'DEVELOPER':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">Dev</span>;
      default:
        return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded">System</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs flex flex-col overflow-hidden" id="live-activity-feed-container">
      {/* Header */}
      <div className="p-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-bold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-stone-600" />
            Live Activity Feed
          </h3>
          <span className="text-[11px] text-stone-500 font-normal">
            ({role === 'ADMIN' ? 'Global View' : role === 'PROJECT_MANAGER' ? 'My Projects' : 'My Assigned Tasks'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCatchupLoaded && (
            <div
              className="hidden sm:flex items-center gap-1.5 text-[11px] text-stone-600 bg-white px-2 py-0.5 rounded-md border border-stone-200"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Real-Time</span>
            </div>
          )}

          <button
            id="refresh-activity-feed-btn"
            onClick={fetchDbCatchupActivities}
            className="p-1 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-200/60 transition-colors"
            title="Refresh database catchup history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-stone-900' : ''}`} />
          </button>
        </div>
      </div>

      {/* Role filter notice for developer or PM */}
      <div className="px-3.5 py-1.5 bg-stone-100/70 border-b border-stone-200 text-[11px] text-stone-600 flex items-center justify-between">
        <span>
          {role === 'ADMIN' && 'Showing real-time stream across all projects and developers.'}
          {role === 'PROJECT_MANAGER' && 'Showing real-time events strictly for projects you created.'}
          {role === 'DEVELOPER' && 'Showing real-time updates strictly for tasks assigned to you.'}
        </span>
        {newIncomingCount > 0 && (
          <span className="text-emerald-700 font-semibold animate-pulse">
            +{newIncomingCount} new live event{newIncomingCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Event List */}
      <div className={`overflow-y-auto divide-y divide-stone-100 ${compact ? 'max-h-72' : 'max-h-[520px]'}`}>
        {loading && activities.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-400">Loading live activity feed from database...</div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-400 flex flex-col items-center gap-2">
            <Radio className="w-6 h-6 text-stone-300" />
            No activity events recorded yet for this role view.
          </div>
        ) : (
          activities.map((act) => {
            const isOverdue = act.actionType === 'OVERDUE_FLAGGED';
            const isAssignment = act.actionType === 'ASSIGNMENT';
            const isStatus = act.actionType === 'STATUS_CHANGE';

            return (
              <div
                key={act.id}
                id={`activity-item-${act.id}`}
                className="p-3 hover:bg-stone-50/80 transition-colors text-xs flex items-start gap-2.5 group"
              >
                {/* Type icon */}
                <div
                  className={`p-1.5 rounded-md mt-0.5 shrink-0 ${
                    isOverdue
                      ? 'bg-rose-100 text-rose-700'
                      : isStatus
                      ? 'bg-blue-100 text-blue-700'
                      : isAssignment
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {isOverdue ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : isStatus ? (
                    <ArrowRight className="w-3.5 h-3.5" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="font-semibold text-stone-900">{act.userName}</span>
                    {getRoleBadge(act.userRole)}
                    {act.projectName && (
                      <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded truncate max-w-[130px]">
                        {act.projectName}
                      </span>
                    )}
                  </div>

                  {/* Formatted activity event message (e.g. 'Ravi moved Task #12 from In Progress → In Review') */}
                  <p className="text-stone-700 leading-relaxed font-medium">
                    {act.formattedMessage}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(act.createdAt)}
                    </span>
                    <span>·</span>
                    <span>Task #{act.taskNumber || act.taskId.slice(-4)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-stone-50 border-t border-stone-200 text-center text-[11px] text-stone-500 flex items-center justify-between px-3">
        <span className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-500" />
          WebSocket event listener active
        </span>
        <span>Role-filtered server push</span>
      </div>
    </div>
  );
};
