import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Card } from '../../../components/common/Card';
import { useAuth } from '../../../context/AuthContext';
import { facultyAPI, authAPI } from '../../../services/api';
import type { AxiosError } from 'axios';

type Role = 'faculty' | 'coordinator' | 'convener' | 'audit' | 'hod';

interface ProfileData {
  faculty_id: number;
  user_details: {
    id: number;
    full_name: string;
    email: string;
    cnic: string;
    role: string;
    profile_picture?: string;
  };
  department_details: {
    department_id: number;
    name: string;
    code?: string;
    short_code?: string;
  };
  program_details?: {
    program_id: number;
    title?: string;
    name?: string;
    short_code?: string;
    code?: string;
  };
  designation: string;
  phone?: string;
  address?: string;
  date_of_joining?: string;
  qualification?: string;
  specialization?: string;
  is_active: boolean;
}

export const UnifiedProfile: React.FC<{ role: Role }> = ({ role }) => {
  const { user, setUser } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasFacultyProfile, setHasFacultyProfile] = useState<boolean>(true);

  const [editData, setEditData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    qualification: '',
    specialization: '',
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchProfileData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Try faculty profile first
      try {
        const response = await facultyAPI.getMyProfile();
        setHasFacultyProfile(true);
        setProfileData(response.data);
        setEditData({
          full_name: response.data.user_details.full_name,
          email: response.data.user_details.email,
          phone: response.data.phone || '',
          address: response.data.address || '',
          qualification: response.data.qualification || '',
          specialization: response.data.specialization || '',
        });
      } catch (e: unknown) {
        const ax = e as AxiosError<any>;
        // Fallback: some users (e.g., newly created AUDIT_MEMBER) may not yet have a faculty profile
        if (ax?.response?.status === 404) {
          const me = await authAPI.getCurrentUser();
          const u = me.data as {
            id: number; full_name: string; email?: string; cnic: string; role: string; profile_picture?: string;
            department?: number | null; department_name?: string | null;
            program?: number | null; program_name?: string | null; role_display?: string;
          };
          const mapped: ProfileData = {
            faculty_id: 0,
            user_details: {
              id: u.id,
              full_name: u.full_name,
              email: u.email || '',
              cnic: u.cnic,
              role: u.role,
              profile_picture: u.profile_picture,
            },
            department_details: {
              department_id: u.department || 0,
              name: u.department_name || '—',
              short_code: undefined,
              code: undefined,
            },
            program_details: u.program ? {
              program_id: u.program,
              title: u.program_name || undefined,
              short_code: undefined,
              code: undefined,
              name: u.program_name || undefined,
            } : undefined,
            designation: u.role_display || 'Audit Member',
            phone: '',
            address: '',
            date_of_joining: undefined,
            qualification: '',
            specialization: '',
            is_active: true,
          };
          setHasFacultyProfile(false);
          setProfileData(mapped);
          setEditData({
            full_name: mapped.user_details.full_name,
            email: mapped.user_details.email,
            phone: '',
            address: '',
            qualification: '',
            specialization: '',
          });
        } else {
          throw e;
        }
      }
    } catch (err: unknown) {
      console.error('Failed to fetch profile:', err);
      const ax = err as AxiosError<{ error?: string }>;
      const message = ax.response?.data?.error || 'Failed to load profile data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleProfileUpdate = async () => {
    try {
      setIsSaving(true);
      setError(null);
      if (hasFacultyProfile) {
        const updatePayload = {
          user_data: { full_name: editData.full_name, email: editData.email },
          phone: editData.phone,
          address: editData.address,
          qualification: editData.qualification,
          specialization: editData.specialization,
        };
        const response = await facultyAPI.updateMyProfile(updatePayload);
        // Backend returns { message, data }
        const updated = response.data?.data ?? response.data;
        setProfileData(updated);
      } else {
        // Fallback: update only basic user fields
        await authAPI.updateProfile({ full_name: editData.full_name, email: editData.email });
        // Refresh current user and re-map to profile shape
        const me = await authAPI.getCurrentUser();
        const u = me.data;
        setProfileData((prev) => prev ? {
          ...prev,
          user_details: {
            ...prev.user_details,
            full_name: u.full_name,
            email: u.email || '',
          }
        } : prev);
      }

      if (user) {
        const updatedUser = { ...user, full_name: editData.full_name, email: editData.email } as any;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (err: unknown) {
      console.error('Failed to update profile:', err);
      const ax = err as AxiosError<{ error?: string }>;
      const message = ax.response?.data?.error || 'Failed to update profile';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      setPasswordError(null);
      setPasswordSuccess(null);

      if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        setPasswordError('All fields are required');
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError('New passwords do not match');
        return;
      }
      if (passwordData.newPassword.length < 8) {
        setPasswordError('New password must be at least 8 characters');
        return;
      }

      const response = await authAPI.changePassword({
        old_password: passwordData.oldPassword,
        new_password: passwordData.newPassword,
        confirm_password: passwordData.confirmPassword,
      });

      setPasswordSuccess(response.data?.message || 'Password changed successfully!');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: unknown) {
      console.error('Failed to change password:', err);
      const ax = err as AxiosError<any>;
      
      // Extract error message from various possible response formats
      let message = 'Failed to change password';
      
      if (ax.response?.data) {
        const data = ax.response.data;
        
        // Check for specific field errors (e.g., old_password, new_password, confirm_password)
        if (data.old_password) {
          message = Array.isArray(data.old_password) ? data.old_password[0] : data.old_password;
        } else if (data.new_password) {
          message = Array.isArray(data.new_password) ? data.new_password[0] : data.new_password;
        } else if (data.confirm_password) {
          message = Array.isArray(data.confirm_password) ? data.confirm_password[0] : data.confirm_password;
        } else if (data.error) {
          message = data.error;
        } else if (data.detail) {
          message = data.detail;
        } else if (typeof data === 'string') {
          message = data;
        }
      }
      
      setPasswordError(message);
      
      // Auto-clear error message after 5 seconds
      setTimeout(() => setPasswordError(null), 5000);
    }
  };

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image size must be less than 5MB'); return; }

    try {
      setUploadingPicture(true);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          if (hasFacultyProfile) {
            await facultyAPI.updateMyProfile({ user_data: { profile_picture: base64String } });
          } else {
            await authAPI.uploadProfilePicture(base64String);
          }
          await fetchProfileData();
          if (user) {
            const updatedUser = { ...user, profile_picture: base64String };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
          }
          alert('Profile picture updated successfully!');
        } catch (e: unknown) {
          const ax = e as AxiosError<{ error?: string }>;
          const message = ax.response?.data?.error || 'Failed to update profile picture';
          setError(message);
        } finally {
          setUploadingPicture(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Failed to read image file');
      setUploadingPicture(false);
    }
  };

  const handleChangePictureClick = () => fileInputRef.current?.click();

  if (isLoading) {
    return (
    <DashboardLayout userRole={role} userName={user?.full_name} userAvatar={user?.profile_picture || undefined}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
    <DashboardLayout userRole={role} userName={user?.full_name} userAvatar={user?.profile_picture || undefined}>
        <div className="p-6">
          <Card>
            <div className="text-center py-8">
              <div className="text-red-500 text-lg mb-4">⚠️ {error}</div>
              <Button variant="primary" onClick={fetchProfileData}>Retry</Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!profileData) return null;

  const layoutUserName = profileData.user_details.full_name || user?.full_name || 'User';
  const layoutUserAvatar = profileData.user_details.profile_picture || user?.profile_picture || undefined;
  const departmentCode = profileData.department_details.code || profileData.department_details.short_code || '';
  const programTitle = profileData.program_details?.title || profileData.program_details?.name || user?.program_name || '';
  const programCode = profileData.program_details?.short_code || profileData.program_details?.code || '';

  return (
    <DashboardLayout userRole={role} userName={layoutUserName} userAvatar={layoutUserAvatar}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div
          className="relative rounded-lg overflow-hidden"
          style={{ backgroundImage: 'url(/background-image.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '300px' }}
        >
          <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center justify-center py-12 px-6">
            <div className="mb-4 relative">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProfilePictureChange} className="hidden" />
              <div className="w-32 h-32 rounded-full bg-white overflow-hidden border-4 border-white shadow-xl">
                {uploadingPicture ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : layoutUserAvatar ? (
                  <img src={layoutUserAvatar} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary text-white text-4xl font-bold">
                    {layoutUserName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <button onClick={handleChangePictureClick} className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors" title="Change profile picture">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{layoutUserName}</h2>
            <p className="text-white/90 text-sm mb-1">Department: {profileData.department_details.name}</p>
            <p className="text-white/80 text-xs mb-2">Designation: {profileData.designation}</p>
            {programTitle && <p className="text-white/80 text-xs mb-6">Program: {programTitle}{programCode ? ` (${programCode})` : ''}</p>}
          </div>
        </div>

        {/* Info */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Profile Information</h2>
            {!isEditing && (
              <Button variant="primary" onClick={() => setIsEditing(true)}>Edit Profile</Button>
            )}
          </div>

          {error && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Full Name</label>
              {isEditing ? (
                <Input value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} placeholder="Enter full name" />
              ) : (
                <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.user_details.full_name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Email Address</label>
              {isEditing ? (
                <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} placeholder="Enter email" />
              ) : (
                <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.user_details.email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">CNIC</label>
              <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.user_details.cnic}</p>
            </div>
            {hasFacultyProfile && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Contact Number</label>
              {isEditing ? (
                <Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} placeholder="Enter phone number" />
              ) : (
                <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.phone || 'Not provided'}</p>
              )}
            </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Department</label>
              <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.department_details.name}{departmentCode ? ` (${departmentCode})` : ''}</p>
            </div>
            {programTitle && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Program</label>
                <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{programTitle}{programCode ? ` (${programCode})` : ''}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Designation</label>
              <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.designation}</p>
            </div>
            {hasFacultyProfile && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Date of Joining</label>
                  <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.date_of_joining ? new Date(profileData.date_of_joining).toLocaleDateString() : 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Qualification</label>
                  {isEditing ? (
                    <Input value={editData.qualification} onChange={(e) => setEditData({ ...editData, qualification: e.target.value })} placeholder="Enter qualification (e.g., PhD)" />
                  ) : (
                    <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.qualification || 'Not provided'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Specialization</label>
                  {isEditing ? (
                    <Input value={editData.specialization} onChange={(e) => setEditData({ ...editData, specialization: e.target.value })} placeholder="Enter specialization" />
                  ) : (
                    <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.specialization || 'Not provided'}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Address</label>
                  {isEditing ? (
                    <Input value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} placeholder="Enter address" />
                  ) : (
                    <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">{profileData.address || 'Not provided'}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => { setIsEditing(false); setError(null); setEditData({ full_name: profileData.user_details.full_name, email: profileData.user_details.email, phone: profileData.phone || '', address: profileData.address || '', qualification: profileData.qualification || '', specialization: profileData.specialization || '' }); }}>Cancel</Button>
              <Button variant="primary" onClick={handleProfileUpdate} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          )}
        </Card>

        {/* Change Password */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Change Password</h2>
          {passwordError && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{passwordError}</div>}
          {passwordSuccess && <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">{passwordSuccess}</div>}
          <div className="space-y-4 max-w-md">
            <Input label="Old Password" type="password" value={passwordData.oldPassword} onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })} />
            <Input label="New Password" type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} />
            <Input label="Confirm Password" type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
            <div className="flex justify-end"><Button variant="primary" onClick={handlePasswordChange}>Change Password</Button></div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UnifiedProfile;