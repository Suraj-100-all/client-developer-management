import React, { useState, useEffect, useCallback } from 'react';
import {
  Filter,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  X,
  Share2,
  Check,
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, FilterParams } from '../types.js';
import { api } from '../services/api.js';
import { wsClient } from '../services/websocket.js';
import { useAuth } from '../context/AuthContext.js';

interface TaskBoardProps {
  projectId?: string;
  onTaskSelect?: (task: Task) => void;
  readOnly?: boolean;
}

const STATUS_COLUMNS: { id: TaskStatus; title: string; color: string; badgeBg: string }[] = [
  { id: 'TODO', title: 'To Do', color: 'border-stone-200 bg-stone-50/50', badgeBg: 'bg-stone-200 text-stone-700' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-blue-200 bg-blue-50/20', badgeBg: 'bg-blue-100 text-blue-700' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'border-amber-200 bg-amber-50/20', badgeBg: 'bg-amber-100 text-amber-700' },
  { id: 'DONE', title: 'Done', color: 'border-emerald-200 bg-emerald-50/20', badgeBg: 'bg-emerald-100 text-emerald-700' },
];

export const TaskBoard: React.FC<TaskBoardProps> = ({ projectId, onTaskSelect, readOnly = false }) => {
  const { user, role, accessToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Parse initial filter params from URL Search Params (Requirement: Shareable URLs)
  const getInitialFilters = (): FilterParams => {
    const params = new URLSearchParams(window.location.search);
    return {
      status: params.get('status') || 'ALL',
      priority: params.get('priority') || 'ALL',
      dueDateRange: (params.get('dueDateRange') as any) || 'all',
      search: params.get('search') || '',
      projectId: projectId || params.get('projectId') || 'ALL',
    };
  };

  const [filters, setFilters] = useState<FilterParams>(getInitialFilters);

  // Sync state changes to browser URL query parameters
  const updateUrlParams = useCallback((newFilters: FilterParams) => {
    const params = new URLSearchParams();
    if (newFilters.status && newFilters.status !== 'ALL') params.set('status', newFilters.status);
    if (newFilters.priority && newFilters.priority !== 'ALL') params.set('priority', newFilters.priority);
    if (newFilters.dueDateRange && newFilters.dueDateRange !== 'all') params.set('dueDateRange', newFilters.dueDateRange);
    if (newFilters.search && newFilters.search.trim()) params.set('search', newFilters.search.trim());
    if (newFilters.projectId && newFilters.projectId !== 'ALL') params.set('projectId', newFilters.projectId);

    const newRelativePathQuery = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
    window.history.replaceState(null, '', newRelativePathQuery);
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const queryFilters = {
        ...filters,
        projectId: projectId || (filters.projectId !== 'ALL' ? filters.projectId : undefined),
      };
      const res = await api.getTasks(queryFilters);
      setTasks(res.tasks);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, projectId, accessToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Real-Time WebSocket updates:
  // "When any user updates a task status, all users currently viewing that project must see the update in real time without refreshing"
  useEffect(() => {
    const unsubStatus = wsClient.on('task:status_updated', (msg: any) => {
      const updatedTask = msg.payload as Task;
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === updatedTask.id);
        if (exists) {
          // If task matches active filters (or general role check), update it
          return prev.map((t) => (t.id === updatedTask.id ? updatedTask : t));
        } else if (!projectId || updatedTask.projectId === projectId) {
          // New or not present yet, could add if relevant
          return [updatedTask, ...prev];
        }
        return prev;
      });
    });

    const unsubCreated = wsClient.on('task:created', (msg: any) => {
      const newTask = msg.payload as Task;
      if (!projectId || newTask.projectId === projectId) {
        // Only append if user has rights (Developer only if assigned)
        if (role === 'DEVELOPER' && newTask.assignedToDevId !== user?.id) {
          return;
        }
        setTasks((prev) => [newTask, ...prev]);
      }
    });

    return () => {
      unsubStatus();
      unsubCreated();
    };
  }, [projectId, role, user]);

  const handleFilterChange = (key: keyof FilterParams, value: any) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    updateUrlParams(updated);
  };

  const handleResetFilters = () => {
    const reset = {
      status: 'ALL',
      priority: 'ALL',
      dueDateRange: 'all' as const,
      search: '',
      projectId: projectId || 'ALL',
    };
    setFilters(reset);
    updateUrlParams(reset);
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (readOnly) return;
    try {
      setUpdatingTaskId(taskId);
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t))
      );
      await api.updateTaskStatus(taskId, newStatus);
    } catch (err: any) {
      console.error('Failed to update task status:', err);
      // Revert
      fetchTasks();
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const copyShareableUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'CRITICAL':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded">Critical</span>;
      case 'HIGH':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">High</span>;
      case 'MEDIUM':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded">Med</span>;
      case 'LOW':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-stone-100 text-stone-700 rounded">Low</span>;
    }
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4" id="task-board-container">
      {/* Search & Filter Bar (Synced to URL Query Parameters) */}
      <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="task-search-input"
              type="text"
              placeholder="Search tasks by title, #ID, or description..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Shareable URL copy button */}
            <button
              id="copy-filter-url-button"
              onClick={copyShareableUrl}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg transition-colors font-medium"
              title="Copy shareable URL with active query filters"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-stone-500" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Filter URL'}</span>
            </button>

            {/* Reset filters */}
            {(filters.status !== 'ALL' || filters.priority !== 'ALL' || filters.dueDateRange !== 'all' || filters.search) && (
              <button
                id="reset-filters-btn"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2 py-1.5 text-rose-600 hover:text-rose-800 font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100 text-xs">
          <div className="flex items-center gap-1 text-stone-500 font-medium">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>

          {/* Status Filter */}
          <select
            id="filter-status-select"
            value={filters.status || 'ALL'}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="bg-stone-50 border border-stone-200 text-stone-700 rounded-md px-2 py-1 focus:ring-1 focus:ring-stone-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>

          {/* Priority Filter */}
          <select
            id="filter-priority-select"
            value={filters.priority || 'ALL'}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="bg-stone-50 border border-stone-200 text-stone-700 rounded-md px-2 py-1 focus:ring-1 focus:ring-stone-900"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Due Date Range Filter */}
          <select
            id="filter-date-select"
            value={filters.dueDateRange || 'all'}
            onChange={(e) => handleFilterChange('dueDateRange', e.target.value)}
            className="bg-stone-50 border border-stone-200 text-stone-700 rounded-md px-2 py-1 focus:ring-1 focus:ring-stone-900"
          >
            <option value="all">All Due Dates</option>
            <option value="overdue">⚠️ Overdue Tasks Only</option>
            <option value="this_week">Due This Week</option>
            <option value="upcoming">Upcoming</option>
          </select>

          <span className="text-[11px] text-stone-400 ml-auto">
            Showing {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Kanban Column View */}
      {loading ? (
        <div className="p-12 text-center text-xs text-stone-500 bg-white rounded-xl border border-stone-200">
          Loading tasks in real-time...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                id={`kanban-column-${col.id.toLowerCase()}`}
                className={`flex flex-col rounded-xl border p-3 min-h-[420px] ${col.color}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-200/60">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-800 text-xs">{col.title}</span>
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${col.badgeBg}`}>
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Column Task Cards */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <div className="h-28 flex items-center justify-center border border-dashed border-stone-300 rounded-lg text-stone-400 text-xs">
                      No tasks in {col.title}
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const isOverdue = task.isOverdue || (new Date(task.dueDate) < new Date() && task.status !== 'DONE');
                      const canUpdate =
                        !readOnly &&
                        (role === 'ADMIN' ||
                          role === 'PROJECT_MANAGER' ||
                          (role === 'DEVELOPER' && task.assignedToDevId === user?.id));

                      return (
                        <div
                          key={task.id}
                          id={`task-card-${task.id}`}
                          onClick={() => onTaskSelect?.(task)}
                          className={`bg-white rounded-lg p-3 border shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
                            isOverdue
                              ? 'border-rose-300 ring-1 ring-rose-200/60 bg-rose-50/20'
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          {/* Top Row: #ID, Project, Priority */}
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-stone-500">#{task.taskNumber}</span>
                              {task.project && (
                                <span className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded truncate max-w-[110px]">
                                  {task.project.title}
                                </span>
                              )}
                            </div>
                            {getPriorityBadge(task.priority)}
                          </div>

                          {/* Task Title */}
                          <h4 className="font-semibold text-stone-900 text-xs leading-snug mb-1.5 line-clamp-2">
                            {task.title}
                          </h4>

                          {/* Description snippet */}
                          {task.description && (
                            <p className="text-[11px] text-stone-500 line-clamp-2 mb-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Overdue alert banner if overdue */}
                          {isOverdue && (
                            <div className="mb-2 px-2 py-1 bg-rose-100/90 text-rose-800 text-[10px] font-semibold rounded flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Overdue (Flagged by Scheduler)</span>
                            </div>
                          )}

                          {/* Footer: Due date, Assigned Dev, Quick Status Transition */}
                          <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px]">
                            {/* Due Date */}
                            <div
                              className={`flex items-center gap-1 ${
                                isOverdue ? 'text-rose-600 font-semibold' : 'text-stone-500'
                              }`}
                            >
                              <Calendar className="w-3 h-3" />
                              <span>{formatDueDate(task.dueDate)}</span>
                            </div>

                            {/* Assigned Dev */}
                            {task.assignedDev ? (
                              <div
                                className="flex items-center gap-1 text-stone-600"
                                title={`Assigned to ${task.assignedDev.name}`}
                              >
                                <img
                                  src={task.assignedDev.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40'}
                                  alt={task.assignedDev.name}
                                  className="w-4 h-4 rounded-full object-cover ring-1 ring-stone-300"
                                />
                                <span className="truncate max-w-[70px] text-[10px] font-medium">
                                  {task.assignedDev.name.split(' ')[0]}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-stone-400 italic">Unassigned</span>
                            )}
                          </div>

                          {/* Quick Status Advance Buttons (Single Click) */}
                          {canUpdate && (
                            <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between gap-1">
                              <span className="text-[10px] text-stone-400 font-medium">Move to:</span>
                              <div className="flex items-center gap-1">
                                {task.status !== 'TODO' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(task.id, 'TODO');
                                    }}
                                    disabled={updatingTaskId === task.id}
                                    className="px-1.5 py-0.5 text-[10px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-colors"
                                  >
                                    To Do
                                  </button>
                                )}
                                {task.status !== 'IN_PROGRESS' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(task.id, 'IN_PROGRESS');
                                    }}
                                    disabled={updatingTaskId === task.id}
                                    className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                                  >
                                    Progress
                                  </button>
                                )}
                                {task.status !== 'IN_REVIEW' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(task.id, 'IN_REVIEW');
                                    }}
                                    disabled={updatingTaskId === task.id}
                                    className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 rounded transition-colors"
                                  >
                                    Review
                                  </button>
                                )}
                                {task.status !== 'DONE' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(task.id, 'DONE');
                                    }}
                                    disabled={updatingTaskId === task.id}
                                    className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors"
                                  >
                                    Done
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
