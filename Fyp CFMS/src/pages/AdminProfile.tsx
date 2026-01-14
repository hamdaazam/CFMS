import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export const AdminProfile: React.FC = () => {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    cnic: user?.cnic || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    role_display: user?.role_display || '',
    department_name: user?.department_name || 'N/A',
    program_name: user?.program_name || 'N/A',
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(user?.profile_picture || null);

  useEffect(() => {
    if (user) {
      setProfileData({
        cnic: user.cnic || '',
        full_name: user.full_name || '',
        email: user.email || '',
        role_display: user.role_display || '',
        department_name: user.department_name || 'N/A',
        program_name: user.program_name || 'N/A',
      });
      setProfilePicture(user.profile_picture || null);
    }
  }, [user]);

  const handlePasswordChange = async () => {
    setError('');
    setSuccessMessage('');

    // Validation
    if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('All password fields are required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (passwordData.oldPassword === passwordData.newPassword) {
      setError('New password must be different from old password');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword({
        old_password: passwordData.oldPassword,
        new_password: passwordData.newPassword,
        confirm_password: passwordData.confirmPassword,
      });
      setSuccessMessage('Password changed successfully!');
      setPasswordData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      const errorMsg = 
        err.response?.data?.old_password?.[0] ||
        err.response?.data?.new_password?.[0] ||
        err.response?.data?.confirm_password?.[0] ||
        err.response?.data?.detail ||
        'Failed to change password';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    setError('');
    setSuccessMessage('');

    // Validation
    if (!profileData.full_name.trim()) {
      setError('Full name is required');
      return;
    }

    const cleanCnic = profileData.cnic.replace(/[-\s]/g, '');
    if (!cleanCnic || cleanCnic.length !== 13 || !/^\d+$/.test(cleanCnic)) {
      setError('CNIC must be exactly 13 digits');
      return;
    }

    if (profileData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.updateProfile({
        full_name: profileData.full_name,
        email: profileData.email || undefined,
        cnic: cleanCnic,
      });
      
      setSuccessMessage('Profile updated successfully!');
      setIsEditingProfile(false);
      
      // Update user context
      if (response.data.user) {
        setUser(response.data.user);
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.cnic?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.full_name?.[0] ||
        err.response?.data?.detail ||
        'Failed to update profile';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        try {
          const response = await authAPI.uploadProfilePicture(base64String);
          
          // Update local state
          setProfilePicture(base64String);
          setSuccessMessage('Profile picture updated successfully!');
          
          // Update user context with the full user data from response
          if (response.data.user) {
            setUser(response.data.user);
            // Also update localStorage to persist the change
            localStorage.setItem('user', JSON.stringify(response.data.user));
          }
        } catch (err: any) {
          const errorMsg =
            err.response?.data?.profile_picture?.[0] ||
            err.response?.data?.detail ||
            'Failed to upload picture';
          setError(errorMsg);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to read image file');
      setLoading(false);
    }
  };

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

        {/* Profile Header with Background Image */}
        <div 
          className="relative rounded-lg overflow-hidden"
          style={{
            backgroundImage: 'url(/background-image.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '300px',
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-primary/70" />
          
          {/* Profile Content */}
          <div className="relative z-0 flex flex-col items-center justify-center py-12 px-6">
            {/* Profile Avatar */}
            <div className="mb-4">
              <div className="w-32 h-32 rounded-full bg-white overflow-hidden border-4 border-white shadow-xl flex items-center justify-center profile-elevated">
                {profilePicture ? (
                  <img 
                    src={profilePicture} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl font-bold text-primary">
                    {profileData.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">{profileData.full_name}</h2>
            <p className="text-white/80 text-sm mb-6">Designation: {profileData.role_display}</p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button 
              onClick={handlePictureClick}
              disabled={loading}
              className="bg-primary-dark px-6 py-2 rounded-lg text-sm font-medium text-white hover:bg-primary-dark/80 transition-colors disabled:opacity-50 relative profile-elevated"
              style={{ zIndex: 0 }}
            >
              {loading ? 'Uploading...' : 'Change Picture'}
            </button>
          </div>
        </div>

        {/* Profile Information */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Profile Information</h2>
            <Button
              variant="primary"
              onClick={() => {
                if (isEditingProfile) {
                  handleProfileUpdate();
                } else {
                  setIsEditingProfile(true);
                  setError('');
                  setSuccessMessage('');
                }
              }}
              disabled={loading}
            >
              {isEditingProfile ? (loading ? 'Saving...' : 'Save Changes') : 'Edit Profile'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Full Name {isEditingProfile && <span className="text-red-500">*</span>}
              </label>
              {isEditingProfile ? (
                <Input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
              ) : (
                <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">
                  {profileData.full_name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                CNIC {isEditingProfile && <span className="text-red-500">*</span>}
              </label>
              {isEditingProfile ? (
                <div>
                  <Input
                    type="text"
                    value={profileData.cnic}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 13);
                      setProfileData({ ...profileData, cnic: value });
                    }}
                    placeholder="1234567890123"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be exactly 13 digits</p>
                </div>
              ) : (
                <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">
                  {profileData.cnic}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Email Address</label>
              {isEditingProfile ? (
                <Input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  placeholder="user@example.com"
                />
              ) : (
                <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">
                  {profileData.email || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Role</label>
              <p className="text-gray-900 font-medium pb-2 border-b border-gray-200">
                {profileData.role_display}
              </p>
            </div>

            {/* Department and Program removed as per client request */}
          </div>

          {isEditingProfile && (
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingProfile(false);
                  setProfileData({
                    cnic: user?.cnic || '',
                    full_name: user?.full_name || '',
                    email: user?.email || '',
                    role_display: user?.role_display || '',
                    department_name: user?.department_name || 'N/A',
                    program_name: user?.program_name || 'N/A',
                  });
                  setError('');
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          )}
        </Card>

        {/* Change Password */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Change Password</h2>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Current Password <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                placeholder="••••••••••••••••••"
                value={passwordData.oldPassword}
                onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                New Password <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">(Min 8 characters)</span>
              </label>
              <Input
                type="password"
                placeholder="••••••••••••••••••"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                placeholder="••••••••••••••••••"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button 
              variant="primary" 
              onClick={handlePasswordChange}
              disabled={loading}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};
