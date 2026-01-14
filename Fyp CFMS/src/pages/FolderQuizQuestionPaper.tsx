import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { printHtmlContent } from '../utils/print';
import RichTextEditor from '../components/common/RichTextEditor';
import { useReviewMode } from '../hooks/useReviewMode';
import { canEditFolder } from '../utils/folderPermissions';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

interface Question {
  id: string;
  questionText: string;
  marks: string;
}

interface QuizPaper {
  semester: string;
  instructor: string;
  date: string;
  name: string;
  regNo: string;
  maxMarks: string;
  maxTime: string;
  instructions?: string;
  questions: Question[];
}

const FolderQuizQuestionPaper: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string; quizId?: string }>();
  const folderId = params.folderId ?? params.id;
  const quizId = params.quizId;
  const navigate = useNavigate();
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [quizName, setQuizName] = useState<string>('Quiz');

  const [paperData, setPaperData] = useState<QuizPaper>({
    semester: '',
    instructor: 'Ms. Anum Naseem',
    date: new Date().toLocaleDateString('en-GB'),
    name: '',
    regNo: '',
    maxMarks: '10',
    maxTime: '90 min',
    instructions: 'Please attempt all questions carefully. Use your time wisely.',
    questions: [
      { id: '1', questionText: '', marks: 'Enter' }
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

        // Determine read-only based on status
        const s = (res.data?.status || '').toUpperCase();
        setStatus(s);
        const firstActivityCompleted = res.data?.first_activity_completed || false;
        const canEditForFinalSubmission = res.data?.can_edit_for_final_submission || false;
        // Use utility function to determine if folder can be edited
        const canEdit = canEditFolder(s, firstActivityCompleted, canEditForFinalSubmission, isAuditMemberReview, isConvenerReview, isHodReview);
        setReadOnly(!canEdit);

        // Load quiz name from quizzes array
        const quizzes = res.data.outline_content?.quizzes || [];
        const currentQuiz = quizzes.find((q: any) => q.id === quizId);
        if (currentQuiz) {
          setQuizName(currentQuiz.name);
        }

        // Load quiz-specific paper data
        const quizPapers = res.data.outline_content?.quizPapers || {};
        if (quizPapers[quizId!]) {
          const saved = quizPapers[quizId!];
          setPaperData({
            ...saved,
            semester: saved.semester || res.data.semester || '',
            date: saved.date || res.data.date || new Date().toLocaleDateString('en-GB')
          });
          setIsSaved(true);
        } else {
          // Set defaults from folder data
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
  }, [id, quizId, isCoordinatorReview]);

  const handleAddQuestion = () => {
    if (readOnly) return;
    const newQuestion: Question = {
      id: Date.now().toString(),
      questionText: '',
      marks: 'Enter'
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
    if (readOnly) return;
    setSaving(true);
    try {
      const existingContent = data?.outline_content || {};
      const quizPapers = existingContent.quizPapers || {};

      await courseFoldersAPI.saveOutline(id, {
        outline_content: {
          ...existingContent,
          quizPapers: {
            ...quizPapers,
            [quizId!]: paperData
          }
        }
      });

      alert('Quiz question paper saved successfully!');
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

  // Determine layout role based on path
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

        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4">Quiz Question Paper</h2>

        <div className="bg-white border border-gray-300 rounded-md shadow-sm p-6 md:p-8 max-w-4xl mx-auto" ref={printRef}>
          <style>{`
            @page {
              margin: 0;
              size: A4;
            }
            @media print {
              @page {
                margin: 0;
                size: A4;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
              }
              .print-question-no-border { 
                border: none !important; 
                box-shadow: none !important;
              }
              .print-question-no-bg { background: transparent !important; }
              .print-question-no-border .richtext-editor,
              .print-question-no-border .richtext-editor > div {
                border: none !important;
              }
              .no-print { display: none !important; }
            }
          `}</style>
          {/* Header with Logo */}
          <div className="text-center mb-6 print:mb-4">
            <div className="flex justify-center mb-3">
              <img src="/cust-logo.png" alt="CUST Logo" className="w-20 h-20" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-1">
              Capital University of Science and Technology
            </h1>
            <h2 className="text-lg font-semibold text-gray-700 mb-0.5">
              Department of Software Engineering
            </h2>
            <div className="text-base font-semibold text-gray-700 mb-1">
              {courseCode} {courseTitle}
            </div>
            <div className="text-base font-bold text-gray-800">{quizName}</div>
          </div>

          <hr className="border-gray-300 my-4 print-hide-hr print:my-0" />



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
              <span className="font-semibold text-gray-700 w-32">Max Time:</span>
              <input
                type="text"
                value={paperData.maxTime}
                onChange={(e) => setPaperData({ ...paperData, maxTime: e.target.value })}
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

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Name:</span>
              <input
                type="text"
                value={paperData.name}
                onChange={(e) => setPaperData({ ...paperData, name: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Reg. No.</span>
              <input
                type="text"
                value={paperData.regNo}
                onChange={(e) => setPaperData({ ...paperData, regNo: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <hr className="border-gray-300 my-6" />

          {/* Instructions */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
            <p className="text-sm font-semibold text-gray-800 mb-2">Instructions:</p>
            <RichTextEditor
              value={paperData.instructions || ''}
              onChange={(html) => setPaperData({ ...paperData, instructions: html })}
              placeholder="Enter instructions here..."
              readOnly={readOnly}
              className="w-full text-sm text-gray-700 bg-transparent focus:outline-none resize-none"
            />
          </div>

          {/* Questions */}
          <div className="space-y-6">
            {paperData.questions.map((question, index) => (
              <div key={question.id} className="border border-gray-200 rounded-md p-4 bg-gray-50 print-question-no-border print-question-no-bg print:p-0">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-semibold text-gray-800">Question {index + 1}:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Marks:</span>
                      <input
                        type="number"
                        min="0"
                        value={question.marks}
                        onChange={(e) => handleUpdateQuestion(question.id, 'marks', e.target.value)}
                        disabled={readOnly}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  {paperData.questions.length > 1 && !readOnly && (
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="text-red-600 hover:text-red-700 text-sm no-print"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <RichTextEditor
                  value={question.questionText || ''}
                  onChange={(html) => handleUpdateQuestion(question.id, 'questionText', html)}
                  placeholder="Paste OR write question here"
                  readOnly={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-indigo-500 text-gray-700 print-question-no-border"
                />
              </div>
            ))}

            {!readOnly && (
              <button
                onClick={handleAddQuestion}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors no-print"
              >
                + Add Question
              </button>
            )}
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || readOnly}
              className="px-6 py-2 bg-red-700 text-white rounded-full hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {readOnly ? 'Read-only' : saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                if (!isSaved) return;
                try {
                  if (!printRef.current) { console.warn('doPrint: printRef missing'); return; }
                  console.log('doPrint: about to print using element node');
                  printHtmlContent('Quiz Paper', printRef.current);
                } catch (e) { console.error('print error', e); }
              }}
              disabled={!isSaved}
              className="px-6 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-700 disabled:bg-gray-300"
            >
              Print
            </button>
            <button
              onClick={() => navigate(`${basePath}/folder/${idForNav}/quizzes/${quizId}/model-solution${isReviewContext ? '?review=1' : ''}`)}
              className="px-6 py-2 bg-indigo-900 text-white rounded-full hover:bg-indigo-800"
            >
              Next: Model Solution
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center max-w-4xl mx-auto">
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/quizzes${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-coral text-white hover:bg-coral/90"
          >
            Back to Quizzes
          </button>
        </div>

        {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && <CoordinatorFeedbackBox folderId={id!} section={`QUIZ_${quizId}_QUESTION_PAPER`} />}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && <AuditMemberFeedbackBox folderId={id!} section={`${quizName} - Question Paper`} />}
      </div>
    </DashboardLayout>
  );
};

export default FolderQuizQuestionPaper;
