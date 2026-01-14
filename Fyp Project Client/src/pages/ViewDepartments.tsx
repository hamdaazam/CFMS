import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { departmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Department {
  id: number;
  name: string;
  short_code: string;
  description: string;
}

export const ViewDepartments: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [editForm, setEditForm] = useState({ name: '', short_code: '', description: '' });
  const [editError, setEditError] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await departmentsAPI.getAll();
      console.log('Departments API response:', response.data);
      // Handle both array and paginated response
      const departmentsData = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDepartments(departmentsData);
    } catch (err) {
      setError('Failed to fetch departments');
      console.error('Error fetching departments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this department?')) {
      return;
    }

    try {
      await departmentsAPI.delete(id);
      setSuccessMessage('Department deleted successfully!');
      fetchDepartments(); // Refresh the list
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete department');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openEdit = (dept: Department) => {
    setEditDept(dept);
    setEditForm({ name: dept.name, short_code: dept.short_code, description: dept.description || '' });
    setEditError('');
    setIsEditOpen(true);
  };

  const validateDeptForm = () => {
    const name = editForm.name.trim();
    const code = editForm.short_code.trim().toUpperCase();
    if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(name)) {
      setEditError('Name can only contain letters, numbers, spaces, dash, underscore and dot (must start with a letter/number).');
      return false;
    }
    if (!/^[A-Z0-9]{1,10}$/.test(code)) {
      setEditError('Short code must be UPPERCASE alphanumeric (max 10 chars, no spaces).');
      return false;
    }
    setEditError('');
    setEditForm(prev => ({ ...prev, short_code: code }));
    return true;
  };

  const submitEdit = async () => {
    if (!editDept) return;
    if (!validateDeptForm()) return;
    try {
      await departmentsAPI.update(editDept.id, {
        name: editForm.name.trim(),
        short_code: editForm.short_code.trim().toUpperCase(),
        description: editForm.description.trim(),
      });
      setIsEditOpen(false);
      setSuccessMessage('Department updated successfully!');
      fetchDepartments();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setEditError(
        err.response?.data?.name?.[0] ||
        err.response?.data?.short_code?.[0] ||
        err.response?.data?.detail ||
        'Failed to update department'
      );
    }
  };

  // Filter departments based on search
  const filteredDepartments = Array.isArray(departments) 
    ? departments.filter(dept =>
        dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.short_code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/50 text-green-700 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Header Section */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Create Department</h2>
          <Button variant="coral" onClick={() => navigate('/department')}>Create</Button>
        </div>

        {/* Departments Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Table Header */}
          <div className="bg-primary px-6 py-4 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">Departments</h3>
            <button className="text-white hover:text-white/80" onClick={() => setCollapsed(!collapsed)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
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

          {/* Table */}
          {!collapsed && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sr no</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Department name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Loading departments...
                    </td>
                  </tr>
                ) : filteredDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No departments found
                    </td>
                  </tr>
                ) : (
                  filteredDepartments.map((department, index) => (
                    <tr key={department.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{department.name}</div>
                          <div className="text-xs text-gray-500 mt-1">Code: {department.short_code}</div>
                        </div>
                      </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-md truncate">{department.description || 'No description'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <button
                        onClick={() => navigate(`/department/description/${department.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => openEdit(department)}
                        className="text-amber-600 hover:text-amber-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(department.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Edit Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
              <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-4 flex justify-between items-center rounded-t-lg">
                <h3 className="text-white font-semibold">Edit Department</h3>
                <button onClick={() => setIsEditOpen(false)} className="text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                {editError && <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-600">{editError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Code</label>
                  <input
                    type="text"
                    value={editForm.short_code}
                    onChange={(e) => setEditForm({ ...editForm, short_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setIsEditOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={submitEdit} className="px-4 py-2 bg-primary text-white rounded-lg">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
