import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { programsAPI, departmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Department {
  id: number;
  name: string;
  short_code: string;
}

export const EditProgram: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [department, setDepartment] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProgram();
    fetchDepartments();
  }, [id]);

  const fetchProgram = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const response = await programsAPI.getById(parseInt(id));
      console.log('Program data:', response.data);
      
      const programData = response.data;
      setTitle(programData.title || '');
      setShortCode(programData.short_code || '');
      setDepartment(programData.department || 0);
      setDescription(programData.description || '');
    } catch (err: any) {
      console.error('Error fetching program:', err);
      setError('Failed to load program details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDepartments(data);
    } catch (err: any) {
      console.error('Error fetching departments:', err);
    }
  };

  const handleSaveEdit = async () => {
    // Validation
    if (!title.trim()) {
      setError('Program title is required');
      return;
    }
    if (!shortCode.trim()) {
      setError('Short code is required');
      return;
    }
    if (!department || department === 0) {
      setError('Please select a department');
      return;
    }

    try {
      setError(null);
      await programsAPI.partialUpdate(parseInt(id!), {
        title: title.trim(),
        short_code: shortCode.trim(),
        department: department,
        description: description.trim(),
      });

      setSuccessMessage('Program updated successfully!');
      setTimeout(() => {
        navigate('/program/view');
      }, 1500);
    } catch (err: any) {
      console.error('Error updating program:', err);
      const errorMsg =
        err.response?.data?.title?.[0] ||
        err.response?.data?.short_code?.[0] ||
        err.response?.data?.department?.[0] ||
        err.response?.data?.detail ||
        'Failed to update program. Please try again.';
      setError(errorMsg);
    }
  };

  const handleCancel = () => {
    navigate('/program/view');
  };

  if (loading) {
    return (
      <DashboardLayout 
        userName={user?.full_name || 'User'}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="p-6">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Loading program details...</p>
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
      <div className="p-6 space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white">Edit Program</h2>
        </div>

        {/* Edit Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            {/* Program Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Program Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter program title"
              />
            </div>

            {/* Short Code */}
            <div>
              <label htmlFor="shortCode" className="block text-sm font-medium text-gray-700 mb-2">
                Short Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="shortCode"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter short code (e.g., SE, CS)"
              />
            </div>

            {/* Department */}
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value={0}>Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.short_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter program description (optional)"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
