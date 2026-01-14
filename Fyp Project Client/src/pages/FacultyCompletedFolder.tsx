import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { FolderCheck, BookOpen, Calendar, Loader2, Eye } from 'lucide-react';

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
  hod_reviewed_at?: string | null;
  first_activity_completed?: boolean;
  outline_content?: any;
}

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

export const FacultyCompletedFolder: React.FC = () => {
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
        
        // Completed folders: APPROVED_BY_HOD with final term content OR deadline hasn't passed yet
        const filtered = data.filter((folder: any) => {
          const status = (folder.status || '').toUpperCase();
          
          // Only show APPROVED_BY_HOD folders
          if (status === 'APPROVED_BY_HOD') {
            const firstActivityCompleted = folder.first_activity_completed === true || folder.first_activity_completed === 'true';
            const canEditForFinalSubmission = folder.can_edit_for_final_submission === true || folder.can_edit_for_final_submission === 'true';
            
            if (firstActivityCompleted) {
              // If deadline has passed, only show if final term content exists (second submission completed)
              if (canEditForFinalSubmission) {
                return hasFinalTermContent(folder);
              } else {
                // Deadline hasn't passed yet - show as completed (first submission completed, waiting for deadline)
                return true;
              }
            }
            // If first_activity_completed is false, don't show (it shouldn't be in completed)
            return false;
          }
          
          // Don't show other statuses in completed folder page
          return false;
        });
        
        setFolders(filtered);
        setError(null);
      } catch (err: any) {
        console.error('Error loading completed folders:', err);
        setError(err.response?.data?.error || 'Failed to load completed folders');
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
          <h1 className="text-3xl font-bold text-gray-800">Completed Folders</h1>
          <p className="text-gray-600 mt-2">View all your fully completed course folders (after final term)</p>
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
            <FolderCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Completed Folders</h3>
            <p className="text-gray-500">Your fully completed folders (after final term approval) will appear here.</p>
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
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                    Completed
                  </span>
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  Completed on {formatDate(folder.hod_reviewed_at || folder.submitted_at)}
                </div>

                <button
                  onClick={() => navigate(`${basePath}/folder/${folder.id}/title-page?review=1`)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Folder
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
