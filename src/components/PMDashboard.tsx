import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  AlertTriangle,
  Calendar,
  Clock,
  Plus,
  FolderPlus,
  ShieldCheck,
  CheckCircle2,
  ListTodo,
} from 'lucide-react';
import type { Project, Task, TaskPriority } from '../types.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { TaskBoard } from './TaskBoard.js';
import { ActivityFeed } from './ActivityFeed.js';
import { CreateProjectModal } from './CreateProjectModal.js';
import { CreateTaskModal } from './CreateTaskModal.js';

export const PMDashboard: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      // API automatically filters projects to those created strictly by this PM!
      const [projRes, taskRes] = await Promise.all([
        api.getProjects(),
        api.getTasks(),
      ]);
      setProjects(projRes.projects);
      setTasks(taskRes.tasks);
    } catch (err) {
      console.error('Failed to load PM dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, accessToken]);

  // Priority breakdown:
  // "PM dashboard: their projects summary, tasks by priority, upcoming due dates this week"
  const priorityCounts: Record<TaskPriority, number> = {
    CRITICAL: tasks.filter((t) => t.priority === 'CRITICAL' && t.status !== 'DONE').length,
    HIGH: tasks.filter((t) => t.priority === 'HIGH' && t.status !== 'DONE').length,
    MEDIUM: tasks.filter((t) => t.priority === 'MEDIUM' && t.status !== 'DONE').length,
    LOW: tasks.filter((t) => t.priority === 'LOW' && t.status !== 'DONE').length,
  };

  // Upcoming due dates this week
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingThisWeekTasks = tasks
    .filter((t) => {
      const due = new Date(t.dueDate);
      return due >= now && due <= oneWeekFromNow && t.status !== 'DONE';
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const overdueTasks = tasks.filter((t) => t.isOverdue || (new Date(t.dueDate) < now && t.status !== 'DONE'));

  return (
    <div className="space-y-6" id="pm-dashboard-view">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full border border-blue-200">
              Project Manager
            </span>
            <span className="text-xs text-stone-500 font-medium">
              Owned Projects: {projects.length} Active
            </span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 mt-1">
            Project Manager Workspace: {user?.name}
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage your assigned client deliverables, assign tasks to developers, and monitor milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="pm-create-project-btn"
            onClick={() => setShowCreateProject(true)}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4 text-stone-600" />
            <span>New Project</span>
          </button>

          <button
            id="pm-create-task-btn"
            onClick={() => setShowCreateTask(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Task</span>
          </button>
        </div>
      </div>

      {/* Summary Cards: Projects Summary, Tasks by Priority, Upcoming Due Dates This Week */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: My Projects Summary */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">My Managed Projects</span>
              <FolderKanban className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-stone-900 mt-1">{projects.length}</div>
            <div className="mt-2 space-y-1 text-[11px] text-stone-600">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="truncate max-w-[170px] font-medium">{p.title}</span>
                  <span className="text-stone-400">{p.taskCount} tasks</span>
                </div>
              ))}
            </div>
          </div>
          {overdueTasks.length > 0 && (
            <div className="mt-3 pt-2 border-t border-stone-100 text-[11px] text-rose-600 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} in your projects</span>
            </div>
          )}
        </div>

        {/* Card 2: Tasks by Priority Breakdown (Required by PM Dashboard) */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Tasks By Priority</span>
              <span className="text-[11px] text-stone-400">Open items</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2 bg-rose-50 border border-rose-200/80 rounded-lg">
                <div className="text-[10px] font-bold text-rose-700 uppercase">Critical (P0)</div>
                <div className="text-lg font-bold text-rose-900 mt-0.5">{priorityCounts.CRITICAL}</div>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-lg">
                <div className="text-[10px] font-bold text-amber-700 uppercase">High (P1)</div>
                <div className="text-lg font-bold text-amber-900 mt-0.5">{priorityCounts.HIGH}</div>
              </div>
              <div className="p-2 bg-blue-50 border border-blue-200/80 rounded-lg">
                <div className="text-[10px] font-bold text-blue-700 uppercase">Medium (P2)</div>
                <div className="text-lg font-bold text-blue-900 mt-0.5">{priorityCounts.MEDIUM}</div>
              </div>
              <div className="p-2 bg-stone-50 border border-stone-200/80 rounded-lg">
                <div className="text-[10px] font-bold text-stone-700 uppercase">Low (P3)</div>
                <div className="text-lg font-bold text-stone-900 mt-0.5">{priorityCounts.LOW}</div>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-stone-400 mt-2 block">
            Automatic overdue alerts sent when deadlines lapse.
          </span>
        </div>

        {/* Card 3: Upcoming Due Dates This Week (Required by PM Dashboard) */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Due This Week</span>
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {upcomingThisWeekTasks.length === 0 ? (
                <div className="text-[11px] text-stone-400 py-3 text-center">
                  No deadlines upcoming in the next 7 days.
                </div>
              ) : (
                upcomingThisWeekTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-1.5 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200/60 text-xs flex items-center justify-between gap-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-stone-900 truncate">
                        #{t.taskNumber} {t.title}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {t.assignedDev ? `Assigned to ${t.assignedDev.name}` : 'Unassigned'}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                      {new Date(t.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <span className="text-[10px] text-stone-400 mt-2 block">
            Monitored by scheduled cron engine.
          </span>
        </div>
      </div>

      {/* Projects Selection Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedProjectId('ALL')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
            selectedProjectId === 'ALL'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          All My Projects ({projects.length})
        </button>

        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProjectId(p.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              selectedProjectId === p.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span className="truncate max-w-[150px]">{p.title}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedProjectId === p.id ? 'bg-blue-700 text-white' : 'bg-stone-100 text-stone-600'
            }`}>
              {p.taskCount}
            </span>
          </button>
        ))}
      </div>

      {/* Main Layout: Task Board (Left) & Team Activity Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <TaskBoard projectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined} />
        </div>

        {/* Live Team Activity Feed for PM's projects */}
        <div className="space-y-4">
          <ActivityFeed projectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined} />
        </div>
      </div>

      {/* Modals */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onProjectCreated={loadData}
      />

      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onTaskCreated={loadData}
        defaultProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
      />
    </div>
  );
};
