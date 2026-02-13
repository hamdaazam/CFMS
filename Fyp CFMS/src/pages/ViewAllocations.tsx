import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseAllocationsAPI } from '../services/api';

interface CourseAllocation {
  id: number;
  course_details: {
    id: number;
    code: string;
    title: string;
    credit_hours: number;
  };
  faculty_details: {
    id: number;
    faculty_id: string;
    full_name: string;
    email: string;
    designation: string;
  };
  section: string;
  department_details: {
    id: number;
    name: string;
    short_code: string;
  };
  program_details?: {
    id: number;
    title: string;
    short_code: string;
  };
  is_active: boolean;
  created_at: string;
}

interface CoordinatorAssignment {
  id: number;
  coordinator: number;
  coordinator_name: string;
  coordinator_email: string | null;
  coordinator_cnic: string | null;
  course: number;
  course_code: string;
  course_title: string;
  department: number;
  department_name: string;
  program: number | null;
  program_title: string | null;
  term: number | null;
  is_active: boolean;
  assigned_at: string;
  assigned_by: number | null;
  assigned_by_name: string | null;
}

export const ViewAllocations: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
  const [coordinatorAssignments, setCoordinatorAssignments] = useState<CoordinatorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCoordinator, setLoadingCoordinator] = useState(false);
  const [error, setError] = useState('');
  const [coordinatorError, setCoordinatorError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<'faculty' | 'coordinator'>('faculty');

  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAllocationIds, setSelectedAllocationIds] = useState<Set<number>>(new Set());

  const fetchAllocations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch allocations based on user role
      // Admin sees all, others see only their own
      const response = user?.role === 'ADMIN' 
        ? await courseAllocationsAPI.getAll({ is_active: true })
        : await courseAllocationsAPI.getMyCourses();
      const data = response.data.results || response.data;
      setAllocations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching allocations:', err);
      setError('Failed to load course allocations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  const fetchCoordinatorAssignments = useCallback(async () => {
    try {
      setLoadingCoordinator(true);
      setCoordinatorError('');
      const response = await courseAllocationsAPI.getCoordinatorAssignments({ is_active: true });
      const data = response.data.results || response.data;
      // Filter by coordinator if not admin
      const filteredData = user?.role === 'ADMIN' 
        ? data
        : Array.isArray(data) ? data.filter((a: CoordinatorAssignment) => a.coordinator === user?.id) : [];
      setCoordinatorAssignments(Array.isArray(filteredData) ? filteredData : []);
    } catch (err: any) {
      console.error('Error fetching coordinator assignments:', err);
      setCoordinatorError('Failed to load coordinator assignments. Please try again.');
    } finally {
      setLoadingCoordinator(false);
    }
  }, [user?.role, user?.id]);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  useEffect(() => {
    if (viewMode === 'coordinator') {
      if (coordinatorAssignments.length === 0 && !loadingCoordinator) {
        fetchCoordinatorAssignments();
      }
      setMessage(null);
    }
  }, [viewMode, coordinatorAssignments.length, loadingCoordinator, fetchCoordinatorAssignments]);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedAllocationIds(new Set()); // Clear selections when toggling mode
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAllocationIds(new Set(filteredAllocations.map(a => a.id)));
    } else {
      setSelectedAllocationIds(new Set());
    }
  };

  const handleSelectAllocation = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedAllocationIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedAllocationIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedAllocationIds.size === 0) {
      setMessage({ type: 'error', text: 'Please select at least one allocation to delete.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const selectedAllocations = filteredAllocations.filter(a => selectedAllocationIds.has(a.id));
    const count = selectedAllocations.length;
    const allocationDetails = selectedAllocations.map(a => 
      `${a.course_details.code} Section ${a.section}`
    ).join(', ');

    if (!window.confirm(`Are you sure you want to delete ${count} selected allocation(s)?\n\nSelected: ${allocationDetails}\n\nThis will permanently delete these allocations.\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // Delete selected allocations one by one
      for (const allocation of selectedAllocations) {
        try {
          await courseAllocationsAPI.delete(allocation.id);
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Unknown error';
          errors.push(`${allocation.course_details.code} Section ${allocation.section}: ${errorMsg}`);
          console.error(`Failed to delete ${allocation.course_details.code} Section ${allocation.section}:`, err);
        }
      }

      // Show results
      if (successCount > 0) {
        setMessage({ 
          type: 'success', 
          text: `Successfully deleted ${successCount} allocation(s).${failCount > 0 ? ` Failed: ${failCount}` : ''}` 
        });
        setTimeout(() => setMessage(null), 5000);
      }
      
      if (failCount > 0) {
        setMessage({ 
          type: 'error', 
          text: `Failed to delete ${failCount} allocation(s). Check console for details.` 
        });
        setTimeout(() => setMessage(null), 5000);
        console.error('Delete selected errors:', errors);
      }

      // Clear selections and exit selection mode
      setSelectedAllocationIds(new Set());
      setIsSelectionMode(false);

      // Refresh the allocations list
      await fetchAllocations();
    } catch (err: any) {
      console.error('Error deleting selected allocations:', err);
      setMessage({ type: 'error', text: 'Failed to delete allocations. Please try again.' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, courseCode: string, section: string) => {
    if (!window.confirm(`Are you sure you want to delete allocation for ${courseCode} Section ${section}?`)) {
      return;
    }

    try {
      await courseAllocationsAPI.delete(id);
      setMessage({ type: 'success', text: 'Allocation deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
      fetchAllocations(); // Refresh list
    } catch (err: any) {
      console.error('Error deleting allocation:', err);
      setMessage({ type: 'error', text: 'Failed to delete allocation. Please try again.' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleDeleteCoordinatorAssignment = async (id: number, courseCode: string, coordinatorName: string) => {
    if (!window.confirm(`Are you sure you want to delete coordinator assignment for ${courseCode} (Coordinator: ${coordinatorName})?`)) {
      return;
    }

    try {
      setLoadingCoordinator(true);
      await courseAllocationsAPI.deleteCoordinatorAssignment(id);
      setMessage({ type: 'success', text: 'Coordinator assignment deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
      fetchCoordinatorAssignments(); // Refresh list
    } catch (err: any) {
      console.error('Error deleting coordinator assignment:', err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete coordinator assignment. Please try again.' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoadingCoordinator(false);
    }
  };

  const handleEditCoordinatorAssignment = (assignment: CoordinatorAssignment) => {
    // For now, we'll use a simple prompt-based edit
    // In a full implementation, you'd want a proper modal/form
    const newIsActive = window.prompt(
      `Edit coordinator assignment for ${assignment.course_code}:\n\n` +
      `Coordinator: ${assignment.coordinator_name}\n` +
      `Current Status: ${assignment.is_active ? 'Active' : 'Inactive'}\n\n` +
      `Enter new status (true/false):`,
      assignment.is_active ? 'true' : 'false'
    );

    if (newIsActive === null) return; // User cancelled

    const isActive = newIsActive.toLowerCase() === 'true';

    if (isActive === assignment.is_active) {
      return; // No change
    }

    // Update the assignment
    courseAllocationsAPI.partialUpdateCoordinatorAssignment(assignment.id, { is_active: isActive })
      .then(() => {
        setMessage({ type: 'success', text: 'Coordinator assignment updated successfully!' });
        setTimeout(() => setMessage(null), 3000);
        fetchCoordinatorAssignments();
      })
      .catch((err: any) => {
        console.error('Error updating coordinator assignment:', err);
        setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update coordinator assignment. Please try again.' });
        setTimeout(() => setMessage(null), 5000);
      });
  };

  const filteredAllocations = allocations.filter(allocation => {
    const searchLower = searchTerm.toLowerCase();
    return (
      allocation.course_details.code.toLowerCase().includes(searchLower) ||
      allocation.course_details.title.toLowerCase().includes(searchLower) ||
      allocation.faculty_details.full_name.toLowerCase().includes(searchLower) ||
      allocation.section.toLowerCase().includes(searchLower) ||
      allocation.department_details.name.toLowerCase().includes(searchLower)
    );
  });

  const filteredCoordinatorAssignments = coordinatorAssignments.filter((assignment) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      assignment.course_code.toLowerCase().includes(searchLower) ||
      assignment.course_title.toLowerCase().includes(searchLower) ||
      assignment.coordinator_name.toLowerCase().includes(searchLower) ||
      (assignment.department_name?.toLowerCase() || '').includes(searchLower) ||
      (assignment.program_title?.toLowerCase() || '').includes(searchLower)
    );
  });

  const isCoordinatorView = viewMode === 'coordinator';
  const isLoading = isCoordinatorView ? loadingCoordinator : loading;
  const displayError = isCoordinatorView ? coordinatorError : error;

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Course Allocations</h1>
            <p className="text-sm text-gray-600 mt-1">
              {isCoordinatorView ? 'View coordinator-course assignments' : 'View and manage faculty course allocations'}
            </p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('faculty')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  !isCoordinatorView ? 'bg-white text-primary shadow' : 'text-gray-600'
                }`}
              >
                Faculty Allocations
              </button>
              <button
                onClick={() => setViewMode('coordinator')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isCoordinatorView ? 'bg-white text-primary shadow' : 'text-gray-600'
                }`}
              >
                Coordinator Assignments
              </button>
            </div>
            <button
              onClick={() => navigate('/courses/allocate')}
              className="bg-coral text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              ← Back to Allocate
            </button>
          </div>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder={
              isCoordinatorView
                ? 'Search by course code, title, coordinator name, department, or program...'
                : 'Search by course code, title, faculty name, section, or department...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Selection Mode Controls - Only show for Faculty Allocations */}
        {!isCoordinatorView && !isLoading && !displayError && filteredAllocations.length > 0 && user?.role === 'ADMIN' && (
          <div className="mb-4 bg-gray-50 p-4 rounded-lg">
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
                <p className="text-sm text-gray-600">Click to select individual allocations for deletion</p>
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
                    disabled={loading || selectedAllocationIds.size === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Selected ({selectedAllocationIds.size})
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  {selectedAllocationIds.size > 0 
                    ? `${selectedAllocationIds.size} allocation(s) selected`
                    : 'Select allocations to delete'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600">Loading allocations...</p>
          </div>
        )}

        {/* Error State */}
        {displayError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{displayError}</p>
          </div>
        )}

        {/* Allocations Table */}
        {!isLoading && !displayError && !isCoordinatorView && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-primary text-white">
                  <tr>
                    {isSelectionMode && user?.role === 'ADMIN' && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedAllocationIds.size === filteredAllocations.length && filteredAllocations.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Course Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Course Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Faculty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Faculty ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Program
                    </th>
                    {user?.role === 'ADMIN' && !isSelectionMode && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={isSelectionMode && user?.role === 'ADMIN' ? 8 : (user?.role === 'ADMIN' ? 8 : 7)} className="px-4 py-8 text-center text-gray-500">
                        {searchTerm ? 'No allocations found matching your search.' : 'No course allocations yet. Click "Back to Allocate" to create one.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAllocations.map((allocation) => (
                      <tr 
                        key={allocation.id} 
                        className={`hover:bg-gray-50 ${isSelectionMode && selectedAllocationIds.has(allocation.id) ? 'bg-blue-50' : ''}`}
                      >
                        {isSelectionMode && user?.role === 'ADMIN' && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedAllocationIds.has(allocation.id)}
                              onChange={(e) => handleSelectAllocation(allocation.id, e.target.checked)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-primary">
                          {allocation.course_details.code}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {allocation.course_details.title}
                          <span className="ml-2 text-xs text-gray-500">
                            ({allocation.course_details.credit_hours} CR)
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {allocation.section}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{allocation.faculty_details.full_name}</div>
                            <div className="text-xs text-gray-500">{allocation.faculty_details.designation}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {allocation.faculty_details.faculty_id || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {allocation.department_details.name}
                          <span className="ml-1 text-xs text-gray-500">
                            ({allocation.department_details.short_code})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {allocation.program_details?.short_code || 'All Programs'}
                        </td>
                        {user?.role === 'ADMIN' && !isSelectionMode && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDelete(allocation.id, allocation.course_details.code, allocation.section)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            {filteredAllocations.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{filteredAllocations.length}</span> allocation(s)
                  {searchTerm && ` matching "${searchTerm}"`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Coordinator Assignments Table */}
        {!isLoading && !displayError && isCoordinatorView && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-primary text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Course Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Course Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Coordinator
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Program
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Assigned At
                    </th>
                    {user?.role === 'ADMIN' && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCoordinatorAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={user?.role === 'ADMIN' ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                        {searchTerm ? 'No coordinator assignments found matching your search.' : 'No coordinator assignments available.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCoordinatorAssignments.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-primary">
                          {assignment.course_code}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {assignment.course_title}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{assignment.coordinator_name}</div>
                            <div className="text-xs text-gray-500">
                              {assignment.coordinator_email || 'No email'}
                            </div>
                            <div className="text-xs text-gray-400">
                              CNIC: {assignment.coordinator_cnic || 'N/A'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {assignment.department_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {assignment.program_title || 'All Programs'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {new Date(assignment.assigned_at).toLocaleString()}
                        </td>
                        {user?.role === 'ADMIN' && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleEditCoordinatorAssignment(assignment)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCoordinatorAssignment(assignment.id, assignment.course_code, assignment.coordinator_name)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredCoordinatorAssignments.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{filteredCoordinatorAssignments.length}</span> coordinator assignment(s)
                  {searchTerm && ` matching "${searchTerm}"`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
