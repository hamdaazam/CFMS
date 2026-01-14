import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'ADMIN' | 'CONVENER' | 'COORDINATOR' | 'SUPERVISOR' | 'EVALUATOR' | 'STUDENT' | 'FACULTY' | 'HOD' | 'AUDIT_TEAM' | 'AUDIT_MEMBER'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const normalized = user.role.trim().toUpperCase();
    const allowed = allowedRoles.some(role => role.toUpperCase() === normalized);

    // Multi-role support (lightweight):
    // Users with role AUDIT_MEMBER should still be able to access Faculty routes because they can also be teaching faculty.
    const auditMemberAsFaculty = normalized === 'AUDIT_MEMBER' && allowedRoles.some(r => r.toUpperCase() === 'FACULTY');

    // Capability-based access:
    // If backend marks this user as having audit access, allow them through audit-member protected routes
    // even if their primary role is FACULTY/CONVENER/COORDINATOR/etc.
    const hasAuditAccess = !!(user as any)?.has_audit_access;
    const auditAccessAllowed = hasAuditAccess && allowedRoles.some(r => r.toUpperCase() === 'AUDIT_MEMBER');

    // If backend marks this user as having coordinator access, allow them through COORDINATOR protected routes
    // (used for coordinator review pages).
    const hasCoordinatorAccess = !!(user as any)?.has_coordinator_access;
    const coordinatorAccessAllowed = hasCoordinatorAccess && allowedRoles.some(r => r.toUpperCase() === 'COORDINATOR');

    if (!allowed && !auditMemberAsFaculty && !auditAccessAllowed && !coordinatorAccessAllowed) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};
