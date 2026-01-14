import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { CreateDepartmentModal } from '../components/modals/CreateDepartmentModal';
import { departmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const Department: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreateDepartmentModalOpen, setIsCreateDepartmentModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleCreateDepartment = async (data: any) => {
    setError('');
    setSuccessMessage('');
    
    try {
      await departmentsAPI.create({
        name: data.name,
        short_code: data.shortCode,
        description: data.description || '',
      });
      
      setSuccessMessage('Department created successfully!');
      setIsCreateDepartmentModalOpen(false);
      setTimeout(() => {
        setSuccessMessage('');
        navigate('/department/view');
      }, 1500);
    } catch (err: any) {
      console.error('Error creating department:', err.response);
      const errorMsg = err.response?.data?.detail 
        || err.response?.data?.name?.[0]
        || err.response?.data?.short_code?.[0]
        || err.response?.data?.non_field_errors?.[0]
        || 'Failed to create department';
      setError(errorMsg);
      setTimeout(() => setError(''), 5000);
    }
  };

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/50 text-green-700 px-4 py-3 rounded-lg mb-6">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Two Sections in One Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {/* Create Department Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Create Department</h2>
            <button 
              onClick={() => setIsCreateDepartmentModalOpen(true)}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              Create
            </button>
          </div>

          {/* View Departments Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">View Departments</h2>
            <button 
              onClick={() => navigate('/department/view')}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* Create Department Modal */}
      <CreateDepartmentModal
        isOpen={isCreateDepartmentModalOpen}
        onClose={() => setIsCreateDepartmentModalOpen(false)}
        onSubmit={handleCreateDepartment}
      />
    </DashboardLayout>
  );
};
