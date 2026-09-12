import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Users,
  FolderPlus,
  Plus,
  BarChart3,
  Clock,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import type { Project, Task } from '../types.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { TaskBoard } from './TaskBoard.js';
import { ActivityFeed } from './ActivityFeed.js';
import { CreateProjectModal } from './CreateProjectModal.js';
import { CreateTaskModal } from './CreateTaskModal.js';

export const AdminDashboard: React.FC = () => {
  const { user, onlineCount, accessToken } = useAuth();
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
      const [projRes, taskRes] = await Promise.all([
        api.getProjects(),
        api.getTasks(),
      ]);
      setProjects(projRes.projects);
      setTasks(taskRes.tasks);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken]);

  // Compute metrics:
  // "Admin dashboard: total projects, total tasks by status, overdue task count, active users online right now (shown as a live count using WebSocket presence)"
  const totalProjects = projects.length;
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const inReviewCount = tasks.filter((t) => t.status === 'IN_REVIEW').length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const overdueCount = tasks.filter((t) => t.isOverdue || (new Date(t.dueDate) < new Date() && t.status !== 'DONE')).length;

  return (
    <div className="space-y-6" id="admin-dashboard-view">
      {/* Top Banner: Greeting & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-800 rounded-full border border-purple-200">
              System Admin
            </span>
            <span className="text-xs text-stone-500 font-medium">Organization-Wide Access</span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 mt-1">
            Admin Workspace: Organization Overview
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage all client projects, supervise team workload, and track live activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="admin-create-project-btn"
            onClick={() => setShowCreateProject(true)}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4 text-stone-600" />
            <span>New Project</span>
          </button>

          <button
            id="admin-create-task-btn"
            onClick={() => setShowCreateTask(true)}
            className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-stone-300" />
            <span>Assign Task</span>
          </button>
        </div>
      </div>

      {/* Executive Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Projects */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-500">Total Projects</span>
            <div className="text-2xl font-bold text-stone-900 mt-1">{totalProjects}</div>
            <span className="text-[11px] text-stone-400">Across 3 Enterprise Clients</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Tasks Breakdown */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-500">Tasks By Status</span>
            <div className="text-sm font-bold text-stone-900 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded text-[11px]">{todoCount} To Do</span>
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px]">{inProgressCount} Prog</span>
              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[11px]">{inReviewCount} Rev</span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[11px]">{doneCount} Done</span>
            </div>
            <span className="text-[11px] text-stone-400 mt-1 block">{tasks.length} total tasks</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Overdue Task Count */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-500">Overdue Tasks</span>
            <div className="text-2xl font-bold text-rose-600 mt-1 flex items-center gap-2">
              <span>{overdueCount}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">
                Action Required
              </span>
            </div>
            <span className="text-[11px] text-stone-400">Flagged by background cron</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Active Users Online (WebSocket Presence) */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-500">Active Online Users</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>{onlineCount} Online</span>
            </div>
            <span className="text-[11px] text-stone-400">Live WebSocket presence</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Projects Overview Carousel / Grid */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Client Projects Portfolio</h2>
            <p className="text-xs text-stone-500">Filter tasks below by selecting a project</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedProjectId('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                selectedProjectId === 'ALL'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All Projects ({projects.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {projects.map((p) => {
            const isSelected = selectedProjectId === p.id;
            const completionPercent = p.taskCount ? Math.round(((p.completedTaskCount || 0) / p.taskCount) * 100) : 0;

            return (
              <div
                key={p.id}
                id={`project-card-${p.id}`}
                onClick={() => setSelectedProjectId(isSelected ? 'ALL' : p.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-stone-900 ring-2 ring-stone-900/10 bg-stone-50/70 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    {p.client?.company || 'Enterprise Client'}
                  </span>
                  {p.overdueTaskCount ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded">
                      {p.overdueTaskCount} overdue
                    </span>
                  ) : null}
                </div>

                <h3 className="font-bold text-stone-900 text-xs leading-snug line-clamp-1 mb-1">
                  {p.title}
                </h3>

                <p className="text-[11px] text-stone-500 line-clamp-2 mb-3 leading-relaxed">
                  {p.description}
                </p>

                {/* Progress bar */}
                <div className="space-y-1 pt-2 border-t border-stone-100 text-[11px]">
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Progress ({completionPercent}%)</span>
                    <span>
                      {p.completedTaskCount} / {p.taskCount} tasks
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-stone-400 flex items-center justify-between">
                  <span>Lead: {p.createdByPm?.name || 'Project Manager'}</span>
                  <span className="text-stone-700 font-semibold">{isSelected ? 'Active Filter' : 'Select'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Layout: Task Board (Left) & Global Live Activity Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-stone-700" />
              <span>Project Task Pipeline</span>
              {selectedProjectId !== 'ALL' && (
                <span className="text-xs font-normal text-stone-500">
                  (Filtered by: {projects.find((p) => p.id === selectedProjectId)?.title})
                </span>
              )}
            </h2>
          </div>
          <TaskBoard projectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined} />
        </div>

        {/* Global Live Activity Feed */}
        <div className="space-y-4">
          <ActivityFeed />
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
