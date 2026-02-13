import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { coursesAPI } from '../services/api';
import { AddCourseModal } from '../components/modals/AddCourseModal';

interface Course {
  id: number;
  code: string;
  title: string;
  credit_hours: number;
  course_type: string;
  department: number;
  program: number | null;
  description: string;
  pre_requisites: string;
  is_active: boolean;
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
  created_at: string;
  updated_at: string;
}

export const ViewCourses: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<number>>(new Set());

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await coursesAPI.getAll();
      
      // Handle paginated response from Django REST Framework
      const data = response.data.results || response.data;
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setCourses(data);
      } else {
        console.error('Invalid response format:', response.data);
        setCourses([]);
        setError('Invalid data format received from server');
      }
    } catch (err: any) {
      console.error('Error fetching courses:', err);
      setCourses([]);
      
      // Check for authentication error
      if (err.response?.status === 401) {
        setError('Please login to view courses');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view courses');
      } else {
        setError(err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to fetch courses. Please ensure the backend server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleDelete = async (id: number, code: string) => {
    const course = courses.find(c => c.id === id);
    if (!course) {
      setError('Course not found. Please refresh the page.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (window.confirm(`Are you sure you want to delete course "${code}"?\n\nThis will permanently delete the course.`)) {
      try {
        setLoading(true);
        setError('');
        await coursesAPI.delete(id);
        setSuccessMessage(`Course "${code}" deleted successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        await fetchCourses();
      } catch (err: any) {
        console.error('Error deleting course:', err);
        const errorMsg = err.response?.data?.detail || 
                         err.response?.data?.message || 
                         err.response?.data?.error ||
                         err.message || 
                         'Failed to delete course. Please try again.';
        setError(errorMsg);
        setTimeout(() => setError(''), 5000);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedCourseIds(new Set()); // Clear selections when toggling mode
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCourseIds(new Set(filteredCourses.map(c => c.id)));
    } else {
      setSelectedCourseIds(new Set());
    }
  };

  const handleSelectCourse = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedCourseIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedCourseIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedCourseIds.size === 0) {
      setError('Please select at least one course to delete.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const selectedCourses = filteredCourses.filter(c => selectedCourseIds.has(c.id));
    const count = selectedCourses.length;
    const codes = selectedCourses.map(c => c.code).join(', ');

    if (!window.confirm(`Are you sure you want to delete ${count} selected course(s)?\n\nSelected: ${codes}\n\nThis will permanently delete these courses.\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // Delete selected courses one by one
      for (const course of selectedCourses) {
        try {
          await coursesAPI.delete(course.id);
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Unknown error';
          errors.push(`${course.code}: ${errorMsg}`);
          console.error(`Failed to delete ${course.code}:`, err);
        }
      }

      // Show results
      if (successCount > 0) {
        setSuccessMessage(`Successfully deleted ${successCount} course(s).${failCount > 0 ? ` Failed: ${failCount}` : ''}`);
        setTimeout(() => setSuccessMessage(''), 5000);
      }
      
      if (failCount > 0) {
        setError(`Failed to delete ${failCount} course(s). Check console for details.`);
        setTimeout(() => setError(''), 5000);
        console.error('Delete selected errors:', errors);
      }

      // Clear selections and exit selection mode
      setSelectedCourseIds(new Set());
      setIsSelectionMode(false);

      // Refresh the courses list
      await fetchCourses();
    } catch (err: any) {
      console.error('Error deleting selected courses:', err);
      setError('Failed to delete courses. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (filteredCourses.length === 0) {
      setError('No courses to delete.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const count = filteredCourses.length;
    if (!window.confirm(`Are you sure you want to delete ALL ${count} course(s)?\n\nThis will permanently delete all visible courses.\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      // Delete all courses one by one
      for (const course of filteredCourses) {
        try {
          await coursesAPI.delete(course.id);
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err.response?.data?.detail || err.response?.data?.message || 'Unknown error';
          errors.push(`${course.code}: ${errorMsg}`);
          console.error(`Failed to delete ${course.code}:`, err);
        }
      }

      // Show results
      if (successCount > 0) {
        setSuccessMessage(`Successfully deleted ${successCount} course(s).${failCount > 0 ? ` Failed: ${failCount}` : ''}`);
        setTimeout(() => setSuccessMessage(''), 5000);
      }
      
      if (failCount > 0) {
        setError(`Failed to delete ${failCount} course(s). Check console for details.`);
        setTimeout(() => setError(''), 5000);
        console.error('Bulk delete errors:', errors);
      }

      // Refresh the courses list
      await fetchCourses();
    } catch (err: any) {
      console.error('Error in bulk delete:', err);
      setError('Failed to delete courses. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: number) => {
    navigate(`/courses/edit/${id}`);
  };

  const filteredCourses = courses.filter(course => 
    course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.department_details.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-green-900">Success</h4>
                <p className="mt-1 text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-900">Error</h4>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Courses</h2>
          <div className="flex gap-4">
            <Button 
              variant="coral"
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Course
            </Button>
            <Button 
              variant="secondary"
              onClick={() => navigate('/course-allocation')}
            >
              Back to Allocation
            </Button>
          </div>
        </div>

        {/* Courses Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Table Header */}
          <div className="bg-primary px-6 py-4 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">Course Details</h3>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-white hover:text-white/80 transition-transform"
              aria-label={collapsed ? 'Expand courses' : 'Collapse courses'}
            >
              <svg className={`w-5 h-5 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {!collapsed && (
          <div className="p-4 border-b border-gray-200 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-md flex-1">
                <input
                  type="text"
                  placeholder="Search courses..."
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
            
            {/* Selection Mode Controls - Only show when there are courses */}
            {user?.role === 'ADMIN' && filteredCourses.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
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
                    <p className="text-sm text-gray-600">Click to select individual courses for deletion</p>
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
                        disabled={loading || selectedCourseIds.size === 0}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Selected ({selectedCourseIds.size})
                      </button>
                    </div>
                    <p className="text-sm text-gray-600">
                      {selectedCourseIds.size > 0 
                        ? `${selectedCourseIds.size} course(s) selected`
                        : 'Select courses to delete'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {!collapsed && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-gray-600">Loading courses...</p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="mt-2 text-gray-600">
                  {searchQuery ? 'No courses found matching your search' : 'No courses available'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {isSelectionMode && user?.role === 'ADMIN' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        <input
                          type="checkbox"
                          checked={selectedCourseIds.size === filteredCourses.length && filteredCourses.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sr. No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Course Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Course Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Credit Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Program</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                    {user?.role === 'ADMIN' && !isSelectionMode && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCourses.map((course, index) => (
                    <tr 
                      key={course.id} 
                      className={`hover:bg-gray-50 ${isSelectionMode && selectedCourseIds.has(course.id) ? 'bg-blue-50' : ''}`}
                    >
                      {isSelectionMode && user?.role === 'ADMIN' && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedCourseIds.has(course.id)}
                            onChange={(e) => handleSelectCourse(course.id, e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{course.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{course.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{course.credit_hours}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          course.course_type === 'THEORY' ? 'bg-blue-100 text-blue-800' :
                          course.course_type === 'LAB' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {course.course_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{course.department_details.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {course.program_details?.title || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          course.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {course.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {user?.role === 'ADMIN' && !isSelectionMode && (
                        <td className="px-6 py-4 text-sm space-x-2">
                          <button
                            onClick={() => handleEdit(course.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(course.id, course.code)}
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
            )}
          </div>
          )}
        </div>
      </div>

      {/* Add Course Modal */}
      <AddCourseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchCourses}
      />
    </DashboardLayout>
  );
};
