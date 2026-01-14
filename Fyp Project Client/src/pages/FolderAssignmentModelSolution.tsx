import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI, folderComponentsAPI } from '../services/api';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import RichTextEditor from '../components/common/RichTextEditor';
import { useReviewMode } from '../hooks/useReviewMode';
import { FolderContentsNav } from '../components/common/FolderContentsNav';
import { canEditFolder } from '../utils/folderPermissions';

interface Answer {
  id: string;
  questionText?: string;
  answerText: string;
  marks: string;
}

interface AssignmentSolution {
  semester: string;
  instructor: string;
  date: string;
  maxMarks: string;
  answers: Answer[];
}

const FolderAssignmentModelSolution: React.FC = () => {
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
  const [readOnly, setReadOnly] = useState(false);
  const [assignmentName, setAssignmentName] = useState<string>('Assignment');

  const [solutionData, setSolutionData] = useState<AssignmentSolution>({
    semester: '',
    instructor: 'Ms. Anum Naseem',
    date: new Date().toLocaleDateString('en-GB'),
    maxMarks: '10',
    answers: [
      { id: '1', questionText: '', answerText: '', marks: 'Enter' }
    ]
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const id = Number(folderId);
  const idForNav = isNaN(id) ? (data?.id ?? id) : id;

  useEffect(() => {
    let mounted = true;
    if (!id || !assignmentId) return;
    
    const loadData = async () => {
      try {
        const res = await courseFoldersAPI.getBasic(id);
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
        const currentAssignment = assignments.find((a: any) => 
          String(a.id) === String(assignmentId) || a.id === assignmentId
        );
        if (currentAssignment) {
          setAssignmentName(currentAssignment.name);
        }

        // Load questions from the saved question paper
        const assignmentPapers = res.data.outline_content?.assignmentPapers || {};
        
        // Try multiple key formats to find the question paper (handle string/number mismatch)
        let savedQuestionPaper = assignmentPapers[assignmentId];
        if (!savedQuestionPaper) {
          savedQuestionPaper = assignmentPapers[String(assignmentId)];
        }
        if (!savedQuestionPaper) {
          savedQuestionPaper = assignmentPapers[Number(assignmentId)];
        }
        if (!savedQuestionPaper && Object.keys(assignmentPapers).length > 0) {
          // If still not found, try to match by iterating through keys
          const paperKeys = Object.keys(assignmentPapers);
          for (const key of paperKeys) {
            if (String(key) === String(assignmentId) || Number(key) === Number(assignmentId)) {
              savedQuestionPaper = assignmentPapers[key];
              break;
            }
          }
        }
        
        // Get questions from paper - ensure they all have IDs
        let questionsFromPaper = (savedQuestionPaper?.questions || []).filter((q: any) => q);
        // If questions don't have IDs, assign them (shouldn't happen but handle gracefully)
        questionsFromPaper = questionsFromPaper.map((q: any, index: number) => ({
          ...q,
          id: q.id || String(Date.now() + index),
          questionText: q.questionText || q.question || '',
          marks: q.marks || q.marks || ''
        }));
        
        console.log('DEBUG Assignment Model Solution:');
        console.log('  Assignment ID:', assignmentId, typeof assignmentId);
        console.log('  Assignment Papers Keys:', Object.keys(assignmentPapers));
        console.log('  Saved Question Paper:', savedQuestionPaper);
        console.log('  Questions from paper:', questionsFromPaper);
        console.log('  Questions count:', questionsFromPaper.length);

        const assignmentSolutions = res.data.outline_content?.assignmentSolutions || {};
        
        // Try multiple key formats to find the solution (handle string/number mismatch)
        let savedSolution = assignmentSolutions[assignmentId!];
        if (!savedSolution) {
          savedSolution = assignmentSolutions[String(assignmentId!)];
        }
        if (!savedSolution) {
          savedSolution = assignmentSolutions[Number(assignmentId!)];
        }
        if (!savedSolution && Object.keys(assignmentSolutions).length > 0) {
          const solutionKeys = Object.keys(assignmentSolutions);
          for (const key of solutionKeys) {
            if (String(key) === String(assignmentId!) || Number(key) === Number(assignmentId!)) {
              savedSolution = assignmentSolutions[key];
              break;
            }
          }
        }
        
        console.log('DEBUG Assignment: Saved Solution:', savedSolution);
        
        // ALWAYS sync with questions from paper if they exist (even if no saved solution)
        if (questionsFromPaper.length > 0) {
          let answers: any[] = [];
          
          if (savedSolution && savedSolution.answers) {
            // If we have saved answers, merge them with questions from paper
            answers = questionsFromPaper.map((q: any) => {
              const existingAnswer = savedSolution.answers?.find((a: any) => 
                String(a.id) === String(q.id) || a.id === q.id
              );
              if (existingAnswer) {
                // Preserve existing answer but update question text and marks if they changed in paper
                return {
                  ...existingAnswer,
                  questionText: q.questionText || existingAnswer.questionText || '',
                  marks: q.marks || existingAnswer.marks || ''
                };
              } else {
                // New question from paper - create empty answer
                return {
                  id: q.id,
                  questionText: q.questionText || '',
                  answerText: '',
                  marks: q.marks || ''
                };
              }
            });
          } else {
            // No saved solution - create answers from questions
            answers = questionsFromPaper.map((q: any) => ({
              id: q.id,
              questionText: q.questionText || '',
              answerText: '',
              marks: q.marks || ''
            }));
          }
          
          console.log('DEBUG Assignment: Synced answers from questions:', answers);
          
          setSolutionData({
            ...(savedSolution || {}),
            answers,
            semester: savedSolution?.semester || res.data.semester || '',
            date: savedSolution?.date || res.data.date || new Date().toLocaleDateString('en-GB'),
            instructor: savedSolution?.instructor || res.data.instructor_name || 'Ms. Anum Naseem',
            maxMarks: savedSolution?.maxMarks || '10'
          });
        } else if (savedSolution) {
          // No questions from paper, but we have saved solution - use it
          setSolutionData({
            ...savedSolution,
            answers: savedSolution.answers || [],
            semester: savedSolution.semester || res.data.semester || '',
            date: savedSolution.date || res.data.date || new Date().toLocaleDateString('en-GB'),
            instructor: savedSolution.instructor || res.data.instructor_name || 'Ms. Anum Naseem',
            maxMarks: savedSolution.maxMarks || '10'
          });
        } else {
          // No questions and no saved solution - create empty answer
          setSolutionData(prev => ({
            ...prev,
            answers: [{ id: '1', questionText: '', answerText: '', marks: '' }],
            instructor: res.data.instructor_name || prev.instructor,
            semester: res.data.semester || prev.semester,
            date: res.data.date || prev.date || new Date().toLocaleDateString('en-GB')
          }));
        }
        // Try to load any associated model solution PDF URL
        const pdfUrl = savedSolution?.model_solution_pdf || assignmentSolutions[assignmentId!]?.model_solution_pdf || res.data.outline_content?.assignmentSolutions?.[assignmentId!]?.model_solution_pdf || null;
        setFileUrl(pdfUrl || null);
      } catch (error) {
        console.error('Error loading assignment model solution:', error);
        if (mounted) setData(null);
      }
    };
    
    loadData();
    return () => { mounted = false; };
  }, [id, assignmentId, isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview]);

  const handleAddAnswer = () => {
    if (readOnly) return;
    const newAnswer: Answer = {
      id: Date.now().toString(),
      answerText: '',
      marks: ''
    };
    setSolutionData({ ...solutionData, answers: [...solutionData.answers, newAnswer] });
  };

  const handleUpdateAnswer = (answerId: string, field: keyof Answer, value: string) => {
    if (readOnly) return;
    setSolutionData({
      ...solutionData,
      answers: solutionData.answers.map(a =>
        a.id === answerId ? { ...a, [field]: value } : a
      )
    });
  };

  const handleDeleteAnswer = (answerId: string) => {
    if (readOnly) return;
    if (solutionData.answers.length <= 1) {
      alert('At least one answer is required');
      return;
    }
    setSolutionData({
      ...solutionData,
      answers: solutionData.answers.filter(a => a.id !== answerId)
    });
  };

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      const existingContent = data?.outline_content || {};
      let updatedPdfUrl = fileUrl;
      
      // Upload PDF file if one was selected
      if (file) {
        const formData = new FormData();
        formData.append('folder', String(id));
        formData.append('component_type', 'MODEL_SOLUTION');
        formData.append('title', `Assignment ${assignmentId} Model Solution`);
        formData.append('file', file);
        const resComp = await folderComponentsAPI.create(formData);
        updatedPdfUrl = resComp.data.file || resComp.data?.url || updatedPdfUrl;
        setFileUrl(updatedPdfUrl);
      }
      
      const existingAssignmentSolutions = existingContent.assignmentSolutions || {};

      // Prepare solution data to save (include PDF URL if available)
      const solutionToSave = {
        ...solutionData,
        ...(updatedPdfUrl && { model_solution_pdf: updatedPdfUrl })
      };

      // Save the solution data (single save operation)
      await courseFoldersAPI.saveOutline(id, {
        outline_content: {
          ...existingContent,
          assignmentSolutions: {
            ...existingAssignmentSolutions,
            [assignmentId!]: solutionToSave
          }
        }
      });

      // Refresh data from server to ensure it's up to date
      const updatedResponse = await courseFoldersAPI.getBasic(id);
      if (!updatedResponse?.data) {
        throw new Error('Failed to refresh data after save');
      }
      
      setData(updatedResponse.data);
      
      // Reload solution data from the saved response, preserving questions from paper
      const assignmentSolutions = updatedResponse.data.outline_content?.assignmentSolutions || {};
      const assignmentPapers = updatedResponse.data.outline_content?.assignmentPapers || {};
      
      // Try multiple key formats to find the solution and paper (handle string/number mismatch)
      let savedSolution = assignmentSolutions[assignmentId!];
      let savedQuestionPaper = assignmentPapers[assignmentId!];
      
      if (!savedSolution) {
        savedSolution = assignmentSolutions[String(assignmentId!)] || assignmentSolutions[Number(assignmentId!)];
      }
      if (!savedQuestionPaper) {
        savedQuestionPaper = assignmentPapers[String(assignmentId!)] || assignmentPapers[Number(assignmentId!)];
      }
      
      // If still not found, try to match by iterating through keys
      if (!savedSolution && Object.keys(assignmentSolutions).length > 0) {
        const solutionKeys = Object.keys(assignmentSolutions);
        for (const key of solutionKeys) {
          if (String(key) === String(assignmentId!) || Number(key) === Number(assignmentId!)) {
            savedSolution = assignmentSolutions[key];
            break;
          }
        }
      }
      if (!savedQuestionPaper && Object.keys(assignmentPapers).length > 0) {
        const paperKeys = Object.keys(assignmentPapers);
        for (const key of paperKeys) {
          if (String(key) === String(assignmentId!) || Number(key) === Number(assignmentId!)) {
            savedQuestionPaper = assignmentPapers[key];
            break;
          }
        }
      }
      
      const questionsFromPaper = (savedQuestionPaper?.questions || []).filter((q: any) => q && q.id);
      
      console.log('DEBUG Assignment: After save - Saved Solution:', savedSolution);
      console.log('DEBUG Assignment: After save - Questions from paper:', questionsFromPaper);
      
      // ALWAYS sync with questions from paper if they exist (preserve saved answers)
      if (questionsFromPaper.length > 0) {
        let answers: any[] = [];
        
        if (savedSolution && savedSolution.answers) {
          // Merge saved answers with questions from paper
          answers = questionsFromPaper.map((q: any) => {
            const existingAnswer = savedSolution.answers?.find((a: any) => 
              String(a.id) === String(q.id) || a.id === q.id
            );
            if (existingAnswer) {
              // Preserve existing answer (including answerText) but update question text and marks
              return {
                ...existingAnswer,
                questionText: q.questionText || existingAnswer.questionText || '',
                marks: q.marks || existingAnswer.marks || ''
              };
            } else {
              // New question from paper - create empty answer
              return {
                id: q.id,
                questionText: q.questionText || '',
                answerText: '',
                marks: q.marks || ''
              };
            }
          });
        } else {
          // No saved solution - create answers from questions
          answers = questionsFromPaper.map((q: any) => ({
            id: q.id,
            questionText: q.questionText || '',
            answerText: '',
            marks: q.marks || ''
          }));
        }
        
        console.log('DEBUG Assignment: After save - Synced answers:', answers);
        
        setSolutionData({
          ...(savedSolution || {}),
          answers,
          semester: savedSolution?.semester || updatedResponse.data.semester || '',
          date: savedSolution?.date || updatedResponse.data.date || new Date().toLocaleDateString('en-GB'),
          instructor: savedSolution?.instructor || updatedResponse.data.instructor_name || 'Ms. Anum Naseem',
          maxMarks: savedSolution?.maxMarks || '10'
        });
      } else if (savedSolution) {
        // No questions from paper, but we have saved solution - use it
        setSolutionData({
          ...savedSolution,
          answers: savedSolution.answers || [],
          semester: savedSolution.semester || updatedResponse.data.semester || '',
          date: savedSolution.date || updatedResponse.data.date || new Date().toLocaleDateString('en-GB'),
          instructor: savedSolution.instructor || updatedResponse.data.instructor_name || 'Ms. Anum Naseem',
          maxMarks: savedSolution.maxMarks || '10'
        });
      }

      alert('Model solution saved successfully!');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const courseTitle = data?.course_title || 'Operating System';
  const courseCode = data?.course_code || 'SE3413';

  // Determine layout role based on review mode
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

        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4">Assignment Model Solution</h2>

        <div className="bg-white border border-gray-300 rounded-md shadow-sm p-6 md:p-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
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
            <div className="text-base font-bold text-gray-800">{assignmentName} - Solution</div>
          </div>

          <hr className="border-gray-300 my-4" />

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Semester:</span>
              <input
                type="text"
                value={solutionData.semester}
                onChange={(e) => setSolutionData({ ...solutionData, semester: e.target.value })}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Max Marks:</span>
              <input
                type="number"
                min="0"
                value={solutionData.maxMarks}
                onChange={(e) => setSolutionData({ ...solutionData, maxMarks: e.target.value })}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Instructor:</span>
              <input
                type="text"
                value={solutionData.instructor}
                onChange={(e) => setSolutionData({ ...solutionData, instructor: e.target.value })}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Date:</span>
              <input
                type="text"
                value={solutionData.date}
                onChange={(e) => setSolutionData({ ...solutionData, date: e.target.value })}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1"
              />
            </div>
          </div>

          <hr className="border-gray-300 my-6" />

          {/* Optional Model Solution PDF Upload */}
          <div className="mb-6">
            <div className="text-sm font-semibold text-gray-800 mb-2">Model Solution PDF (Optional)</div>
            {fileUrl && (
              <div className="mb-2">
                <a href={fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                  Download existing model solution PDF
                </a>
              </div>
            )}
            {!readOnly && (
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e?.target?.files ? e.target.files[0] : null)}
                />
                {file && <span className="text-sm text-gray-600">{file.name}</span>}
              </div>
            )}
          </div>

          {/* Answers */}
          <div className="space-y-6">
            {solutionData.answers.map((answer, index) => (
              <div key={answer.id} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-semibold text-gray-800">Question {index + 1}:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Marks:</span>
                      <input
                        type="number"
                        min="0"
                        value={answer.marks}
                        onChange={(e) => handleUpdateAnswer(answer.id, 'marks', e.target.value)}
                        disabled={readOnly}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  {solutionData.answers.length > 1 && !readOnly && (
                    <button
                      onClick={() => handleDeleteAnswer(answer.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="mb-2 font-medium text-gray-700">Question (from Question Paper)</div>
                <RichTextEditor
                  value={answer.questionText || ''}
                  onChange={(html) => handleUpdateAnswer(answer.id, 'questionText', html)}
                  placeholder="Question will appear here from the saved question paper"
                  readOnly={true}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 mb-3"
                />
                <div className="mb-2 font-medium text-gray-700">Answer</div>
                <RichTextEditor
                  value={answer.answerText || ''}
                  onChange={(html) => handleUpdateAnswer(answer.id, 'answerText', html)}
                  placeholder="Paste OR write ANSWER here"
                  readOnly={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-indigo-500 text-gray-700"
                />
              </div>
            ))}

            {!readOnly && (
              <button
                onClick={handleAddAnswer}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors"
              >
                + Add Answer
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
              onClick={() => navigate(`${basePath}/folder/${idForNav}/assignments/${assignmentId}/records/best${isReviewContext ? '?review=1' : ''}`)}
              className="px-6 py-2 bg-indigo-900 text-white rounded-full hover:bg-indigo-800"
            >
              Next: Upload Best Record
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center max-w-4xl mx-auto">
          <button
            onClick={() => navigate(`${basePath}/folder/${id}/assignments/${assignmentId}/question-paper${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-coral text-white hover:bg-coral/90"
          >
            Previous
          </button>
        </div>

        {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && <CoordinatorFeedbackBox folderId={id!} section={`ASSIGNMENT_${assignmentId}_MODEL_SOLUTION`} />}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && <AuditMemberFeedbackBox folderId={id!} section={`${assignmentName} - Model Solution`} />}
      </div>
    </DashboardLayout>
  );
};

export default FolderAssignmentModelSolution;
