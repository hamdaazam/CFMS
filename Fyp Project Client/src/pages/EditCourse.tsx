import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { coursesAPI, departmentsAPI, programsAPI } from '../services/api';

interface Department {
  id: number;
  name: string;
  short_code: string;
}

interface Program {
  id: number;
  title: string;
  short_code: string;
  department: number;
}

interface CourseFormData {
  code: string;
  title: string;
  credit_hours: number;
  course_type: string;
  department: number;
  program: number | null;
  description: string;
  pre_requisites: string;
  is_active: boolean;
}

export const EditCourse: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);

  const [formData, setFormData] = useState<CourseFormData>({
    code: '',
    title: '',
    credit_hours: 3,
    course_type: 'THEORY',
    department: 0,
    program: null,
    description: '',
    pre_requisites: '',
    is_active: true,
  });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch course details
        const courseResponse = await coursesAPI.getById(Number(id));
        const course = courseResponse.data;

        // Fetch departments
        const deptResponse = await departmentsAPI.getAll();
        const deptData = deptResponse.data.results || deptResponse.data;
        setDepartments(Array.isArray(deptData) ? deptData : []);

        // Fetch all programs
        const progResponse = await programsAPI.getAll();
        const progData = progResponse.data.results || progResponse.data;
        const allProgs = Array.isArray(progData) ? progData : [];
        setAllPrograms(allProgs);

        // Filter programs by department
        const filteredPrograms = allProgs.filter(
          (p: Program) => p.department === course.department
        );
        setPrograms(filteredPrograms);

        // Set form data
        setFormData({
          code: course.code,
          title: course.title,
          credit_hours: course.credit_hours,
          course_type: course.course_type,
          department: course.department,
          program: course.program,
          description: course.description || '',
          pre_requisites: course.pre_requisites || '',
          is_active: course.is_active,
        });
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.message || 'Failed to fetch course details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Update programs when department changes
  useEffect(() => {
    if (formData.department) {
      const filteredPrograms = allPrograms.filter(
        (p: Program) => p.department === formData.department
      );
      setPrograms(filteredPrograms);

      // Reset program if it's not in the new department
      if (formData.program && !filteredPrograms.find(p => p.id === formData.program)) {
        setFormData(prev => ({ ...prev, program: null }));
      }
    } else {
      setPrograms([]);
      setFormData(prev => ({ ...prev, program: null }));
    }
  }, [formData.department, allPrograms]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) :
        type === 'checkbox' ? (e.target as HTMLInputElement).checked :
          value === '' && (name === 'department' || name === 'program') ? null :
            name === 'department' || name === 'program' ? Number(value) :
              value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.code.trim()) {
      setError('Course code is required');
      return;
    }
    if (!formData.title.trim()) {
      setError('Course title is required');
      return;
    }
    if (!formData.department) {
      setError('Department is required');
      return;
    }
    if (formData.credit_hours < 1) {
      setError('Credit hours must be at least 1');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await coursesAPI.partialUpdate(Number(id), formData);
      alert('Course updated successfully');
      navigate('/courses/view');
    } catch (err: any) {
      console.error('Error updating course:', err);
      setError(err.response?.data?.message || 'Failed to update course');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        userName={user?.full_name || 'User'}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-gray-600">Loading course details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Edit Course</h2>
          <p className="text-gray-600">Update course information</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Course Code */}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
              Course Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., CS101"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Enter the course code (will be converted to uppercase)</p>
          </div>

          {/* Course Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Introduction to Programming"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credit Hours */}
            <div>
              <label htmlFor="credit_hours" className="block text-sm font-medium text-gray-700 mb-2">
                Credit Hours <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="credit_hours"
                name="credit_hours"
                value={formData.credit_hours}
                onChange={handleInputChange}
                min="1"
                max="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            {/* Course Type */}
            <div>
              <label htmlFor="course_type" className="block text-sm font-medium text-gray-700 mb-2">
                Course Type <span className="text-red-500">*</span>
              </label>
              <select
                id="course_type"
                name="course_type"
                value={formData.course_type}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              >
                <option value="THEORY">Theory</option>
                <option value="LAB">Lab</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Department */}
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                id="department"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.short_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Program */}
            <div>
              <label htmlFor="program" className="block text-sm font-medium text-gray-700 mb-2">
                Program <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <select
                id="program"
                name="program"
                value={formData.program || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={!formData.department}
              >
                <option value="">Select Program (Optional)</option>
                {programs.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.title} ({prog.short_code})
                  </option>
                ))}
              </select>
              {!formData.department && (
                <p className="mt-1 text-xs text-gray-500">Select a department first</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter course description (optional)"
            />
          </div>

          {/* Pre-requisites */}
          <div>
            <label htmlFor="pre_requisites" className="block text-sm font-medium text-gray-700 mb-2">
              Pre-requisites
            </label>
            <textarea
              id="pre_requisites"
              name="pre_requisites"
              value={formData.pre_requisites}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter pre-requisite courses (optional)"
            />
            <p className="mt-1 text-xs text-gray-500">e.g., CS101, MATH101</p>
          </div>

          {/* Is Active */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleInputChange}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
              Active Course
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/courses/view')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update Course'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};
