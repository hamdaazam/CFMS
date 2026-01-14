import { useLocation } from 'react-router-dom';

/**
 * Detects whether the current route is a coordinator/audit-member/convener review view of a folder
 * and returns helpers to build correct base paths and enforce read-only.
 */
export const useReviewMode = () => {
  const location = useLocation();
  // Coordinator views can be under both `/coordinator/folder/...` (review/read-only views)
  // and `/coordinator/folders/...` (the coordinator's pending / edit views). Treat both as
  // coordinator context so pages render the correct base path and behaviour.
  const isCoordinatorReview = location.pathname.startsWith('/coordinator/folder/') || location.pathname.startsWith('/coordinator/folders/');
  const isAuditMemberReview = location.pathname.startsWith('/audit-member/folder/');
  const isConvenerReview = location.pathname.startsWith('/convener/folder/');
  const isHodReview = location.pathname.startsWith('/hod/folder/');
  
  // Determine base path based on current route
  let basePath = '/faculty';
  if (isCoordinatorReview) {
    basePath = '/coordinator';
  } else if (isAuditMemberReview) {
    basePath = '/audit-member';
  } else if (isConvenerReview) {
    basePath = '/convener';
  } else if (isHodReview) {
    basePath = '/hod';
  }
  
  return { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath };
};
