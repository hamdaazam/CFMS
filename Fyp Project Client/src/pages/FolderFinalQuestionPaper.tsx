import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { useReviewMode } from '../hooks/useReviewMode';
import { printHtmlContent } from '../utils/print';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import RichTextEditor from '../components/common/RichTextEditor';
import { canEditFolder } from '../utils/folderPermissions';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

interface Question {
  id: string;
  questionText: string;
  marks: string;
  clo: string;
}

interface FinalPaper {
  semester: string;
  instructor: string;
  date: string;
  instructions?: string;
  duration: string;
  maxMarks: string;
  clo: string;
  questions: Question[];
}

const FolderFinalQuestionPaper: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const [paperData, setPaperData] = useState<FinalPaper>({
    semester: '',
    instructor: 'Ms. Anum Naseem',
    date: new Date().toLocaleDateString('en-GB'),
    instructions: 'There are TWO questions in this paper on TWO pages. Attempt all questions. This exam carries 20% weight towards the final evaluation. Attempt all questions on answer sheet.',
    duration: '3 Hours',
    maxMarks: '100',
    clo: '1',
    questions: [
      { id: '1', questionText: '', marks: '10', clo: '1' }
    ]
  });

  const id = Number(folderId);
  const idForNav = isNaN(id) ? (data?.id ?? id) : id;

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    courseFoldersAPI.getBasic(id)
      .then((res) => {
        if (!mounted) return;
        setData(res.data);
        const s = (res.data?.status || '').toUpperCase();
        setStatus(s);
        const firstActivityCompleted = res.data?.first_activity_completed || false;
        const canEditForFinalSubmission = res.data?.can_edit_for_final_submission || false;
        // Use utility function to determine if folder can be edited
        const canEdit = canEditFolder(s, firstActivityCompleted, canEditForFinalSubmission, isAuditMemberReview, isConvenerReview, isHodReview);
        setReadOnly(!canEdit);
        const finalPaper = res.data.outline_content?.finalPaper;
        if (finalPaper) {
          const saved = finalPaper;
          setPaperData({
            ...saved,
            semester: saved.semester || res.data.semester || '',
            date: saved.date || res.data.date || new Date().toLocaleDateString('en-GB')
          });
          setIsSaved(true);
        } else {
          setPaperData(prev => ({
            ...prev,
            instructor: res.data.instructor_name || prev.instructor,
            semester: res.data.semester || prev.semester,
            date: res.data.date || prev.date || new Date().toLocaleDateString('en-GB')
          }));
          setIsSaved(false);
        }
      })
      .catch(() => {
        if (mounted) setData(null);
      });
    return () => { mounted = false; };
  }, [id]);

  const handleAddQuestion = () => {
    if (readOnly) return;
    const newQuestion: Question = {
      id: Date.now().toString(),
      questionText: '',
      marks: '10',
      clo: '1'
    };
    setPaperData({ ...paperData, questions: [...paperData.questions, newQuestion] });
  };

  const handleUpdateQuestion = (questionId: string, field: keyof Question, value: string) => {
    if (readOnly) return;
    setPaperData({
      ...paperData,
      questions: paperData.questions.map(q =>
        q.id === questionId ? { ...q, [field]: value } : q
      )
    });
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (readOnly) return;
    if (paperData.questions.length <= 1) {
      alert('At least one question is required');
      return;
    }
    setPaperData({
      ...paperData,
      questions: paperData.questions.filter(q => q.id !== questionId)
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingContent = data?.outline_content || {};

      await courseFoldersAPI.saveOutline(id, {
        outline_content: {
          ...existingContent,
          finalPaper: paperData
        }
      });

      alert('Question paper saved successfully!');
      setIsSaved(true);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const courseTitle = data?.course_title || 'Operating System';
  const courseCode = data?.course_code || 'SE3413';

  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <FolderContentsNav basePath={basePath} folderId={idForNav} />
        </div>
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium mb-4">
          {courseTitle}
        </div>

        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4">Final Question Paper</h2>

        <div className="bg-white border border-gray-300 rounded-md shadow-sm p-6 md:p-8 max-w-4xl mx-auto" ref={printRef}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <img src="/cust-logo.png" alt="CUST Logo" className="w-20 h-20" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-1">
              Capital University of Science and Technology
            </h1>
            <h2 className="text-base font-semibold text-gray-700 mb-0.5">
              Department of Software Engineering
            </h2>
            <div className="text-base font-semibold text-gray-700 mb-1">
              {courseCode} - {courseTitle}
            </div>
            <div className="text-sm font-normal text-gray-700">Final Exam {paperData.semester || ''}</div>
          </div>

          <hr className="border-gray-300 my-4" />

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Semester:</span>
              <input
                type="text"
                value={paperData.semester}
                onChange={(e) => setPaperData({ ...paperData, semester: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Max Marks:</span>
              <input
                type="number"
                min="0"
                value={paperData.maxMarks}
                onChange={(e) => setPaperData({ ...paperData, maxMarks: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Instructor:</span>
              <input
                type="text"
                value={paperData.instructor}
                onChange={(e) => setPaperData({ ...paperData, instructor: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Time:</span>
              <input
                type="text"
                value={paperData.duration}
                onChange={(e) => setPaperData({ ...paperData, duration: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Date:</span>
              <input
                type="text"
                value={paperData.date}
                onChange={(e) => setPaperData({ ...paperData, date: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
            <p className="text-sm font-semibold text-gray-800 mb-2">Instructions:</p>
            <RichTextEditor
              value={paperData.instructions || ''}
              onChange={(html) => setPaperData({ ...paperData, instructions: html })}
              placeholder="Enter exam instructions here..."
              readOnly={readOnly}
              className="w-full text-sm text-gray-700 bg-transparent focus:outline-none resize-none"
            />
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="flex">
              <span className="font-semibold text-gray-700 w-24">Name:</span>
              <div className="flex-1 border-b border-gray-300"></div>
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-24">Reg No.</span>
              <div className="flex-1 border-b border-gray-300"></div>
            </div>
          </div>

          <hr className="border-gray-300 my-6" />


          {/* Questions */}
          <div className="space-y-6">
            {paperData.questions.map((question, index) => (
              <div key={question.id} className="mb-6">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-semibold text-gray-800">Question {index + 1}:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">CLO:</span>
                      <input
                        type="text"
                        value={question.clo}
                        onChange={(e) => handleUpdateQuestion(question.id, 'clo', e.target.value)}
                        disabled={readOnly}
                        className="w-16 px-2 py-1 border-b border-gray-300 text-sm focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                        placeholder="1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Marks:</span>
                      <input
                        type="number"
                        min="0"
                        value={question.marks}
                        onChange={(e) => handleUpdateQuestion(question.id, 'marks', e.target.value)}
                        disabled={readOnly}
                        className="w-20 px-2 py-1 border-b border-gray-300 text-sm focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>
                  </div>
                  {paperData.questions.length > 1 && (
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      disabled={readOnly}
                      className="text-red-600 hover:text-red-700 text-sm disabled:text-gray-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="border-b-2 border-gray-300 pb-1 mb-3"></div>
                <RichTextEditor
                  value={question.questionText || ''}
                  onChange={(html) => handleUpdateQuestion(question.id, 'questionText', html)}
                  placeholder="Type question text here..."
                  readOnly={readOnly}
                  className="w-full px-0 py-2 border-0 focus:outline-none focus:ring-0 text-gray-700 text-sm"
                />
                <div className="border-b border-gray-200 mt-8"></div>
              </div>
            ))}

            <button
              onClick={handleAddQuestion}
              disabled={readOnly}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors disabled:text-gray-400 disabled:hover:border-gray-300"
            >
              + Add Question
            </button>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || readOnly}
              className="px-6 py-2 bg-red-700 text-white rounded-full hover:bg-red-800 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : readOnly ? 'Read-only' : 'Save'}
            </button>
            <button
              onClick={() => {
                if (!isSaved) return;
                try {
                  if (!printRef.current) { console.warn('doPrint: printRef missing'); return; }
                  console.log('doPrint: about to print using element node');
                  printHtmlContent('Final Paper', printRef.current);
                } catch (e) { console.error('print error', e); }
              }}
              disabled={!isSaved}
              className="px-6 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-700 disabled:bg-gray-300"
            >
              Print
            </button>
            <button
              onClick={() => navigate(`${basePath}/folder/${idForNav}/final/model-solution${isReviewContext ? '?review=1' : ''}`)}
              className="px-6 py-2 bg-indigo-900 text-white rounded-full hover:bg-indigo-800"
            >
              Next: Model Solution
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center max-w-4xl mx-auto">
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/midterm/records/worst${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-coral text-white hover:bg-coral/90"
          >
            Previous
          </button>
        </div>

        {isCoordinatorReview && submittedStatuses.has((status || '').toUpperCase()) && isReviewContext && (
          <CoordinatorFeedbackBox folderId={id} section="FINAL_QUESTION_PAPER" />
        )}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && (
          <AuditMemberFeedbackBox folderId={id} section="FINAL_QUESTION_PAPER" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FolderFinalQuestionPaper;
