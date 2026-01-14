import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface AssignRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (role: string) => void;
}

export const AssignRoleModal: React.FC<AssignRoleModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [selectedRole, setSelectedRole] = useState('');

  const handleSubmit = () => {
    if (onSubmit && selectedRole) {
      onSubmit(selectedRole);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Role" maxWidth="md">
      <div className="space-y-6">
        {/* Role Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
          >
            <option value="">Select role</option>
            <option value="HOD">HOD</option>
            <option value="Coordinator">Coordinator</option>
            <option value="Convener">Convener</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Lecturer">Lecturer</option>
          </select>
        </div>

        {/* Done Button */}
        <div className="flex justify-center pt-4">
          <Button variant="coral" onClick={handleSubmit} className="px-12">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
