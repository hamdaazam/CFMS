import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { CheckCircle, XCircle, FileText, Loader } from 'lucide-react';

interface FolderDetail {
  id: number;
  status?: string;
  course_details?: {
    title?: string;
    code?: string;
  };
  faculty_details?: {
    user_details?: {
      full_name?: string;
    };
  };
  section?: string;
  term_details?: {
    name?: string;
  };
  hod_decision?: string;
  hod_remarks?: string;
  hod_final_feedback?: string;
  audit_assignments?: any[];
}

export const HODFolderDecision: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [folderData, setFolderData] = useState<FolderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [finalFeedback, setFinalFeedback] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);

  useEffect(() => {
    fetchFolderData();
  }, [folderId]);

  const fetchFolderData = async () => {
    try {
      setLoading(true);
      const response = await courseFoldersAPI.getById(Number(folderId));
      setFolderData(response.data);
      setRemarks(response.data.hod_remarks || '');
      setFinalFeedback(response.data.hod_final_feedback || '');
      
      // Set decision based on current status
      if (response.data.status === 'APPROVED_BY_HOD') {
        setDecision('APPROVED');
      } else if (response.data.status === 'REJECTED_BY_HOD') {
        setDecision('REJECTED');
      }
    } catch (error) {
      console.error('Error fetching folder data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (newDecision: 'APPROVED' | 'REJECTED') => {
    const actionText = decision ? 'change the decision to' : 'make a decision to';
    if (!confirm(`Are you sure you want to ${actionText} ${newDecision === 'APPROVED' ? 'APPROVE' : 'REJECT'} this folder as HOD?`)) {
      return;
    }

    setSaving(true);
    try {
      // Use HOD final decision endpoint
      await courseFoldersAPI.hodFinalDecision(Number(folderId), {
        decision: newDecision === 'APPROVED' ? 'approve' : 'reject',
        notes: remarks,
        final_feedback: finalFeedback
      });

      alert(`Folder ${newDecision === 'APPROVED' ? 'approved' : 'rejected'} successfully!`);
      setDecision(newDecision);
      
      // Refresh folder data to get updated status
      await fetchFolderData();
      
      // Don't auto-navigate if decision was changed (let HOD see the updated status)
      if (!decision) {
        // Only navigate if this was a new decision
        setTimeout(() => {
          navigate('/hod/review-folders');
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error updating decision:', error);
      alert(error.response?.data?.error || 'Failed to update decision. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout userRole="hod" userName={user?.full_name || 'HOD'} userAvatar={user?.profile_picture || undefined}>
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const courseTitle = folderData?.course_details?.title || 'N/A';

  return (
    <DashboardLayout userRole="hod" userName={user?.full_name || 'HOD'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-4 md:p-6">
        {/* Course chip */}
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-white text-sm font-medium mb-4">
          {courseTitle}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Final Folder Decision (HOD)</h2>

        {/* Folder Information */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-primary" />
            Folder Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Course Code</p>
              <p className="font-medium text-gray-900">{folderData?.course_details?.code || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Course Title</p>
              <p className="font-medium text-gray-900">{folderData?.course_details?.title || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Section</p>
              <p className="font-medium text-gray-900">{folderData?.section || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Faculty</p>
              <p className="font-medium text-gray-900">{folderData?.faculty_details?.user_details?.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Term</p>
              <p className="font-medium text-gray-900">{folderData?.term_details?.name || 'N/A'}</p>
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
                    <span className="text-green-800">This folder has been APPROVED by HOD</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 mr-2 text-red-600" />
                    <span className="text-red-800">This folder has been REJECTED by HOD</span>
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Final Remarks */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">HOD Final Remarks</h3>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter your final remarks about this course folder as Head of Department..."
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            disabled={saving}
          />
          <p className="text-sm text-gray-600 mt-2">
            Please provide comprehensive feedback about the folder quality, completeness, audit findings, and final decision rationale. (Optional)
          </p>
        </div>

        {/* Final Feedback Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Final Feedback</h3>
          <textarea
            value={finalFeedback}
            onChange={(e) => setFinalFeedback(e.target.value)}
            placeholder="Enter your final feedback for the faculty member (optional but recommended)..."
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            disabled={saving}
          />
          <p className="text-sm text-gray-600 mt-2">
            This feedback will be visible to the faculty member and can include suggestions for improvement, commendations, or any additional notes.
          </p>
        </div>

        {/* Decision Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Make Final Decision</h3>
            <p className="text-sm text-gray-600 mb-4">
              {decision 
                ? 'You can change your decision if needed. The folder workflow will be updated accordingly.'
                : 'This is the final approval step. Once you make a decision, the folder workflow will be completed.'}
            </p>
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
                    Final Approval
                  </>
                )}
              </button>
              <button
                onClick={() => handleDecision('REJECTED')}
                disabled={saving}
                className="flex-1 flex items-center justify-center px-6 py-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && decision === 'REJECTED' ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 mr-2" />
                    Reject Folder
                  </>
                )}
              </button>
            </div>
          </div>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => navigate('/hod/review-folders')}
            className="px-6 py-2.5 rounded-full bg-gray-500 text-white hover:bg-gray-600 transition-colors"
          >
            Back to Review Folders
          </button>
          <button
            onClick={() => navigate(`/hod/folder/${folderId}/title-page`)}
            className="px-6 py-2.5 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            View Full Folder
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};
