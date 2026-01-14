import { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { HODDecisionModal } from '../components/modals/HODDecisionModal';
import { AlertCircle, FileCheck, PieChart, CheckCircle, FolderKanban } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CourseFolder {
  id: number;
  course_details?: { code?: string; title?: string };
  section: string;
  faculty_name?: string;
  status: string;
  submitted_at: string;
  convener_notes?: string;
  audit_report?: string;
}

export const HODDashboard = () => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<CourseFolder | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  
  // Capability-based coordinator module
  const canUseCoordinatorModule = !!user?.has_coordinator_access;
  const [coordinatorFolders, setCoordinatorFolders] = useState<CourseFolder[]>([]);

  const fetchCoordinatorFolders = async () => {
    if (!canUseCoordinatorModule) return;
    try {
      const response = await courseFoldersAPI.getAll({ assigned_to_me: 1 });
      const data = response.data;
      let foldersList: CourseFolder[] = [];
      if (Array.isArray(data)) {
        foldersList = data;
      } else if (data && Array.isArray(data.results)) {
        foldersList = data.results;
      }
      setCoordinatorFolders(foldersList);
    } catch (error) {
      console.error('Failed to fetch coordinator folders:', error);
      setCoordinatorFolders([]);
    }
  };

  useEffect(() => {
    fetchFolders();
    fetchCoordinatorFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const response = await courseFoldersAPI.getAll({ status: 'SUBMITTED_TO_HOD' });
      const foldersData = response.data?.results || response.data || [];
      setFolders(Array.isArray(foldersData) ? foldersData : []);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      'SUBMITTED_TO_HOD': { color: 'bg-blue-100 text-blue-800', label: 'Awaiting Your Decision' },
      'APPROVED_BY_HOD': { color: 'bg-green-100 text-green-800', label: 'Approved' },
      'REJECTED_BY_HOD': { color: 'bg-red-100 text-red-800', label: 'Rejected' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Show folders that need decision OR have been decided on (so HOD can change decision)
  const pendingFolders = folders.filter(f => 
    f.status === 'SUBMITTED_TO_HOD' || 
    f.status === 'APPROVED_BY_HOD' || 
    f.status === 'REJECTED_BY_HOD'
  );

  return (
    <DashboardLayout
      userRole="hod"
      userName={user?.full_name || 'Head of Department'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Header with University Background to match other roles */}
        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            backgroundImage: 'url(/background-image.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '220px',
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-primary/70" />

          {/* Profile Content */}
          <div className="relative z-10 flex flex-col items-center justify-center py-10 px-6 text-white">
            <div className="w-24 h-24 rounded-full bg-white overflow-hidden mb-4 border-4 border-white shadow-lg flex items-center justify-center">
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={user.full_name || 'Head of Department'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-primary">
                  {user?.full_name?.charAt(0) || 'H'}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold mb-1">{user?.full_name || 'Head of Department'}</h1>
            <p className="text-white/90 text-sm">Designation: HOD</p>
            <p className="text-white/80 text-xs mt-1">Final review and approval of course folders</p>
          </div>
        </div>

        {/* Coordinator Module (if enabled) */}
        {canUseCoordinatorModule && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <FolderKanban className="w-5 h-5 mr-2 text-indigo-600" />
                Course Coordinator
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                COORDINATOR ROLE
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pending Review</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">
                      {coordinatorFolders.filter(f => f.status === 'SUBMITTED').length}
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <Link to="/coordinator/review" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    Review Now →
                  </Link>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Approved</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">
                      {coordinatorFolders.filter(f => f.status === 'APPROVED_COORDINATOR').length}
                    </h3>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Returned</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">
                      {coordinatorFolders.filter(f => f.status === 'REJECTED_COORDINATOR').length}
                    </h3>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pending Decision Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Decision</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{pendingFolders.length}</h3>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded text-xs">Action Required</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-500">Awaiting approval</span>
            </div>
          </div>

          {/* Total Submitted Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Submitted</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{folders.length}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <FileCheck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded text-xs">Total</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-500">Forwarded to you</span>
            </div>
          </div>

          {/* Completion Rate Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Completion Rate</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">
                  {folders.length > 0 ? Math.round(((folders.length - pendingFolders.length) / folders.length) * 100) : 0}%
                </h3>
              </div>
              <div className="p-3 bg-violet-50 rounded-lg">
                <PieChart className="w-6 h-6 text-violet-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-violet-600 font-medium bg-violet-50 px-2 py-0.5 rounded text-xs">Rate</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-500">Reviewed vs Total</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading folders...</p>
          </div>
        ) : (
          <>
            {/* Pending Folders */}
            {pendingFolders.length > 0 ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-indigo-900">
                  📊 Folders for Final Decision ({pendingFolders.length})
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Review folders, make decisions, or change existing decisions
                </p>
                <div className="space-y-4">
                  {pendingFolders.map((folder) => (
                    <div key={folder.id} className="border-2 border-indigo-200 rounded-lg p-6 hover:bg-indigo-50 transition">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-bold text-xl text-indigo-900">
                            {folder.course_details?.code || folder.course_details?.title ? `${folder.course_details?.code || ''} - ${folder.course_details?.title || ''}` : 'Untitled Course'}
                          </h3>
                          <p className="text-gray-700 text-sm mt-1">Section: <span className="font-semibold">{folder.section}</span></p>
                          <p className="text-gray-700 text-sm">Faculty: <span className="font-semibold">{folder.faculty_name || 'Unknown'}</span></p>
                          <p className="text-gray-500 text-xs mt-2">
                            Submitted: {new Date(folder.submitted_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>

                          {/* Convener Notes */}
                          {folder.convener_notes && (
                            <div className="mt-3 bg-purple-50 border border-purple-200 rounded p-3">
                              <p className="text-xs font-semibold text-purple-900 mb-1">CONVENER'S NOTES:</p>
                              <p className="text-sm text-purple-800">{folder.convener_notes}</p>
                            </div>
                          )}

                          {/* Audit Report */}
                          {folder.audit_report && (
                            <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-3">
                              <p className="text-xs font-semibold text-blue-900 mb-1">AUDIT REPORT:</p>
                              <p className="text-sm text-blue-800">{folder.audit_report}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3 ml-4">
                          {getStatusBadge(folder.status)}
                          <button
                            onClick={() => {
                              setSelectedFolder(folder);
                              setShowDecisionModal(true);
                            }}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-semibold text-sm shadow-md transition"
                          >
                            {folder.status === 'APPROVED_BY_HOD' || folder.status === 'REJECTED_BY_HOD' ? 'Change Decision' : 'Make Decision'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-xl font-semibold text-gray-700">All folders reviewed!</p>
                <p className="text-gray-500 mt-2">No pending folders awaiting your decision</p>
              </div>
            )}
          </>
        )}

        {/* Decision Modal */}
        {selectedFolder && (
          <HODDecisionModal
            isOpen={showDecisionModal}
            onClose={() => {
              setShowDecisionModal(false);
              setSelectedFolder(null);
            }}
            folderId={selectedFolder.id}
            folderName={`${selectedFolder.course_details?.code || ''} - ${selectedFolder.section}`}
            onSuccess={fetchFolders}
          />
        )}
      </div>
    </DashboardLayout>
  );
};
