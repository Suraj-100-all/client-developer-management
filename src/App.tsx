/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { PMDashboard } from './components/PMDashboard.js';
import { DeveloperDashboard } from './components/DeveloperDashboard.js';
import { RoleOverviewBanner } from './components/RoleOverviewBanner.js';

function DashboardContent() {
  const { role, user, isLoading, accessToken } = useAuth();

  if (isLoading || !user || !accessToken) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center space-y-3 p-8 bg-white rounded-2xl border border-stone-200 shadow-sm max-w-sm">
          <div className="w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="font-semibold text-stone-900 text-sm">Loading Workspace...</h3>
          <p className="text-xs text-stone-500">
            Connecting to real-time events and services.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans antialiased">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Body: Render Dashboard Based on Authenticated User Role */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Workspace Role Switcher */}
        <RoleOverviewBanner />

        {role === 'ADMIN' && <AdminDashboard />}
        {role === 'PROJECT_MANAGER' && <PMDashboard />}
        {role === 'DEVELOPER' && <DeveloperDashboard />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-auto py-5 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-stone-900 text-white flex items-center justify-center font-bold text-[10px]">
              V
            </div>
            <span className="font-medium text-stone-700">Velozity Client Operations</span>
            <span>·</span>
            <span>Enterprise Workspace</span>
          </div>

          <div className="flex items-center gap-4 text-stone-500 text-[11px]">
            <span>Real-Time Engine Active</span>
            <span>·</span>
            <span>© 2026 Velozity Systems</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
