import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { AlertCircle, BookOpen, Calendar, Loader2 } from 'lucide-react';

interface CourseFolder {
  id: number;
  course_details: {
    code: string;
    title: string;
  };
  section: string;
  term_name: string;
  status: string;
  submitted_at: string | null;
  first_activity_completed?: boolean;
  outline_content?: any;
}

const statusLabels: Record<string, string> = {
  SUBMITTED: 'Submitted to Coordinator',
  APPROVED_COORDINATOR: 'Approved by Coordinator',
  ASSIGNED_TO_CONVENER: 'Assigned to Convener',
  UNDER_AUDIT: 'Under Audit Review',
  AUDIT_COMPLETED: 'Audit Completed',
  SUBMITTED_TO_HOD: 'Submitted to HOD',
};

const statusColors: Record<string, string> = {
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  APPROVED_COORDINATOR: 'bg-blue-100 text-blue-800',
  ASSIGNED_TO_CONVENER: 'bg-teal-100 text-teal-800',
  UNDER_AUDIT: 'bg-purple-100 text-purple-800',
  AUDIT_COMPLETED: 'bg-indigo-100 text-indigo-800',
  SUBMITTED_TO_HOD: 'bg-orange-100 text-orange-800',
};

const PENDING_STATUSES = [
  'SUBMITTED',
  'APPROVED_COORDINATOR',
  'ASSIGNED_TO_CONVENER',
  'UNDER_AUDIT',
  'AUDIT_COMPLETED',
  'SUBMITTED_TO_HOD',
  'REJECTED_COORDINATOR',
  'REJECTED_BY_CONVENER',
  'REJECTED_BY_HOD',
];

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
    
    // Note: outline_content is not included in list serializer to avoid performance issues
    // So we rely on the backend's has_final_term_content field
    
    return has_required_files;
  } catch (e) {
    console.error('Error checking final term content:', e);
    return false;
  }
};

export const FacultyPendingFolder: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        setLoading(true);
        const response = await courseFoldersAPI.getMyFolders();
        const data = Array.isArray(response.data) ? response.data : [];
        const filtered = data.filter((folder: any) => {
          const status = (folder.status || '').toUpperCase();
          
          // Include standard pending statuses
          if (PENDING_STATUSES.includes(status)) {
            return true;
          }
          
          // Include APPROVED_BY_HOD folders that are ready for second submission
          // (first approval after mid-term - show in pending if no final term content yet)
          if (status === 'APPROVED_BY_HOD') {
            const firstActivityCompleted = folder.first_activity_completed === true || folder.first_activity_completed === 'true';
            
            if (firstActivityCompleted) {
              // First approval completed - show in pending if final term content is not yet added
              // This allows instructor to continue working on folder for final term
              return !hasFinalTermContent(folder);
            }
            // If first_activity_completed is false, don't show in pending
            return false;
          }
          
          return false;
        });
        setFolders(filtered);
        setError(null);
      } catch (err: any) {
        console.error('Error loading pending folders:', err);
        setError(err.response?.data?.error || 'Failed to load pending folders');
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const basePath = user?.role === 'COORDINATOR' ? '/coordinator' : user?.role === 'CONVENER' ? '/convener' : '/faculty';
  const layoutUserRole = user?.role === 'COORDINATOR' ? 'coordinator' : user?.role === 'CONVENER' ? 'convener' : 'faculty';
  
  return (
    <DashboardLayout userAvatar={user?.profile_picture || undefined} userRole={layoutUserRole}>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Pending Folders</h1>
          <p className="text-gray-600 mt-2">
            Folders currently awaiting coordinator, convener, or HOD review
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
          </div>
        ) : folders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Pending Folders
            </h3>
            <p className="text-gray-500">
              Submit a folder to see it appear here while it is under review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {folders.map((folder) => (
              <div key={folder.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <BookOpen className="w-4 h-4 mr-2 text-slate-600" />
                      Section {folder.section}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {folder.course_details.code}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {folder.course_details.title}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      statusColors[folder.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {statusLabels[folder.status] || folder.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  Submitted on {formatDate(folder.submitted_at)}
                </div>

                <button
                  onClick={() => navigate(`${basePath}/folder/${folder.id}/title-page`)}
                  className="w-full bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {folder.status === 'APPROVED_BY_HOD' && folder.first_activity_completed
                    ? 'Edit Folder (Add Final Term Content)'
                    : 'View Folder Details'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
