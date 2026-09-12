import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Building } from 'lucide-react';
import type { Client } from '../types.js';
import { api } from '../services/api.js';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getClients()
        .then((res) => {
          setClients(res.clients);
          if (res.clients.length > 0 && !clientId) {
            setClientId(res.clients[0].id);
          }
        })
        .catch(() => {});
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required');
      return;
    }
    if (!clientId) {
      setError('Please select a client');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.createProject({
        title: title.trim(),
        description: description.trim(),
        clientId,
      });
      setTitle('');
      setDescription('');
      onProjectCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-100">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-stone-900 text-white rounded-lg">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Create New Project</h3>
              <p className="text-[11px] text-stone-500">Admin & PM Permission Protected</p>
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
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Project Title *</label>
            <input
              id="new-project-title"
              type="text"
              placeholder="e.g. NextGen Cloud POS System"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Client *</label>
            <div className="relative">
              <select
                id="new-project-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white text-xs text-stone-800"
                required
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Project Scope / Description</label>
            <textarea
              id="new-project-desc"
              rows={3}
              placeholder="Describe deliverables, architecture, key milestone objectives..."
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
              id="submit-create-project-btn"
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              {loading ? 'Creating Project...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
