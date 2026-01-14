import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
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


export const EditFaculty: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [facultyName, setFacultyName] = useState('');
  const [email, setEmail] = useState('');
  const [cnic, setCnic] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState<number>(0);
  const [program, setProgram] = useState<number>(0);
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [address, setAddress] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  useEffect(() => {
    fetchFaculty();
    fetchDepartments();
    fetchPrograms();
  }, [id]);

  const fetchFaculty = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const response = await facultyAPI.getById(parseInt(id));
      console.log('Faculty data:', response.data);
      
      const facultyData = response.data;
      setFacultyName(facultyData.user_details?.full_name || '');
      setEmail(facultyData.user_details?.email || '');
      setCnic(facultyData.user_details?.cnic || '');
      setPhone(facultyData.phone || '');
      setDesignation(facultyData.designation || '');
      setDepartment(facultyData.department || 0);
      setProgram(facultyData.program || 0);
      setDateOfJoining(facultyData.date_of_joining || '');
      setQualification(facultyData.qualification || '');
      setSpecialization(facultyData.specialization || '');
      setAddress(facultyData.address || '');

    } catch (err: any) {
      console.error('Error fetching faculty:', err);
      setError('Failed to load faculty details. Please try again.');
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

  const fetchPrograms = async () => {
    try {
      const response = await programsAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setPrograms(data);
    } catch (err: any) {
      console.error('Error fetching programs:', err);
    }
  };


  const handleSaveEdit = async () => {
    // Validation
    if (!facultyName.trim()) {
      setError('Faculty name is required');
      return;
    }
    
    // Validate CNIC format
    const cleanCnic = cnic.replace(/[-\s]/g, '');
    if (!cleanCnic || cleanCnic.length !== 13 || !/^\d+$/.test(cleanCnic)) {
      setError('CNIC must be exactly 13 digits');
      return;
    }
    
    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (!designation) {
      setError('Please select a designation');
      return;
    }
    if (!department || department === 0) {
      setError('Please select a department');
      return;
    }

    try {
      setError(null);
      const payload: any = {
        user_data: {
          full_name: facultyName,
          email: email || null,
          cnic: cleanCnic,
        },
        designation: designation,
        department: department,
        program: program || undefined,
        phone: phone || undefined,
        date_of_joining: dateOfJoining || undefined,
        qualification: qualification || undefined,
        specialization: specialization || undefined,
        address: address || undefined,
      };


      await facultyAPI.partialUpdate(parseInt(id!), payload);

      setSuccessMessage('Faculty updated successfully!');
      setTimeout(() => {
        navigate('/faculty-management/manage');
      }, 1500);
    } catch (err: any) {
      console.error('Error updating faculty:', err);
      const errorMsg =
        err.response?.data?.user_data?.cnic?.[0] ||
        err.response?.data?.user_data?.email?.[0] ||
        err.response?.data?.designation?.[0] ||
        err.response?.data?.department?.[0] ||
        err.response?.data?.detail ||
        'Failed to update faculty. Please try again.';
      setError(errorMsg);
    }
  };

  const handleCancel = () => {
    navigate('/faculty-management/manage');
  };

  if (loading) {
    return (
      <DashboardLayout 
        userName={user?.full_name || 'User'}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="p-6">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Loading faculty details...</p>
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
          <h2 className="text-2xl font-bold text-white">Edit Faculty</h2>
        </div>

        {/* Edit Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            {/* User Information - Now Editable */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-900 mb-3">User Information (Admin Can Edit)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={facultyName}
                    onChange={(e) => setFacultyName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="faculty@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CNIC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="1234567890123 (13 digits)"
                    maxLength={13}
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be exactly 13 digits</p>
                </div>
              </div>
            </div>

            {/* Editable Faculty Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="03XXXXXXXXX"
                />
              </div>

              {/* Designation */}
              <div>
                <label htmlFor="designation" className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select role</option>
                  <option value="HOD">HOD (Head of Department)</option>
                  <option value="CONVENER">Convener (Department Level)</option>
                  <option value="COORDINATOR">Coordinator (Program/Course Level)</option>
                  <option value="FACULTY">Faculty (General Faculty Member)</option>
                  <option value="AUDIT_TEAM">Audit Team (Course Folder Auditor)</option>
                </select>
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

              {/* Program */}
              <div>
                <label htmlFor="program" className="block text-sm font-medium text-gray-700 mb-2">
                  Program
                </label>
                <select
                  id="program"
                  value={program}
                  onChange={(e) => setProgram(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value={0}>Select Program (Optional)</option>
                  {programs.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.title} ({prog.short_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date of Joining */}
              <div>
                <label htmlFor="dateOfJoining" className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Joining
                </label>
                <input
                  type="date"
                  id="dateOfJoining"
                  value={dateOfJoining}
                  onChange={(e) => setDateOfJoining(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Qualification */}
              <div>
                <label htmlFor="qualification" className="block text-sm font-medium text-gray-700 mb-2">
                  Qualification
                </label>
                <input
                  type="text"
                  id="qualification"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., PhD, MS, BS"
                />
              </div>
            </div>


            {/* Specialization */}
            <div>
              <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-2">
                Specialization
              </label>
              <input
                type="text"
                id="specialization"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Machine Learning, Software Engineering"
              />
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter full address"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-4 border-t">
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
