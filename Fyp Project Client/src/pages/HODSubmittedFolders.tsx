import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { FileCheck, Loader2, BookOpen, Calendar } from 'lucide-react';

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
  faculty_details?: {
    user_details?: {
      full_name: string;
    };
  };
}

const statusLabels: Record<string, string> = {
  SUBMITTED_TO_HOD: 'Submitted to HOD',
  UNDER_REVIEW_BY_HOD: 'Under Review by HOD'
};

const statusColors: Record<string, string> = {
  SUBMITTED_TO_HOD: 'bg-orange-100 text-orange-800',
  UNDER_REVIEW_BY_HOD: 'bg-blue-100 text-blue-800'
};

export const HODSubmittedFolders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        setLoading(true);
        const params: any = {};
        if (user?.department) params.department = user.department;

        const response = await courseFoldersAPI.getAll(params);
        const data = Array.isArray(response.data) ? response.data : response.data.results || [];
        const submitted = data.filter((f: any) =>
          ['SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD'].includes(f.status)
        );
        setFolders(submitted);
        setError(null);
      } catch (err: any) {
        console.error('Error loading submitted folders:', err);
        setError(err.response?.data?.error || 'Failed to load submitted folders');
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, [user?.department]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <DashboardLayout userRole="hod" userName={user?.full_name || 'HOD'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Submitted Folders</h1>
          <p className="text-gray-600 mt-2">
            Folders submitted to you for final review and approval
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
            <FileCheck className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Submitted Folders
            </h3>
            <p className="text-gray-500">
              No folders are currently awaiting your review.
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
                      {folder.course_details?.title || 'Untitled Course'}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {folder.course_details?.code || 'No Code'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Faculty: {folder.faculty_details?.user_details?.full_name || 'Unknown'}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[folder.status] || 'bg-gray-100 text-gray-800'
                      }`}
                  >
                    {statusLabels[folder.status] || folder.status?.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  Submitted on {formatDate(folder.submitted_at)}
                </div>

                <button
                  onClick={() => navigate(`/hod/folder/${folder.id}/review`)}
                  className="w-full bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Review Folder
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
