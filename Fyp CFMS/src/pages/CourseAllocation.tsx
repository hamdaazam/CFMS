import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { AllocateCourseModal } from '../components/modals/AllocateCourseModal';
import { AddCourseModal } from '../components/modals/AddCourseModal';
import { useAuth } from '../context/AuthContext';
import { courseAllocationsAPI, coursesAPI } from '../services/api';

export const CourseAllocation: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAllocateCourseModalOpen, setIsAllocateCourseModalOpen] = useState(false);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for allocation upload
  const [allocationUploadMessage, setAllocationUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [allocationUploadErrors, setAllocationUploadErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [allocationUploadLoading, setAllocationUploadLoading] = useState(false);
  const [selectedAllocationFile, setSelectedAllocationFile] = useState<File | null>(null);
  const allocationFileInputRef = useRef<HTMLInputElement>(null);

  const handleAllocateCourse = async (data: any) => {
    try {
      console.log('Sending allocation data:', data);
      await courseAllocationsAPI.create(data);
      setMessage({ type: 'success', text: 'Course allocated successfully!' });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error('Error allocating course:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.detail 
        || error.response?.data?.message 
        || error.response?.data?.non_field_errors?.[0]
        || JSON.stringify(error.response?.data || {})
        || 'Failed to allocate course. Please try again.';
      setMessage({ type: 'error', text: errorMsg });
      setTimeout(() => setMessage(null), 10000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setUploadMessage({ type: 'error', text: 'Please select a .xlsx file.' });
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setUploadMessage(null);
  };

  const handleCourseUpload = async () => {
    if (!selectedFile) return;
    setUploadLoading(true);
    setUploadMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const resp = await coursesAPI.uploadExcel(formData);
      const created = resp.data?.created ?? 0;
      const skipped = resp.data?.skipped ?? 0;
      setUploadMessage({
        type: 'success',
        text: `Uploaded successfully. Created: ${created}, Skipped: ${skipped}`,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      const errText =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.errors?.[0]?.error ||
        'Upload failed. Please check the file and try again.';
      setUploadMessage({ type: 'error', text: errText });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleAllocationFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setAllocationUploadMessage({ type: 'error', text: 'Please select a .xlsx file.' });
      setSelectedAllocationFile(null);
      return;
    }
    setSelectedAllocationFile(file);
    setAllocationUploadMessage(null);
  };

  const handleAllocationUpload = async () => {
    if (!selectedAllocationFile) return;
    setAllocationUploadLoading(true);
    setAllocationUploadMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedAllocationFile);
      const resp = await courseAllocationsAPI.uploadExcel(formData);
      const created = resp.data?.created ?? 0;
      const skipped = resp.data?.skipped ?? 0;
      const errors = resp.data?.errors ?? [];
      
      let message = `Uploaded successfully. Created: ${created}, Skipped: ${skipped}`;
      if (errors.length > 0) {
        message += `. ${errors.length} error(s) occurred.`;
      }
      
      // Determine message type based on results
      const messageType = created > 0 ? 'success' : 'error';
      
      setAllocationUploadMessage({
        type: messageType,
        text: message,
      });
      
      // Store errors for detailed display
      if (errors.length > 0) {
        console.error('Upload errors:', errors);
        setAllocationUploadErrors(errors);
      } else {
        setAllocationUploadErrors([]);
      }
      
      setSelectedAllocationFile(null);
      if (allocationFileInputRef.current) allocationFileInputRef.current.value = '';
    } catch (error: any) {
      const errText =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.response?.data?.errors?.[0]?.error ||
        'Upload failed. Please check the file and try again.';
      setAllocationUploadMessage({ type: 'error', text: errText });
    } finally {
      setAllocationUploadLoading(false);
    }
  };

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6">
        {/* Bulk Course Upload (Admin only) */}
        {user?.role === 'ADMIN' && (
          <div className="mb-6 bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-800">Bulk Course Upload (Excel)</h2>
                <p className="text-sm text-gray-600">
                  Upload .xlsx with columns: <code>code</code>, <code>title</code>, <code>credit_hours</code>, <code>course_type</code> (THEORY/LAB/HYBRID), <code>department</code>, <code>program</code> (optional), <code>description</code> (optional), <code>pre_requisites</code> (optional).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={uploadLoading}
                />
                <button
                  className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-200 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLoading}
                >
                  {selectedFile ? 'Change File' : 'Choose File'}
                </button>
                <button
                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
                  onClick={handleCourseUpload}
                  disabled={!selectedFile || uploadLoading}
                >
                  {uploadLoading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-700">
                Selected: <span className="font-medium">{selectedFile.name}</span>
              </p>
            )}
            {uploadMessage && (
              <div
                className={`mt-3 p-3 rounded ${
                  uploadMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{uploadMessage.text}</p>
              </div>
            )}
          </div>
        )}

        {/* Bulk Course Allocation Upload (Admin only) */}
        {user?.role === 'ADMIN' && (
          <div className="mb-6 bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <h2 className="text-lg font-semibold text-gray-800">Bulk Course Allocation Upload (Excel)</h2>
                <p className="text-sm text-gray-600">
                  Upload .xlsx with columns:
                </p>
                <div className="text-sm text-gray-600 ml-4">
                  <p><strong>Required Columns:</strong></p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li><code className="bg-gray-100 px-2 py-1 rounded">course_code</code> (or <code className="bg-gray-100 px-2 py-1 rounded">course</code>) - Course code</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">faculty_name</code> (or <code className="bg-gray-100 px-2 py-1 rounded">faculty_email</code>) - Faculty member name or email</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">section</code> - Section number</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">department</code> - Department name</li>
                  </ul>
                  <p className="mt-2"><strong>Optional:</strong></p>
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    <li><code className="bg-gray-100 px-2 py-1 rounded">program</code> - Program title</li>
                    <li><code className="bg-gray-100 px-2 py-1 rounded">coordinator</code> - Coordinator name or email (creates coordinator assignment)</li>
                  </ul>
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs text-blue-800">
                        <strong>Note:</strong> The coordinator column accepts either name or email. If duplicate names exist, use email for accurate matching.
                      </p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-xs text-amber-800">
                        <strong>Faculty Matching:</strong> The system will try to match faculty by:
                        <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
                          <li>Exact email match (if faculty_email column is used)</li>
                          <li>Partial email match (if faculty_name contains '@')</li>
                          <li>Exact full name match</li>
                          <li>Partial name match (extracts name parts)</li>
                        </ul>
                        If matching fails, check that faculty names/emails in your Excel match exactly with the database, or use full email addresses for best results.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={allocationFileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleAllocationFileSelect}
                  disabled={allocationUploadLoading}
                />
                <button
                  className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-200 transition-colors"
                  onClick={() => allocationFileInputRef.current?.click()}
                  disabled={allocationUploadLoading}
                >
                  {selectedAllocationFile ? 'Change File' : 'Choose File'}
                </button>
                <button
                  className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
                  onClick={handleAllocationUpload}
                  disabled={!selectedAllocationFile || allocationUploadLoading}
                >
                  {allocationUploadLoading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
            {selectedAllocationFile && (
              <p className="mt-2 text-sm text-gray-700">
                Selected: <span className="font-medium">{selectedAllocationFile.name}</span>
              </p>
            )}
            {allocationUploadMessage && (
              <div className="mt-3 space-y-2">
                <div
                  className={`p-3 rounded ${
                    allocationUploadMessage.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  <p className="text-sm font-medium">{allocationUploadMessage.text}</p>
                </div>
                {allocationUploadErrors.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 max-h-60 overflow-y-auto">
                    <p className="text-sm font-medium text-yellow-900 mb-2">Detailed Errors:</p>
                    <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
                      {allocationUploadErrors.slice(0, 20).map((err, idx) => (
                        <li key={idx}>
                          <strong>Row {err.row}:</strong> {err.error}
                        </li>
                      ))}
                      {allocationUploadErrors.length > 20 && (
                        <li className="text-yellow-700 italic">
                          ... and {allocationUploadErrors.length - 20} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Three Sections in One Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* View Courses Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">View Courses</h2>
            <button 
              onClick={() => navigate('/courses/view')}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              View Courses
            </button>
          </div>

          {/* Create Course Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Create Course</h2>
            <button 
              onClick={() => setIsAddCourseModalOpen(true)}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              Create Course
            </button>
          </div>

          {/* Allocate Courses Section */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Allocate Courses</h2>
            <button 
              onClick={() => setIsAllocateCourseModalOpen(true)}
              className="bg-coral text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-coral-dark transition-colors"
            >
              Allocate
            </button>
          </div>
        </div>

        {/* View Allocations Section */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Manage Allocations</h2>
              <p className="text-sm text-gray-600 mt-1">View all course allocations and manage them</p>
            </div>
            <button 
              onClick={() => navigate('/courses/allocations')}
              className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              View All Allocations
            </button>
          </div>
        </div>
      </div>

      {/* Add Course Modal */}
      <AddCourseModal
        isOpen={isAddCourseModalOpen}
        onClose={() => setIsAddCourseModalOpen(false)}
        onSuccess={() => {
          // Optionally navigate to view courses or refresh
          navigate('/courses/view');
        }}
      />

      {/* Allocate Course Modal */}
      <AllocateCourseModal
        isOpen={isAllocateCourseModalOpen}
        onClose={() => setIsAllocateCourseModalOpen(false)}
        onSubmit={handleAllocateCourse}
      />
    </DashboardLayout>
  );
};
