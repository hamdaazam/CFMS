import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseAllocationsAPI } from '../services/api';
import { BookOpen, Users, Clock } from 'lucide-react';

interface CourseDetails {
  id: number;
  code: string;
  title: string;
  credit_hours: number;
  course_type: string;
  department_details: {
    id: number;
    name: string;
  };
  program_details?: {
    id: number;
    title: string;
  };
}

interface CourseAllocation {
  id: number;
  course: number;
  course_details: CourseDetails;
  section: string;
  department_details: {
    id: number;
    name: string;
  };
  program_details?: {
    id: number;
    title: string;
  };
  term?: number;
  is_active: boolean;
  created_at: string;
}

export const FacultyCourses: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyCourses();
  }, []);

  const fetchMyCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await courseAllocationsAPI.getMyCourses();
      setAllocations(response.data.results || []);
    } catch (err: any) {
      console.error('Error fetching courses:', err);
      setError(err.response?.data?.detail || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (allocationId: number) => {
    const base = (user?.role === 'COORDINATOR') ? '/coordinator' : user?.role === 'CONVENER' ? '/convener' : '/faculty';
    navigate(`${base}/create-folder`, { state: { selectedAllocationId: allocationId } });
  };

  return (
    <DashboardLayout userAvatar={user?.profile_picture || undefined} userRole={user?.role === 'COORDINATOR' ? 'coordinator' : 'faculty'}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">My Courses</h1>
          <p className="text-gray-600 mt-2">View and manage your assigned courses</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchMyCourses}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : allocations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Courses Assigned</h3>
            <p className="text-gray-500">You don't have any courses assigned yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allocations.map((allocation) => {
              const course = allocation.course_details;
              return (
                <div key={allocation.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${course.course_type === 'LAB' ? 'bg-purple-100 text-purple-700' :
                        course.course_type === 'HYBRID' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                      }`}>
                      {course.course_type}
                    </span>
                  </div>

                  <div className="mb-2">
                    <h3 className="text-lg font-bold text-gray-800">{course.code}</h3>
                    <span className="text-xs text-gray-500">Section: {allocation.section}</span>
                  </div>
                  <p className="text-gray-600 mb-4 line-clamp-2">{course.title}</p>

                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{course.credit_hours} Credit Hours</span>
                    </div>
                    {allocation.program_details && (
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        <span>{allocation.program_details.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleViewDetails(allocation.id)}
                      className="text-primary hover:text-primary-dark font-semibold text-sm"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
