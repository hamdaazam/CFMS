import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { useReviewMode } from '../hooks/useReviewMode';
import { courseFoldersAPI } from '../services/api';
import { FolderContentsNav } from '../components/common/FolderContentsNav';
import { canEditFolder } from '../utils/folderPermissions';

interface FolderDetail {
  id: number;
  section: string;
  status?: string;
  course_title?: string;
  course_code?: string;
  instructor_name?: string;
  semester?: string;
  outline_content?: OutlineContent;
  coordinator_remarks?: string | null;
  coordinator_notes?: string | null;
  coordinator_feedback?: Record<string, string> | null;
  convener_notes?: string | null;
  hod_notes?: string | null;
  coordinator_reviewed_by_details?: { full_name?: string } | null;
  coordinator_reviewed_at?: string | null;
  first_activity_completed?: boolean;
}

interface GradingPolicy {
  assessment: string;
  percentage: string;
}

interface CLOPLOMapping {
  plo: string;
  clo1: boolean;
  clo2: boolean;
  clo3: boolean;
}

interface OutlineContent {
  introduction?: string;
  objectives?: string;
  weeklyPlan?: string;
  textbooks?: string;
  gradingPolicy?: GradingPolicy[];
  cloHeaders?: string[];
  ploMappings?: CLOPLOMapping[];
}

