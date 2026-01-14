import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, FileText, Loader } from 'lucide-react';

interface FolderDetail {
  id: number;
  status?: string;
  course_title?: string;
  course_code?: string;
  instructor_name?: string;
  section?: string;
  semester?: string;
  coordinator_decision?: string;
  coordinator_remarks?: string;
}

const CoordinatorFolderDecision: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [folderData, setFolderData] = useState<FolderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'DISAPPROVED' | null>(null);
  
  // Determine user role for layout and navigation
  const userRole = user?.role?.toLowerCase() || 'coordinator';
  const isHodOrConvener = userRole === 'hod' || userRole === 'convener';

  useEffect(() => {
    fetchFolderData();
  }, [id]);

  const fetchFolderData = async () => {
    try {
      setLoading(true);
      const response = await courseFoldersAPI.getBasic(Number(id));
      setFolderData(response.data);
      setRemarks(response.data.coordinator_remarks || '');
      
      // Set decision based on current status
      if (response.data.coordinator_decision === 'APPROVED') {
        setDecision('APPROVED');
      } else if (response.data.coordinator_decision === 'DISAPPROVED') {
        setDecision('DISAPPROVED');
      }
    } catch (error) {
      console.error('Error fetching folder data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (newDecision: 'APPROVED' | 'DISAPPROVED') => {
    // Remarks are optional - allow approve/reject without remarks
    if (!confirm(`Are you sure you want to ${newDecision === 'APPROVED' ? 'APPROVE' : 'DISAPPROVE'} this folder?`)) {
      return;
    }

    setSaving(true);
    try {
      // Use the coordinator_review workflow endpoint
      await courseFoldersAPI.coordinatorReview(Number(id), {
        action: newDecision === 'APPROVED' ? 'approve' : 'reject',
        notes: remarks
      });

      alert(`Folder ${newDecision === 'APPROVED' ? 'approved' : 'disapproved'} successfully!`);
      setDecision(newDecision);
      
      // Navigate back to appropriate dashboard based on user role
      setTimeout(() => {
        if (isHodOrConvener) {
          navigate(`/${userRole}/dashboard`);
        } else {
          navigate('/coordinator/dashboard');
        }
      }, 1500);
    } catch (error: any) {
      console.error('Error updating decision:', error);
      alert(error.response?.data?.error || 'Failed to update decision. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout userRole={userRole as any}>
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  const courseTitle = folderData?.course_title || 'N/A';

  return (
    <DashboardLayout userRole={userRole as any}>
      <div className="p-4 md:p-6">
        {/* Course chip */}
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium mb-4">
          {courseTitle}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Folder Decision</h2>

        {/* Folder Information */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-indigo-600" />
            Folder Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Course Code</p>
              <p className="font-medium text-gray-900">{folderData?.course_code || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Course Title</p>
              <p className="font-medium text-gray-900">{folderData?.course_title || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Section</p>
              <p className="font-medium text-gray-900">{folderData?.section || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Instructor</p>
              <p className="font-medium text-gray-900">{folderData?.instructor_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Semester</p>
              <p className="font-medium text-gray-900">{folderData?.semester || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Status</p>
              <p className="font-medium text-gray-900">
                {folderData?.status?.replace(/_/g, ' ') || 'N/A'}
              </p>
            </div>
          </div>

          {decision && (
            <div className={`mt-4 p-4 rounded-lg ${decision === 'APPROVED' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="font-semibold flex items-center">
                {decision === 'APPROVED' ? (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                    <span className="text-green-800">This folder has been APPROVED</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 mr-2 text-red-600" />
                    <span className="text-red-800">This folder has been DISAPPROVED</span>
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Final Remarks */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Final Remarks</h3>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your final remarks about this course folder... (Optional)"
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            disabled={saving}
          />
          <p className="text-sm text-gray-500 mt-2">
            Optional: Provide comprehensive feedback about the folder quality, completeness, and any recommendations.
          </p>
        </div>

        {/* Decision Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Make Your Decision</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => handleDecision('APPROVED')}
              disabled={saving}
              className="flex-1 flex items-center justify-center px-6 py-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && decision === 'APPROVED' ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Approve Folder
                </>
              )}
            </button>
            <button
              onClick={() => handleDecision('DISAPPROVED')}
              disabled={saving}
              className="flex-1 flex items-center justify-center px-6 py-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && decision === 'DISAPPROVED' ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 mr-2" />
                  Disapprove Folder
                </>
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => navigate('/coordinator/dashboard')}
            className="px-6 py-2.5 rounded-full bg-gray-500 text-white hover:bg-gray-600 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CoordinatorFolderDecision;
