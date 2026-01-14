import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { CreateProgramModal } from '../components/modals/CreateProgramModal';
import { programsAPI, departmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Department {
  id: number;
  name: string;
  short_code: string;
}

export const Program: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreateProgramModalOpen, setIsCreateProgramModalOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      const departmentsData = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDepartments(departmentsData);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const handleCreateProgram = async (data: any) => {
    setError('');
    setSuccessMessage('');
    
    try {
      await programsAPI.create({
        title: data.title,
        short_code: data.shortCode,
        department: data.department,
        description: data.description || '',
      });
      
      setSuccessMessage('Program created successfully!');
      setIsCreateProgramModalOpen(false);
      setTimeout(() => {
        setSuccessMessage('');
        navigate('/program/view');
      }, 1500);
    } catch (err: any) {
      console.error('Error creating program:', err.response);
      const errorMsg = err.response?.data?.detail 
        || err.response?.data?.title?.[0]
        || err.response?.data?.short_code?.[0]
        || err.response?.data?.department?.[0]
        || err.response?.data?.non_field_errors?.[0]
        || 'Failed to create program';
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
          {/* Create Program Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Create Program</h2>
            <button 
              onClick={() => setIsCreateProgramModalOpen(true)}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              Create
            </button>
          </div>

          {/* View Programs Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">View Programs</h2>
            <button 
              onClick={() => navigate('/program/view')}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* Create Program Modal */}
      <CreateProgramModal
        isOpen={isCreateProgramModalOpen}
        onClose={() => setIsCreateProgramModalOpen(false)}
        onSubmit={handleCreateProgram}
        departments={departments}
      />
    </DashboardLayout>
  );
};
