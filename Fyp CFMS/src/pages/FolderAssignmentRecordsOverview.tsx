import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { useReviewMode } from '../hooks/useReviewMode';
import { FileText, Download } from 'lucide-react';

interface OutlineContent {
  assignmentRecords?: Record<string, any>;
}

interface FolderBasic {
  id: number;
  status?: string;
  course_code?: string;
  course_title?: string;
  outline_content?: OutlineContent;
}

const FolderAssignmentRecordsOverview: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string; assignmentId?: string }>();
  const folderIdParam = params.folderId ?? params.id;
  const assignmentId = params.assignmentId;
  const folderId = Number(folderIdParam);
  const navigate = useNavigate();
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);
  const [data, setData] = useState<FolderBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignmentName, setAssignmentName] = useState<string>('Assignment');

  useEffect(() => {
    let mounted = true;
    if (!folderId) return;
    courseFoldersAPI.getBasic(folderId)
      .then((res) => {
        if (!mounted) return;
        setData(res.data);
        
        // Load assignment name from assignments array
        const assignments = res.data.outline_content?.assignments || [];
        const currentAssignment = assignments.find((a: any) => a.id === assignmentId);
        if (currentAssignment) {
          setAssignmentName(currentAssignment.name);
        }
        
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Error loading assignment records overview:', err);
        setError('Failed to load assignment record overview');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [folderId]);

  const assignmentRecords = (data?.outline_content?.assignmentRecords || {})[assignmentId || ''] || {};
  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';
  const status = (data?.status || '').toUpperCase();
  const isHodEditable = isHodReview && (status === 'SUBMITTED_TO_HOD' || status === 'UNDER_REVIEW_BY_HOD');
  const editableStatuses = new Set<string>(['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD']);
  const isReadOnly = (submittedStatuses.has(status) && !isHodEditable) || isAuditMemberReview || (isConvenerReview && !editableStatuses.has(status));

  const handleDownload = (record: any) => {
    if (!record) return;
    if (record.fileData) {
      const byteCharacters = atob(record.fileData.split(',')[1] || record.fileData);
      const byteArrays = [];
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays.push(byteCharacters.charCodeAt(i));
      }
      const blob = new Blob([new Uint8Array(byteArrays)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      alert('File data not available. Please re-upload the file.');
    }
  };

  if (loading) {
    return (
      <DashboardLayout userRole={userRole}>
        <div className="p-6 text-gray-600">Loading assignment record overview...</div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout userRole={userRole}>
        <div className="p-6 text-red-600">{error}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-6">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium mb-6">
          {data?.course_title || 'Course'}
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{assignmentName} Record Overview</h1>
        <p className="text-gray-600 mb-6">Quick access to best / average / worst student performance documents.</p>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl">
          {['best', 'average', 'worst'].map((key) => {
            const record = assignmentRecords[key];
            return (
              <div key={key} className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 flex flex-col">
                <div className="flex items-center mb-3">
                  <FileText className="w-6 h-6 text-indigo-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-800 capitalize">{key} Record</h3>
                </div>
                {record ? (
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 font-medium mb-1">{record.fileName}</p>
                    <p className="text-xs text-gray-500 mb-4">Uploaded {new Date(record.uploadDate).toLocaleDateString()} • {(record.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleDownload(record)}
                        className="w-full px-4 py-2 text-sm rounded-full bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <Download size={16} />
                        Download
                      </button>
                      {!isReadOnly && (
                        <button
                          onClick={() => navigate(`${basePath}/folder/${folderId}/assignments/${assignmentId}/records/${key}${isReviewContext ? '?review=1' : ''}`)}
                          className="w-full px-4 py-2 text-sm rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          View / Manage
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-4">No {key} record uploaded yet.</p>
                    {!isReadOnly && (
                      <button
                        onClick={() => navigate(`${basePath}/folder/${folderId}/assignments/${assignmentId}/records/${key}${isReviewContext ? '?review=1' : ''}`)}
                        className="w-full px-4 py-2 text-sm rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Upload {key} Record
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8">
          <button
            onClick={() => navigate(`${basePath}/folder/${folderId}/assignments/task${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-gray-600 text-white hover:bg-gray-700"
          >
            Back to Assignments
          </button>
        </div>
        {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && <CoordinatorFeedbackBox folderId={folderId!} section={`ASSIGNMENT_${assignmentId}_RECORDS`} />}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && <AuditMemberFeedbackBox folderId={folderId!} section={`${assignmentName} - Records Overview`} />}
      </div>
    </DashboardLayout>
  );
};

export default FolderAssignmentRecordsOverview;
