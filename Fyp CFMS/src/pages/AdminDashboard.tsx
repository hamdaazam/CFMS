import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { StatsCard } from '../components/common/StatsCard';
import { useAuth } from '../context/AuthContext';
import { departmentsAPI, programsAPI, facultyAPI, termsAPI, coursesAPI, courseAllocationsAPI } from '../services/api';

interface DashboardStats {
  totalDepartments: number;
  totalPrograms: number;
  totalFaculty: number;
  totalCourses: number;
  totalAllocations: number;
  activeTerm: string | null;
  activeTermsCount: number;
}

interface Department {
  id: number;
  name: string;
  short_code: string;
  programs?: number;
  faculty_count?: number;
}

interface Faculty {
  id: number;
  faculty_id: string | null;
  user: {
    full_name: string;
    email: string;
    cnic: string;
  };
  designation: string;
  department: number;
  department_details?: {
    name: string;
  };
  phone: string | null;
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalDepartments: 0,
    totalPrograms: 0,
    totalFaculty: 0,
    totalCourses: 0,
    totalAllocations: 0,
    activeTerm: null,
    activeTermsCount: 0,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepartments, setShowDepartments] = useState(true);
  const [showFaculty, setShowFaculty] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [
        deptResponse,
        progResponse,
        facultyResponse,
        termsResponse,
        coursesResponse,
        allocationsResponse
      ] = await Promise.all([
        departmentsAPI.getAll(),
        programsAPI.getAll(),
        facultyAPI.getAll({ is_active: true }),
        termsAPI.getAll({ is_active: true }),
        coursesAPI.getAll({ is_active: true }),
        courseAllocationsAPI.getAll({ is_active: true })
      ]);

      // Handle paginated responses
      const deptData = deptResponse.data.results || deptResponse.data;
      const progData = progResponse.data.results || progResponse.data;
      const facultyData = facultyResponse.data.results || facultyResponse.data;
      const termsData = termsResponse.data.results || termsResponse.data;
      const coursesData = coursesResponse.data.results || coursesResponse.data;
      const allocationsData = allocationsResponse.data.results || allocationsResponse.data;

      const departmentsArray = Array.isArray(deptData) ? deptData : [];
      const programsArray = Array.isArray(progData) ? progData : [];
      const facultyArray = Array.isArray(facultyData) ? facultyData : [];
      const termsArray = Array.isArray(termsData) ? termsData : [];
      const coursesArray = Array.isArray(coursesData) ? coursesData : [];
      const allocationsArray = Array.isArray(allocationsData) ? allocationsData : [];

      // Calculate faculty count per department
      const departmentsWithCounts = departmentsArray.map(dept => ({
        ...dept,
        programs: programsArray.filter(p => p.department === dept.id).length,
        faculty_count: facultyArray.filter(f => f.department === dept.id).length,
      }));

      setDepartments(departmentsWithCounts);
      setFaculty(facultyArray);
      setStats({
        totalDepartments: departmentsArray.length,
        totalPrograms: programsArray.length,
        totalFaculty: facultyArray.length,
        totalCourses: coursesArray.length,
        totalAllocations: allocationsArray.length,
        activeTerm: termsArray.length > 0 ? termsArray[0].session_term : null,
        activeTermsCount: termsArray.length,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout 
      userName={user?.full_name || 'Admin'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600">Loading dashboard...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* User Profile Header with Campus Background & Purple Overlay */}
            <div 
              className="relative rounded-lg overflow-hidden"
              style={{
                backgroundImage: 'url(/background-image.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '300px',
              }}
            >
              {/* Overlay */}
              <div className="absolute inset-0 bg-primary/70" />
              
              {/* Profile Content */}
              <div className="relative z-0 flex flex-col items-center justify-center py-12 px-6">
                {/* Profile Avatar */}
                <div className="w-24 h-24 rounded-full bg-white overflow-hidden mb-4 border-4 border-white shadow-lg flex items-center justify-center profile-elevated">
                  {user?.profile_picture ? (
                    <img 
                      src={user.profile_picture} 
                      alt={user.full_name || 'Admin'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-primary">
                      {user?.full_name?.charAt(0) || 'A'}
                    </span>
                  )}
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-3">{user?.full_name || 'Admin'}</h2>
                <p className="text-white/90 text-sm mb-6">Administrator</p>
                
                {/* Stats Row */}
                <div className="flex gap-8 text-center">
                  <div>
                    <p className="text-xl font-bold text-white">{stats.totalDepartments}</p>
                    <p className="text-white/70 text-xs">Departments</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{stats.totalPrograms}</p>
                    <p className="text-white/70 text-xs">Programs</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{stats.totalFaculty}</p>
                    <p className="text-white/70 text-xs">Faculty Members</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{stats.totalCourses}</p>
                    <p className="text-white/70 text-xs">Courses</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Term */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-gray-700 font-semibold mb-2">Current Active Term</h3>
              <p className="text-3xl font-bold text-gray-900 mb-3">
                {stats.activeTerm || 'No Active Term'}
              </p>
              {stats.activeTerm && (
                <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  Active
                </span>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatsCard
                title="Departments"
                value={stats.totalDepartments.toString()}
                buttonText="View Details"
                onButtonClick={() => navigate('/department/view')}
              />
              <StatsCard
                title="Programs"
                value={stats.totalPrograms.toString()}
                buttonText="View Details"
                onButtonClick={() => navigate('/program/view')}
              />
              <StatsCard
                title="Faculty Members"
                value={stats.totalFaculty.toString()}
                buttonText="View Details"
                onButtonClick={() => navigate('/faculty-management/manage')}
              />
              <StatsCard
                title="Courses"
                value={stats.totalCourses.toString()}
                buttonText="View Details"
                onButtonClick={() => navigate('/courses/view')}
              />
              <StatsCard
                title="Course Allocations"
                value={stats.totalAllocations.toString()}
                buttonText="View Details"
                onButtonClick={() => navigate('/courses/allocations')}
              />
              <StatsCard
                title="Active Terms"
                value={stats.activeTermsCount.toString()}
                buttonText="View Details"
                onButtonClick={() => navigate('/terms/view?active=true')}
              />
            </div>

            {/* Department Details Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-header px-6 py-3 flex items-center justify-between">
                <h3 className="text-white font-semibold">Department Details</h3>
                <button
                  onClick={() => setShowDepartments((s) => !s)}
                  className="text-white/90 hover:text-white"
                  aria-label={showDepartments ? 'Collapse departments' : 'Expand departments'}
                >
                  {showDepartments ? 'Hide' : 'Show'}
                </button>
              </div>
              {showDepartments && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sr no</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Short Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Programs</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faculty Count</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No departments found.
                        </td>
                      </tr>
                    ) : (
                      departments.map((dept, index) => (
                        <tr key={dept.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{dept.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{dept.short_code}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{dept.programs || 0}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{dept.faculty_count || 0}</td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => navigate(`/department/description/${dept.id}`)}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            {/* Faculty Details Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-header px-6 py-3 flex items-center justify-between">
                <h3 className="text-white font-semibold">Faculty Details</h3>
                <button
                  onClick={() => setShowFaculty((s) => !s)}
                  className="text-white/90 hover:text-white"
                  aria-label={showFaculty ? 'Collapse faculty' : 'Expand faculty'}
                >
                  {showFaculty ? 'Hide' : 'Show'}
                </button>
              </div>
              {showFaculty && (
              <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sr no</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faculty ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNIC</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {faculty.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                          No faculty members found.
                        </td>
                      </tr>
                    ) : (
                      faculty.map((fac, index) => (
                        <tr key={fac.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{fac.faculty_id || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{fac.user.full_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{fac.user.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{fac.phone || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{fac.user.cnic || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{fac.designation}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {fac.department_details?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => navigate(`/faculty-management/edit/${fac.id}`)}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {faculty.length > 0 && (
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Showing all {faculty.length} faculty member{faculty.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              </>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
