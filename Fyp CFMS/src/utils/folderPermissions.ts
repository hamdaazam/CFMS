/**
 * Utility functions for determining folder edit permissions
 */

/**
 * Determines if a folder can be edited by faculty
 * @param status - Folder status
 * @param firstActivityCompleted - Whether first activity is completed (legacy, for backwards compatibility)
 * @param canEditForFinalSubmission - Whether folder can be edited for final submission (from backend deadline check)
 * @param isAuditMemberReview - Whether this is an audit member review
 * @param isConvenerReview - Whether this is a convener review
 * @param isHodReview - Whether this is an HOD review
 * @returns true if folder can be edited
 */
export const canEditFolder = (
  status: string | undefined,
  firstActivityCompleted: boolean = false,
  canEditForFinalSubmission: boolean = false,
  isAuditMemberReview: boolean = false,
  isConvenerReview: boolean = false,
  isHodReview: boolean = false
): boolean => {
  if (!status) return false;
  
  const s = status.toUpperCase();
  
  // Always read-only for audit member review
  if (isAuditMemberReview) return false;
  
  // Simplified logic: Allow editing if APPROVED_BY_HOD and first_activity_completed = True (second submission)
  const canEditForSecondSubmission = s === 'APPROVED_BY_HOD' && firstActivityCompleted;
  
  // Editable statuses (normal editing)
  const editableStatuses = new Set<string>(['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD']);
  
  // Submitted statuses (read-only, except for second submission)
  const submittedStatuses = new Set<string>([
    'SUBMITTED',
    'UNDER_REVIEW_BY_COORDINATOR',
    'APPROVED_COORDINATOR',
    'UNDER_AUDIT',
    'AUDIT_COMPLETED',
    'SUBMITTED_TO_HOD',
    'UNDER_REVIEW_BY_HOD',
    'COMPLETED',
  ]);
  
  // If it's a submitted status but not APPROVED_BY_HOD with first_activity_completed, it's read-only
  if (submittedStatuses.has(s) && !canEditForSecondSubmission) {
    return false;
  }
  
  // If it's APPROVED_BY_HOD, allow editing only if first_activity_completed = True (second submission)
  if (s === 'APPROVED_BY_HOD') {
    return canEditForSecondSubmission;
  }
  
  // For convener/HOD review, only allow editing if status is in editableStatuses
  if (isConvenerReview || isHodReview) {
    return editableStatuses.has(s);
  }
  
  // For faculty, allow editing if status is editable or if it's second submission
  return editableStatuses.has(s) || canEditForSecondSubmission;
};

