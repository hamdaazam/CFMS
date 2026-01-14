import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Eye, FileCheck } from 'lucide-react';

export const HODReviewFolders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<any[]>([]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      // Fetch folders that are submitted to HOD OR already have HOD decisions (so HOD can change them)
      const params: any = {};
      if (user?.department) params.department = user.department;
      
      const response = await courseFoldersAPI.getAll(params);
      const allData = Array.isArray(response.data) ? response.data : response.data.results || [];
      
      // Filter to show folders that need HOD review or have HOD decisions (so they can be changed)
      const relevantFolders = allData.filter((folder: any) => 
        folder.status === 'SUBMITTED_TO_HOD' || 
        folder.status === 'APPROVED_BY_HOD' || 
        folder.status === 'REJECTED_BY_HOD'
      );
      
      setFolders(relevantFolders);
    } catch (err) {
      console.error('Error fetching folders:', err);
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

  return (
    <DashboardLayout userRole="hod" userName={user?.full_name || 'HOD'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-header px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-white font-semibold text-lg">Folders for Final Decision</h2>
              <p className="text-white/80 text-sm mt-1">Review, make final decision, or change existing decisions on folders</p>
            </div>
            {folders.length > 0 && (
              <div className="bg-white/20 px-4 py-2 rounded-md">
                <span className="text-white font-semibold">{folders.length}</span>
                <span className="text-white/80 text-sm ml-1">pending</span>
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
              <p className="text-lg font-medium">No folders awaiting review</p>
              <p className="text-sm mt-2">All folders have been processed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sr no</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faculty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Audit Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {folders.map((folder, index) => (
                    <tr key={folder.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <div>
                          <p className="font-semibold">{folder.course_details?.title || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{folder.course_details?.code || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {folder.faculty_details?.user_details?.full_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{folder.section}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {folder.program_name || 'All Programs'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {folder.status === 'SUBMITTED_TO_HOD' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Awaiting Decision
                          </span>
                        ) : folder.status === 'APPROVED_BY_HOD' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Approved
                          </span>
                        ) : folder.status === 'REJECTED_BY_HOD' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {folder.status || 'Unknown'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/hod/folder/${folder.id}/title-page`)}
                            className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
                            title="View Folder"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          <button
                            onClick={() => handleReview(folder)}
                            className="text-white bg-primary hover:bg-primary-dark px-3 py-1 rounded-md flex items-center gap-1 font-medium"
                          >
                            <FileCheck className="w-4 h-4" />
                            {folder.status === 'APPROVED_BY_HOD' || folder.status === 'REJECTED_BY_HOD' ? 'Change Decision' : 'Review'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
