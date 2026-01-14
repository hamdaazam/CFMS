import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { HeroBanner } from '../components/common/HeroBanner';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle } from 'lucide-react';

export const AuditTeamDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignedCount, setAssignedCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const isAuditMember = user?.role === 'AUDIT_MEMBER';

  useEffect(() => {
    const load = async () => {
      try {
        // Pending assignments (not yet submitted by this auditor)
        const pendingRes = await courseFoldersAPI.getAll({ assigned_to_me: 1 });
        const pendingList: any[] = Array.isArray(pendingRes.data) ? pendingRes.data : (pendingRes.data?.results || []);
        setPendingCount(pendingList.length); // UNDER_AUDIT & not submitted

        // Active assignments (still in UNDER_AUDIT regardless of my own submission state)
        // We fetch all my assigned folders then filter by status to avoid counting completed audits.
        const allRes = await courseFoldersAPI.getAll({});
        const allList: any[] = Array.isArray(allRes.data) ? allRes.data : (allRes.data?.results || []);
        const activeUnderAudit = allList.filter(f => f.status === 'UNDER_AUDIT');
        setAssignedCount(activeUnderAudit.length);

        // Completed = my submitted audit reports (status after my submission may be AUDIT_COMPLETED or UNDER_AUDIT if others pending)
        const reportsRes = await courseFoldersAPI.getMyAuditReports({ submitted: 1 });
        const reports: any[] = Array.isArray(reportsRes.data) ? reportsRes.data : [];
        setCompletedCount(reports.length);
      } catch (e) {
        setAssignedCount(0); setCompletedCount(0); setPendingCount(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <DashboardLayout
      // Use faculty-first sidebar; audit links are included there for users with audit capability
      userRole="faculty"
      userName={user?.full_name || (isAuditMember ? 'Audit Member' : 'Auditor')}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        <HeroBanner>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-24 h-24 rounded-full bg-white overflow-hidden mb-4 border-4 border-white shadow-lg flex items-center justify-center">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt={user.full_name || 'Auditor'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-primary">{user?.full_name?.charAt(0) || 'A'}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-1">{user?.full_name || (isAuditMember ? 'Audit Member' : 'Auditor')}</h1>
            <p className="text-white/90 text-sm">Role: {isAuditMember ? 'AUDIT MEMBER' : (user?.role || 'AUDITOR')}</p>
            <p className="text-white/80 text-xs mt-1">Review assigned course folders and submit audit feedback</p>
          </div>
        </HeroBanner>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assigned Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Assigned Folders</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{loading ? '...' : assignedCount}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded text-xs">Active</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-500">Currently assigned</span>
            </div>
          </div>

          {/* Under Audit Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Under Audit</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{loading ? '...' : pendingCount}</h3>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <Clock className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded text-xs">Pending</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-500">Awaiting report</span>
            </div>
          </div>

          {/* Completed Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{loading ? '...' : completedCount}</h3>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded text-xs">Done</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-500">Audit cycle finished</span>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="bg-white rounded-lg shadow-md p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Audit Reports</h3>
            <p className="text-sm text-gray-600 mb-4">Review your submitted reports and their status.</p>
            <button onClick={() => navigate('/audit-member/reports')} className="mt-auto w-full bg-coral text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors">
              View Reports
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
