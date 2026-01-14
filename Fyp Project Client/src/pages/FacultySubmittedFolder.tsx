import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { FileCheck, Loader2, BookOpen, Calendar, UserPlus, Clock, CheckCircle, XCircle, Eye, FileText } from 'lucide-react';

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
  access_request_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

const statusLabels: Record<string, string> = {
  APPROVED_BY_HOD: 'Accepted by HOD',
};

const statusColors: Record<string, string> = {
  APPROVED_BY_HOD: 'bg-green-100 text-green-800',
};

const ACCEPTED_STATUSES = ['APPROVED_BY_HOD'] as const;

export const FacultySubmittedFolder: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingFolder, setRequestingFolder] = useState<number | null>(null);
  const [accessRequests, setAccessRequests] = useState<Record<number, { status: string; requested_at?: string }>>({});
  const [generatingPdf, setGeneratingPdf] = useState<number | null>(null);

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        setLoading(true);
        let data: any[] = [];
        if (user?.role === 'HOD' || user?.role === 'CONVENER') {
          // HOD and CONVENER should see final accepted folders across their department
          const params: any = { status: 'APPROVED_BY_HOD' };
          if (user?.department) params.department = user.department;
          const response = await courseFoldersAPI.getAll(params);
          data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
        } else {
          const response = await courseFoldersAPI.getMyFolders();
          data = Array.isArray(response.data) ? response.data : [];
        }
        const filtered = data.filter((folder: any) =>
          ACCEPTED_STATUSES.includes(folder.status)
        );
        setFolders(filtered);
        
        // Fetch access requests if user is CONVENER or HOD
        if ((user?.role === 'HOD' || user?.role === 'CONVENER') && filtered.length > 0) {
          try {
            const requestsResponse = await courseFoldersAPI.getMyAccessRequests();
            const requests: any[] = Array.isArray(requestsResponse.data) ? requestsResponse.data : [];
            const requestsMap: Record<number, { status: string; requested_at?: string }> = {};
            requests.forEach((req: any) => {
              // Handle both folder ID and folder_details structure
              const folderId = req.folder_details?.id || req.folder;
              if (folderId) {
                requestsMap[folderId] = {
                  status: req.status,
                  requested_at: req.requested_at
                };
              }
            });
            setAccessRequests(requestsMap);
          } catch (err) {
            console.error('Error loading access requests:', err);
          }
        }
        
        setError(null);
      } catch (err: any) {
  console.error('Error loading accepted folders:', err);
  setError(err.response?.data?.error || 'Failed to load accepted folders');
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, [user?.role, user?.department]);
  
  const handleRequestAccess = async (folderId: number) => {
    try {
      setRequestingFolder(folderId);
      await courseFoldersAPI.requestAccess(folderId);
      // Update access requests
      setAccessRequests(prev => ({
        ...prev,
        [folderId]: { status: 'PENDING', requested_at: new Date().toISOString() }
      }));
      alert('Access request submitted successfully. Admin will be notified.');
    } catch (err: any) {
      console.error('Error requesting access:', err);
      alert(err.response?.data?.error || 'Failed to request access');
    } finally {
      setRequestingFolder(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const basePath = user?.role === 'COORDINATOR' ? '/coordinator' : user?.role === 'CONVENER' ? '/convener' : user?.role === 'HOD' ? '/hod' : '/faculty';
  const layoutUserRole = user?.role === 'COORDINATOR' ? 'coordinator' : user?.role === 'CONVENER' ? 'convener' : user?.role === 'HOD' ? 'hod' : 'faculty';
  return (
    <DashboardLayout userAvatar={user?.profile_picture || undefined} userRole={layoutUserRole}>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Accepted Folders</h1>
          <p className="text-gray-600 mt-2">
            All folders that have received final approval
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
              No Accepted Folders
            </h3>
            <p className="text-gray-500">
              Once your folder is approved, it will appear here.
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
                  Accepted on {formatDate(folder.hod_reviewed_at || folder.submitted_at)}
                </div>

                {/* Request Access Button for CONVENER/HOD */}
                {(user?.role === 'CONVENER' || user?.role === 'HOD') && (
                  <div className="pt-3 border-t border-gray-200">
                    {accessRequests[folder.id]?.status === 'PENDING' ? (
                      <div className="flex items-center text-sm text-blue-600">
                        <Clock className="w-4 h-4 mr-2" />
                        Access request pending
                      </div>
                    ) : accessRequests[folder.id]?.status === 'APPROVED' ? (
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-green-600">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Access granted
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`${basePath}/folder/${folder.id}/title-page?review=1`)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View Folder
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                setGeneratingPdf(folder.id);
                                const response = await courseFoldersAPI.generateFolderReport(folder.id);
                                if (response.data?.url) {
                                  window.open(response.data.url, '_blank');
                                } else {
                                  alert('PDF report is being generated. Please check back in a moment.');
                                }
                              } catch (err: any) {
                                console.error('Error generating PDF:', err);
                                alert(err.response?.data?.error || 'Failed to generate PDF report');
                              } finally {
                                setGeneratingPdf(null);
                              }
                            }}
                            disabled={generatingPdf === folder.id}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            {generatingPdf === folder.id ? 'Generating...' : 'View PDF'}
                          </button>
                        </div>
                      </div>
                    ) : accessRequests[folder.id]?.status === 'REJECTED' ? (
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-red-600">
                          <XCircle className="w-4 h-4 mr-2" />
                          Access request rejected
                        </div>
                        <button
                          onClick={() => handleRequestAccess(folder.id)}
                          disabled={requestingFolder === folder.id}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          {requestingFolder === folder.id ? 'Requesting...' : 'Request Access Again'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRequestAccess(folder.id)}
                        disabled={requestingFolder === folder.id}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {requestingFolder === folder.id ? 'Requesting...' : 'Request Folder'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
