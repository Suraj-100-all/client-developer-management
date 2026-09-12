import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, User, AlertCircle } from 'lucide-react';
import type { Project, User as UserType, TaskPriority } from '../types.js';
import { api } from '../services/api.js';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  defaultProjectId?: string;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
  defaultProjectId,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [assignedToDevId, setAssignedToDevId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  // Default due date = 3 days from now
  const defaultDue = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState(defaultDue);

  const [projects, setProjects] = useState<Project[]>([]);
  const [developers, setDevelopers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Fetch available projects
      api.getProjects()
        .then((res) => {
          setProjects(res.projects);
          if (!projectId && res.projects.length > 0) {
            setProjectId(defaultProjectId || res.projects[0].id);
          }
        })
        .catch(() => {});

      // Fetch developers for assignment
      api.getUsers('DEVELOPER')
        .then((res) => {
          setDevelopers(res.users);
          if (res.users.length > 0 && !assignedToDevId) {
            setAssignedToDevId(res.users[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, defaultProjectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    if (!projectId) {
      setError('Please select a project');
      return;
    }
    if (!dueDate) {
      setError('Due date is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.createTask({
        title: title.trim(),
        description: description.trim(),
        projectId,
        assignedToDevId: assignedToDevId || undefined,
        priority,
        dueDate: new Date(dueDate).toISOString(),
      });
      setTitle('');
      setDescription('');
      onTaskCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-100">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Assign New Task</h3>
              <p className="text-[11px] text-stone-500">Creates DB Task & Triggers Real-time WebSocket Notification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Task Title *</label>
            <input
              id="new-task-title"
              type="text"
              placeholder="e.g. Build real-time order matching simulator"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">Target Project *</label>
              <select
                id="new-task-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white text-xs text-stone-800"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Assign Developer *</label>
              <select
                id="new-task-assignee"
                value={assignedToDevId}
                onChange={(e) => setAssignedToDevId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white text-xs text-stone-800"
              >
                <option value="">Unassigned</option>
                {developers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">Priority *</label>
              <select
                id="new-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white text-xs text-stone-800"
              >
                <option value="CRITICAL">Critical (P0)</option>
                <option value="HIGH">High (P1)</option>
                <option value="MEDIUM">Medium (P2)</option>
                <option value="LOW">Low (P3)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Due Date *</label>
              <input
                id="new-task-duedate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white text-xs text-stone-800"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Task Description / Acceptance Criteria</label>
            <textarea
              id="new-task-desc"
              rows={3}
              placeholder="Specify technical acceptance criteria, dependencies, or wireframes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white text-xs leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:bg-stone-100 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-create-task-btn"
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              {loading ? 'Creating Task...' : 'Assign & Dispatch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
