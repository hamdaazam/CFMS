import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { programsAPI, departmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Program {
  id: number;
  title: string;
  short_code: string;
  department: number;
  department_name?: string;
  description?: string;
}

interface Department {
  id: number;
  name: string;
  short_code: string;
}

export const ViewPrograms: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchPrograms();
    fetchDepartments();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await programsAPI.getAll();
      console.log('Programs response:', response);
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setPrograms(data);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
      setError('Failed to load programs. Please try again.');
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

  const getDepartmentName = (departmentId: number): string => {
    const dept = departments.find(d => d.id === departmentId);
    return dept ? `${dept.name} (${dept.short_code})` : 'Unknown';
  };

  const handleEdit = (id: number) => {
    navigate(`/program/edit/${id}`);
  };

  const handleDelete = async (id: number) => {
    const program = programs.find(p => p.id === id);
    if (!program) return;

    if (window.confirm(`Are you sure you want to delete the program "${program.title}"?`)) {
      try {
        await programsAPI.delete(id);
        setSuccessMessage('Program deleted successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchPrograms();
      } catch (err: any) {
        console.error('Error deleting program:', err);
        const errorMsg = err.response?.data?.detail || 'Failed to delete program. Please try again.';
        setError(errorMsg);
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  const filteredPrograms = programs.filter(program =>
    program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    program.short_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getDepartmentName(program.department).toLowerCase().includes(searchQuery.toLowerCase())
  );


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

        {/* Header Section */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Programs</h2>
          <Button variant="coral" onClick={() => navigate('/program')}>Add Program</Button>
        </div>

        {/* Programs Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Table Header */}
          <div className="bg-primary px-6 py-4 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">Program Details</h3>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-white hover:text-white/80 transition-transform"
              aria-label={collapsed ? 'Expand programs' : 'Collapse programs'}
            >
              <svg className={`w-5 h-5 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Search */}
          {!collapsed && (
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          )}

          {/* Loading State */}
          {loading && !collapsed && (
            <div className="p-8 text-center text-gray-500">
              Loading programs...
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredPrograms.length === 0 && !collapsed && (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'No programs found matching your search.' : 'No programs available. Add a program to get started.'}
            </div>
          )}

          {/* Table */}
          {!loading && filteredPrograms.length > 0 && !collapsed && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sr. No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Program Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Short Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPrograms.map((program, index) => (
                    <tr key={program.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{program.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{program.short_code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{getDepartmentName(program.department)}</td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button
                          onClick={() => handleEdit(program.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(program.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
