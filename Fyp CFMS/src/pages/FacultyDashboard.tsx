import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { StatsCard } from '../components/common/StatsCard';
import { useAuth } from '../context/AuthContext';
import { courseAllocationsAPI, courseFoldersAPI, facultyAPI } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

interface CourseAllocation {
  id: number;
  course_details: {
    id?: number;
    code?: string;
    title: string;
  };
  section: string;
  department_details: {
    name: string;
  };
  program_details?: {
    title: string;
  } | null;
}

interface FacultyProfile {
  faculty_id: number;
  user_details: {
    id: number;
    full_name: string;
    email: string;
    cnic: string;
    role: string;
    profile_picture?: string;
  };
  department_details: {
    department_id: number;
    name: string;
    code: string;
  };
  program_details?: {
    program_id: number;
    name: string;
    code: string;
  } | null;
  designation: string;
  phone?: string;
  address?: string;
  date_of_joining?: string;
  qualification?: string;
  specialization?: string;
  is_active: boolean;
}

interface CourseFolderSummary {
  id: number;
  course_details?: {
    code?: string;
    title?: string;
  };
  section: string;
  department_name?: string;
  program_name?: string | null;
  status?: string;
  status_display?: string;
  created_at: string;
}

const formatStatusLabel = (statusCode: string) =>
  statusCode
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

const extractList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)) {
    return ((payload as { results?: unknown[] }).results as T[]) ?? [];
  }

  return [];
};

const PENDING_STATUSES = [
  'SUBMITTED',
  'APPROVED_COORDINATOR',
  'ASSIGNED_TO_CONVENER',
  'UNDER_AUDIT',
  'AUDIT_COMPLETED',
  'SUBMITTED_TO_HOD',
  'REJECTED_COORDINATOR', // Folder rejected by coordinator - faculty needs to fix and resubmit
  'REJECTED_BY_CONVENER', // Folder rejected by convener - faculty needs to fix and resubmit
  'REJECTED_BY_HOD', // Folder rejected by HOD - faculty needs to fix and resubmit
] as const;

