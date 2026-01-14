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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
    if (window.confirm(`Are you sure you want to delete course ${code}?`)) {
      try {
        await coursesAPI.delete(id);
        alert('Course deleted successfully');
        fetchCourses();
      } catch (err: any) {
        console.error('Error deleting course:', err);
        alert(err.response?.data?.message || 'Failed to delete course');
      }
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
          <div className="p-4 border-b border-gray-200">
            <div className="relative max-w-md">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sr. No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Course Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Course Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Credit Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Program</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCourses.map((course, index) => (
                    <tr key={course.id} className="hover:bg-gray-50">
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
