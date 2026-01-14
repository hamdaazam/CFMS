import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { coursesAPI, facultyAPI, departmentsAPI, programsAPI, termsAPI, courseAllocationsAPI } from '../../services/api';

interface AllocateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: CourseAllocationData) => void;
}

interface CourseAllocationData {
  course: number;
  faculty: number;
  section: string;
  department: number;
  program: number | null;
  term?: number | null;
  is_coordinator?: boolean;
}

interface Course {
  id: number;
  code: string;
  title: string;
  department: number;
  program: number | null;
}

interface Faculty {
  id: number;
  faculty_id: string | null;
  user: {
    full_name: string;
    email: string;
  };
  department: number;
  program: number | null;
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
  department: number;
}

export const AllocateCourseModal: React.FC<AllocateCourseModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CourseAllocationData>({
    course: 0,
    faculty: 0,
    section: '',
    department: 0,
    program: null,
    term: null,
    is_coordinator: false,
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [allFaculty, setAllFaculty] = useState<Faculty[]>([]);
  const [filteredFaculty, setFilteredFaculty] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [filteredPrograms, setFilteredPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTermId, setActiveTermId] = useState<number | null>(null);
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Filter programs when department changes
  useEffect(() => {
    if (formData.department) {
      const filtered = allPrograms.filter(p => p.department === formData.department);
      setFilteredPrograms(filtered);
    } else {
      setFilteredPrograms([]);
    }
  }, [formData.department, allPrograms]);

  // Filter faculty when department/program changes
  useEffect(() => {
    let filtered = allFaculty;
    
    if (formData.department) {
      filtered = filtered.filter(f => f.department === formData.department);
    }
    
    if (formData.program) {
      filtered = filtered.filter(f => f.program === formData.program || f.program === null);
    }
    
    setFilteredFaculty(filtered);
  }, [formData.department, formData.program, allFaculty]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [coursesRes, facultyRes, deptRes, progRes, termRes] = await Promise.all([
        coursesAPI.getAll({ is_active: true }),
        facultyAPI.getAll({ is_active: true }),
        departmentsAPI.getAll(),
        programsAPI.getAll(),
        termsAPI.getAll({ is_active: true }),
      ]);

      // Handle paginated responses
      const coursesData = coursesRes.data.results || coursesRes.data;
      const facultyData = facultyRes.data.results || facultyRes.data;
      const deptData = deptRes.data.results || deptRes.data;
      const progData = progRes.data.results || progRes.data;
      const termData = termRes.data.results || termRes.data;

      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setAllFaculty(Array.isArray(facultyData) ? facultyData : []);
      setFilteredFaculty(Array.isArray(facultyData) ? facultyData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setAllPrograms(Array.isArray(progData) ? progData : []);
      // Use active term if available for pre-checks
      if (Array.isArray(termData) && termData.length > 0) {
        const tid = termData[0].id;
        setActiveTermId(tid);
        setActiveTermLabel(termData[0].session_term || termData[0].label || null);
        // Set the term in the form data so back-end receives it
        setFormData(prev => ({ ...prev, term: tid }));
      } else if (termData && termData.id) {
        const tid = termData.id;
        setActiveTermId(tid);
        setActiveTermLabel(termData.session_term || termData.label || null);
        setFormData(prev => ({ ...prev, term: tid }));
      } else {
        setActiveTermId(null);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.course) {
      setError('Please select a course');
      return;
    }
    if (!formData.faculty) {
      setError('Please select a faculty member');
      return;
    }
    if (!formData.section.trim()) {
      setError('Please enter a section');
      return;
    }
    if (!formData.department) {
      setError('Please select a department');
      return;
    }

    // Ensure term field is present for API; use activeTermId if none selected
    const termToSubmit = formData.term ?? activeTermId;
    if (!termToSubmit) {
      setError('No active academic term found. Please select a term before allocating.');
      return;
    }

    if (onSubmit) {
      // Pre-check duplicate allocation for the active term
      try {
        const termIdToCheck = activeTermId;
        if (termIdToCheck) {
          const resp = await courseAllocationsAPI.getAll({
            course: formData.course,
            faculty: formData.faculty,
            section: formData.section,
            term: termIdToCheck,
            is_active: true,
          });

          const count = resp.data?.count ?? (Array.isArray(resp.data) ? resp.data.length : 0);
          if (count > 0) {
            setError('This instructor already has the same course and section for the active term.');
            return;
          }
        }
      } catch (err) {
        // If the pre-check fails for any reason, proceed and let the server validate
        console.error('Failed to check duplicates:', err);
      }
      onSubmit({ ...formData, term: termToSubmit });
    }
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      course: 0,
      faculty: 0,
      section: '',
      department: 0,
      program: null,
      term: null,
      is_coordinator: false,
    });
    setError('');
    onClose();
  };

  const handleChange = (field: keyof CourseAllocationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Get selected course details
  const selectedCourse = courses.find(c => c.id === formData.course);
  
  // Get selected faculty details
  const selectedFaculty = allFaculty.find(f => f.id === formData.faculty);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Allocate Course" maxWidth="md">
      <div className="space-y-3">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-gray-600">Loading data...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Department Dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                DEPARTMENT <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => handleChange('department', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
                required
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.short_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Program Dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                PROGRAM <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <select
                value={formData.program || ''}
                onChange={(e) => handleChange('program', e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
                disabled={!formData.department}
              >
                <option value="">Select program (Optional)</option>
                {filteredPrograms.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.title} ({prog.short_code})
                  </option>
                ))}
              </select>
              {!formData.department && (
                <p className="mt-1 text-xs text-gray-500">Select a department first</p>
              )}
            </div>

            {/* Course Dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                COURSE <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.course}
                onChange={(e) => handleChange('course', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Instructor Dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                INSTRUCTOR <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.faculty}
                onChange={(e) => handleChange('faculty', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
                disabled={!formData.department}
                required
              >
                <option value="">Select instructor</option>
                {filteredFaculty.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.user.full_name} {faculty.faculty_id ? `(${faculty.faculty_id})` : ''}
                  </option>
                ))}
              </select>
              {!formData.department && (
                <p className="mt-1 text-xs text-gray-500">Select a department first</p>
              )}
            </div>

            {/* Instructor Details (Read-only) */}
            {selectedFaculty && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Instructor Details:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Faculty ID:</span>
                    <span className="ml-2 font-medium">{selectedFaculty.faculty_id || 'Not assigned'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2 font-medium break-all">{selectedFaculty.user.email || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                SECTION <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.section}
                onChange={(e) => handleChange('section', e.target.value.toUpperCase())}
                placeholder="Enter section (e.g., 1, 2, 3)"
                maxLength={10}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            {/* Course Coordinator Checkbox */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                id="is_coordinator"
                checked={formData.is_coordinator || false}
                onChange={(e) => handleChange('is_coordinator', e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <label htmlFor="is_coordinator" className="text-sm font-medium text-gray-700 cursor-pointer">
                Make this instructor a Course Coordinator for this course
              </label>
            </div>
            {formData.is_coordinator && (
              <p className="text-xs text-blue-700 ml-7 -mt-2">
                This instructor will be assigned as coordinator for this course. Any role (Faculty, Convener, HOD) can be a coordinator.
              </p>
            )}

            {/* Summary Box */}
                        {/* Term (Active) - readonly field */}
                        {activeTermLabel && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">TERM</label>
                            <div className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50">
                              {activeTermLabel}
                            </div>
                          </div>
                        )}
            {selectedCourse && selectedFaculty && formData.section && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                <h4 className="text-xs font-semibold text-blue-900">Allocation Summary:</h4>
                <p className="text-xs text-blue-800">
                  <strong>{selectedCourse.code}</strong> - {selectedCourse.title}
                </p>
                <p className="text-xs text-blue-800">
                  Instructor: <strong>{selectedFaculty.user.full_name}</strong>
                </p>
                <p className="text-xs text-blue-800">
                  Section: <strong>{formData.section}</strong>
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="coral" onClick={handleSubmit}>
                Allocate Course
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
