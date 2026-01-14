import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { AddFacultyModal } from '../components/modals/AddFacultyModal';
import type { FacultyFormData } from '../components/modals/AddFacultyModal';
import { facultyAPI, departmentsAPI, programsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Department {
  id: number;
  name: string;
  short_code: string;
}

interface Program {
  id: number;
  title: string;
  short_code: string;
}


export const FacultyManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAddFacultyModalOpen, setIsAddFacultyModalOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments();
    fetchPrograms();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDepartments(data);
    } catch (err: any) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchPrograms = async () => {
    try {
      const response = await programsAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setPrograms(data);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
    }
  };


  const handleAddFaculty = async (data: FacultyFormData) => {
    setError(null);
    
    // Validation
    if (!data.email || !data.facultyName || !data.cnic || !data.password) {
      setError('Email, Name, CNIC, and Password are required');
      throw new Error('Validation failed');
    }
    
    if (!data.department) {
      setError('Please select a department');
      throw new Error('Validation failed');
    }
    
    if (!data.designation) {
      setError('Please select a designation');
      throw new Error('Validation failed');
    }

    if (data.password.length < 8) {
      setError('Password must be at least 8 characters long');
      throw new Error('Validation failed');
    }

    if (data.designation === 'COORDINATOR') {
      if (!data.program) {
        setError('Please select a program for the coordinator');
        throw new Error('Validation failed');
      }
    }

    function extractAPIError(err: any) {
      if (!err || !err.response || !err.response.data) return 'Failed to add faculty. Please try again.';
      const d = err.response.data;
      if (typeof d === 'string') return d;
      if (d.detail) return d.detail;
      const fields = ['email','cnic','password','phone','designation','department','program'];
      for (const key of fields) {
        if (d[key]) {
          if (Array.isArray(d[key])) return d[key].join(' ');
          if (typeof d[key] === 'string') return d[key];
          if (typeof d[key] === 'object') {
            // nested messages
            const first = Object.values(d[key])[0];
            if (Array.isArray(first)) return first.join(' ');
            if (typeof first === 'string') return first;
          }
        }
      }
      return 'Failed to add faculty. Please try again.';
    }

    try {
      await facultyAPI.create({
        email: data.email,
        full_name: data.facultyName,
        password: data.password,
        cnic: data.cnic,
        department: parseInt(data.department),
        program: data.program ? parseInt(data.program) : undefined,
        designation: data.designation,
        phone: data.phoneNumber || undefined,
        date_of_joining: data.joiningDate || undefined,
      });

      setError(null);
      setIsAddFacultyModalOpen(false);
      if (data.designation === 'COORDINATOR' || data.designation === 'CONVENER') {
        setSuccessMessage('Faculty created and role assignment request sent to HOD for approval.');
      } else {
        setSuccessMessage('Faculty added successfully!');
      }
      setTimeout(() => {
        setSuccessMessage(null);
        navigate('/faculty-management/manage');
      }, 1500);
    } catch (err: any) {
      console.error('Error adding faculty:', err);
      const errorMsg = extractAPIError(err);
      setError(errorMsg);
      throw err;
    }
  };

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Two Sections in One Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Add Faculty Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Add Faculty</h2>
            <button 
              onClick={() => setIsAddFacultyModalOpen(true)}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              Create
            </button>
          </div>

          {/* Manage Faculty Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Manage Faculty</h2>
            <button 
              onClick={() => navigate('/faculty-management/manage')}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              Manage
            </button>
          </div>
        </div>
      </div>

      {/* Add Faculty Modal */}
      <AddFacultyModal
        isOpen={isAddFacultyModalOpen}
        onClose={() => {
          setIsAddFacultyModalOpen(false);
          setError(null);
        }}
        onSubmit={handleAddFaculty}
        departments={departments}
        programs={programs}
        error={error || undefined}
      />
    </DashboardLayout>
  );
};
