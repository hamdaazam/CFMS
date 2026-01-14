import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * RoleBasedRedirect Component
 * Automatically redirects users to their role-specific dashboard
 * Used for the root "/" route and after login
 */
export const RoleBasedRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4F7FE' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  switch (user.role) {
    case 'ADMIN':
      return <Navigate to="/admin/dashboard" replace />;

    case 'HOD':
      return <Navigate to="/hod/dashboard" replace />;

    case 'CONVENER':
      return <Navigate to="/convener/dashboard" replace />;

    case 'COORDINATOR':
      return <Navigate to="/coordinator/dashboard" replace />;

    case 'FACULTY':
      return <Navigate to="/faculty/dashboard" replace />;

    case 'EVALUATOR':
    case 'AUDIT_TEAM':
      return <Navigate to="/evaluator/dashboard" replace />;
    case 'AUDIT_MEMBER':
      // Audit members can also be faculty/other roles in practice.
      // Prefer sending them to the Faculty dashboard so they don't lose teaching-folder features,
      // while still allowing them to access Audit Member pages from the sidebar.
      return <Navigate to="/faculty/dashboard" replace />;

    default:
      // Fallback to login for unknown roles
      return <Navigate to="/login" replace />;
  }
};

/**
 * Hook to get the dashboard path for a user's role
 */
export const useDashboardPath = (): string => {
  const { user } = useAuth();

  if (!user) return '/login';

  const dashboardPaths: Record<string, string> = {
    'ADMIN': '/admin/dashboard',
    'HOD': '/hod/dashboard',
    'CONVENER': '/convener/dashboard',
    'COORDINATOR': '/coordinator/dashboard',
    'FACULTY': '/faculty/dashboard',
    'EVALUATOR': '/evaluator/dashboard',
    'AUDIT_TEAM': '/evaluator/dashboard',
    'AUDIT_MEMBER': '/faculty/dashboard',
  };

  return dashboardPaths[user.role] || '/login';
};

/**
 * Hook to get the profile path for a user's role
 */
export const useProfilePath = (): string => {
  const { user } = useAuth();

  if (!user) return '/login';

  const profilePaths: Record<string, string> = {
    'ADMIN': '/admin/profile',
    'HOD': '/hod/profile',
    'CONVENER': '/convener/profile',
    'COORDINATOR': '/coordinator/profile',
    'FACULTY': '/faculty/profile',
    'EVALUATOR': '/evaluator/profile',
    'AUDIT_TEAM': '/evaluator/profile',
    'AUDIT_MEMBER': '/faculty/profile',
  };

  return profilePaths[user.role] || '/login';
};
