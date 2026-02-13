import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { useAutoSave } from '../hooks/useAutoSave';

interface Question {
  id: string;
  questionText: string;
  marks: string;
}

interface AssignmentPaper {
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

const FolderAssignmentQuestionPaper: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string; assignmentId?: string }>();
  const folderId = params.folderId ?? params.id;
  const assignmentId = params.assignmentId;
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
  const [assignmentName, setAssignmentName] = useState<string>('Assignment');

  const [paperData, setPaperData] = useState<AssignmentPaper>({
    semester: '',
    instructor: 'Ms. Anum Naseem',
    date: new Date().toLocaleDateString('en-GB'),
    name: '',
    regNo: '',
    maxMarks: '10',
    maxTime: '90 min',
    instructions: 'Please attempt all questions. Read instructions carefully before attempting the questions.',
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

        // Load assignment name from assignments array
        const assignments = res.data.outline_content?.assignments || [];
        const currentAssignment = assignments.find((a: any) => a.id === assignmentId);
        if (currentAssignment) {
          setAssignmentName(currentAssignment.name);
        }

        // Load assignment-specific paper data
        const assignmentPapers = res.data.outline_content?.assignmentPapers || {};
        if (assignmentPapers[assignmentId!]) {
          const saved = assignmentPapers[assignmentId!];
          // Ensure questions array exists and is not empty
          const questions = saved.questions && Array.isArray(saved.questions) && saved.questions.length > 0
            ? saved.questions
            : [{ id: Date.now().toString(), questionText: '', marks: 'Enter' }];
          
          setPaperData({
            ...saved,
            semester: saved.semester || res.data.semester || saved?.semester || '',
            date: saved.date || res.data.date || new Date().toLocaleDateString('en-GB'),
            questions: questions // Ensure questions array is always present
          });
          setIsSaved(true);
        } else {
          // Set defaults from folder data
          setPaperData(prev => ({
            ...prev,
            instructor: res.data.instructor_name || prev.instructor,
            semester: res.data.semester || prev.semester,
            date: res.data.date || prev.date || new Date().toLocaleDateString('en-GB'),
            questions: prev.questions && prev.questions.length > 0 
              ? prev.questions 
              : [{ id: Date.now().toString(), questionText: '', marks: 'Enter' }] // Ensure at least one question
          }));
          setIsSaved(false);
        }
      })
      .catch(() => {
        if (mounted) setData(null);
      });
    return () => { mounted = false; };
  }, [id, assignmentId, isCoordinatorReview]);

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

  // Auto-save hook - saves when data changes, on navigation, and on unmount
  const saveData = useCallback(async () => {
    if (readOnly || !id || !assignmentId || !data) return;
    
    const existingContent = data.outline_content || {};
    const assignmentPapers = existingContent.assignmentPapers || {};

    await courseFoldersAPI.saveOutline(id, {
      outline_content: {
        ...existingContent,
        assignmentPapers: {
          ...assignmentPapers,
          [assignmentId]: paperData
        }
      }
    });
    
    setIsSaved(true);
  }, [readOnly, id, assignmentId, data, paperData]);

  const { triggerSave, navigateWithSave, isSaving: autoSaving } = useAutoSave({
    saveFn: saveData,
    enabled: !readOnly && !!id && !!assignmentId && !!data,
    debounceMs: 2000, // Auto-save 2 seconds after user stops typing
    saveBeforeNavigation: true,
    saveOnUnmount: true,
    saveOnBeforeUnload: true,
    dependencies: [paperData] // Auto-save when paperData changes
  });

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      await triggerSave();
      alert('Assignment question paper saved successfully!');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const doPrint = () => {
    if (!isSaved) return;
    try {
      if (!printRef.current) { console.warn('doPrint: printRef missing'); return; }
      console.log('doPrint: about to print using element node');
      // Use empty title to avoid any text in browser print header
      printHtmlContent('', printRef.current);
    } catch (e) { console.error('print error', e); }
  };

  const courseTitle = data?.course_title || 'Operating System';
  // const courseCode = data?.course_code || 'SE3413';

  // Determine layout role based on path
  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6 print:p-0">
        <div className="mb-4 no-print">
          <FolderContentsNav basePath={basePath} folderId={idForNav} />
        </div>
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium mb-4 no-print">
          {courseTitle}
        </div>

        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 no-print">Assignment Question Paper</h2>

        <div className="bg-white border border-gray-300 rounded-md shadow-sm p-6 md:p-8 max-w-4xl mx-auto print:!border-0 print:!shadow-none print:!p-0 print:!rounded-none print:!max-w-none print:!mx-0 print:!bg-transparent" ref={printRef}>
          <style>{`
            @page {
              margin: 25mm 20mm;
              size: A4;
            }
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              @page {
                margin: 25mm 20mm;
                size: A4;
              }
              
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                background: white !important;
              }
              
              /* Hide browser print headers/footers text */
              @page {
                margin: 25mm 20mm;
                size: A4;
                marks: none;
              }
              
              /* Hide browser date/time and URL in print */
              @page {
                margin: 25mm 20mm;
                size: A4;
                marks: none;
              }
              
              /* Additional CSS to hide any date/time text and browser headers */
              body::before,
              body::after,
              html::before,
              html::after,
              .page::before,
              .page::after {
                display: none !important;
                content: none !important;
                visibility: hidden !important;
              }
              
              /* Hide any title text that might appear */
              title {
                display: none !important;
              }
              
              /* Ensure no browser header/footer text appears */
              @page {
                margin: 25mm 20mm;
                size: A4;
                marks: none;
              }
              
              /* Remove any text nodes that contain "about:blank" or dates */
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              body * {
                visibility: visible;
              }
              
              .no-print,
              .no-print * {
                display: none !important;
                visibility: hidden !important;
              }
              
              /* Hide scrollbars */
              ::-webkit-scrollbar {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
              }
              
              * {
                overflow: visible !important;
                scrollbar-width: none !important;
              }
              
              /* Main container */
              .page > div,
              [class*="print"] {
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
              }
              
              /* Print utility classes */
              .print-no-border { 
                border: none !important; 
                box-shadow: none !important;
              }
              
              .print-no-bg { 
                background: transparent !important; 
              }
              
              .print-no-border-bottom { 
                border-bottom: none !important; 
              }
              
              .print-hide-hr { 
                display: none !important; 
              }
              
              .print-no-padding { 
                padding: 0 !important; 
              }
              
              .print-no-margin { 
                margin: 0 !important; 
              }
              
              /* Hide horizontal rules */
              hr { 
                display: none !important; 
                visibility: hidden !important;
              }
              
              /* Remove ALL borders, backgrounds, and boxes - override everything including Tailwind */
              * {
                border: none !important;
                border-top: none !important;
                border-right: none !important;
                border-bottom: none !important;
                border-left: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                background: transparent !important;
                background-color: transparent !important;
                outline: none !important;
              }
              
              /* Keep white background only on body/page */
              body, .page, html {
                background: white !important;
              }
              
              /* Override Tailwind utility classes */
              .border, .border-0, .border-1, .border-2, .border-4,
              .border-gray-100, .border-gray-200, .border-gray-300,
              .rounded, .rounded-md, .rounded-lg, .rounded-xl,
              .shadow, .shadow-sm, .shadow-md, .shadow-lg,
              .bg-gray-50, .bg-gray-100, .bg-white {
                border: none !important;
                border-top: none !important;
                border-right: none !important;
                border-bottom: none !important;
                border-left: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                background: transparent !important;
                background-color: transparent !important;
              }
              
              /* Input fields - make them look like plain text */
              input, textarea, select {
                border: none !important;
                border-top: none !important;
                border-right: none !important;
                border-bottom: none !important;
                border-left: none !important;
                background: transparent !important;
                background-color: transparent !important;
                box-shadow: none !important;
                outline: none !important;
                padding: 0 !important;
                margin: 0 !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                appearance: none !important;
                -webkit-appearance: none !important;
                display: inline !important;
                width: auto !important;
                height: auto !important;
                min-height: auto !important;
              }
              
              /* Remove spacing between Marks label and number */
              .print\\:!gap-0 > * {
                margin-left: 0 !important;
                margin-right: 0 !important;
              }
              
              .print\\:mr-0 {
                margin-right: 0 !important;
              }
              
              .print\\:!ml-0 {
                margin-left: 0 !important;
              }
              
              /* Remove all container styling */
              div, section, article, form, main {
                border: none !important;
                border-top: none !important;
                border-right: none !important;
                border-bottom: none !important;
                border-left: none !important;
                box-shadow: none !important;
                background: transparent !important;
                background-color: transparent !important;
              }
              
              /* Keep only essential spacing - but remove padding from containers */
              .page > div {
                padding: 0 !important;
                margin: 0 !important;
              }
              
              /* Rich text editor - make it look like plain text */
              .rich-text-editor,
              [class*="rich-text"],
              [class*="richtext"],
              .richtext-editor {
                border: none !important;
                background: transparent !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                outline: none !important;
              }
              
              .rich-text-editor *,
              [class*="rich-text"] *,
              [class*="richtext"] *,
              .richtext-editor *,
              [contenteditable="true"],
              [contenteditable="false"] {
                border: none !important;
                background: transparent !important;
                outline: none !important;
                box-shadow: none !important;
              }
              
              /* ContentEditable divs should display as plain text */
              div[contenteditable="true"],
              div[contenteditable="false"] {
                border: none !important;
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                outline: none !important;
                min-height: auto !important;
              }
              
              /* Page breaks */
              .page-break-before {
                page-break-before: always !important;
                break-before: page !important;
              }
              
              .page-break-after {
                page-break-after: always !important;
                break-after: page !important;
              }
              
              .avoid-page-break {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              
              /* Force Question 3 to start on new page */
              .print-page-break-before {
                page-break-before: always !important;
                break-before: page !important;
              }
              
              /* Ensure tight spacing for Marks */
              .print\\:!gap-0 {
                gap: 0 !important;
              }
              
              /* Remove ALL spacing between Marks label and number */
              /* Target the flex container - force zero gap */
              .print\\:!gap-1,
              .print\\:!space-x-0 {
                gap: 0 !important;
                column-gap: 0 !important;
                row-gap: 0 !important;
              }
              
              /* Remove spacing from Marks label container */
              span.print\\:whitespace-nowrap {
                margin-right: 0 !important;
                padding-right: 0 !important;
              }
              
              /* Force zero spacing for input inside Marks span */
              span.print\\:whitespace-nowrap > input {
                margin-left: 0 !important;
                padding-left: 0 !important;
                letter-spacing: 0 !important;
                display: inline !important;
              }
              
              /* Ensure printed-value spans have no spacing */
              .printed-value {
                margin-left: 0 !important;
                margin-right: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                letter-spacing: 0 !important;
              }
              
              /* Remove any text node whitespace between Marks: and number */
              span.print\\:whitespace-nowrap .printed-value {
                margin-left: 0 !important;
                padding-left: 0 !important;
              }
              
              /* Remove all spacing from flex children in question header */
              .print\\:items-baseline > * {
                margin-left: 0 !important;
                margin-right: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
              }
              
              /* Remove whitespace from text nodes inside Marks span */
              span.print\\:whitespace-nowrap {
                white-space: nowrap !important;
              }
              
              /* Typography */
              h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
                page-break-inside: avoid;
              }
              
              /* Questions should stay together */
              [class*="question"],
              [class*="Question"] {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              
              /* Images - logo sizing */
              img {
                max-width: 100% !important;
                height: auto !important;
                page-break-inside: avoid;
              }
              
              /* Specifically size logo smaller in print */
              img[alt="CUST Logo"],
              img[src*="cust-logo"],
              img[src*="logo"] {
                width: 40px !important;
                height: 40px !important;
                max-width: 40px !important;
                max-height: 40px !important;
              }
              
              /* Tables */
              table {
                page-break-inside: avoid;
              }
              
              tr {
                page-break-inside: avoid;
              }
            }
          `}</style>
          {/* Header with Logo */}
          <div className="text-center mb-6 print:mb-2 print:avoid-page-break">
            <div className="flex justify-center mb-2 print:mb-1">
              <img src="/cust-logo.png" alt="CUST Logo" className="w-20 h-20 print:w-10 print:h-10" />
            </div>
            <h1 className="text-xl font-bold text-gray-800 mb-1 print:text-sm print:mb-0.5 print:font-semibold">Capital University of Science and Technology</h1>
            <h2 className="text-base font-semibold text-gray-700 mb-0.5 print:text-xs print:mb-0.5 print:font-medium">Department of Software Engineering</h2>
            <div className="text-base font-semibold text-gray-700 mb-1 print:text-xs print:mb-0.5 print:font-medium">{/* courseCode */} - {courseTitle}</div>
            <div className="text-sm font-bold text-gray-800 print:text-xs print:mt-0.5 print:font-semibold">{assignmentName}</div>
          </div>

          <hr className="border-gray-300 my-4 print-hide-hr print:my-2" />

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm print:mb-3 print:avoid-page-break print:text-xs print:gap-2">
            <div className="flex print:flex-row print:gap-1">
              <span className="font-semibold text-gray-700 w-32 print:w-auto print:inline">Semester:</span>
              <input
                type="text"
                value={paperData.semester}
                onChange={(e) => setPaperData({ ...paperData, semester: e.target.value })}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 print:!border-0 print:!border-b-0 print:inline print:!p-0 print:!bg-transparent"
              />
            </div>
            <div className="flex print:flex-row print:gap-1 print:justify-end">
              <span className="font-semibold text-gray-700 w-32 print:w-auto print:inline">Max Marks:</span>
              <input
                type="number"
                min="0"
                value={paperData.maxMarks}
                onChange={(e) => setPaperData({ ...paperData, maxMarks: e.target.value })}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 print:!border-0 print:!border-b-0 print:inline print:!p-0 print:!bg-transparent"
              />
            </div>
            <div className="flex print:flex-row print:gap-1">
              <span className="font-semibold text-gray-700 w-32 print:w-auto print:inline">Instructor:</span>
              <input
                type="text"
                value={paperData.instructor}
                onChange={(e) => setPaperData({ ...paperData, instructor: e.target.value })}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 print:!border-0 print:!border-b-0 print:inline print:!p-0 print:!bg-transparent"
              />
            </div>

            <div className="flex print:flex-row print:gap-1 print:justify-end">
              <span className="font-semibold text-gray-700 w-32 print:w-auto print:inline">Due Date:</span>
              <input
                type="text"
                value={paperData.date}
                onChange={(e) => setPaperData({ ...paperData, date: e.target.value })}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 print:!border-0 print:!border-b-0 print:inline print:!p-0 print:!bg-transparent"
              />
            </div>
          </div>

          <hr className="border-gray-300 my-6 print-hide-hr print:my-0" />

          {/* Instructions */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded print:!border-0 print:!bg-transparent print:!p-0 print:mb-3 print:avoid-page-break">
            <p className="text-sm font-semibold text-gray-800 mb-2 print:mb-1 print:text-xs print:font-medium print:inline print:mr-2">Instructions:</p>
            <RichTextEditor
              value={paperData.instructions || ''}
              onChange={(html) => setPaperData({ ...paperData, instructions: html })}
              placeholder="Enter instructions here..."
              readOnly={readOnly}
              className="w-full text-sm text-gray-700 bg-transparent focus:outline-none resize-none print-no-border print:text-xs print:inline print:p-0"
            />
          </div>

          {/* Questions */}
          <div className="space-y-6 print:space-y-3">
            {paperData.questions.map((question, index) => {
              // Question 3 (index 2) should start on a new page
              const isQuestion3 = index === 2;
              return (
              <div 
                key={question.id} 
                className={`border border-gray-200 rounded-md p-4 bg-gray-50 print:!border-0 print:!bg-transparent print:!p-0 print:mb-3 print:avoid-page-break ${isQuestion3 ? 'print-page-break-before' : ''}`}
                style={isQuestion3 ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}
              >
                <div className="flex justify-between items-start mb-3 print:mb-1.5 print:flex-row print:gap-2">
                  <div className="flex items-center gap-3 flex-1 print:gap-1 print:flex-row print:items-baseline print:!gap-1 print:!space-x-0">
                    <span className="font-semibold text-gray-800 print:text-sm print:font-medium print:inline">Question {index + 1}:</span>
                    <span className="text-sm font-medium text-gray-700 print:text-xs print:inline print:!mr-0 print:!pr-0 print:whitespace-nowrap" style={{ marginRight: 0, paddingRight: 0 }}>
                      Marks:
                      <input
                        type="number"
                        min="0"
                        value={question.marks}
                        onChange={(e) => handleUpdateQuestion(question.id, 'marks', e.target.value)}
                        disabled={readOnly}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed print:!border-0 print:!p-0 print:!w-auto print:text-xs print:!bg-transparent print:inline print:!ml-0 print:!pl-0"
                        style={{ marginLeft: 0, paddingLeft: 0 }}
                      />
                    </span>
                  </div>
                  {paperData.questions.length > 1 && !readOnly && (
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="text-red-600 hover:text-red-700 text-sm no-print"
                      style={{ display: 'none' }}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-indigo-500 text-gray-700 print:!border-0 print:!p-0 print:text-sm print:!bg-transparent"
                />
              </div>
              );
            })}

            {!readOnly && (
              <button
                onClick={handleAddQuestion}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors no-print"
              >
                + Add Question
              </button>
            )}
          </div>

          <div className="mt-6 flex justify-center gap-3 no-print">
            <button
              onClick={handleSave}
              disabled={saving || readOnly}
              className="px-6 py-2 bg-red-700 text-white rounded-full hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {readOnly ? 'Read-only' : saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={doPrint}
              disabled={!isSaved}
              className="px-6 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-700 disabled:bg-gray-300"
            >
              Print
            </button>
            <button
              onClick={async () => {
                // Auto-save before navigating
                if (!readOnly) {
                  await triggerSave();
                }
                navigate(`${basePath}/folder/${idForNav}/assignments/${assignmentId}/model-solution${isReviewContext ? '?review=1' : ''}`);
              }}
              className="px-6 py-2 bg-indigo-900 text-white rounded-full hover:bg-indigo-800"
            >
              Next: Model Solution
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center max-w-4xl mx-auto no-print">
          <button
            onClick={async () => {
              // Auto-save before navigating back
              if (!readOnly) {
                await triggerSave();
              }
              navigate(`${basePath}/folder/${idForNav}/assignments/task${isReviewContext ? '?review=1' : ''}`);
            }}
            className="px-6 py-2.5 rounded-full bg-coral text-white hover:bg-coral/90"
          >
            Back to Assignments
          </button>
        </div>

        <div className="no-print">
          {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && <CoordinatorFeedbackBox folderId={id!} section={`ASSIGNMENT_${assignmentId}_QUESTION_PAPER`} />}

          {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && <AuditMemberFeedbackBox folderId={id!} section={`${assignmentName} - Question Paper`} />}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FolderAssignmentQuestionPaper;

