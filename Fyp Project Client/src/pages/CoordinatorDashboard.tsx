import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { ClipboardList, CheckCircle, AlertTriangle, X } from 'lucide-react';

export const CoordinatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [showApprovedModal, setShowApprovedModal] = useState(false);
  const [showAllFoldersModal, setShowAllFoldersModal] = useState(false);
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, number | string> = { assigned_to_me: 1 };
      // Don't filter by program - coordinator assignments are course-based, not program-based
      const response = await courseFoldersAPI.getAll(params as any);
      const items = Array.isArray(response.data) ? response.data : response.data.results || [];
      
      // Filter out folders that are assigned for audit (UNDER_AUDIT status or have assigned_auditors)
      // These should only appear in audit member review, not coordinator review
      // Note: Dashboard shows all folders (including APPROVED_BY_HOD) for counts and modals
      // The CoordinatorReview page filters out APPROVED_BY_HOD folders
      const coordinatorFolders = items.filter((folder: any) => {
        // Exclude folders that are under audit
        if (folder.status === 'UNDER_AUDIT' || folder.status === 'AUDIT_COMPLETED') {
          return false;
        }
        // Exclude folders that have audit assignments (even if status hasn't changed yet)
        if (folder.assigned_auditors && folder.assigned_auditors.length > 0) {
          return false;
        }
        return true;
      });
      
      setFolders(coordinatorFolders);
    } catch (e: unknown) {
      console.error('Failed to load dashboard data', e);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.program]);

  const counts = useMemo(() => {
    const pending = folders.filter((f) => f.status === 'SUBMITTED').length;
    // Include both APPROVED_COORDINATOR and APPROVED_BY_HOD in approved count
    const approved = folders.filter((f) => f.status === 'APPROVED_COORDINATOR' || f.status === 'APPROVED_BY_HOD').length;
    const returned = folders.filter((f) => f.status === 'REJECTED_COORDINATOR').length;
    // Show all folders including those with final decision
    const total = folders.length;
    return { total, pending, approved, returned };
  }, [folders]);

  const approvedFolders = useMemo(() => {
    return folders.filter((f) => f.status === 'APPROVED_COORDINATOR' || f.status === 'APPROVED_BY_HOD');
  }, [folders]);

  return (
    <DashboardLayout
      userRole="coordinator"
      userName={user?.full_name || 'Coordinator'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Header with University Background */}
        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            backgroundImage: 'url(/background-image.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '220px',
          }}
        >
          <div className="absolute inset-0 bg-primary/70" />

          <div className="relative z-10 flex flex-col items-center justify-center py-10 px-6">
            <div className="w-24 h-24 rounded-full bg-white overflow-hidden mb-4 border-4 border-white shadow-lg">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt={user.full_name || 'Coordinator'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary text-4xl font-bold">
                  {user?.full_name?.charAt(0) || 'C'}
                </div>
              )}
            </div>
            <h2 className="text-3xl font-bold text-white">{user?.full_name || 'Coordinator'}</h2>
            {user?.program_name && (
              <p className="text-white/80 text-sm mt-1">Program: {user.program_name}</p>
            )}
          </div>
        </div>

        {/* Dashboard Cards - neutral UI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Pending Review</h3>
                <p className="mt-2 text-3xl font-bold text-slate-800">{counts.pending}</p>
              </div>
              <div className="p-3 rounded-full bg-slate-50 text-slate-700">
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>
            
          </div>

          <button
            onClick={() => setShowApprovedModal(true)}
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Approved</h3>
                <p className="mt-2 text-3xl font-bold text-slate-800">{counts.approved}</p>
              </div>
              <div className="p-3 rounded-full bg-slate-50 text-green-700">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
          </button>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Returned</h3>
                <p className="mt-2 text-3xl font-bold text-slate-800">{counts.returned}</p>
              </div>
              <div className="p-3 rounded-full bg-slate-50 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Totals - Interactive */}
        <button
          onClick={() => setShowAllFoldersModal(true)}
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Total folders assigned to you</p>
            <p className="text-2xl font-bold text-slate-800">{counts.total}</p>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {loading && (
            <div className="mt-3 text-sm text-gray-600">Loading…</div>
          )}
          {!loading && folders.length > 0 && (
            <p className="mt-3 text-xs text-gray-500">Click to view all folders →</p>
          )}
        </button>

        {/* All Folders Modal */}
        {showAllFoldersModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">All Folders Assigned to You</h2>
                <button
                  onClick={() => setShowAllFoldersModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-y-auto p-6 flex-1">
                {folders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No folders assigned</p>
                ) : (
                  <div className="space-y-3">
                    {folders.map((folder) => {
                      const getStatusBadge = (status: string) => {
                        if (status === 'SUBMITTED') {
                          return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">Pending Review</span>;
                        } else if (status === 'APPROVED_COORDINATOR') {
                          return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Approved by Coordinator</span>;
                        } else if (status === 'APPROVED_BY_HOD') {
                          return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">Approved by HOD (Final)</span>;
                        } else if (status === 'REJECTED_COORDINATOR') {
                          return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Returned</span>;
                        }
                        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">{status}</span>;
                      };

                      return (
                        <div
                          key={folder.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">
                                {folder.course_details?.title || folder.course?.title || folder.course_title || 'Folder'}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {folder.course_details?.code || folder.course?.code || folder.course_code || ''} - Section {folder.section}
                              </p>
                              <div className="mt-2">
                                {getStatusBadge(folder.status)}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setShowAllFoldersModal(false);
                                navigate(`/coordinator/folder/${folder.id}/title-page?review=1`);
                              }}
                              className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                            >
                              View Folder
                            </button>
                          </div>
                          {folder.status === 'APPROVED_COORDINATOR' && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <button
                                onClick={() => {
                                  setShowAllFoldersModal(false);
                                  navigate(`/coordinator/folder/${folder.id}/decision?review=1`);
                                }}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                              >
                                Change Decision →
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approved Folders Modal */}
        {showApprovedModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Approved Folders</h2>
                <button
                  onClick={() => setShowApprovedModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-y-auto p-6 flex-1">
                {approvedFolders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No approved folders</p>
                ) : (
                  <div className="space-y-3">
                    {approvedFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {folder.course_details?.title || folder.course?.title || folder.course_title || 'Folder'}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {folder.course_details?.code || folder.course?.code || folder.course_code || ''} - Section {folder.section}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Status: {folder.status === 'APPROVED_BY_HOD' ? 'Approved by HOD (Final)' : 'Approved by Coordinator'}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setShowApprovedModal(false);
                              navigate(`/coordinator/folder/${folder.id}/title-page?review=1`);
                            }}
                            className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                          >
                            View Folder
                          </button>
                        </div>
                        {folder.status === 'APPROVED_COORDINATOR' && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <button
                              onClick={() => {
                                setShowApprovedModal(false);
                                navigate(`/coordinator/folder/${folder.id}/decision?review=1`);
                              }}
                              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              Change Decision →
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
