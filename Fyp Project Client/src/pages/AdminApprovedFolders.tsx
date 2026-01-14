import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI, termsAPI, departmentsAPI, programsAPI, coursesAPI, facultyAPI } from '../services/api';
import { Loader, Share2, Eye, Clock, CheckCircle, XCircle, UserCheck, UserX } from 'lucide-react';

interface Term {
  id: number;
  session_term: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface CourseFolder {
  id: number;
  course: number;
  course_details: {
    code: string;
    title: string;
  };
  faculty: number;
  faculty_details: {
    full_name: string;
    email: string;
  };
  term: number;
  term_details: {
    session_term: string;
  };
  section: string;
  department: number;
  department_details: {
    name: string;
  };
  program: number | null;
  program_details: {
    title: string;
  } | null;
  status: string;
  hod_reviewed_at: string | null;
  hod_reviewed_by: number | null;
  created_at: string;
}

export const AdminApprovedFolders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  
  // Filters
  const [selectedTerm, setSelectedTerm] = useState<number | ''>('');
  const [selectedDepartment, setSelectedDepartment] = useState<number | ''>('');
  const [selectedProgram, setSelectedProgram] = useState<number | ''>('');
  const [selectedCourse, setSelectedCourse] = useState<number | ''>('');
  const [selectedFaculty, setSelectedFaculty] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sharingFolder, setSharingFolder] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [accessRequests, setAccessRequests] = useState<Record<number, any[]>>({});
  const [processingRequest, setProcessingRequest] = useState<number | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    fetchTerms();
    fetchDepartments();
    fetchFolders();
  }, []);

  useEffect(() => {
    fetchAccessRequests();
  }, []);

  const fetchAccessRequests = async () => {
    try {
      const response = await courseFoldersAPI.getFolderAccessRequests('PENDING');
      const requests: any[] = Array.isArray(response.data) ? response.data : [];
      
      // Group requests by folder ID
      const requestsByFolder: Record<number, any[]> = {};
      requests.forEach((req: any) => {
        const folderId = req.folder_details?.id || req.folder;
        if (folderId) {
          if (!requestsByFolder[folderId]) {
            requestsByFolder[folderId] = [];
          }
          requestsByFolder[folderId].push(req);
        }
      });
      setAccessRequests(requestsByFolder);
    } catch (error) {
      console.error('Error fetching access requests:', error);
    }
  };

  const handleApproveRequest = async (folderId: number, requestId: number) => {
    try {
      setProcessingRequest(requestId);
      await courseFoldersAPI.approveAccessRequest(folderId, {
        request_id: requestId,
        action: 'approve',
        notes: adminNotes
      });
      setMessage({ type: 'success', text: 'Access request approved successfully' });
      setTimeout(() => setMessage(null), 5000);
      setShowRequestModal(false);
      setSelectedRequest(null);
      setAdminNotes('');
      fetchAccessRequests();
      fetchFolders();
    } catch (error: any) {
      console.error('Error approving request:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to approve request' 
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (folderId: number, requestId: number) => {
    if (!adminNotes.trim()) {
      setMessage({ type: 'error', text: 'Please provide a reason for rejection' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }
    
    try {
      setProcessingRequest(requestId);
      await courseFoldersAPI.approveAccessRequest(folderId, {
        request_id: requestId,
        action: 'reject',
        notes: adminNotes
      });
      setMessage({ type: 'success', text: 'Access request rejected' });
      setTimeout(() => setMessage(null), 5000);
      setShowRequestModal(false);
      setSelectedRequest(null);
      setAdminNotes('');
      fetchAccessRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to reject request' 
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setProcessingRequest(null);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, [selectedTerm, selectedDepartment, selectedProgram, selectedCourse, selectedFaculty]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchPrograms(selectedDepartment);
    } else {
      setPrograms([]);
      setSelectedProgram('');
    }
  }, [selectedDepartment]);

  const fetchTerms = async () => {
    try {
      const response = await termsAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setTerms(data.sort((a: Term, b: Term) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      ));
    } catch (error) {
      console.error('Error fetching terms:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchPrograms = async (deptId: number) => {
    try {
      const response = await programsAPI.getAll({ department: deptId });
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setPrograms(data);
    } catch (error) {
      console.error('Error fetching programs:', error);
    }
  };

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedTerm) params.term = selectedTerm;
      if (selectedDepartment) params.department = selectedDepartment;
      if (selectedProgram) params.program = selectedProgram;
      if (selectedCourse) params.course = selectedCourse;
      if (selectedFaculty) params.faculty = selectedFaculty;

      const response = await courseFoldersAPI.getApprovedByTerm(params);
      const data = Array.isArray(response.data.results) ? response.data.results : response.data.results || [];
      setFolders(data);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
      setMessage({ type: 'error', text: 'Failed to load approved folders' });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (folderId: number, role: 'CONVENER' | 'HOD') => {
    if (!confirm(`Share this folder with ${role}? They will receive a notification.`)) {
      return;
    }

    setSharingFolder(folderId);
    try {
      await courseFoldersAPI.shareWithRole(folderId, { role });
      setMessage({ 
        type: 'success', 
        text: `Folder shared with ${role} successfully. They have been notified.` 
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('Error sharing folder:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || `Failed to share folder with ${role}` 
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSharingFolder(null);
    }
  };

  const filteredFolders = folders.filter(folder => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      folder.course_details.code.toLowerCase().includes(search) ||
      folder.course_details.title.toLowerCase().includes(search) ||
      folder.faculty_details.full_name.toLowerCase().includes(search) ||
      folder.faculty_details.email.toLowerCase().includes(search) ||
      folder.department_details.name.toLowerCase().includes(search) ||
      folder.section.toLowerCase().includes(search)
    );
  });

  // Group folders by term
  const foldersByTerm = filteredFolders.reduce((acc, folder) => {
    const termKey = folder.term_details.session_term;
    if (!acc[termKey]) {
      acc[termKey] = [];
    }
    acc[termKey].push(folder);
    return acc;
  }, {} as Record<string, CourseFolder[]>);

  return (
    <DashboardLayout 
      userName={user?.full_name || 'Admin'} 
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Approved Course Folders</h1>
          <p className="text-gray-600">View and manage approved course folders by term</p>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Term
              </label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">All Terms</option>
                {terms.map(term => (
                  <option key={term.id} value={term.id}>
                    {term.session_term} {term.is_active && '(Active)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value ? Number(e.target.value) : '');
                  setSelectedProgram('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Program
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value ? Number(e.target.value) : '')}
                disabled={!selectedDepartment}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100"
              >
                <option value="">All Programs</option>
                {programs.map(prog => (
                  <option key={prog.id} value={prog.id}>
                    {prog.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by course code, title, instructor name, or email..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Folders by Term */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(foldersByTerm).length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">No approved folders found for the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(foldersByTerm)
              .sort(([a], [b]) => b.localeCompare(a)) // Sort terms descending
              .map(([termName, termFolders]) => (
                <div key={termName} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="bg-primary text-white px-6 py-4">
                    <h2 className="text-xl font-bold">{termName}</h2>
                    <p className="text-sm text-primary-light">
                      {termFolders.length} approved folder{termFolders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Course
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Section
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Instructor
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Program
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Approved Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {termFolders.map((folder) => (
                          <tr key={folder.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-primary">
                                {folder.course_details.code}
                              </div>
                              <div className="text-sm text-gray-500">
                                {folder.course_details.title}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {folder.section}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {folder.faculty_details.full_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {folder.faculty_details.email}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {folder.department_details.name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {folder.program_details?.title || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {folder.hod_reviewed_at 
                                ? new Date(folder.hod_reviewed_at).toLocaleDateString()
                                : 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => navigate(`/faculty/folders/${folder.id}`)}
                                    className="text-primary hover:text-primary-dark flex items-center gap-1"
                                    title="View Folder"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleShare(folder.id, 'CONVENER')}
                                      disabled={sharingFolder === folder.id}
                                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                                      title="Share with Convener"
                                    >
                                      <Share2 className="w-4 h-4" />
                                      <span className="text-xs">Convener</span>
                                    </button>
                                    <button
                                      onClick={() => handleShare(folder.id, 'HOD')}
                                      disabled={sharingFolder === folder.id}
                                      className="text-purple-600 hover:text-purple-800 flex items-center gap-1 disabled:opacity-50"
                                      title="Share with HOD"
                                    >
                                      <Share2 className="w-4 h-4" />
                                      <span className="text-xs">HOD</span>
                                    </button>
                                  </div>
                                </div>
                                {/* Access Requests */}
                                {accessRequests[folder.id] && accessRequests[folder.id].length > 0 && (
                                  <div className="flex flex-col gap-1 pt-2 border-t border-gray-200">
                                    <div className="text-xs text-gray-500 font-semibold mb-1">Access Requests:</div>
                                    {accessRequests[folder.id].map((req: any) => (
                                      <div key={req.id} className="flex items-center justify-between bg-yellow-50 px-2 py-1 rounded">
                                        <div className="flex items-center gap-2">
                                          <Clock className="w-3 h-3 text-yellow-600" />
                                          <span className="text-xs text-gray-700">
                                            {req.requested_by_details?.full_name || 'Unknown'} ({req.requested_by_details?.role || ''})
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            setSelectedRequest(req);
                                            setShowRequestModal(true);
                                          }}
                                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded disabled:opacity-50"
                                          disabled={processingRequest === req.id}
                                        >
                                          Review
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )}
        
        {/* Access Request Modal */}
        {showRequestModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Review Access Request</h2>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Requested by:</strong> {selectedRequest.requested_by_details?.full_name || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Role:</strong> {selectedRequest.requested_by_details?.role || 'Unknown'}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Folder:</strong> {selectedRequest.folder_details?.course_details?.code || 'N/A'} - {selectedRequest.folder_details?.section || 'N/A'}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Requested at:</strong> {selectedRequest.requested_at ? new Date(selectedRequest.requested_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes / Reason {selectedRequest.status === 'PENDING' && '(Required for rejection)'}
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Add notes or reason for approval/rejection..."
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => handleApproveRequest(selectedRequest.folder_details?.id || selectedRequest.folder, selectedRequest.id)}
                  disabled={processingRequest === selectedRequest.id}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleRejectRequest(selectedRequest.folder_details?.id || selectedRequest.folder, selectedRequest.id)}
                  disabled={processingRequest === selectedRequest.id || !adminNotes.trim()}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <UserX className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setSelectedRequest(null);
                    setAdminNotes('');
                  }}
                  disabled={processingRequest === selectedRequest.id}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

