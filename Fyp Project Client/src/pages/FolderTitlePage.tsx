import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { useReviewMode } from '../hooks/useReviewMode';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

interface FolderDetail {
  id: number;
  section: string;
  status?: string;
  course_title?: string;
  course_code?: string;
  instructor_name?: string;
  semester?: string;
  department_name?: string;
  program_name?: string;
}

const InfoRow: React.FC<{ label: string; value?: string; active?: boolean }>
  = ({ label, value, active }) => (
    <div className={`grid grid-cols-2 border border-gray-300 text-sm md:text-base ${active ? 'bg-white font-semibold' : 'bg-white/95'}`}>
      <div className="px-4 py-3 border-r border-gray-300 text-gray-700">{label}</div>
      <div className={`px-4 py-3 text-gray-900`}>{value || '—'}</div>
    </div>
  );

const FolderTitlePage: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;
  const navigate = useNavigate();
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [data, setData] = useState<FolderDetail | null>(null);
  const [active, setActive] = useState<string | null>('title');
  const id = Number(folderId);
  const idForNav = isNaN(id) ? (data?.id ?? id) : id;

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    // Use ultra-fast basic endpoint instead of full detail endpoint
    courseFoldersAPI.getBasic(id)
      .then((res) => {
        if (!mounted) return;
        console.log('[FolderTitlePage] Loaded data:', res.data);
        setData(res.data);
        setStatus((res.data?.status || '').toUpperCase());
      })
      .catch((err) => {
        console.error('[FolderTitlePage] Error loading folder:', err);
        if (mounted) setData(null);
      });
    return () => { mounted = false; };
  }, [id]);

  const courseTitle = data?.course_title || '—';
  const courseCode = data?.course_code || '—';
  const section = data?.section || '—';
  const instructor = data?.instructor_name || '—';
  const term = data?.semester || '—';

  // Determine layout role based on path
  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6">
        {/* On-screen navigation (avoid huge sidebar when many courses) */}
        <div className="mb-4">
          <FolderContentsNav basePath={basePath} folderId={idForNav} />
        </div>

        {/* Course chip */}
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-200/60 text-indigo-900 text-sm font-medium mb-4">
          {courseTitle}
        </div>

        <h2 className="text-base md:text-lg font-semibold text-indigo-900 mb-3">Title Page</h2>

        <div className="bg-white/80 border border-gray-200 rounded-md shadow-sm p-4 md:p-6 overflow-hidden">
          {/* Header: place logo to the right so it doesn't overlap the table */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm md:text-base font-semibold text-gray-900">
                COURSE FILE: BS Software Engineering
              </div>
              <div className="text-sm text-gray-700">
                Capital University of Science & Technology, Islamabad
              </div>
            </div>
            <img src="/cust-logo.png" alt="CUST" className="w-20 h-20 opacity-90 ml-4 flex-shrink-0" />
          </div>

          {/* Information table */}
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <InfoRow label="Course Title" value={courseTitle} active={active === 'title'} />
            <InfoRow label="Course Code" value={courseCode} active={active === 'code'} />
            <InfoRow label="Section" value={section} active={active === 'section'} />
            <InfoRow label="Instructor" value={instructor} active={active === 'instructor'} />
            <InfoRow label="Semester" value={term} active={active === 'semester'} />
          </div>

          {/* focus controls for demo highlight - real pages will set active automatically per route/interaction */}
          <div className="mt-4 flex gap-2 text-xs text-gray-500">
            <button className="underline" onClick={() => setActive('title')}>Highlight Title</button>
            <button className="underline" onClick={() => setActive('code')}>Code</button>
            <button className="underline" onClick={() => setActive('section')}>Section</button>
            <button className="underline" onClick={() => setActive('instructor')}>Instructor</button>
            <button className="underline" onClick={() => setActive('semester')}>Semester</button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/course-outline${isReviewContext ? '?review=1' : ''}`)}
            className="px-5 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Next
          </button>
        </div>

        {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && (
          <CoordinatorFeedbackBox folderId={id} section="TITLE_PAGE" />
        )}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && (
          <AuditMemberFeedbackBox folderId={id} section="TITLE_PAGE" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FolderTitlePage;
