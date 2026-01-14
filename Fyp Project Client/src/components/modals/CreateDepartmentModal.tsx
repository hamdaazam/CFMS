import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface CreateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: DepartmentData) => void;
}

interface DepartmentData {
  name: string;
  shortCode: string;
  description: string;
}

export const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<DepartmentData>({
    name: '',
    shortCode: '',
    description: '',
  });

  const handleSubmit = () => {
    // Validation
    const name = formData.name.trim();
    const code = formData.shortCode.trim().toUpperCase();
    if (!name) {
      alert('Please enter department name');
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(name)) {
      alert('Name can only contain letters, numbers, spaces, dash, underscore and dot (must start with a letter/number).');
      return;
    }
    if (!code) {
      alert('Please enter short code');
      return;
    }
    if (!/^[A-Z0-9]{1,10}$/.test(code)) {
      alert('Short code must be UPPERCASE alphanumeric (max 10 chars, no spaces).');
      return;
    }
    
    if (onSubmit) {
  onSubmit({ ...formData, shortCode: code, name });
    }
    
    // Reset form
    setFormData({
      name: '',
      shortCode: '',
      description: '',
    });
    onClose();
  };

  const handleChange = (field: keyof DepartmentData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Department" maxWidth="md">
      <div className="space-y-3">
        {/* Department Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Department name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Enter department name"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Short Code */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Short Code</label>
          <input
            type="text"
            value={formData.shortCode}
            onChange={(e) => handleChange('shortCode', e.target.value)}
            placeholder="e.g., CS, EE"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Add Description"
            rows={6}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          />
        </div>

        {/* Done Button */}
        <div className="flex justify-center pt-3">
          <Button variant="coral" onClick={handleSubmit} className="px-12">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
