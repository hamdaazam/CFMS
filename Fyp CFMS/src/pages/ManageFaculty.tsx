import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { facultyAPI, departmentsAPI, programsAPI, roleRequestsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface Faculty {
  id: number;
  user_id?: number;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  cnic?: string;
  designation: string;
  department: number;
  department_name?: string;
  program?: number;
  program_name?: string;
}

interface Department {
  id: number;
  name: string;
  short_code: string;
}

interface Program {
  id: number;
  title: string;
  short_code: string;
}

export const ManageFaculty: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingRequestsMap, setPendingRequestsMap] = useState<Record<number, any>>({});
  
  // Bulk upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchFaculty();
    fetchDepartments();
    fetchPrograms();
    fetchPendingRoleRequests();
    // Listen for role request updates so pending state is refreshed (approve/reject/delete)
    const handler = (e: any) => {
      fetchPendingRoleRequests();
      fetchFaculty();
    };
    window.addEventListener('roleRequestUpdated', handler as EventListener);
    return () => window.removeEventListener('roleRequestUpdated', handler as EventListener);
  }, []);

  const fetchFaculty = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // If not admin, only show the logged-in user's profile
      const response = user?.role === 'ADMIN' 
        ? await facultyAPI.getAll()
        : await facultyAPI.getMyProfile();
      
      console.log('Faculty response:', response);
      
      // Handle both array and paginated response
      let facultyData: any[] = [];
      
      if (user?.role === 'ADMIN') {
        // Admin gets list of all faculty
        facultyData = Array.isArray(response.data) ? response.data : response.data.results || [];
      } else {
        // Non-admin gets single profile object, convert to array
        facultyData = [response.data];
      }
      
      // Map the data to extract user details from nested user_details
      facultyData = facultyData.map((f: any) => ({
        id: f.id, // Numeric PK used for operations (edit/delete)
        user_id: f.user_details?.id || null,
        faculty_id: f.faculty_id,
        full_name: f.user_details?.full_name || 'N/A',
        email: f.user_details?.email || 'N/A',
        phone: f.phone || '',
        cnic: f.user_details?.cnic || '',
        role: f.user_details?.role || 'FACULTY',
        designation: f.designation,
        department: f.department || f.department_details?.department_id,
        program: f.program || f.program_details?.program_id,
      }));
      
      setFaculty(facultyData);
    } catch (err: any) {
      console.error('Error fetching faculty:', err);
      setError('Failed to load faculty. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDepartments(data);
    } catch (err: any) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchPrograms = async () => {
    try {
      const response = await programsAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setPrograms(data);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
    }
  };

  const fetchPendingRoleRequests = async () => {
    try {
      const resp = await roleRequestsAPI.getAll({ status: 'PENDING' });
      const data = Array.isArray(resp.data) ? resp.data : resp.data.results || [];
      const map: Record<number, any> = {};
      data.forEach((r: any) => {
        if (r.target_user) {
          map[r.target_user] = r;
        }
      });
      setPendingRequestsMap(map);
    } catch (err) {
      setPendingRequestsMap({});
    }
  };

  const getDepartmentName = (departmentId: number): string => {
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.name : 'Unknown';
  };

  const getProgramName = (programId?: number): string => {
    if (!programId) return 'N/A';
    const prog = programs.find(p => p.id === programId);
    return prog ? prog.title : 'Unknown';
  };

  const handleEdit = (id: number) => {
    navigate(`/faculty-management/edit/${id}`);
  };

  const handleDelete = async (id: number) => {
    const facultyMember = faculty.find(f => f.id === id);
    if (!facultyMember) {
      setError('Faculty member not found. Please refresh the page.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${facultyMember.full_name}"?\n\nThis will permanently delete the faculty member and their user account.`)) {
      try {
        setLoading(true);
        setError(null);
        await facultyAPI.delete(id);
        setSuccessMessage(`Faculty "${facultyMember.full_name}" deleted successfully!`);
        setTimeout(() => setSuccessMessage(null), 3000);
        // Refresh the faculty list
        await fetchFaculty();
      } catch (err: any) {
        console.error('Error deleting faculty:', err);
        const errorMsg = err.response?.data?.detail || 
                         err.response?.data?.message || 
                         err.response?.data?.error ||
                         err.message || 
                         'Failed to delete faculty. Please try again.';
        setError(errorMsg);
        setTimeout(() => setError(null), 5000);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedFacultyIds(new Set()); // Clear selections when toggling mode
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFacultyIds(new Set(visibleFaculty.map(f => f.id)));
    } else {
      setSelectedFacultyIds(new Set());
    }
  };

  const handleSelectFaculty = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedFacultyIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedFacultyIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedFacultyIds.size === 0) {
      setError('Please select at least one faculty member to delete.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const selectedFaculty = visibleFaculty.filter(f => selectedFacultyIds.has(f.id));
    const count = selectedFaculty.length;
    const names = selectedFaculty.map(f => f.full_name).join(', ');

    if (!window.confirm(`Are you sure you want to delete ${count} selected faculty member(s)?\n\nSelected: ${names}\n\nThis will permanently delete these faculty members and their user accounts.\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // Delete selected faculty members one by one
      for (const facultyMember of selectedFaculty) {
        try {
          await facultyAPI.delete(facultyMember.id);
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Unknown error';
          errors.push(`${facultyMember.full_name}: ${errorMsg}`);
          console.error(`Failed to delete ${facultyMember.full_name}:`, err);
        }
      }

      // Show results
      if (successCount > 0) {
        setSuccessMessage(`Successfully deleted ${successCount} faculty member(s).${failCount > 0 ? ` Failed: ${failCount}` : ''}`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
      
      if (failCount > 0) {
        setError(`Failed to delete ${failCount} faculty member(s). Check console for details.`);
        setTimeout(() => setError(null), 5000);
        console.error('Delete selected errors:', errors);
      }

      // Clear selections and exit selection mode
      setSelectedFacultyIds(new Set());
      setIsSelectionMode(false);

      // Refresh the faculty list
      await fetchFaculty();
    } catch (err: any) {
      console.error('Error deleting selected faculty:', err);
      setError('Failed to delete faculty members. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (visibleFaculty.length === 0) {
      setError('No faculty members to delete.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const count = visibleFaculty.length;
    if (!window.confirm(`Are you sure you want to delete ALL ${count} faculty member(s)?\n\nThis will permanently delete all faculty members and their user accounts.\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // Delete all faculty members one by one
      for (const facultyMember of visibleFaculty) {
        try {
          await facultyAPI.delete(facultyMember.id);
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Unknown error';
          errors.push(`${facultyMember.full_name}: ${errorMsg}`);
          console.error(`Failed to delete ${facultyMember.full_name}:`, err);
        }
      }

      // Show results
      if (successCount > 0) {
        setSuccessMessage(`Successfully deleted ${successCount} faculty member(s).${failCount > 0 ? ` Failed: ${failCount}` : ''}`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
      
      if (failCount > 0) {
        setError(`Failed to delete ${failCount} faculty member(s). Check console for details.`);
        setTimeout(() => setError(null), 5000);
        console.error('Bulk delete errors:', errors);
      }

      // Refresh the faculty list
      await fetchFaculty();
    } catch (err: any) {
      console.error('Error in bulk delete:', err);
      setError('Failed to delete faculty members. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx')) {
      setUploadError('Please select a valid .xlsx file.');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadSuccess(null);
  };

  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Get JWT token from localStorage
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      // Use the same API base URL as configured in api.ts
      const API_BASE_URL = 'http://127.0.0.1:8000/api';
      
      const response = await axios.post(
        `${API_BASE_URL}/faculty/upload-excel/`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const data = response.data;
      const stats = data.statistics || {};
      
      // Show success message with statistics
      const successMsg = `Upload successful! Created: ${stats.created || 0}, Skipped: ${stats.skipped || 0}, Errors: ${stats.errors || 0}`;
      setUploadSuccess(successMsg);
      
      // Clear file selection
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh faculty list
      fetchFaculty();

      // Auto-hide success message after 5 seconds
      setTimeout(() => setUploadSuccess(null), 5000);

      // Show detailed errors if any
      if (data.errors && data.errors.length > 0) {
        console.warn('Upload completed with errors:', data.errors);
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      const errorMsg = err.response?.data?.error || 
                      err.response?.data?.detail || 
                      err.message || 
                      'Failed to upload file. Please try again.';
      setUploadError(errorMsg);
    } finally {
      setUploadLoading(false);
    }
  };

  const filteredFaculty = faculty.filter(f =>
    f.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.cnic && f.cnic.includes(searchQuery)) ||
    f.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Exclude users who have pending CONVENER/COORDINATOR role requests from the main Manage view (they should be shown under Pending)
  const visibleFaculty = filteredFaculty.filter((f) => {
    const req = f.user_id ? pendingRequestsMap[f.user_id] : undefined;
    if (!req) return true;
    // If there's a pending request for COORDINATOR or CONVENER, hide from manage list
    if (['COORDINATOR', 'CONVENER'].includes(req.role)) return false;
    return true;
  });

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Bulk Faculty Upload Section - Admin Only */}
        {user?.role === 'ADMIN' && (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Bulk Faculty Upload (Excel)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload an Excel file (.xlsx) with columns:
            </p>
            <div className="text-sm text-gray-600 mb-4 ml-4">
              <p><strong>Required Columns:</strong></p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li><code className="bg-gray-100 px-2 py-1 rounded">name</code> - Full name</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">email</code> - Email address</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">cnic</code> - 13-digit CNIC number</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">department</code> - Department name</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">role</code> - FACULTY, CONVENER, or HOD</li>
              </ul>
              <p className="mt-2"><strong>Optional:</strong> <code className="bg-gray-100 px-2 py-1 rounded">program</code>, <code className="bg-gray-100 px-2 py-1 rounded">id</code></p>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> All users will be created with default password: <strong>Cust123</strong>
                </p>
                <p className="text-xs text-blue-800 mt-1">
                  Dashboard access is automatically assigned based on role (FACULTY → Faculty Dashboard, CONVENER → Convener Dashboard, HOD → HOD Dashboard)
                </p>
              </div>
            </div>
            
            {/* Upload Success Message */}
            {uploadSuccess && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                {uploadSuccess}
              </div>
            )}

            {/* Upload Error Message */}
            {uploadError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {uploadError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx)
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={uploadLoading}
                      id="excel-file-input"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleChooseFileClick();
                      }}
                      disabled={uploadLoading}
                      className="flex-1 cursor-pointer inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {selectedFile ? 'Change File' : 'Choose File'}
                    </button>
                  </div>
                  {selectedFile && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        <span className="font-medium">Selected:</span> {selectedFile.name}
                        <span className="ml-2 text-xs">({(selectedFile.size / 1024).toFixed(2)} KB)</span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-end">
                  <Button
                    variant="primary"
                    onClick={handleBulkUpload}
                    disabled={!selectedFile || uploadLoading}
                    className="min-w-[120px]"
                  >
                    {uploadLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </span>
                    ) : 'Upload'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">
            {user?.role === 'ADMIN' ? 'Faculty' : 'My Profile'}
          </h2>
          {user?.role === 'ADMIN' && (
            <Button variant="coral" onClick={() => navigate('/faculty-management')}>
              Add Faculty
            </Button>
          )}
        </div>

        {/* Faculty Details Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Table Header */}
          <div className="bg-primary px-6 py-4 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">
              {user?.role === 'ADMIN' ? 'Faculty Details' : 'My Details'}
            </h3>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-white hover:text-white/80 transition-transform"
              aria-label={collapsed ? 'Expand faculty list' : 'Collapse faculty list'}
            >
              <svg className={`w-5 h-5 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Search */}
          {!collapsed && (
          <div className="p-4 border-b border-gray-200">
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Search by name, email, CNIC, or designation"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          )}

          {/* Loading State */}
          {loading && !collapsed && (
            <div className="p-8 text-center text-gray-500">
              Loading faculty...
            </div>
          )}

          {/* Empty State */}
          {!loading && visibleFaculty.length === 0 && !collapsed && (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'No faculty found matching your search.' : faculty.length === 0 ? 'No faculty available. Add faculty to get started.' : 'No Faculty matches the given query.'}
            </div>
          )}

          {/* Selection Mode Controls - Only show when there are faculty members */}
          {!loading && visibleFaculty.length > 0 && user?.role === 'ADMIN' && !collapsed && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              {!isSelectionMode ? (
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleToggleSelectionMode}
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Select to Delete
                  </button>
                  <p className="text-sm text-gray-600">Click to select individual faculty members for deletion</p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleToggleSelectionMode}
                      disabled={loading}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                    >
                      Cancel Selection
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={loading || selectedFacultyIds.size === 0}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Selected ({selectedFacultyIds.size})
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">
                    {selectedFacultyIds.size > 0 
                      ? `${selectedFacultyIds.size} faculty member(s) selected`
                      : 'Select faculty members to delete'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          {!loading && visibleFaculty.length > 0 && !collapsed && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {isSelectionMode && user?.role === 'ADMIN' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        <input
                          type="checkbox"
                          checked={selectedFacultyIds.size === visibleFaculty.length && visibleFaculty.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sr. No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">CNIC</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Designation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Program</th>
                    {user?.role === 'ADMIN' && !isSelectionMode && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleFaculty.map((facultyMember, index) => (
                    <tr 
                      key={facultyMember.id} 
                      className={`hover:bg-gray-50 ${isSelectionMode && selectedFacultyIds.has(facultyMember.id) ? 'bg-blue-50' : ''}`}
                    >
                      {isSelectionMode && user?.role === 'ADMIN' && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedFacultyIds.has(facultyMember.id)}
                            onChange={(e) => handleSelectFaculty(facultyMember.id, e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{facultyMember.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{facultyMember.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{facultyMember.phone || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {facultyMember.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{facultyMember.cnic || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {facultyMember.designation}
                        {facultyMember.user_id && pendingRequestsMap[facultyMember.user_id] && (
                          <div className="text-xs text-yellow-700 font-medium">Pending approval: {pendingRequestsMap[facultyMember.user_id].role}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{getDepartmentName(facultyMember.department)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{getProgramName(facultyMember.program)}</td>
                      {user?.role === 'ADMIN' && !isSelectionMode && (
                        <td className="px-6 py-4 text-sm space-x-2">
                          <button
                            onClick={() => handleEdit(facultyMember.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(facultyMember.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      )}
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
