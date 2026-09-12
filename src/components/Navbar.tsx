import React, { useState } from 'react';
import {
  Users,
  Radio,
  ChevronDown,
  Layers,
  UserCheck,
} from 'lucide-react';
import { useAuth, SEED_ACCOUNTS } from '../context/AuthContext.js';
import { NotificationsDropdown } from './NotificationsDropdown.js';

interface NavbarProps {
  onOpenSecurityAudit?: () => void;
  onOpenReferenceDoc?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, role, switchUser, onlineCount, onlineUserIds, isWsConnected, availableUsers } = useAuth();
  const [showPresenceTooltip, setShowPresenceTooltip] = useState(false);
  const [showSwitchDropdown, setShowSwitchDropdown] = useState(false);

  const getRoleBadge = (userRole?: string) => {
    switch (userRole) {
      case 'ADMIN':
        return <span className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-800 rounded-full border border-purple-200">Admin</span>;
      case 'PROJECT_MANAGER':
        return <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full border border-blue-200">PM</span>;
      case 'DEVELOPER':
        return <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">Developer</span>;
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Layers className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 text-base tracking-tight">Velozity</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                  Operations
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">Client Projects & Engineering Management</p>
            </div>
          </div>

          {/* Center: Live Presence & WebSocket Status */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            {/* WS Live status */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-full">
              <span className="relative flex h-2 w-2">
                {isWsConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                )}
              </span>
              <span className="font-medium text-stone-700 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-stone-400" />
                {isWsConnected ? 'Live Connection' : 'Offline'}
              </span>
            </div>

            {/* Active Users Online Count (Live WebSocket Presence) */}
            <div
              className="relative cursor-pointer"
              onMouseEnter={() => setShowPresenceTooltip(true)}
              onMouseLeave={() => setShowPresenceTooltip(false)}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full font-semibold">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>{onlineCount} Online</span>
              </div>

              {showPresenceTooltip && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-stone-900 text-white text-xs rounded-lg p-3 shadow-xl z-50 pointer-events-none">
                  <div className="font-semibold text-stone-200 mb-1 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-400" /> Active Team Sessions ({onlineCount})
                  </div>
                  <p className="text-stone-400 text-[11px] leading-tight">
                    Real-time presence tracked through active WebSocket connections.
                  </p>
                  <div className="mt-2 space-y-1">
                    {onlineUserIds.map((uid) => {
                      const u = availableUsers.find((x) => x.id === uid) || SEED_ACCOUNTS.find((x) => x.id === uid);
                      return (
                        <div key={uid} className="flex items-center gap-1.5 text-stone-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span className="truncate">{u?.name || uid}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Section: Account Switcher, Notifications */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Account Switcher Dropdown */}
            <div className="relative">
              <button
                id="role-switcher-toggle"
                onClick={() => setShowSwitchDropdown(!showSwitchDropdown)}
                className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 rounded-lg text-xs transition-colors cursor-pointer"
                title="Switch active user profile"
              >
                <div className="flex items-center gap-2 text-left">
                  <img
                    src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'}
                    alt={user?.name}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-stone-300"
                  />
                  <div className="hidden sm:block">
                    <div className="font-semibold text-stone-900 leading-tight flex items-center gap-1">
                      {user?.name}
                    </div>
                  </div>
                </div>
                {getRoleBadge(role || undefined)}
                <ChevronDown className="w-3.5 h-3.5 text-stone-500 ml-1" />
              </button>

              {showSwitchDropdown && (
                <div
                  id="role-switcher-dropdown"
                  className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-stone-200 z-50 p-2 divide-y divide-stone-100"
                >
                  <div className="px-3 py-2 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Switch Active Account
                  </div>
                  <div className="py-1 space-y-1">
                    {SEED_ACCOUNTS.map((acc) => {
                      const isCurrent = user?.id === acc.id;
                      return (
                        <button
                          key={acc.id}
                          id={`switch-to-${acc.id}`}
                          onClick={() => {
                            switchUser(acc.id);
                            setShowSwitchDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-blue-50 text-blue-900 font-semibold'
                              : 'hover:bg-stone-100 text-stone-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span>{acc.name}</span>
                              {isCurrent && <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </div>
                            <div className="text-[11px] text-stone-400 truncate">{acc.label}</div>
                          </div>
                          {getRoleBadge(acc.role)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Dropdown */}
            <NotificationsDropdown />
          </div>
        </div>
      </div>
    </header>
  );
};
