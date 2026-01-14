import React from 'react';
import { AlertCircle, Edit } from 'lucide-react';

interface RejectionFeedbackBannerProps {
  status: string;
  coordinatorRemarks?: string | null;
  coordinatorNotes?: string | null;
  coordinatorFeedback?: Record<string, string> | null;
  convenerNotes?: string | null;
  hodNotes?: string | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  onActionClick?: () => void;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const RejectionFeedbackBanner: React.FC<RejectionFeedbackBannerProps> = ({
  status,
  coordinatorRemarks,
  coordinatorNotes,
  coordinatorFeedback,
  convenerNotes,
  hodNotes,
  reviewerName,
  reviewedAt,
  onActionClick
}) => {
  // Only show if status is a rejection status
  const isRejected = 
    status === 'REJECTED_COORDINATOR' || 
    status === 'REJECTED_BY_CONVENER' || 
    status === 'REJECTED_BY_HOD';

  if (!isRejected) return null;

  // Determine which notes to show based on status
  let mainFeedback = '';
  let feedbackSource = '';
  
  if (status === 'REJECTED_COORDINATOR') {
    mainFeedback = coordinatorRemarks?.trim() || coordinatorNotes?.trim() || '';
    feedbackSource = 'Coordinator';
  } else if (status === 'REJECTED_BY_CONVENER') {
    mainFeedback = convenerNotes?.trim() || '';
    feedbackSource = 'Convener';
  } else if (status === 'REJECTED_BY_HOD') {
    mainFeedback = hodNotes?.trim() || '';
    feedbackSource = 'HOD';
  }

  // Check if there's any section-specific feedback
  const hasSectionFeedback = coordinatorFeedback && 
    Object.values(coordinatorFeedback).some(fb => fb && String(fb).trim().length > 0);

  return (
    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 md:p-6 shadow-md mb-6 animate-fade-in">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-6 w-6 md:h-8 md:w-8 text-red-500" />
        </div>
        <div className="ml-3 md:ml-4 flex-1">
          <h3 className="text-base md:text-lg font-bold text-red-900 mb-2">
            ⚠️ Folder Rejected - Action Required
          </h3>
          <p className="text-xs md:text-sm text-red-800 mb-3">
            This folder has been rejected and returned to you. Please review the feedback below, make necessary corrections, and resubmit.
          </p>
          
          {/* Main Feedback Box */}
          <div className="bg-white rounded-lg p-3 md:p-4 border border-red-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-red-900 text-sm md:text-base">
                {feedbackSource} Feedback
              </h4>
              <span className="px-2 md:px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                REJECTED
              </span>
            </div>
            
            {/* Main Remarks */}
            {mainFeedback ? (
              <div className="bg-red-50 rounded p-2 md:p-3">
                <p className="text-xs md:text-sm font-medium text-red-900 mb-1">Overall Decision:</p>
                <p className="text-xs md:text-sm text-red-800 whitespace-pre-line">{mainFeedback}</p>
              </div>
            ) : (
              <div className="bg-yellow-50 rounded p-2 md:p-3 border border-yellow-200">
                <p className="text-xs md:text-sm text-yellow-800">
                  ⚠️ No specific remarks provided. Please contact the {feedbackSource.toLowerCase()} for details.
                </p>
              </div>
            )}

            {/* Section-Specific Feedback */}
            {hasSectionFeedback && (
              <div className="space-y-2">
                <p className="text-xs md:text-sm font-medium text-red-900">Section-Specific Feedback:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Object.entries(coordinatorFeedback!).map(([section, feedback]) => {
                    if (!feedback || (typeof feedback === 'string' && !feedback.trim())) return null;
                    return (
                      <div key={section} className="bg-gray-50 rounded p-2 md:p-3 border-l-2 border-red-400">
                        <p className="text-xs font-semibold text-gray-700 uppercase mb-1">
                          {section.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs md:text-sm text-gray-800 whitespace-pre-line">{String(feedback)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reviewer Info */}
            {(reviewerName || reviewedAt) && (
              <div className="pt-2 border-t border-red-200 text-xs text-red-700">
                Rejected by {reviewerName || 'Reviewer'} • {formatDate(reviewedAt || null)}
              </div>
            )}
          </div>

          {/* Action Button */}
          {onActionClick && (
            <div className="mt-3 md:mt-4">
              <button
                onClick={onActionClick}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 md:px-4 rounded-lg transition-colors text-xs md:text-sm flex items-center shadow-sm"
              >
                <Edit className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                Review and Make Corrections
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
