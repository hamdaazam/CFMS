import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authAPI } from '../services/api';

interface User {
  id: number;
  cnic: string;
  email?: string;
  full_name: string;
  role: 'ADMIN' | 'CONVENER' | 'COORDINATOR' | 'FACULTY' | 'SUPERVISOR' | 'EVALUATOR' | 'STUDENT' | 'HOD' | 'AUDIT_TEAM' | 'AUDIT_MEMBER';
  role_display: string;
  department?: number;
  department_name?: string;
  program?: number;
  program_name?: string;
  is_active: boolean;
  date_joined: string;
  profile_picture?: string | null;
  // Capability flags (computed by backend)
  has_audit_access?: boolean;
  has_coordinator_access?: boolean;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  login: (identifier: string, password: string, method?: 'cnic' | 'email') => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const refreshMe = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await authAPI.getCurrentUser();
        const userData = res.data as User;
        if (!mounted) return;
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      } catch {
        // ignore; keep existing cached user
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Load stored user immediately for snappy UI, then refresh from /auth/me
    // so capability flags (has_audit_access / has_coordinator_access) stay up-to-date.
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setLoading(false); // Don't wait for API call if we have cached user
      } catch {
        // ignore corrupted cache
        setUser(null);
        setLoading(false);
      }
    } else {
      setLoading(false); // No cached user, set loading to false immediately
    }

    // Refresh user data in background (non-blocking)
    refreshMe();

    // When conveners assign audit/coordinator work, other users need to pick up new capabilities.
    // We already broadcast `foldersUpdated` in the UI; use it to refresh /auth/me automatically.
    const onFoldersUpdated = () => { refreshMe(); };
    window.addEventListener('foldersUpdated', onFoldersUpdated as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('foldersUpdated', onFoldersUpdated as EventListener);
    };
  }, []);

  const login = async (identifier: string, password: string, method: 'cnic' | 'email' = 'cnic') => {
    try {
      const payload = method === 'cnic' ? { cnic: identifier, password } : { email: identifier, password };
      const response = await authAPI.login(payload);
      const { user: userData, access, refresh } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authAPI.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
