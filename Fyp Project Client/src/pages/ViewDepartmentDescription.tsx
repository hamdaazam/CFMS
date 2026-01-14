import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { departmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Department {
  id: number;
  name: string;
  short_code: string;
  description: string;
}

export const ViewDepartmentDescription: React.FC = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartment();
  }, [id]);

  const fetchDepartment = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await departmentsAPI.getById(parseInt(id));
      console.log('Department details:', response.data);
      setDepartment(response.data);
    } catch (err) {
      setError('Failed to fetch department details');
      console.error('Error fetching department:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout 
        userName={user?.full_name || 'User'}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500">Loading department details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !department) {
    return (
      <DashboardLayout 
        userName={user?.full_name || 'User'}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="p-6">
          <div className="bg-red-500/20 border border-red-500/50 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Department not found'}
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
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-4xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Department name: {department.name}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Code: {department.short_code}
          </p>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Description</h3>
            <div className="bg-gray-50 rounded-lg p-6 min-h-[200px]">
              <p className="text-gray-700 leading-relaxed">
                {department.description || 'No description available'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