const ACCEPTED_STATUSES = ['APPROVED_BY_HOD'] as const;

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  const [profileData, setProfileData] = useState<FacultyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [folders, setFolders] = useState<CourseFolderSummary[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [folderError, setFolderError] = useState<string | null>(null);

  // Capability-based audit module (user can keep FACULTY role but still audit)
  const canUseAuditModule = user?.role === 'AUDIT_MEMBER' || !!user?.has_audit_access;
  const [auditAssignedCount, setAuditAssignedCount] = useState<number>(0);
  const [auditCompletedCount, setAuditCompletedCount] = useState<number>(0);

  // Capability-based coordinator module (user can keep FACULTY role but still be a coordinator)
  const canUseCoordinatorModule = !!user?.has_coordinator_access;
  const [coordinatorFolders, setCoordinatorFolders] = useState<any[]>([]);
  const [coordinatorLoading, setCoordinatorLoading] = useState(false);

  const fetchMyCourses = async () => {
    try {
      setLoading(true);
      const response = await courseAllocationsAPI.getMyCourses();
      setAllocations(extractList<CourseAllocation>(response.data));
    } catch (err) {
      console.error('Error fetching course allocations:', err);
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileData = async () => {
    try {
      setProfileLoading(true);
      const response = await facultyAPI.getMyProfile();
      setProfileData(response.data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchMyFolders = async () => {
    try {
      setFoldersLoading(true);
      setFolderError(null);
      const response = await courseFoldersAPI.getMyFolders();
      setFolders(extractList<CourseFolderSummary>(response.data));
    } catch (err) {
      console.error('Error fetching folders:', err);
      setFolderError('Failed to load folder data.');
      setFolders([]);
    } finally {
      setFoldersLoading(false);
    }
  };

  const fetchAuditSummary = async () => {
    if (!canUseAuditModule) return;
    try {
      const pendingRes = await courseFoldersAPI.getAll({ assigned_to_me: 1 });
      const pendingList: any[] = extractList<any>(pendingRes.data);
      setAuditAssignedCount(pendingList.length);

      const reportsRes = await courseFoldersAPI.getMyAuditReports({ submitted: 1 });
      const reports: any[] = Array.isArray(reportsRes.data) ? reportsRes.data : [];
      setAuditCompletedCount(reports.length);
    } catch (e) {
      setAuditAssignedCount(0);
      setAuditCompletedCount(0);
    }
  };

  const fetchCoordinatorSummary = async () => {
    if (!canUseCoordinatorModule) return;
    try {
      setCoordinatorLoading(true);
      const response = await courseFoldersAPI.getAll({ assigned_to_me: 1 });
      const folders: any[] = extractList<any>(response.data);
      setCoordinatorFolders(folders);
    } catch (e) {
      setCoordinatorFolders([]);
    } finally {
      setCoordinatorLoading(false);
    }
  };

  useEffect(() => {
    fetchMyCourses();
    fetchProfileData();
    fetchMyFolders();
    fetchAuditSummary();
    fetchCoordinatorSummary();
  }, []);

  const acceptedFoldersCount = folders.filter((folder) => {
    const status = folder.status || 'DRAFT';
    return ACCEPTED_STATUSES.includes(status as (typeof ACCEPTED_STATUSES)[number]);
  }).length;

  // Helper function to check if folder has final term content
  const hasFinalTermContent = (folder: any): boolean => {
    try {
      // Use backend-provided flag if available (most reliable)
      if (folder.has_final_term_content !== undefined) {
        return folder.has_final_term_content === true;
      }
      
      // Fallback: check files directly
      const has_required_files = !!(
        folder.project_report_file && 
        folder.course_result_file && 
        folder.folder_review_report_file
      );
      
      return has_required_files;
    } catch (e) {
      console.error('Error checking final term content:', e);
      return false;
    }
  };

  const pendingFoldersCount = folders.filter((folder) => {
    const status = folder.status || 'DRAFT';
    
    // Include standard pending statuses
    if (PENDING_STATUSES.includes(status as (typeof PENDING_STATUSES)[number])) {
      return true;
    }
    
    // Include APPROVED_BY_HOD folders that are ready for second submission
    // (first approval after mid-term - show in pending if no final term content yet)
    if (status === 'APPROVED_BY_HOD') {
      const firstActivityCompleted = folder.first_activity_completed === true || folder.first_activity_completed === 'true';
      
      if (firstActivityCompleted) {
        // First approval completed - show in pending if final term content is not yet added
        return !hasFinalTermContent(folder);
      }
    }
    
    return false;
  }).length;

  const stats: Array<{ title: string; value: string | number; buttonText?: string; onButtonClick?: () => void }> = [
    {
      title: 'Total Courses',
      value: loading ? '-' : allocations.length.toString(),
      buttonText: 'View Courses',
      onButtonClick: () => navigate('/faculty/create-folder'),
    },
    {
      title: 'Accepted Folders',
      value: foldersLoading ? '-' : acceptedFoldersCount.toString(),
    },
    {
      title: 'Pending',
      value: foldersLoading ? '-' : pendingFoldersCount.toString(),
    },
  ];

  return (
    <DashboardLayout
      userRole="faculty"
      userName={user?.full_name || 'Faculty'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* User Profile Header with Background Image */}
        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            backgroundImage: 'url(/background-image.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '300px',
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-primary/70" />

          {/* Profile Content */}
          <div className="relative z-10 flex flex-col items-center justify-center py-12 px-6">
            <div className="mb-6">
              <div className="w-40 h-40 rounded-full bg-white overflow-hidden border-4 border-white shadow-xl">
                {profileLoading ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : profileData?.user_details.profile_picture ? (
                  <img
                    src={profileData.user_details.profile_picture}
                    alt={profileData.user_details.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary text-white text-5xl font-bold">
                    {profileData?.user_details.full_name.charAt(0).toUpperCase() || user?.full_name?.charAt(0) || 'F'}
                  </div>
                )}
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-1">
              {profileData?.user_details.full_name || user?.full_name || 'Faculty'}
            </h2>
            <p className="text-white/90 text-sm">
              {profileData?.user_details.role || 'FACULTY'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <StatsCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              buttonText={stat.buttonText}
              onButtonClick={stat.onButtonClick}
            />
          ))}
        </div>

        {/* Coordinator Module (if enabled) */}
        {canUseCoordinatorModule && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-header px-6 py-3">
              <h3 className="text-white font-semibold">Course Coordinator</h3>
            </div>
            <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-gray-700 font-medium">You are assigned as a course coordinator. Review and provide feedback on submitted folders.</p>
                <p className="text-sm text-gray-600">
                  Pending: {coordinatorFolders.filter(f => f.status === 'SUBMITTED').length} • 
                  Approved: {coordinatorFolders.filter(f => f.status === 'APPROVED_COORDINATOR').length} • 
                  Returned: {coordinatorFolders.filter(f => f.status === 'REJECTED_COORDINATOR').length}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/coordinator/review" className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">
                  Review Folders
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Audit Member Module (if enabled) */}
        {canUseAuditModule && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-header px-6 py-3">
              <h3 className="text-white font-semibold">Audit Member</h3>
            </div>
            <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-gray-700 font-medium">You can review folders assigned to you for audit.</p>
                <p className="text-sm text-gray-600">Assigned: {auditAssignedCount} • Submitted reports: {auditCompletedCount}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/audit-member/assigned-folders" className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">
                  Assigned Folders
                </Link>
                <Link to="/audit-member/reports" className="px-4 py-2 rounded bg-slate-100 text-slate-800 text-sm hover:bg-slate-200">
                  My Reports
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Courses Details Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-header px-6 py-3">
            <h3 className="text-white font-semibold">Courses Details</h3>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No courses assigned yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sr no</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allocations.slice(0, 5).map((allocation, index) => (
                    <tr key={allocation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {allocation.course_details.code || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {allocation.course_details.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{allocation.section}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{allocation.department_details.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {allocation.program_details?.title || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Folder Details Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-header px-6 py-3">
            <h3 className="text-white font-semibold">Course Folders</h3>
          </div>
          {foldersLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : folderError ? (
            <div className="text-center py-12 text-red-600">{folderError}</div>
          ) : folders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No folders created yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sr no</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {folders.map((folder, index) => {
                    const statusCode = folder.status || 'DRAFT';
                    const statusLabel = folder.status_display || formatStatusLabel(statusCode);
                    const statusClass = statusCode === 'DRAFT'
                      ? 'text-orange-600'
                      : statusCode.includes('REJECTED')
                        ? 'text-red-600'
                        : 'text-green-600';

                    return (
                      <tr key={folder.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {folder.course_details?.title || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{folder.section}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{folder.department_name || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{folder.program_name || 'All Programs'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={statusClass}>{statusLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
