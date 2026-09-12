import React, { useState, useEffect } from 'react';
import {
  Code2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority } from '../types.js';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { TaskBoard } from './TaskBoard.js';
import { ActivityFeed } from './ActivityFeed.js';

export const DeveloperDashboard: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      // API strictly returns only tasks assigned to current developer!
      const res = await api.getTasks();
      setTasks(res.tasks);
    } catch (err) {
      console.error('Failed to load developer dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, accessToken]);

  const todoTasks = tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const inReviewTasks = tasks.filter((t) => t.status === 'IN_REVIEW');
  const doneTasks = tasks.filter((t) => t.status === 'DONE');
  const overdueTasks = tasks.filter((t) => t.isOverdue || (new Date(t.dueDate) < new Date() && t.status !== 'DONE'));

  return (
    <div className="space-y-6" id="developer-dashboard-view">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
              Developer Workspace
            </span>
            <span className="text-xs text-stone-500 font-medium">
              Assigned Queue: {tasks.length} Tasks
            </span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 mt-1">
            Developer Workspace: {user?.name}
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Focused task queue assigned to you. Move task status as you make progress.
          </p>
        </div>
      </div>

      {/* Developer Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-500">In Progress</span>
            <div className="text-xl font-bold text-blue-600 mt-0.5">{inProgressTasks.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            {inProgressTasks.length}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-500">Awaiting Review</span>
            <div className="text-xl font-bold text-amber-600 mt-0.5">{inReviewTasks.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
            {inReviewTasks.length}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-500">Completed</span>
            <div className="text-xl font-bold text-emerald-600 mt-0.5">{doneTasks.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
            {doneTasks.length}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-stone-500">Overdue Alerts</span>
            <div className="text-xl font-bold text-rose-600 mt-0.5">{overdueTasks.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
            {overdueTasks.length}
          </div>
        </div>
      </div>

      {/* Main Layout: Task Board (Left) & Personal Live Activity Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-600" />
              <span>My Assigned Tasks</span>
            </h2>
            <span className="text-xs text-stone-400">
              Advance tasks to "In Review" to trigger real-time PM notification
            </span>
          </div>

          <TaskBoard />
        </div>

        {/* Right: Personal Live Activity Feed (Only tasks assigned to this dev) */}
        <div className="space-y-4">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};
