import React, { useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface CreateProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: ProgramData) => void;
  departments: Array<{ id: number; name: string; short_code: string }>;
}

interface ProgramData {
  title: string;
  shortCode: string;
  department: number | string;
  description?: string;
}

export const CreateProgramModal: React.FC<CreateProgramModalProps> = ({ isOpen, onClose, onSubmit, departments }) => {
  const [formData, setFormData] = useState<ProgramData>({
    title: '',
    shortCode: '',
    department: '',
    description: '',
  });
  const [errors, setErrors] = useState<{ title?: string; shortCode?: string; department?: string }>({});

  // Backend-aligned validation patterns
  const titlePattern = useMemo(() => /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/, []);
  const shortCodePattern = useMemo(() => /^[A-Z0-9]{1,12}$/u, []);

  const validate = (data: ProgramData) => {
    const newErrors: { title?: string; shortCode?: string; department?: string } = {};
    const title = (data.title || '').trim();
    const shortCode = (data.shortCode || '').trim();
    if (!title) {
      newErrors.title = 'Title is required.';
    } else if (!titlePattern.test(title)) {
      newErrors.title = 'Only letters, numbers, spaces, dash, underscore and dot. Must start alphanumeric.';
    }

    if (!shortCode) {
      newErrors.shortCode = 'Short code is required.';
    } else if (!shortCodePattern.test(shortCode)) {
      newErrors.shortCode = 'Use UPPERCASE letters/numbers only (max 12, no spaces).';
    }

    if (!data.department) {
      newErrors.department = 'Please select a department.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    // Final trim/sanitize before validation
    const sanitized: ProgramData = {
      ...formData,
      title: formData.title.replace(/\s{2,}/g, ' ').trim(),
      shortCode: formData.shortCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
    };

    if (!validate(sanitized)) return;

    if (onSubmit) {
      onSubmit(sanitized);
    }

    // Reset form
    setFormData({
      title: '',
      shortCode: '',
      department: '',
      description: '',
    });
    setErrors({});
    onClose();
  };

  const handleChange = (field: keyof ProgramData, value: string | number) => {
    // Field-specific sanitization aligned with backend
    if (field === 'title' && typeof value === 'string') {
      // Allow letters, numbers, spaces, dash, underscore and dot; collapse multiple spaces
      const sanitized = value.replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s{2,}/g, ' ');
      setFormData(prev => ({ ...prev, title: sanitized }));
      // Live validation: only set error if non-empty and invalid
      if (sanitized && !titlePattern.test(sanitized.trim())) {
        setErrors(prev => ({ ...prev, title: 'Only letters, numbers, spaces, dash, underscore and dot. Must start alphanumeric.' }));
      } else {
        setErrors(prev => ({ ...prev, title: undefined }));
      }
      return;
    }
    if (field === 'shortCode' && typeof value === 'string') {
      // Force uppercase, strip invalids, limit length
      const sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      setFormData(prev => ({ ...prev, shortCode: sanitized }));
      if (sanitized && !shortCodePattern.test(sanitized)) {
        setErrors(prev => ({ ...prev, shortCode: 'Use UPPERCASE letters/numbers only (max 12, no spaces).'}));
      } else {
        setErrors(prev => ({ ...prev, shortCode: undefined }));
      }
      return;
    }
    if (field === 'department') {
      setFormData(prev => ({ ...prev, department: value }));
      // Clear department error on valid selection
      if (value) setErrors(prev => ({ ...prev, department: undefined }));
      return;
    }
    if (field === 'description' && typeof value === 'string') {
      setFormData(prev => ({ ...prev, description: value }));
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Program" maxWidth="md">
      <div className="space-y-3">
        {/* Program Title */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Program Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g., Software Engineering"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600">{errors.title}</p>
          )}
          {!errors.title && formData.title && (
            <p className="mt-1 text-[11px] text-gray-500">Allowed: letters, numbers, spaces, - _ . (start with a letter/number)</p>
          )}
        </div>

        {/* Short Code */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Short Code</label>
          <input
            type="text"
            value={formData.shortCode}
            onChange={(e) => handleChange('shortCode', e.target.value)}
            placeholder="e.g., SE"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {errors.shortCode && (
            <p className="mt-1 text-xs text-red-600">{errors.shortCode}</p>
          )}
          {!errors.shortCode && formData.shortCode && (
            <p className="mt-1 text-[11px] text-gray-500">Uppercase letters/numbers only, up to 12 characters</p>
          )}
        </div>

        {/* Department Dropdown */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
          <select
            value={formData.department}
            onChange={(e) => handleChange('department', parseInt(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
          >
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.short_code})
              </option>
            ))}
          </select>
          {errors.department && (
            <p className="mt-1 text-xs text-red-600">{errors.department}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Add program description"
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
        </div>

        {/* Done Button */}
        <div className="flex justify-center pt-3">
          <Button
            variant="coral"
            onClick={handleSubmit}
            className="px-12"
            disabled={Boolean(errors.title || errors.shortCode || errors.department) || !formData.title || !formData.shortCode || !formData.department}
          >
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
