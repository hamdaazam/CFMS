import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowLeft, CheckCircle, XCircle, MessageSquare } from 'lucide-react';

interface FolderData {
  id: number;
  status: string;
  course_code?: string;
  course_title?: string;
  section?: string;
  coordinator_decision?: 'APPROVED' | 'DISAPPROVED' | null;
  coordinator_remarks?: string | null;
  coordinator_notes?: string | null;
  coordinator_feedback?: Record<string, string> | null;
  coordinator_reviewed_by_details?: { full_name?: string } | null;
  coordinator_reviewed_at?: string | null;
  convener_notes?: string | null;
  hod_notes?: string | null;
}

const SECTION_ORDER: string[] = [
  'TITLE_PAGE',
  'COURSE_OUTLINE',
  'COURSE_LOG',
  'ATTENDANCE',
  'LECTURE_NOTES',
  'CLO_ASSESSMENT',
  'ASSIGNMENTS',
  'ASSIGNMENTS_QUESTION_PAPER',
  'ASSIGNMENTS_MODEL_SOLUTION',
  'ASSIGNMENTS_RECORDS',
  'QUIZZES',
  'QUIZZES_QUESTION_PAPER',
  'QUIZZES_MODEL_SOLUTION',
  'QUIZZES_RECORDS',
  'MIDTERM_QUESTION_PAPER',
  'MIDTERM_MODEL_SOLUTION',
  'MIDTERM_RECORDS_BEST',
  'MIDTERM_RECORDS_AVERAGE',
  'MIDTERM_RECORDS_WORST',
  'FINAL_QUESTION_PAPER',
  'FINAL_MODEL_SOLUTION',
  'FINAL_RECORDS_BEST',
  'FINAL_RECORDS_AVERAGE',
  'FINAL_RECORDS_WORST',
  'COURSE_REVIEW_REPORT',
  'PROJECT_REPORT',
  'COURSE_RESULT',
  'FOLDER_REVIEW_REPORT'
];

const sectionPriority = (raw: string) => {
  const normalized = raw.toUpperCase();
  const exactIndex = SECTION_ORDER.indexOf(normalized);
  if (exactIndex !== -1) return exactIndex;

  if (normalized.startsWith('ASSIGNMENT')) return SECTION_ORDER.indexOf('ASSIGNMENTS');
  if (normalized.startsWith('QUIZ')) return SECTION_ORDER.indexOf('QUIZZES');
  if (normalized.startsWith('MIDTERM')) return SECTION_ORDER.indexOf('MIDTERM_QUESTION_PAPER');
  if (normalized.startsWith('FINAL')) return SECTION_ORDER.indexOf('FINAL_QUESTION_PAPER');

  // Unknown sections are pushed to the end but kept stable via secondary sort.
  return SECTION_ORDER.length + 1;
};

