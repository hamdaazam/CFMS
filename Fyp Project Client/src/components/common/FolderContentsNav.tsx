import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

// Add CSS for hiding scrollbar while keeping functionality
const scrollbarHideStyle = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;  /* Chrome, Safari, Opera */
  }
`;

type Item = { label: string; to: string };

export const FolderContentsNav: React.FC<{
  basePath: string;
  folderId: number;
  title?: string;
}> = ({ basePath, folderId, title = 'Folder Contents' }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const review = searchParams.get('review') === '1' ? '?review=1' : '';

  // Check if this is a review context (coordinator, convener, audit, or HOD)
  const isReviewContext = basePath === '/coordinator' || 
                          basePath === '/convener' || 
                          basePath === '/audit-member' || 
                          basePath === '/hod';
  
  // For audit review, use the audit review route instead of submit
  // For other reviewers, don't show Submit button at all
  const items: Item[] = [
    { label: 'Title Page', to: `${basePath}/folder/${folderId}/title-page${review}` },
    { label: 'Course Outline', to: `${basePath}/folder/${folderId}/course-outline${review}` },
    { label: 'Course Log', to: `${basePath}/folder/${folderId}/course-log${review}` },
    { label: 'Attendance', to: `${basePath}/folder/${folderId}/attendance${review}` },
    { label: 'Lecture Notes', to: `${basePath}/folder/${folderId}/lecture-notes${review}` },
    { label: 'Assignments', to: `${basePath}/folder/${folderId}/assignments/task${review}` },
    { label: 'Quizzes', to: `${basePath}/folder/${folderId}/quizzes${review}` },
    { label: 'Midterm', to: `${basePath}/folder/${folderId}/midterm/question-paper${review}` },
    { label: 'Final', to: `${basePath}/folder/${folderId}/final/question-paper${review}` },
    { label: 'Folder Report', to: `${basePath}/folder/${folderId}/report${review}` },
    { label: 'Project Report', to: `${basePath}/folder/${folderId}/project-report${review}` },
    { label: 'Course Result', to: `${basePath}/folder/${folderId}/course-result${review}` },
    { label: 'Course Review Report', to: `${basePath}/folder/${folderId}/folder-review-report${review}` },
    { label: 'CLO Assessment', to: `${basePath}/folder/${folderId}/clo-assessment${review}` },
    // Only show Submit for faculty (not for reviewers)
    // For audit review, show Final Decision instead
    ...(basePath === '/audit-member'
      ? [{ label: 'Final Decision', to: `/audit-member/folders/${folderId}/review` }]
      : !isReviewContext 
        ? [{ label: 'Submit', to: `${basePath}/folder/${folderId}/submit${review}` }]
        : []
    ),
  ];

  return (
    <>
      <style>{scrollbarHideStyle}</style>
      <div className="sticky top-20 z-20 bg-white/90 backdrop-blur border border-indigo-100 rounded-lg p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-indigo-900">{title}</h3>
        <span className="text-xs text-indigo-700/80">Folder #{folderId}</span>
      </div>
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 min-w-max pb-2">
          {items.map((it) => (
            (() => {
              const isActive = location.pathname === it.to.replace(/\?.*$/, '');
              return (
            <Link
              key={it.label}
              to={it.to}
              className={[
                'px-3 py-2 rounded-md text-xs font-semibold text-center border transition-colors whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200',
              ].join(' ')}
            >
              {it.label}
            </Link>
              );
            })()
          ))}
        </div>
      </div>
    </div>
    </>
  );
};


