import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Eye, FileCheck, CheckCircle, XCircle } from 'lucide-react';

export const HODReviewedFolders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<any[]>([]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (user?.department) params.department = user.department;
      
      const response = await courseFoldersAPI.getAll(params);
      const allData = Array.isArray(response.data) ? response.data : response.data.results || [];
      
      // Filter to show only folders where HOD has made a decision
      const reviewedFolders = allData.filter((folder: any) => 
        folder.status === 'APPROVED_BY_HOD' || 
        folder.status === 'REJECTED_BY_HOD'
      );
      
      setFolders(reviewedFolders);
    } catch (err) {
      console.error('Error fetching reviewed folders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, [user?.department]);

  const handleReview = (folder: any) => {
    // Navigate to folder review page with decision form
    navigate(`/hod/folder/${folder.id}/decision`);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED_BY_HOD') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </span>
      );
    } else if (status === 'REJECTED_BY_HOD') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </span>
      );
    }
    return null;
  };

  return (
    <DashboardLayout userRole="hod" userName={user?.full_name || 'HOD'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-3 sm:p-4 md:p-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-header px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div>
              <h2 className="text-white font-semibold text-base sm:text-lg">Reviewed Folders</h2>
              <p className="text-white/80 text-xs sm:text-sm mt-1">View and manage folders where you have made a decision</p>
            </div>
            {folders.length > 0 && (
              <div className="bg-white/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md">
                <span className="text-white font-semibold text-sm sm:text-base">{folders.length}</span>
                <span className="text-white/80 text-xs sm:text-sm ml-1">reviewed</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No reviewed folders</p>
              <p className="text-sm mt-2">You haven't reviewed any folders yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sr no</th>
                        <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                        <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Faculty</th>
                        <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Section</th>
                        <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Program</th>
                        <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
                        <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Reviewed Date</th>
                        <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {folders.map((folder, index) => (
                        <tr key={folder.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                          <td className="px-3 sm:px-4 md:px-6 py-4 text-sm font-medium text-gray-900">
                            <div>
                              <p className="font-semibold">{folder.course_details?.title || 'N/A'}</p>
                              <p className="text-xs text-gray-500">{folder.course_details?.code || ''}</p>
                              <p className="text-xs text-gray-500 md:hidden mt-1">
                                {folder.faculty_details?.user_details?.full_name || folder.faculty_name || 'N/A'} • Sec {folder.section}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">
                            {folder.faculty_details?.user_details?.full_name || folder.faculty_name || 'N/A'}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">{folder.section}</td>
                          <td className="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">
                            {folder.program_name || 'All Programs'}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                            {getStatusBadge(folder.status)}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                            {folder.hod_reviewed_at 
                              ? new Date(folder.hod_reviewed_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : 'N/A'}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                              <button
                                onClick={() => navigate(`/hod/folder/${folder.id}/title-page`)}
                                className="text-gray-600 hover:text-gray-800 flex items-center gap-1 text-xs sm:text-sm"
                                title="View Folder"
                              >
                                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">View</span>
                              </button>
                              <button
                                onClick={() => handleReview(folder)}
                                className="text-white bg-primary hover:bg-primary-dark px-2 sm:px-3 py-1 rounded-md flex items-center gap-1 font-medium text-xs sm:text-sm"
                              >
                                <FileCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Change Decision</span>
                                <span className="sm:hidden">Change</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

