import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Eye, Edit, Calendar, BookOpen, Filter, FolderOpen } from 'lucide-react';

interface CourseFolder {
  id: number;
  course_details: {
    code: string;
    title: string;
  };
  term_name: string;
  section: string;
  status: string;
  status_display: string;
  is_complete: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  APPROVED_COORDINATOR: 'bg-blue-100 text-blue-800',
  REJECTED_COORDINATOR: 'bg-red-100 text-red-800',
  ASSIGNED_TO_CONVENER: 'bg-teal-100 text-teal-800',
  UNDER_AUDIT: 'bg-purple-100 text-purple-800',
  AUDIT_COMPLETED: 'bg-indigo-100 text-indigo-800',
  REJECTED_BY_CONVENER: 'bg-rose-100 text-rose-700',
  SUBMITTED_TO_HOD: 'bg-orange-100 text-orange-800',
  APPROVED_BY_HOD: 'bg-green-100 text-green-800',
  REJECTED_BY_HOD: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted to Coordinator',
  APPROVED_COORDINATOR: 'Approved by Coordinator',
  REJECTED_COORDINATOR: 'Returned by Coordinator',
  ASSIGNED_TO_CONVENER: 'Assigned to Convener',
  UNDER_AUDIT: 'Under Audit Review',
  AUDIT_COMPLETED: 'Audit Completed',
  REJECTED_BY_CONVENER: 'Returned by Convener',
  SUBMITTED_TO_HOD: 'Submitted to HOD',
  APPROVED_BY_HOD: 'Approved by HOD',
  REJECTED_BY_HOD: 'Returned by HOD',
};

export const MyFolders: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  useEffect(() => {
    fetchFolders();
  }, [selectedStatus]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const params = selectedStatus !== 'ALL' ? { status: selectedStatus } : undefined;
      const response = await courseFoldersAPI.getMyFolders(params);
      setFolders(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching folders:', err);
      setError(err.response?.data?.error || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  const basePath = user?.role === 'COORDINATOR' ? '/coordinator' : user?.role === 'CONVENER' ? '/convener' : '/faculty';
  const layoutUserRole = user?.role === 'COORDINATOR' ? 'coordinator' : user?.role === 'CONVENER' ? 'convener' : 'faculty';

  // Navigation handled inline with role-aware base path

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const canEdit = (status: string) => {
    return [
      'DRAFT',
      'REJECTED_COORDINATOR',
      'REJECTED_BY_CONVENER',
      'REJECTED_BY_HOD',
    ].includes(status);
  };

  if (loading) {
    return (
      <DashboardLayout
        title="My Course Folders"
        userRole={layoutUserRole}
        userName={user?.full_name || (user?.role === 'COORDINATOR' ? 'Coordinator' : 'Faculty')}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Course Folders"
      userRole={layoutUserRole}
      userName={user?.full_name || (user?.role === 'COORDINATOR' ? 'Coordinator' : 'Faculty')}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="space-y-6">
        {/* Header with Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                My Course Folders
              </h2>
              <p className="text-gray-600">
                Manage and track your course folders
              </p>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-3">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted to Coordinator</option>
                <option value="APPROVED_COORDINATOR">Approved by Coordinator</option>
                <option value="REJECTED_COORDINATOR">Returned by Coordinator</option>
                <option value="ASSIGNED_TO_CONVENER">Assigned to Convener</option>
                <option value="UNDER_AUDIT">Under Audit Review</option>
                <option value="AUDIT_COMPLETED">Audit Completed</option>
                <option value="REJECTED_BY_CONVENER">Returned by Convener</option>
                <option value="SUBMITTED_TO_HOD">Submitted to HOD</option>
                <option value="APPROVED_BY_HOD">Approved by HOD</option>
                <option value="REJECTED_BY_HOD">Returned by HOD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Folders List */}
        {folders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Folders Found
            </h3>
            <p className="text-gray-500 mb-6">
              {selectedStatus === 'ALL'
                ? "You haven't created any course folders yet."
                : `No folders with status "${statusLabels[selectedStatus] || selectedStatus}"`}
            </p>
            <button
              onClick={() => navigate(`${basePath}/create-folder`)}
              className="bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200"
            >
              Create New Folder
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Term
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Complete
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {folders.map((folder) => (
                    <tr key={folder.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <BookOpen className="w-5 h-5 text-slate-700 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {folder.course_details.code}
                            </div>
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {folder.course_details.title}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {folder.section}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-700">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {folder.term_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[folder.status] || 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {statusLabels[folder.status] || folder.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {folder.is_complete ? (
                          <span className="text-green-600 font-medium text-sm">✓ Yes</span>
                        ) : (
                          <span className="text-red-600 font-medium text-sm">✗ No</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(folder.submitted_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => navigate(`${basePath}/folders/${folder.id}`)}
                          className="text-slate-700 hover:text-slate-900 inline-flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </button>
                        {canEdit(folder.status) && (
                          <button
                            onClick={() => navigate(`${basePath}/folders/${folder.id}/edit`)}
                            className="text-emerald-600 hover:text-emerald-900 inline-flex items-center ml-3"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>);
}

export default MyFolders;
