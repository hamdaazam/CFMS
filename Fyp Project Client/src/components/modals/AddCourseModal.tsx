import React, { useState, useEffect } from 'react';
import { coursesAPI, departmentsAPI, programsAPI } from '../../services/api';

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

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCourseModal: React.FC<AddCourseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
      code: '',
      title: '',
      credit_hours: 3,
      course_type: 'THEORY',
      department: '',
      program: '',
      description: '',
      pre_requisites: '',
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchDepartmentsAndPrograms();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.department) {
      const filteredPrograms = allPrograms.filter(
        (p) => p.department === Number(formData.department)
      );
      setPrograms(filteredPrograms);
    } else {
      setPrograms([]);
    }
  }, [formData.department, allPrograms]);

  const fetchDepartmentsAndPrograms = async () => {
    try {
      const [deptResponse, progResponse] = await Promise.all([
        departmentsAPI.getAll(),
        programsAPI.getAll(),
      ]);
      
      // Handle paginated responses from Django REST Framework
      const deptData = deptResponse.data.results || deptResponse.data;
      const progData = progResponse.data.results || progResponse.data;
      
      // Ensure responses are arrays
      if (Array.isArray(deptData)) {
        setDepartments(deptData);
      } else {
        console.error('Invalid departments response:', deptResponse.data);
        setDepartments([]);
      }
      
      if (Array.isArray(progData)) {
        setAllPrograms(progData);
      } else {
        console.error('Invalid programs response:', progResponse.data);
        setAllPrograms([]);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load departments and programs');
      setDepartments([]);
      setAllPrograms([]);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? Number(value)
          : type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
    if (!formData.program) {
      setError('Program is required');
      return;
    }

    // Frontend sanitization
    const codeUpper = formData.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(codeUpper)) {
      setError('Course code can only contain letters, numbers, and hyphens (no spaces).');
      return;
    }
    if (!/^[A-Za-z0-9 _.-]+$/.test(formData.title.trim())) {
      setError('Title can only contain letters, numbers, spaces, dash, underscore and dot.');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        code: codeUpper,
        title: formData.title.trim(),
        credit_hours: formData.credit_hours,
        course_type: formData.course_type,
        department: Number(formData.department),
        program: Number(formData.program),
        description: formData.description.trim(),
        pre_requisites: formData.pre_requisites.trim(),
      };

      await coursesAPI.create(payload);
      alert('Course created successfully!');
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating course:', err);
      if (err.response?.data?.code) {
        setError(err.response.data.code[0] || 'Failed to create course');
      } else {
        setError(err.response?.data?.message || 'Failed to create course');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      title: '',
      credit_hours: 3,
      course_type: 'THEORY',
      department: '',
      program: '',
      description: '',
      pre_requisites: '',
      // is_active: true, // Removed Active Course checkbox
    });
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <h3 className="text-xl font-bold text-white">Add New Course</h3>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Course Code */}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Course Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., CS101"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Will be converted to uppercase</p>
          </div>

          {/* Course Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Introduction to Programming"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Credit Hours */}
            <div>
              <label htmlFor="credit_hours" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            {/* Course Type */}
            <div>
              <label htmlFor="course_type" className="block text-sm font-medium text-gray-700 mb-1">
                Course Type <span className="text-red-500">*</span>
              </label>
              <select
                id="course_type"
                name="course_type"
                value={formData.course_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              >
                <option value="THEORY">Theory</option>
                <option value="LAB">Lab</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Department */}
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                id="department"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
              <label htmlFor="program" className="block text-sm font-medium text-gray-700 mb-1">
                Program <span className="text-red-500">*</span>
              </label>
              <select
                id="program"
                name="program"
                value={formData.program}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={!formData.department}
                required
              >
                <option value="">Select Program</option>
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
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter course description (optional)"
            />
          </div>

          {/* Pre-requisites */}
          <div>
            <label htmlFor="pre_requisites" className="block text-sm font-medium text-gray-700 mb-1">
              Pre-requisites
            </label>
            <textarea
              id="pre_requisites"
              name="pre_requisites"
              value={formData.pre_requisites}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., CS101, MATH101"
            />
          </div>


          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