const FolderCourseOutline: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;
  const navigate = useNavigate();
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>([
    'SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED'
  ]);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [data, setData] = useState<FolderDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  // Refs for contentEditable divs
  const introRef = React.useRef<HTMLDivElement>(null);
  const objectivesRef = React.useRef<HTMLDivElement>(null);
  const weeklyPlanRef = React.useRef<HTMLDivElement>(null);
  const textbooksRef = React.useRef<HTMLDivElement>(null);

  // Editable content state
  const [introduction, setIntroduction] = useState('');
  const [objectives, setObjectives] = useState('');
  const [weeklyPlan, setWeeklyPlan] = useState('');
  const [textbooks, setTextbooks] = useState('');
  const [gradingPolicy, setGradingPolicy] = useState<GradingPolicy[]>([
    { assessment: 'Quiz', percentage: '20%' },
    { assessment: 'Assignments', percentage: '20%' },
    { assessment: 'Mid Term', percentage: '20%' },
    { assessment: 'Final Term', percentage: '40%' },
  ]);
  const [cloHeaders, setCloHeaders] = useState(['CLO1', 'CLO 2', 'CLO 3']);
  const [ploMappings, setPloMappings] = useState<CLOPLOMapping[]>([
    { plo: 'PLO Name/ Knowledge', clo1: false, clo2: false, clo3: false },
    { plo: 'PLO-2 (Problem Analysis/ Solve Computing Problems)', clo1: true, clo2: false, clo3: false },
    { plo: 'PLO-3 (Problem Analysis/ Design of solutions)', clo1: false, clo2: true, clo3: false },
    { plo: 'PLO-X (Design/ Development of Solutions)', clo1: false, clo2: false, clo3: true },
  ]);

  const id = Number(folderId);

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    // Use ultra-fast basic endpoint instead of full detail endpoint
    courseFoldersAPI.getBasic(id)
      .then((res) => {
        if (!mounted) return;
        const responseData = res.data;
        console.log('[FolderCourseOutline] Loaded data:', {
          course_title: responseData?.course_title,
          course_code: responseData?.course_code,
          instructor_name: responseData?.instructor_name
        });
        
        setData(responseData);
        // Determine read-only based on status: Submitted/Under-review/Approved/Completed
        const s = (responseData?.status || '').toUpperCase();
        setStatus(s);
        const firstActivityCompleted = responseData?.first_activity_completed || false;
        const canEditForFinalSubmission = responseData?.can_edit_for_final_submission || false;
        // Use utility function to determine if folder can be edited
        const canEdit = canEditFolder(s, firstActivityCompleted, canEditForFinalSubmission, isAuditMemberReview, isConvenerReview, isHodReview);
        setReadOnly(!canEdit);
        // Load saved content from back end if exists
        if (responseData?.outline_content) {
          const content = responseData.outline_content;
          const intro = content.introduction || '';
          const obj = content.objectives || '';
          const weekly = content.weeklyPlan || '';
          const books = content.textbooks || '';
          
          setIntroduction(intro);
          setObjectives(obj);
          setWeeklyPlan(weekly);
          setTextbooks(books);
          
          // Set innerHTML for refs after state update
          setTimeout(() => {
            if (introRef.current) introRef.current.innerHTML = intro;
            if (objectivesRef.current) objectivesRef.current.innerHTML = obj;
            if (weeklyPlanRef.current) weeklyPlanRef.current.innerHTML = weekly;
            if (textbooksRef.current) textbooksRef.current.innerHTML = books;
          }, 0);
          
          if (content.gradingPolicy) setGradingPolicy(content.gradingPolicy);
          if (content.cloHeaders) setCloHeaders(content.cloHeaders);
          if (content.ploMappings) setPloMappings(content.ploMappings);
        }
      })
      .catch((error) => {
        console.error('[FolderCourseOutline] Error loading data:', error);
        if (mounted) {
          setData(null);
        }
      });
    return () => { mounted = false; };
  }, [id]);

  const courseTitle = data?.course_title || '—';
  const courseCode = data?.course_code || '—';
  const instructor = data?.instructor_name || '—';

  const toggleMapping = (rowIndex: number, cloIndex: number) => {
    const updated = [...ploMappings];
    const key = `clo${cloIndex + 1}` as keyof CLOPLOMapping;
    updated[rowIndex] = { ...updated[rowIndex], [key]: !updated[rowIndex][key] };
    setPloMappings(updated);
  };

  const updatePLOText = (rowIndex: number, value: string) => {
    const updated = [...ploMappings];
    updated[rowIndex] = { ...updated[rowIndex], plo: value };
    setPloMappings(updated);
  };

  const updateCLOHeader = (index: number, value: string) => {
    const updated = [...cloHeaders];
    updated[index] = value;
    setCloHeaders(updated);
  };

  const updateGradingPolicy = (index: number, field: 'assessment' | 'percentage', value: string) => {
    const updated = [...gradingPolicy];
    updated[index] = { ...updated[index], [field]: value };
    setGradingPolicy(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const outlineContent: OutlineContent = {
        introduction,
        objectives,
        weeklyPlan,
        textbooks,
        gradingPolicy,
        cloHeaders,
        ploMappings,
      };

      await courseFoldersAPI.saveOutline(id, { outline_content: outlineContent });
      
      // Reload data after save to get fresh course code, title, instructor name, and outline content
      const freshData = await courseFoldersAPI.getBasic(id);
      if (freshData?.data) {
        setData(freshData.data);
        
        // Reload outline content fields from server
        if (freshData.data.outline_content) {
          const content = freshData.data.outline_content;
          setIntroduction(content.introduction || '');
          setObjectives(content.objectives || '');
          setWeeklyPlan(content.weeklyPlan || '');
          setTextbooks(content.textbooks || '');
          
          // Update contentEditable divs
          setTimeout(() => {
            if (introRef.current) introRef.current.innerHTML = content.introduction || '';
            if (objectivesRef.current) objectivesRef.current.innerHTML = content.objectives || '';
            if (weeklyPlanRef.current) weeklyPlanRef.current.innerHTML = content.weeklyPlan || '';
            if (textbooksRef.current) textbooksRef.current.innerHTML = content.textbooks || '';
          }, 0);
          
          if (content.gradingPolicy) setGradingPolicy(content.gradingPolicy);
          if (content.cloHeaders) setCloHeaders(content.cloHeaders);
          if (content.ploMappings) setPloMappings(content.ploMappings);
        }
        
        console.log('[FolderCourseOutline] Reloaded after save:', {
          course_title: freshData.data.course_title,
          course_code: freshData.data.course_code,
          instructor_name: freshData.data.instructor_name,
          has_outline_content: !!freshData.data.outline_content
        });
      }
      
      alert('Course outline saved successfully!');
    } catch (error) {
      console.error('Error saving outline:', error);
      alert('Failed to save course outline');
    } finally {
      setSaving(false);
    }
  };

  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <FolderContentsNav basePath={basePath} folderId={id} />
        </div>
        {/* Course chip */}
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-200/60 text-indigo-900 text-sm font-medium mb-4">
          {courseTitle}
        </div>

        <h2 className="text-base md:text-lg font-semibold text-indigo-900 mb-3">Course Outline</h2>

        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 md:p-6 relative overflow-hidden">
          {/* Logo watermark */}
          <div className="flex justify-center mb-4">
            <img src="/cust-logo.png" alt="CUST" className="w-16 h-16 opacity-90" />
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-sm md:text-base font-semibold text-gray-900">
              Capital University of Science & Technology, Islamabad
            </div>
            <div className="text-sm text-gray-700">
              Department of Software Engineering
            </div>
          </div>

          {/* Course Info */}
          <div className="border border-gray-300 rounded-sm mb-6">
            <div className="grid grid-cols-2 border-b border-gray-300">
              <div className="px-4 py-2 border-r border-gray-300 font-medium text-sm text-gray-700 bg-gray-50">Course Code</div>
              <div className="px-4 py-2 text-sm text-gray-900">{courseCode}</div>
            </div>
            <div className="grid grid-cols-2 border-b border-gray-300">
              <div className="px-4 py-2 border-r border-gray-300 font-medium text-sm text-gray-700 bg-gray-50">Course Title</div>
              <div className="px-4 py-2 text-sm text-gray-900">{courseTitle}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="px-4 py-2 border-r border-gray-300 font-medium text-sm text-gray-700 bg-gray-50">Instructor Name</div>
              <div className="px-4 py-2 text-sm text-gray-900">{instructor}</div>
            </div>
          </div>

          {/* Introduction */}
          <div className="border border-gray-300 rounded-sm mb-4">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-300 font-medium text-sm text-gray-700">Introduction</div>
            <div
              ref={introRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onInput={(e) => setIntroduction(e.currentTarget.innerHTML)}
              onBlur={(e) => setIntroduction(e.currentTarget.innerHTML)}
              className="px-4 py-3 text-sm text-gray-800 min-h-[60px] focus:outline-none focus:bg-blue-50/30 text-left"
              style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}
              dir="ltr"
              data-placeholder="Type introduction here..."
            />
          </div>

          {/* Objectives */}
          <div className="border border-gray-300 rounded-sm mb-4">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-300 font-medium text-sm text-gray-700">Objectives</div>
            <div
              ref={objectivesRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onInput={(e) => setObjectives(e.currentTarget.innerHTML)}
              onBlur={(e) => setObjectives(e.currentTarget.innerHTML)}
              className="px-4 py-3 text-sm text-gray-800 min-h-[60px] focus:outline-none focus:bg-blue-50/30 text-left"
              style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}
              dir="ltr"
              data-placeholder="Type objectives here..."
            />
          </div>

          {/* Contents/Weekly Plan */}
          <div className="border border-gray-300 rounded-sm mb-4">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-300 font-medium text-sm text-gray-700">Contents/Weekly Plan</div>
            <div
              ref={weeklyPlanRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onInput={(e) => setWeeklyPlan(e.currentTarget.innerHTML)}
              onBlur={(e) => setWeeklyPlan(e.currentTarget.innerHTML)}
              className="px-4 py-3 text-sm text-gray-800 min-h-[60px] focus:outline-none focus:bg-blue-50/30 text-left"
              style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}
              dir="ltr"
              data-placeholder="Type weekly plan here..."
            />
          </div>

          {/* Textbooks & Reference books */}
          <div className="border border-gray-300 rounded-sm mb-4">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-300 font-medium text-sm text-gray-700">Textbooks & Reference books</div>
            <div
              ref={textbooksRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onInput={(e) => setTextbooks(e.currentTarget.innerHTML)}
              onBlur={(e) => setTextbooks(e.currentTarget.innerHTML)}
              className="px-4 py-3 text-sm text-gray-800 min-h-[60px] focus:outline-none focus:bg-blue-50/30 text-left"
              style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}
              dir="ltr"
              data-placeholder="Type textbooks and references here..."
            />
          </div>

          {/* Grading Policy / Eval - Now Editable */}
          <div className="border border-gray-300 rounded-sm mb-4">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-300 font-medium text-sm text-gray-700">Grading policy/ Evaluation Criteria</div>
            <div className="px-4 py-3">
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {gradingPolicy.map((item, idx) => (
                    <tr key={idx} className={idx < gradingPolicy.length - 1 ? 'border-b border-gray-200' : ''}>
                      <td className="py-2 pr-4">
                        <input
                          type="text"
                          value={item.assessment}
                          onChange={(e) => updateGradingPolicy(idx, 'assessment', e.target.value)}
                          disabled={readOnly}
                          className="w-full text-gray-700 bg-transparent focus:outline-none focus:bg-white px-1 py-0.5 rounded disabled:text-gray-400"
                          placeholder="Assessment name"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="text"
                          value={item.percentage}
                          onChange={(e) => updateGradingPolicy(idx, 'percentage', e.target.value)}
                          disabled={readOnly}
                          className="w-full text-gray-900 font-medium bg-transparent focus:outline-none focus:bg-white px-1 py-0.5 rounded disabled:text-gray-400"
                          placeholder="XX%"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CLO -PLO mapping */}
          <div className="border border-gray-300 rounded-sm mb-4">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-300 font-medium text-sm text-gray-700">Clo -PLO mapping</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-2 text-left font-medium text-gray-700"></th>
                    <th className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-700">CLOs</th>
                    {cloHeaders.map((header, idx) => (
                      <th key={idx} className="border border-gray-300 px-2 py-2 text-center font-medium text-gray-700">
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => updateCLOHeader(idx, e.target.value)}
                          disabled={readOnly}
                          className="w-full text-center bg-transparent focus:outline-none focus:bg-white px-1 py-0.5 rounded disabled:text-gray-400"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ploMappings.map((mapping, rowIdx) => (
                    <tr key={rowIdx}>
                      {rowIdx === 0 && (
                        <td className="border border-gray-300 px-2 py-2 text-gray-700 align-top font-medium">PLOs</td>
                      )}
                      {rowIdx > 0 && <td className="border border-gray-300 px-2 py-2"></td>}
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="text"
                          value={mapping.plo}
                          onChange={(e) => updatePLOText(rowIdx, e.target.value)}
                          disabled={readOnly}
                          className="w-full text-xs text-gray-700 bg-transparent focus:outline-none focus:bg-white px-1 py-0.5 rounded disabled:text-gray-400"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={mapping.clo1}
                            onChange={() => toggleMapping(rowIdx, 0)}
                            disabled={readOnly}
                            className="w-5 h-5 cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
                          />
                        </div>
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={mapping.clo2}
                            onChange={() => toggleMapping(rowIdx, 1)}
                            disabled={readOnly}
                            className="w-5 h-5 cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
                          />
                        </div>
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={mapping.clo3}
                            onChange={() => toggleMapping(rowIdx, 2)}
                            disabled={readOnly}
                            className="w-5 h-5 cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="mt-6 flex justify-between items-center">
          <button
            onClick={() => navigate(`${basePath}/folder/${id}/title-page${isReviewContext ? '?review=1' : ''}`)}
            className="px-5 py-2 rounded-full bg-coral text-white hover:bg-coral/90"
          >
            Previous
          </button>
          <button
            onClick={handleSave}
            disabled={saving || readOnly}
            className="px-6 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : readOnly ? 'Read-only' : 'Save Changes'}
          </button>
          <button
            onClick={() => navigate(`${basePath}/folder/${id}/course-log${isReviewContext ? '?review=1' : ''}`)}
            className="px-5 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Next
          </button>
        </div>

        {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && (
          <CoordinatorFeedbackBox folderId={id} section="COURSE_OUTLINE" />
        )}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && (
          <AuditMemberFeedbackBox folderId={id} section="COURSE_OUTLINE" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FolderCourseOutline;
