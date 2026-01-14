import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuth } from '../../context/AuthContext';
import {
  validateName,
  validateEmail,
  validateCNIC,
  validatePhone,
  validatePassword,
  sanitizeName,
  sanitizeCNIC,
  sanitizePhone
} from '../../utils/validation';

interface AddFacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: FacultyFormData) => Promise<void>;
  departments: Array<{ id: number; name: string; short_code: string }>;
  programs: Array<{ id: number; title: string; short_code: string }>;
  error?: string;
}

export interface FacultyFormData {
  facultyName: string;
  phoneNumber: string;
  designation: string;
  department: string;
  program: string;
  dateOfBirth: string;
  email: string;
  joiningDate: string;
  cnic: string;
  password: string;
}

export const AddFacultyModal: React.FC<AddFacultyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  departments,
  programs,
  error: externalError
}) => {
  const { user } = useAuth();
  type ScalarField = keyof Omit<FacultyFormData, 'coordinatorCourses'>;
  const [formData, setFormData] = useState<FacultyFormData>({
    facultyName: '',
    phoneNumber: '',
    designation: '',
    department: '',
    program: '',
    dateOfBirth: '',
    email: '',
    joiningDate: '',
    cnic: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);


  const handleSubmit = async () => {
    if (onSubmit) {
      setLoading(true);
      try {
        await onSubmit(formData);
        // Reset form only on success
        setFormData({
          facultyName: '',
          phoneNumber: '',
          designation: '',
          department: '',
          program: '',
          dateOfBirth: '',
          email: '',
          joiningDate: '',
          cnic: '',
          password: '',
        });
        onClose();
      } catch (error) {
        // Error will be shown via externalError prop, don't close modal
      } finally {
        setLoading(false);
      }
    }
  };

  const handleChange = (field: ScalarField, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Faculty" maxWidth="md">
      <div className="space-y-4">

        {/* Error Message */}
        {externalError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{externalError}</p>
          </div>
        )}

        {/* Info Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-blue-700">
            <span className="font-semibold">Note:</span> Faculty ID will be generated automatically by the system.
          </p>
        </div>

        {/* Faculty Name - With Validation */}
        <Input
          label="Faculty Name"
          value={formData.facultyName}
          onChange={(e) => handleChange('facultyName', e.target.value)}
          placeholder="Enter full name"
          required
          sanitize={sanitizeName}
          onValidate={(value) => validateName(value, 'Faculty Name')}
          helperText="Only letters, spaces, hyphens, and apostrophes allowed"
          success
        />

        {/* Email - With Validation */}
        <Input
          type="email"
          label="Email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="faculty@university.edu"
          required
          onValidate={validateEmail}
          helperText="Enter a valid email address"
          success
        />

        {/* CNIC - With Auto-formatting and Validation */}
        <Input
          label="CNIC"
          value={formData.cnic}
          onChange={(e) => handleChange('cnic', e.target.value)}
          placeholder="12345-1234567-1"
          required
          sanitize={sanitizeCNIC}
          onValidate={validateCNIC}
          maxLength={15}
          showCharCount
          helperText="13-digit national ID number (auto-formatted)"
          success
        />

        {/* Phone Number - With Validation */}
        <Input
          label="Phone Number"
          value={formData.phoneNumber}
          onChange={(e) => handleChange('phoneNumber', e.target.value)}
          placeholder="0300-1234567"
          sanitize={sanitizePhone}
          onValidate={validatePhone}
          maxLength={11}
          helperText="Optional: 11 digits"
          success
        />

        {/* Password - With Validation */}
        <Input
          type="password"
          label="Password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          placeholder="Enter strong password"
          required
          onValidate={validatePassword}
          helperText="Minimum 8 characters with uppercase, lowercase, and number"
          showCharCount
          maxLength={128}
          success
        />

        {/* Role Dropdown */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.designation}
            onChange={(e) => handleChange('designation', e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-500 focus:outline-none appearance-none bg-white transition-all"
          >
            <option value="">Select role</option>
            <option value="HOD">HOD (Head of Department)</option>
            <option value="CONVENER">Convener (Department Level)</option>
            <option value="FACULTY">Faculty (General Faculty Member)</option>
            {user?.role === 'CONVENER' && (
              <option value="AUDIT_TEAM">Audit Team (Course Folder Auditor)</option>
            )}
          </select>
          {['CONVENER'].includes(formData.designation) && (
            <p className="mt-1.5 text-xs text-amber-700 flex items-start gap-1">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Role assignment will be sent to Department HOD for approval</span>
            </p>
          )}
        </div>

        {/* Department Dropdown */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.department}
            onChange={(e) => handleChange('department', e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-500 focus:outline-none appearance-none bg-white transition-all"
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
          <label className="block text-sm font-semibold text-gray-700 mb-2">Program <span className="text-red-500">*</span> </label>
          <select
            value={formData.program}
            onChange={(e) => handleChange('program', e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-500 focus:outline-none appearance-none bg-white transition-all"
          >
            <option value="">Select program (optional)</option>
            {programs.map((prog) => (
              <option key={prog.id} value={prog.id}>
                {prog.title} ({prog.short_code})
              </option>
            ))}
          </select>
        </div>


        {/* Date of Birth */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleChange('dateOfBirth', e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* Joining Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Joining Date</label>
          <input
            type="date"
            value={formData.joiningDate}
            onChange={(e) => handleChange('joiningDate', e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-500 focus:outline-none transition-all"
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="coral" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating Faculty...' : 'Add Faculty'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