const formatSectionName = (section: string) => {
  return section
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

export const FolderCoordinatorFeedback: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;

  const navigate = useNavigate();
  const { user } = useAuth();
  const [folder, setFolder] = useState<FolderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFolderData();
  }, [folderId]);

  const fetchFolderData = async () => {
    if (!folderId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await courseFoldersAPI.getById(Number(folderId));
      setFolder(response.data);
    } catch (err: any) {
      console.error('Error fetching folder:', err);
      setError(err.response?.data?.error || 'Failed to load folder data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout userRole={user?.role?.toLowerCase() as any}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !folder) {
    return (
      <DashboardLayout userRole={user?.role?.toLowerCase() as any}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error || 'Folder not found'}</p>
        </div>
      </DashboardLayout>
    );
  }

  // Determine if folder is rejected
  const isRejected =
    folder.status === 'REJECTED_COORDINATOR' ||
    folder.status === 'REJECTED_BY_CONVENER' ||
    folder.status === 'REJECTED_BY_HOD';

  // Determine feedback source
  let feedbackSource = 'Coordinator';
  let mainFeedback = folder.coordinator_remarks?.trim() || folder.coordinator_notes?.trim() || '';

  if (folder.status === 'REJECTED_BY_CONVENER') {
    feedbackSource = 'Convener';
    mainFeedback = folder.convener_notes?.trim() || '';
  } else if (folder.status === 'REJECTED_BY_HOD') {
    feedbackSource = 'HOD';
    mainFeedback = folder.hod_notes?.trim() || '';
  }

  // Check if section feedback exists
  const sectionFeedback = folder.coordinator_feedback || {};
  const hasSectionFeedback = Object.values(sectionFeedback).some(
    fb => fb && String(fb).trim().length > 0
  );

  const orderedSectionFeedback = Object.entries(sectionFeedback)
    .filter(([, feedback]) => feedback && String(feedback).trim().length > 0)
    .sort(([a], [b]) => {
      const priorityDiff = sectionPriority(a) - sectionPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return a.localeCompare(b);
    });

  return (
    <DashboardLayout userRole={user?.role?.toLowerCase() as any}>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Feedback
            </h1>
            <p className="text-gray-600">
              {folder.course_code} - {folder.course_title} | Section {folder.section}
            </p>
          </div>
          <button
            onClick={() => {
              const role = user?.role;
              const basePath = role === 'FACULTY' ? '/faculty' :
                role === 'COORDINATOR' ? '/coordinator' :
                  role === 'CONVENER' ? '/convener' :
                    role === 'HOD' ? '/hod' :
                      '/faculty';
              navigate(`${basePath}/folder/${folderId}/title-page`);
            }}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Folder
          </button>
        </div>

        {/* Status Card */}
        <div className={`rounded-lg p-6 ${isRejected
          ? 'bg-red-50 border-l-4 border-red-500'
          : folder.coordinator_decision === 'APPROVED'
            ? 'bg-green-50 border-l-4 border-green-500'
            : 'bg-blue-50 border-l-4 border-blue-500'
          }`}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              {isRejected ? (
                <XCircle className="w-8 h-8 text-red-600" />
              ) : folder.coordinator_decision === 'APPROVED' ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <h2 className={`text-xl font-bold mb-2 ${isRejected
                ? 'text-red-900'
                : folder.coordinator_decision === 'APPROVED'
                  ? 'text-green-900'
                  : 'text-blue-900'
                }`}>
                {isRejected
                  ? `Folder Rejected by ${feedbackSource}`
                  : folder.coordinator_decision === 'APPROVED'
                    ? 'Folder Approved by Coordinator'
                    : 'Coordinator Review Status'}
              </h2>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${isRejected
                ? 'bg-red-100 text-red-800'
                : folder.coordinator_decision === 'APPROVED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
                }`}>
                {folder.status.replace(/_/g, ' ')}
              </div>
              {isRejected && (
                <p className={`mt-3 text-sm ${isRejected ? 'text-red-800' : 'text-green-800'
                  }`}>
                  ⚠️ Your folder has been returned for corrections. Please review the feedback below carefully, make the necessary changes, and resubmit.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Overall Feedback Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-slate-700 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Overall Feedback & Remarks
            </h3>
          </div>
          <div className="p-6 bg-gray-50">
            {mainFeedback ? (
              <div className="bg-white rounded-md border border-gray-200 p-5">
                <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                  {mainFeedback}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-white rounded-md border border-gray-300">
                <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0" />
                <p className="text-gray-600">
                  No overall remarks provided by the {feedbackSource.toLowerCase()}.
                </p>
              </div>
            )}



          </div>
        </div>

        {/* Section-Specific Feedback */}
        {hasSectionFeedback && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-700 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Section-Specific Feedback
              </h3>
            </div>
            <div className="p-6 bg-gray-50">
              <p className="text-gray-700 mb-5 text-sm font-medium">
                The coordinator has provided detailed feedback for specific sections of your folder:
              </p>
              <div className="space-y-3">
                {orderedSectionFeedback.map(([section, feedback]) => (
                  <div
                    key={section}
                    className="bg-white rounded-md border border-gray-200 p-5 hover:border-gray-300 transition-colors"
                  >
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wide border border-slate-200">
                        {formatSectionName(section)}
                      </span>
                    </h4>
                    <p className="text-gray-700 text-sm whitespace-pre-line leading-relaxed pl-1">
                      {String(feedback)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No Feedback Message */}
        {!mainFeedback && !hasSectionFeedback && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-900 mb-1">
                  No Detailed Feedback Available
                </h4>
                <p className="text-yellow-800 text-sm">
                  The coordinator has not provided detailed feedback for this folder yet.
                  {folder.status === 'SUBMITTED' && ' Your folder is currently under review.'}
                  {isRejected && ' Please contact the coordinator for more information about the rejection.'}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default FolderCoordinatorFeedback;
