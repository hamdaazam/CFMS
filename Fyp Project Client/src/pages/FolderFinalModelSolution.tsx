import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI, folderComponentsAPI } from '../services/api';
import { useReviewMode } from '../hooks/useReviewMode';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import RichTextEditor from '../components/common/RichTextEditor';
import { canEditFolder } from '../utils/folderPermissions';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

interface Answer {
  id: string;
  answerText: string;
  marks: string;
  questionText: string;
  clo: string;
}

interface FinalSolution {
  semester: string;
  instructor: string;
  date: string;
  maxMarks: string;
  clo: string;
  answers: Answer[];
}

const FolderFinalModelSolution: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const [solutionData, setSolutionData] = useState<FinalSolution>({
    semester: '',
    instructor: 'Ms. Anum Naseem',
    date: new Date().toLocaleDateString('en-GB'),
    maxMarks: '100',
    clo: '1',
    answers: [
      { id: '1', answerText: '', marks: '', questionText: '', clo: '1' }
    ]
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

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
        // Load questions from the saved final question paper
        const finalPaper = res.data.outline_content?.finalPaper;
        const questionsFromPaper = (finalPaper?.questions || []).filter((q: any) => q && q.id);
        
        console.log('DEBUG: Final Paper:', finalPaper);
        console.log('DEBUG: Questions from paper:', questionsFromPaper);
        console.log('DEBUG: Questions count:', questionsFromPaper.length);

        const finalSolution = res.data.outline_content?.finalSolution;
        console.log('DEBUG: Final Solution:', finalSolution);
        
        if (finalSolution) {
          const saved = finalSolution;
          // If questions exist in question paper, sync them with answers
          let answers = saved.answers || [];
          
          if (questionsFromPaper.length > 0) {
            // Sync answers with questions from paper (match by ID, handle string/number mismatch)
            answers = questionsFromPaper.map((q: any) => {
              const existingAnswer = saved.answers?.find((a: any) => 
                String(a.id) === String(q.id) || a.id === q.id
              );
              if (existingAnswer) {
                // Preserve existing answer but update question text and marks if they changed in paper
                return {
                  ...existingAnswer,
                  questionText: q.questionText || existingAnswer.questionText || '',
                  marks: q.marks || existingAnswer.marks || '',
                  clo: q.clo || existingAnswer.clo || '1'
                };
              } else {
                // New question from paper - create empty answer
                return {
                  id: q.id,
                  questionText: q.questionText || '',
                  answerText: '',
                  marks: q.marks || '',
                  clo: q.clo || '1'
                };
              }
            });
          }
          
          console.log('DEBUG: Synced answers:', answers);
          
          setSolutionData({
            ...saved,
            answers,
            semester: saved.semester || res.data.semester || '',
            date: saved.date || res.data.date || new Date().toLocaleDateString('en-GB'),
            instructor: saved.instructor || res.data.instructor_name || 'Ms. Anum Naseem',
            maxMarks: saved.maxMarks || '100'
          });
        } else {
          // Initialize with questions from question paper if available
          const initialAnswers = questionsFromPaper.length > 0
            ? questionsFromPaper.map((q: any) => ({
                id: q.id,
                questionText: q.questionText || '',
                answerText: '',
                marks: q.marks || '',
                clo: q.clo || '1'
              }))
            : [{ id: '1', answerText: '', marks: '', questionText: '', clo: '1' }];
          
          console.log('DEBUG: Initial answers (no saved solution):', initialAnswers);
          
          setSolutionData(prev => ({
            ...prev,
            answers: initialAnswers,
            instructor: res.data.instructor_name || prev.instructor,
            semester: res.data.semester || prev.semester,
            date: res.data.date || prev.date || new Date().toLocaleDateString('en-GB')
          }));
        }
        const pdfUrl = res.data.outline_content?.finalSolution?.model_solution_pdf || null;
        setFileUrl(pdfUrl || null);
      })
      .catch(() => {
        if (mounted) setData(null);
      });
    return () => { mounted = false; };
  }, [id]);

  const handleAddAnswer = () => {
    if (readOnly) return;
    const newAnswer: Answer = {
      id: Date.now().toString(),
      answerText: '',
      marks: '',
      questionText: '',
      clo: '1'
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
    setSaving(true);
    try {
      const existingContent = data?.outline_content || {};
      let updatedPdfUrl = fileUrl;
      
      // Upload PDF file if one was selected
      if (file) {
        const formData = new FormData();
        formData.append('folder', String(id));
        formData.append('component_type', 'MODEL_SOLUTION');
        formData.append('title', 'Final Model Solution');
        formData.append('file', file);
        const resComp = await folderComponentsAPI.create(formData);
        updatedPdfUrl = resComp.data.file || resComp.data?.url || updatedPdfUrl;
        setFileUrl(updatedPdfUrl);
      }

      // Prepare solution data to save (include PDF URL if available)
      const solutionToSave = {
        ...solutionData,
        ...(updatedPdfUrl && { model_solution_pdf: updatedPdfUrl })
      };

      // Save the solution data
      await courseFoldersAPI.saveOutline(id, {
        outline_content: {
          ...existingContent,
          finalSolution: solutionToSave
        }
      });

      // Refresh data from server to ensure it's up to date
      const updatedResponse = await courseFoldersAPI.getBasic(id);
      if (!updatedResponse?.data) {
        throw new Error('Failed to refresh data after save');
      }
      
      setData(updatedResponse.data);
      
      // Reload solution data from the saved response, preserving questions from paper
      const savedFinalSolution = updatedResponse.data.outline_content?.finalSolution;
      const finalPaper = updatedResponse.data.outline_content?.finalPaper;
      const questionsFromPaper = (finalPaper?.questions || []).filter((q: any) => q && q.id);
      
      console.log('DEBUG: After save - Final Paper:', finalPaper);
      console.log('DEBUG: After save - Questions from paper:', questionsFromPaper);
      console.log('DEBUG: After save - Saved Solution:', savedFinalSolution);
      
      if (savedFinalSolution) {
        // Sync answers with questions from paper if available
        let answers = savedFinalSolution.answers || [];
        if (questionsFromPaper.length > 0) {
          answers = questionsFromPaper.map((q: any) => {
            const existingAnswer = savedFinalSolution.answers?.find((a: any) => 
              String(a.id) === String(q.id) || a.id === q.id
            );
            if (existingAnswer) {
              // Preserve existing answer but update question text and marks if they changed
              return {
                ...existingAnswer,
                questionText: q.questionText || existingAnswer.questionText || '',
                marks: q.marks || existingAnswer.marks || '',
                clo: q.clo || existingAnswer.clo || '1'
              };
            } else {
              return {
                id: q.id,
                questionText: q.questionText || '',
                answerText: '',
                marks: q.marks || '',
                clo: q.clo || '1'
              };
            }
          });
        }
        
        console.log('DEBUG: After save - Synced answers:', answers);
        
        setSolutionData({
          ...savedFinalSolution,
          answers,
          semester: savedFinalSolution.semester || updatedResponse.data.semester || '',
          date: savedFinalSolution.date || updatedResponse.data.date || new Date().toLocaleDateString('en-GB'),
          instructor: savedFinalSolution.instructor || updatedResponse.data.instructor_name || 'Ms. Anum Naseem',
          maxMarks: savedFinalSolution.maxMarks || '100'
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

        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4">Final Model Solution</h2>

        <div className="bg-white border border-gray-300 rounded-md shadow-sm p-6 md:p-8 max-w-4xl mx-auto">
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
            <div className="text-base font-bold text-gray-800 mb-1">Solution</div>
            <div className="text-base font-semibold text-gray-700 mb-1">
              {courseCode} - {courseTitle}
            </div>
            <div className="text-sm font-normal text-gray-700">Final Exam</div>
          </div>

          <hr className="border-gray-300 my-4" />

          {/* Info Section */}
          <div className="space-y-2 mb-6 text-sm">
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Semester:</span>
              <input
                type="text"
                value={solutionData.semester}
                onChange={(e) => setSolutionData({ ...solutionData, semester: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:text-gray-400"
              />
              <span className="font-semibold text-gray-700 w-32 ml-8">Max Marks:</span>
              <input
                type="number"
                min="0"
                value={solutionData.maxMarks}
                onChange={(e) => setSolutionData({ ...solutionData, maxMarks: e.target.value })}
                disabled={readOnly}
                className="w-20 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Date:</span>
              <input
                type="text"
                value={solutionData.date}
                onChange={(e) => setSolutionData({ ...solutionData, date: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-700 w-32">Instructor:</span>
              <input
                type="text"
                value={solutionData.instructor}
                onChange={(e) => setSolutionData({ ...solutionData, instructor: e.target.value })}
                disabled={readOnly}
                className="flex-1 border-b border-gray-300 focus:outline-none focus:border-indigo-500 px-1 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
          </div>

          <hr className="border-gray-300 my-6" />
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
              <div key={answer.id} className="mb-6">
                <div className="flex justify-between items-start mb-2">
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
                        className="w-20 px-2 py-1 border-b border-gray-300 text-sm focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </div>
                  </div>
                  {solutionData.answers.length > 1 && (
                    <button
                      onClick={() => handleDeleteAnswer(answer.id)}
                      disabled={readOnly}
                      className="text-red-600 hover:text-red-700 text-sm disabled:text-gray-400"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-600 mb-1">Question (from Question Paper)</p>
                  <RichTextEditor
                    value={answer.questionText || ''}
                    onChange={(html) => handleUpdateAnswer(answer.id, 'questionText', html)}
                    placeholder="Question will appear here from the saved question paper"
                    readOnly={true}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-medium text-gray-700 mb-3"
                  />
                  <p className="text-sm font-semibold text-gray-800">Answer</p>
                </div>

                <RichTextEditor
                  value={answer.answerText || ''}
                  onChange={(html) => handleUpdateAnswer(answer.id, 'answerText', html)}
                  placeholder="Type or Paste your answer here"
                  readOnly={readOnly}
                  className="w-full px-0 py-2 border-0 focus:outline-none focus:ring-0 text-gray-700 text-sm"
                />
                <div className="border-b border-gray-200 mt-8"></div>
              </div>
            ))}

            <button
              onClick={handleAddAnswer}
              disabled={readOnly}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors disabled:text-gray-400 disabled:hover:border-gray-300"
            >
              + Add Answer
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
              onClick={() => navigate(`${basePath}/folder/${id}/final/records/best${isReviewContext ? '?review=1' : ''}`)}
              className="px-6 py-2 bg-indigo-900 text-white rounded-full hover:bg-indigo-800"
            >
              Next: Upload Best Record
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center max-w-4xl mx-auto">
          <button
            onClick={() => navigate(`${basePath}/folder/${id}/final/question-paper${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-coral text-white hover:bg-coral/90"
          >
            Previous
          </button>
        </div>

        {isCoordinatorReview && submittedStatuses.has((status || '').toUpperCase()) && isReviewContext && (
          <CoordinatorFeedbackBox folderId={id} section="FINAL_MODEL_SOLUTION" />
        )}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && (
          <AuditMemberFeedbackBox folderId={id} section="FINAL_MODEL_SOLUTION" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FolderFinalModelSolution;
