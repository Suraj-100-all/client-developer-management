import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Role } from '../types.js';
import { api, setAccessToken, setRefreshToken } from '../services/api.js';
import { wsClient } from '../services/websocket.js';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  accessToken: string | null;
  isLoading: boolean;
  onlineCount: number;
  onlineUserIds: string[];
  isWsConnected: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  availableUsers: User[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial default seed accounts for quick testing
export const SEED_ACCOUNTS = [
  { id: 'usr-admin-1', name: 'Alex Morgan', role: 'ADMIN', email: 'admin@velozity.com', label: 'Admin (Full Access)' },
  { id: 'usr-pm-1', name: 'Sarah Jenkins', role: 'PROJECT_MANAGER', email: 'pm.sarah@velozity.com', label: 'PM 1 (Fintech & LogiTrack)' },
  { id: 'usr-pm-2', name: 'Marcus Vance', role: 'PROJECT_MANAGER', email: 'pm.marcus@velozity.com', label: 'PM 2 (HealthSync & AeroSky)' },
  { id: 'usr-dev-1', name: 'Ravi Kumar', role: 'DEVELOPER', email: 'dev.ravi@velozity.com', label: 'Dev 1 (Ravi - Senior Dev)' },
  { id: 'usr-dev-2', name: 'Elena Rostova', role: 'DEVELOPER', email: 'dev.elena@velozity.com', label: 'Dev 2 (Elena - Frontend)' },
  { id: 'usr-dev-3', name: 'Alex Chen', role: 'DEVELOPER', email: 'dev.alex@velozity.com', label: 'Dev 3 (Alex - Backend)' },
  { id: 'usr-dev-4', name: 'Priya Patel', role: 'DEVELOPER', email: 'dev.priya@velozity.com', label: 'Dev 4 (Priya - React)' },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('velozity_user');
        return saved ? JSON.parse(saved) : null;
      } catch {}
    }
    return null;
  });
  const [accessToken, setAccessTokenState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('velozity_access_token');
      } catch {}
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(1);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  const handleAuthSuccess = useCallback((newUser: User, token: string, refreshToken?: string) => {
    setUser(newUser);
    setAccessTokenState(token);
    setAccessToken(token);
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('velozity_user', JSON.stringify(newUser));
        localStorage.setItem('velozity_access_token', token);
      } catch {}
    }
    wsClient.connect(token);
  }, []);

  // Initialize session: verify existing session, try refresh or default to Admin seed account
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // If we have saved credentials, proactively verify them before completing load
      if (accessToken && user) {
        try {
          const meRes = await api.getCurrentUser();
          if (isMounted) {
            handleAuthSuccess(meRes.user, accessToken);
            setIsLoading(false);
            return;
          }
        } catch {
          // Access token might have expired - attempt refresh
          try {
            const refreshData = await api.refresh();
            if (isMounted) {
              handleAuthSuccess(refreshData.user, refreshData.accessToken, refreshData.refreshToken);
              setIsLoading(false);
              return;
            }
          } catch {
            // Refresh failed or invalid session
          }
        }
      }

      // If no valid session or session verification failed, re-authenticate smoothly
      try {
        const fallbackEmail = user?.email || 'admin@velozity.com';
        const loginData = await api.login(fallbackEmail, 'Password123!');
        if (isMounted) {
          handleAuthSuccess(loginData.user, loginData.accessToken, loginData.refreshToken);
        }
      } catch {
        // Fallback to default admin seed account
        try {
          const loginData = await api.login('admin@velozity.com', 'Password123!');
          if (isMounted) {
            handleAuthSuccess(loginData.user, loginData.accessToken, loginData.refreshToken);
          }
        } catch (err) {
          console.error('[Auth] Initial login fallback failed:', err);
          // Ultimate fallback: initialize session with primary Admin persona so user is never stuck
          if (isMounted && !user) {
            const defaultAdmin = SEED_ACCOUNTS[0];
            handleAuthSuccess({
              id: defaultAdmin.id,
              email: defaultAdmin.email,
              name: defaultAdmin.name,
              role: defaultAdmin.role as any,
              avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80',
              createdAt: new Date().toISOString(),
            }, 'demo-session-token');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen to WebSocket presence updates
    const unsubPresence = wsClient.on('presence:update', (msg: any) => {
      if (msg.payload) {
        if (typeof msg.payload.onlineCount === 'number') {
          setOnlineCount(msg.payload.onlineCount);
        }
        if (Array.isArray(msg.payload.onlineUserIds)) {
          setOnlineUserIds(msg.payload.onlineUserIds);
        }
      }
    });

    const unsubStatus = wsClient.onStatusChange((connected) => {
      setIsWsConnected(connected);
    });

    return () => {
      isMounted = false;
      unsubPresence();
      unsubStatus();
    };
  }, [handleAuthSuccess]);

  // Fetch available users list for quick switchers and assignments
  useEffect(() => {
    if (accessToken) {
      api.getUsers().then((res) => {
        setAvailableUsers(res.users);
      }).catch(() => {});
    }
  }, [accessToken]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.login(email, password);
      handleAuthSuccess(data.user, data.accessToken, data.refreshToken);
    } finally {
      setIsLoading(false);
    }
  };

  const switchUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const data = await api.switchUser(userId);
      handleAuthSuccess(data.user, data.accessToken, data.refreshToken);
    } catch {
      const seed = SEED_ACCOUNTS.find((s) => s.id === userId);
      if (seed) {
        handleAuthSuccess({
          id: seed.id,
          email: seed.email,
          name: seed.name,
          role: seed.role as any,
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
        }, 'demo-session-token');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('velozity_user');
        localStorage.removeItem('velozity_access_token');
        localStorage.removeItem('velozity_refresh_token');
      } catch {}
    }
    setUser(null);
    setAccessTokenState(null);
    setAccessToken(null);
    setRefreshToken(null);
    wsClient.disconnect();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        accessToken,
        isLoading,
        onlineCount,
        onlineUserIds,
        isWsConnected,
        login,
        logout,
        switchUser,
        availableUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
