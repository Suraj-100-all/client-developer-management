import React, { useState } from 'react';
import {
  Shield,
  FolderKanban,
  Code2,
  ChevronDown,
  User,
} from 'lucide-react';
import { useAuth, SEED_ACCOUNTS } from '../context/AuthContext.js';

export const RoleOverviewBanner: React.FC = () => {
  const { user, role, switchUser } = useAuth();
  const [showMoreUsers, setShowMoreUsers] = useState(false);

  // Key primary roles for 1-click persona switching
  const primaryRoles = [
    {
      id: 'usr-admin-1',
      role: 'ADMIN',
      title: 'Admin',
      name: 'SRJ Developer',
      subtitle: 'System Admin',
      icon: Shield,
      activeColor: 'bg-purple-600 text-white shadow-xs',
      inactiveColor: 'bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200',
    },
    {
      id: 'usr-pm-1',
      role: 'PROJECT_MANAGER',
      title: 'Project Manager',
      name: 'Saroj',
      subtitle: 'Project Lead',
      icon: FolderKanban,
      activeColor: 'bg-blue-600 text-white shadow-xs',
      inactiveColor: 'bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200',
    },
    {
      id: 'usr-dev-1',
      role: 'DEVELOPER',
      title: 'Developer',
      name: 'Ravi Kumar',
      subtitle: 'Lead Developer',
      icon: Code2,
      activeColor: 'bg-emerald-600 text-white shadow-xs',
      inactiveColor: 'bg-stone-50 text-stone-700 hover:bg-stone-100 border-stone-200',
    },
  ];

  const secondaryAccounts = SEED_ACCOUNTS.filter(
    (acc) => !['usr-admin-1', 'usr-pm-1', 'usr-dev-1'].includes(acc.id)
  );

  return (
    <div className="mb-6" id="workspace-persona-bar">
      <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Persona selector tabs */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider pl-1 pr-2 hidden sm:inline">
              Workspace Role:
            </span>
            <div className="grid grid-cols-3 gap-1.5 flex-1 sm:flex-none">
              {primaryRoles.map((item) => {
                const isSelected =
                  user?.id === item.id ||
                  (role === item.role &&
                    !['usr-pm-2', 'usr-dev-2', 'usr-dev-3', 'usr-dev-4'].includes(user?.id || ''));
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    id={`role-tab-${item.role.toLowerCase()}`}
                    onClick={() => switchUser(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? item.activeColor + ' border-transparent'
                        : item.inactiveColor
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <div className="text-left min-w-0">
                      <span className="font-semibold block truncate">{item.title}</span>
                      <span className={`text-[10px] block truncate ${isSelected ? 'text-white/80' : 'text-stone-400'}`}>
                        {item.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right side: Secondary team members & active scope badge */}
          <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-100">
            {/* Active scope description */}
            <div className="text-xs text-stone-500 hidden md:block">
              {role === 'ADMIN' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg font-medium border border-purple-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Organization-Wide Access (All Projects)
                </span>
              )}
              {role === 'PROJECT_MANAGER' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium border border-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Project Scope: {user?.name}'s Projects
                </span>
              )}
              {role === 'DEVELOPER' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-medium border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Queue Scope: Assigned to {user?.name}
                </span>
              )}
            </div>

            {/* Other Team Members Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoreUsers(!showMoreUsers)}
                className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 flex items-center gap-1.5 transition-colors"
                title="Switch to other team members"
              >
                <User className="w-3.5 h-3.5 text-stone-400" />
                <span>Switch Member</span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {showMoreUsers && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-stone-200 z-50 p-2 divide-y divide-stone-100">
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    All Team Members
                  </div>
                  <div className="py-1 space-y-1">
                    {secondaryAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          switchUser(acc.id);
                          setShowMoreUsers(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          user?.id === acc.id
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-stone-900">{acc.name}</div>
                          <div className="text-[10px] text-stone-400">{acc.label}</div>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                          {acc.role === 'PROJECT_MANAGER' ? 'PM' : 'Dev'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
