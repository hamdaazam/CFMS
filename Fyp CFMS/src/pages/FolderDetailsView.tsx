import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Modal } from '../components/common/Modal';
import {
  courseFoldersAPI,
  folderComponentsAPI,
  assessmentsAPI,
  courseLogsAPI,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Download,
  Edit,
  Send,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

interface FolderDetails {
  id: number;
  course_details: {
    code: string;
    title: string;
  };
  term_details: {
    session_term: string;
  };
  section: string;
  status: string;
  is_complete: boolean;
  submitted_at: string | null;
  created_at: string;
  department_details: { name: string };
  program_details: { title: string } | null;
  coordinator_notes?: string | null;
  coordinator_remarks?: string | null;
  coordinator_decision?: 'APPROVED' | 'DISAPPROVED' | null;
  coordinator_feedback?: Record<string, string> | null;
  coordinator_reviewed_at?: string | null;
  coordinator_reviewed_by_details?: { full_name?: string } | null;
  convener_notes?: string | null;
  hod_notes?: string | null;
}

interface Component {
  id: number;
  component_type: string;
  title: string;
  file: string;
  description?: string;
  file_size?: number;
  created_at: string;
  updated_at: string;
  order?: number;
  folder?: number;
}

interface Assessment {
  id: number;
  assessment_type: 'ASSIGNMENT' | 'QUIZ' | 'MIDTERM' | 'FINAL';
  number: number;
  title?: string;
  description?: string;
  max_marks?: number | string;
  weightage?: number | string;
  question_paper?: string | null;
  model_solution?: string | null;
  sample_scripts?: string | null;
  created_at?: string;
  updated_at?: string;
}

const resolveFileUrl = (filePath?: string | null) => {
  if (!filePath) {
    return '#';
  }

  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  if (filePath.startsWith('/')) {
    return `http://127.0.0.1:8000${filePath}`;
  }

  return `http://127.0.0.1:8000/media/${filePath}`;
};

interface CourseLog {
  id: number;
  lecture_number: number;
  date: string;
  duration: number;
  topics_covered: string;
  evaluation_instrument: string;
  attendance_sheet?: string | null;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
  RETURNED: 'bg-red-100 text-red-800',
  APPROVED_COORDINATOR: 'bg-blue-100 text-blue-800',
  UNDER_AUDIT: 'bg-purple-100 text-purple-800',
  AUDIT_COMPLETED: 'bg-indigo-100 text-indigo-800',
  SUBMITTED_HOD: 'bg-orange-100 text-orange-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  RETURNED: 'Returned for Revision',
  APPROVED_COORDINATOR: 'Approved by Coordinator',
  UNDER_AUDIT: 'Under Audit',
  AUDIT_COMPLETED: 'Audit Completed',
  SUBMITTED_HOD: 'Submitted to HOD',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const componentLabels: Record<string, string> = {
  TITLE_PAGE: 'Title Page',
  COURSE_OUTLINE: 'Course Outline',
  COURSE_LOG: 'Course Log',
  ATTENDANCE: 'Attendance Sheet',
  REFERENCE_BOOKS: 'Reference Books',
  FINAL_RESULT: 'Final Result',
  AUDIT_FEEDBACK: 'Audit Feedback',
  OTHER: 'Other',
};

const assessmentLabels: Record<string, string> = {
  ASSIGNMENT: 'Assignment',
  QUIZ: 'Quiz',
  MIDTERM: 'Midterm Exam',
  FINAL: 'Final Exam',
};

export const FolderDetailsView: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [folder, setFolder] = useState<FolderDetails | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courseLogs, setCourseLogs] = useState<CourseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [componentToEdit, setComponentToEdit] = useState<Component | null>(null);
  const [componentForm, setComponentForm] = useState({ title: '', description: '' });
  const [componentFile, setComponentFile] = useState<File | null>(null);
  const [assessmentToEdit, setAssessmentToEdit] = useState<Assessment | null>(null);
  const [assessmentForm, setAssessmentForm] = useState({
    title: '',
    number: '',
    description: '',
    max_marks: '',
    weightage: '',
  });
  const [assessmentFiles, setAssessmentFiles] = useState({
    question: null as File | null,
    solution: null as File | null,
    sample: null as File | null,
  });
  const [logToEdit, setLogToEdit] = useState<CourseLog | null>(null);
  const [logForm, setLogForm] = useState({
    lecture_number: '',
    date: '',
    duration: '',
    topics_covered: '',
    evaluation_instrument: '',
  });
  const [logAttendanceFile, setLogAttendanceFile] = useState<File | null>(null);
  // Coordinator review actions
  const isCoordinatorViewer = (user?.role === 'COORDINATOR');
  const [reviewNotes, setReviewNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [returning, setReturning] = useState(false);
  // Per-section feedback (Coordinator)
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (folderId) {
      fetchFolderDetails();
    }
  }, [folderId]);

  const fetchFolderDetails = async () => {
    try {
      setLoading(true);
      const folderRes = await courseFoldersAPI.getById(Number(folderId));
      const f = folderRes.data;
      setFolder(f);

      // Use nested relations from detail serializer to avoid extra network calls
      const comps = Array.isArray(f.components) ? f.components : [];
      const asses = Array.isArray(f.assessments) ? f.assessments : [];
      const logs = Array.isArray(f.log_entries) ? f.log_entries : [];
      setComponents(comps);
      setAssessments(asses);
      setCourseLogs(logs);

      setError(null);
    } catch (err: any) {
      console.error('Error fetching folder details:', err);
      setError(err.response?.data?.error || 'Failed to load folder details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!folderId) return;

    try {
      setSubmitting(true);
      await courseFoldersAPI.submit(Number(folderId));
      alert('Folder submitted successfully!');
      fetchFolderDetails(); // Refresh to show new status
    } catch (err: any) {
      const msg = err.response?.data?.details || err.response?.data?.error || 'Failed to submit folder';
      // Surface the backend message in the page UI instead of using a browser alert
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = () => {
    navigate(`/faculty/folders/${folderId}/edit`);
  };

  const handleDeleteComponent = async (componentId: number) => {
    if (!window.confirm('Are you sure you want to delete this component?')) return;
    
    try {
      await folderComponentsAPI.delete(componentId);
      alert('Component deleted successfully!');
      fetchFolderDetails(); // Refresh the list
    } catch (err: any) {
      console.error('Delete error:', err);
      const errorMsg = err.response?.data?.error 
        || err.response?.data?.detail 
        || err.message
        || 'Failed to delete component';
      alert(errorMsg);
    }
  };

  const openComponentEdit = (component: Component) => {
    setComponentToEdit(component);
    setComponentForm({
      title: component.title || '',
      description: component.description || '',
    });
    setComponentFile(null);
  };

  const closeComponentModal = () => {
    setComponentToEdit(null);
    setComponentForm({ title: '', description: '' });
    setComponentFile(null);
  };

  const handleComponentUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!componentToEdit || !folderId) return;

    try {
      const formData = new FormData();
      formData.append('folder', String(componentToEdit.folder ?? folderId));
      formData.append('component_type', componentToEdit.component_type);
      formData.append('title', componentForm.title.trim() || componentToEdit.title);
      formData.append('description', componentForm.description.trim());
      formData.append('order', String(componentToEdit.order ?? 0));

      if (componentFile) {
        formData.append('file', componentFile);
      }

      await folderComponentsAPI.update(componentToEdit.id, formData);
      alert('Component updated successfully!');
      closeComponentModal();
      fetchFolderDetails();
    } catch (err: any) {
      console.error('Update error:', err);
      alert(err.response?.data?.error || 'Failed to update component');
    }
  };

  const openAssessmentEdit = (assessment: Assessment) => {
    setAssessmentToEdit(assessment);
    setAssessmentForm({
      title: assessment.title || '',
      number: assessment.number ? String(assessment.number) : '',
      description: assessment.description || '',
      max_marks:
        assessment.max_marks !== undefined && assessment.max_marks !== null
          ? String(assessment.max_marks)
          : '',
      weightage:
        assessment.weightage !== undefined && assessment.weightage !== null
          ? String(assessment.weightage)
          : '',
    });
    setAssessmentFiles({ question: null, solution: null, sample: null });
  };

  const closeAssessmentModal = () => {
    setAssessmentToEdit(null);
    setAssessmentForm({
      title: '',
      number: '',
      description: '',
      max_marks: '',
      weightage: '',
    });
    setAssessmentFiles({ question: null, solution: null, sample: null });
  };

  const handleAssessmentUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assessmentToEdit) return;

    const numberValue = assessmentForm.number || (assessmentToEdit.number ? String(assessmentToEdit.number) : '');
    if (!numberValue) {
      alert('Assessment number is required');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('assessment_type', assessmentToEdit.assessment_type);
      formData.append('number', numberValue);

  formData.append('title', assessmentForm.title.trim());
  formData.append('description', assessmentForm.description.trim());

  const maxMarksValue = assessmentForm.max_marks.trim();
  if (maxMarksValue) formData.append('max_marks', maxMarksValue);

  const weightageValue = assessmentForm.weightage.trim();
  if (weightageValue) formData.append('weightage', weightageValue);

      if (assessmentFiles.question) {
        formData.append('question_paper', assessmentFiles.question);
      }
      if (assessmentFiles.solution) {
        formData.append('model_solution', assessmentFiles.solution);
      }
      if (assessmentFiles.sample) {
        formData.append('sample_scripts', assessmentFiles.sample);
      }

      await assessmentsAPI.partialUpdate(assessmentToEdit.id, formData);
      alert('Assessment updated successfully!');
      closeAssessmentModal();
      fetchFolderDetails();
    } catch (err: any) {
      console.error('Update assessment error:', err);
      alert(err.response?.data?.error || 'Failed to update assessment');
    }
  };

  const handleDeleteAssessment = async (assessmentId: number) => {
    if (!window.confirm('Are you sure you want to delete this assessment?')) return;

    try {
      await assessmentsAPI.delete(assessmentId);
      alert('Assessment deleted successfully!');
      fetchFolderDetails();
    } catch (err: any) {
      console.error('Delete assessment error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to delete assessment';
      alert(errorMsg);
    }
  };

  const openLogEdit = (log: CourseLog) => {
    setLogToEdit(log);
    setLogForm({
      lecture_number: log.lecture_number ? String(log.lecture_number) : '',
      date: log.date ? (log.date.includes('T') ? log.date.split('T')[0] : log.date) : '',
      duration: log.duration ? String(log.duration) : '',
      topics_covered: log.topics_covered || '',
      evaluation_instrument: log.evaluation_instrument || '',
    });
    setLogAttendanceFile(null);
  };

  const closeLogModal = () => {
    setLogToEdit(null);
    setLogForm({
      lecture_number: '',
      date: '',
      duration: '',
      topics_covered: '',
      evaluation_instrument: '',
    });
    setLogAttendanceFile(null);
  };

  const handleLogUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!logToEdit) return;

    const lectureNumberValue = logForm.lecture_number || String(logToEdit.lecture_number);
    const dateValue = logForm.date || (logToEdit.date ? (logToEdit.date.includes('T') ? logToEdit.date.split('T')[0] : logToEdit.date) : '');
    const durationValue = logForm.duration || String(logToEdit.duration);
    const topicsValue = logForm.topics_covered.trim() || logToEdit.topics_covered;

    if (!dateValue || !topicsValue) {
      alert('Date and topics covered are required');
      return;
    }

    try {
      const payload = {
        lecture_number: Number(lectureNumberValue),
        date: dateValue,
        duration: Number(durationValue),
        topics_covered: topicsValue,
        evaluation_instrument: logForm.evaluation_instrument.trim(),
      };

      await courseLogsAPI.partialUpdate(logToEdit.id, payload);

      if (logAttendanceFile) {
        const attendanceData = new FormData();
        attendanceData.append('attendance_sheet', logAttendanceFile);
        await courseLogsAPI.uploadAttendance(logToEdit.id, attendanceData);
      }

      alert('Course log updated successfully!');
      closeLogModal();
      fetchFolderDetails();
    } catch (err: any) {
      console.error('Update log error:', err);
      alert(err.response?.data?.error || 'Failed to update course log');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('Are you sure you want to delete this lecture entry?')) return;

    try {
      await courseLogsAPI.delete(logId);
      alert('Course log deleted successfully!');
      fetchFolderDetails();
    } catch (err: any) {
      console.error('Delete log error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to delete course log';
      alert(errorMsg);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const editableStatuses = [
    'DRAFT',
    'REJECTED_COORDINATOR',
    'REJECTED_BY_CONVENER',
    'REJECTED_BY_HOD',
  ];
  const isFacultyViewer = (user?.role === 'FACULTY');
  const canEdit = folder ? (isFacultyViewer && editableStatuses.includes(folder.status)) : false;
  const canSubmit = folder ? (isFacultyViewer && editableStatuses.includes(folder.status)) : false;
  const canCoordinatorAct = folder ? (isCoordinatorViewer && folder.status === 'SUBMITTED') : false;

  useEffect(() => {
    if (folder && isCoordinatorViewer) {
      const fb = (folder as any).coordinator_feedback || {};
      setFeedbackDrafts(fb);
    }
  }, [folder?.id]);

  const getFb = (key: string) => feedbackDrafts?.[key] || '';
  const setFb = (key: string, val: string) => setFeedbackDrafts((prev) => ({ ...prev, [key]: val }));
  const saveFb = async (key: string) => {
    if (!folderId) return;
    try {
      await courseFoldersAPI.saveCoordinatorFeedback(Number(folderId), { section: key, notes: feedbackDrafts[key] || '' });
      alert('Feedback saved');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save feedback');
    }
  };

  const groupAssessmentsByType = (type: string) => {
    if (!Array.isArray(assessments)) return [];
    return assessments
      .filter((a) => a.assessment_type === type)
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  };

  if (loading) {
    return (
      <DashboardLayout title="Folder Details">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !folder) {
    return (
      <DashboardLayout title="Folder Details">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error || 'Folder not found'}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Folder Details">
      <div className="space-y-6">
        {/* REJECTION FEEDBACK BANNER - Shows when folder is rejected */}
        {(folder.status === 'REJECTED_COORDINATOR' || 
          folder.status === 'REJECTED_BY_CONVENER' || 
          folder.status === 'REJECTED_BY_HOD') && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2">
                  ⚠️ Folder Rejected - Action Required
                </h3>
                <p className="text-sm text-red-800 mb-3">
                  This folder has been rejected and returned to you. Please review the feedback below, make the necessary corrections, and resubmit.
                </p>
                
                {/* Rejection Details */}
                <div className="bg-white rounded-lg p-4 border border-red-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-red-900">
                      {folder.status === 'REJECTED_COORDINATOR' && 'Coordinator Feedback'}
                      {folder.status === 'REJECTED_BY_CONVENER' && 'Convener Feedback'}
                      {folder.status === 'REJECTED_BY_HOD' && 'HOD Feedback'}
                    </h4>
                    {folder.coordinator_decision === 'DISAPPROVED' && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                        DISAPPROVED
                      </span>
                    )}
                  </div>
                  
                  {/* Main Rejection Remarks */}
                  <div className="bg-red-50 rounded p-3 mb-3">
                    <p className="text-sm font-medium text-red-900 mb-1">Overall Decision:</p>
                    <p className="text-sm text-red-800 whitespace-pre-line">
                      {folder.coordinator_remarks && folder.coordinator_remarks.trim() 
                        ? folder.coordinator_remarks
                        : folder.coordinator_notes && folder.coordinator_notes.trim()
                          ? folder.coordinator_notes
                          : folder.convener_notes && folder.convener_notes.trim()
                            ? folder.convener_notes
                            : folder.hod_notes && folder.hod_notes.trim()
                              ? folder.hod_notes
                              : 'No specific remarks provided.'}
                    </p>
                  </div>

                  {/* Section-Specific Feedback */}
                  {folder.coordinator_feedback && Object.keys(folder.coordinator_feedback).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-900 mb-2">Section-Specific Feedback:</p>
                      {Object.entries(folder.coordinator_feedback).map(([section, feedback]) => {
                        if (!feedback || (typeof feedback === 'string' && !feedback.trim())) return null;
                        return (
                          <div key={section} className="bg-gray-50 rounded p-3 border-l-2 border-red-400">
                            <p className="text-xs font-semibold text-gray-700 uppercase mb-1">
                              {section.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-gray-800 whitespace-pre-line">{String(feedback)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reviewer Info */}
                  {(folder.coordinator_reviewed_at || folder.coordinator_reviewed_by_details?.full_name) && (
                    <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-700">
                      Rejected by {folder.coordinator_reviewed_by_details?.full_name || 'Reviewer'} • {formatDate(folder.coordinator_reviewed_at || null)}
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="mt-4">
                  <button
                    onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Start Making Corrections
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">
                {folder.course_details.code} - {folder.course_details.title}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-blue-100 mt-4">
                <div>
                  <span className="block text-blue-200">Section</span>
                  <span className="font-medium text-white">{folder.section}</span>
                </div>
                <div>
                  <span className="block text-blue-200">Term</span>
                  <span className="font-medium text-white">{folder.term_details.session_term}</span>
                </div>
                <div>
                  <span className="block text-blue-200">Department</span>
                  <span className="font-medium text-white">{folder.department_details.name}</span>
                </div>
                <div>
                  <span className="block text-blue-200">Program</span>
                  <span className="font-medium text-white">{folder.program_details?.title || 'N/A'}</span>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <span className="block text-blue-200">Submitted</span>
                  <span className="font-medium text-white">{formatDate(folder.submitted_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4 ml-4">
              <img src="/cust-logo.png" alt="CUST" className="w-20 h-20 opacity-90 ml-4 flex-shrink-0" />
              <span
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                statusColors[folder.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {statusLabels[folder.status] || folder.status}
            </span>
          </div>

          {/* Action Buttons (Faculty only) */}
          {isFacultyViewer && (
            <div className="flex gap-3 mt-6">
              {canEdit && (
                <button
                  onClick={handleEdit}
                  className="bg-white text-blue-600 hover:bg-blue-50 font-medium py-2 px-6 rounded-lg transition-colors duration-200 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Folder
                </button>
              )}
              {canSubmit && folder.is_complete && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200 flex items-center disabled:bg-gray-400"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              )}
            </div>
          )}

          {/* Status Banner (Faculty only) */}
          {isFacultyViewer && (
            <div className="mt-4 flex items-center">
              {folder.status === 'SUBMITTED' ? (
                <div className="flex items-center text-blue-100">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <span className="font-medium">Folder submitted to Coordinator{folder.submitted_at ? ` on ${new Date(folder.submitted_at).toLocaleDateString()}` : ''}</span>
                </div>
              ) : folder.is_complete ? (
                <div className="flex items-center text-green-100">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <span className="font-medium">Folder is complete and ready to submit</span>
                </div>
              ) : (
                <div className="flex items-center text-yellow-100">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span className="font-medium">Folder is incomplete - upload all required components</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coordinator Review Summary (always visible to Coordinator; visible to others after review) */}
        {((user?.role === 'COORDINATOR') ||
          folder.status === 'REJECTED_COORDINATOR' ||
          folder.status === 'APPROVED_COORDINATOR') && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              Coordinator Review
              {folder.coordinator_decision && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  folder.coordinator_decision === 'APPROVED' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {folder.coordinator_decision === 'APPROVED' ? 'APPROVED' : 'DISAPPROVED'}
                </span>
              )}
            </h3>
            <div className="text-sm text-gray-700 whitespace-pre-line">
              {folder.coordinator_remarks && folder.coordinator_remarks.trim().length > 0
                ? folder.coordinator_remarks
                : folder.coordinator_notes && folder.coordinator_notes.trim().length > 0
                  ? folder.coordinator_notes
                  : (user?.role === 'COORDINATOR'
                      ? 'No remarks yet. Use the Review page to approve or return this folder.'
                      : 'No remarks provided.')}
            </div>
            {(folder.coordinator_reviewed_at || folder.coordinator_reviewed_by_details?.full_name) && (
              <div className="text-xs text-gray-500 mt-2">
                {folder.coordinator_reviewed_by_details?.full_name ? (
                  <>
                    Reviewed by {folder.coordinator_reviewed_by_details.full_name} • {formatDate(folder.coordinator_reviewed_at || null)}
                  </>
                ) : (
                  <>Reviewed • {formatDate(folder.coordinator_reviewed_at || null)}</>
                )}
              </div>
            )}
          </div>
        )}

        {/* Course Outline Feedback (Coordinator) */}
        {isCoordinatorViewer && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Feedback: Course Outline</h3>
            <textarea
              value={getFb('COURSE_OUTLINE')}
              onChange={(e) => setFb('COURSE_OUTLINE', e.target.value)}
              placeholder="Remarks about course outline (visible to faculty)"
              className="w-full border border-gray-300 rounded-md p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 text-right">
              <button onClick={() => saveFb('COURSE_OUTLINE')} className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700">Save Outline Feedback</button>
            </div>
          </div>
        )}

        {/* Inline Review Controls for Coordinator */}
        {canCoordinatorAct && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Give Review</h3>
            <p className="text-sm text-gray-600 mb-3">Add optional remarks, then approve or return with notes.</p>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Remarks for faculty (required when returning)"
              className="w-full border border-gray-300 rounded-md p-2 min-h-[90px] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                disabled={approving || returning}
                onClick={async () => {
                  if (!folderId) return;
                  try {
                    setApproving(true);
                    await courseFoldersAPI.coordinatorReview(Number(folderId), { action: 'approve', notes: reviewNotes });
                    alert('Folder approved.');
                    navigate('/coordinator/review');
                  } catch (err: any) {
                    alert(err.response?.data?.error || 'Failed to approve');
                  } finally {
                    setApproving(false);
                  }
                }}
                className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400"
              >
                {approving ? 'Approving…' : 'Approve'}
              </button>
              <button
                disabled={approving || returning}
                onClick={async () => {
                  if (!folderId) return;
                  if (!reviewNotes || reviewNotes.trim().length < 5) {
                    alert('Please write at least 5 characters explaining the required changes.');
                    return;
                  }
                  try {
                    setReturning(true);
                    await courseFoldersAPI.coordinatorReview(Number(folderId), { action: 'reject', notes: reviewNotes });
                    alert('Folder returned with notes.');
                    navigate('/coordinator/review');
                  } catch (err: any) {
                    alert(err.response?.data?.error || 'Failed to return');
                  } finally {
                    setReturning(false);
                  }
                }}
                className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-400"
              >
                {returning ? 'Returning…' : 'Return with Notes'}
              </button>
            </div>
          </div>
        )}

        {/* Components Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-blue-600" />
            Folder Components
          </h3>
          
          {!Array.isArray(components) || components.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No components uploaded yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {components.map((component) => (
                <div
                  key={component.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">
                        {componentLabels[component.component_type] || component.component_type}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">{component.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{formatFileSize(component.file_size)}</span>
                        <span>•</span>
                        <span>{formatDate(component.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openComponentEdit(component)}
                          className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded"
                          title="Replace file"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                      <a
                        href={resolveFileUrl(component.file)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-700 hover:text-slate-900 p-2 hover:bg-slate-100 rounded"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComponent(component.id)}
                          className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course Logs Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <BookOpen className="w-6 h-6 mr-2 text-blue-600" />
            Course Log Entries
          </h3>
          
          {!Array.isArray(courseLogs) || courseLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No course logs added yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Lecture #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Duration (min)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Topics Covered
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Evaluation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Attendance
                    </th>
                    {canEdit && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {courseLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {log.lecture_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{log.duration}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{log.topics_covered}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {log.evaluation_instrument || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {log.attendance_sheet ? (
                          <a
                            href={resolveFileUrl(log.attendance_sheet)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-500">Not uploaded</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openLogEdit(log)}
                              className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded"
                              title="Edit lecture"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLog(log.id)}
                              className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                              title="Delete lecture"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Course Log + Attendance Feedback (Coordinator) */}
        {isCoordinatorViewer && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Feedback: Course Log</h3>
            <textarea
              value={getFb('COURSE_LOG')}
              onChange={(e) => setFb('COURSE_LOG', e.target.value)}
              placeholder="Remarks about course logs (visible to faculty)"
              className="w-full border border-gray-300 rounded-md p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 text-right">
              <button onClick={() => saveFb('COURSE_LOG')} className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700">Save Log Feedback</button>
            </div>
            <h4 className="text-md font-semibold text-gray-800 mt-4 mb-2">Feedback: Attendance</h4>
            <textarea
              value={getFb('ATTENDANCE')}
              onChange={(e) => setFb('ATTENDANCE', e.target.value)}
              placeholder="Remarks about attendance (visible to faculty)"
              className="w-full border border-gray-300 rounded-md p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 text-right">
              <button onClick={() => saveFb('ATTENDANCE')} className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700">Save Attendance Feedback</button>
            </div>
          </div>
        )}

        {/* Assignments Section */}
        {groupAssessmentsByType('ASSIGNMENT').length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <FileCheck className="w-6 h-6 mr-2 text-blue-600" />
              Assignments ({groupAssessmentsByType('ASSIGNMENT').length}/4)
            </h3>
            
            <div className="space-y-4">
              {groupAssessmentsByType('ASSIGNMENT').map((assessment) => (
                <div
                  key={assessment.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">
                      Assignment {assessment.number ?? assessment.title ?? assessment.id}
                    </h4>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAssessmentEdit(assessment)}
                          className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded"
                          title="Edit assignment"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAssessment(assessment.id)}
                          className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                          title="Delete assignment"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <a
                      href={resolveFileUrl(assessment.question_paper)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-blue-700">Question Paper</span>
                      <Download className="w-4 h-4 text-blue-600" />
                    </a>
                    <a
                      href={resolveFileUrl(assessment.model_solution)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-green-700">Model Solution</span>
                      <Download className="w-4 h-4 text-green-600" />
                    </a>
                    <a
                      href={resolveFileUrl(assessment.sample_scripts)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-purple-700">Sample Scripts</span>
                      <Download className="w-4 h-4 text-purple-600" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isCoordinatorViewer && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Feedback: Assignments</h3>
            <textarea
              value={getFb('ASSIGNMENTS')}
              onChange={(e) => setFb('ASSIGNMENTS', e.target.value)}
              placeholder="Remarks about assignments (visible to faculty)"
              className="w-full border border-gray-300 rounded-md p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 text-right">
              <button onClick={() => saveFb('ASSIGNMENTS')} className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700">Save Assignments Feedback</button>
            </div>
          </div>
        )}

        {/* Quizzes Section */}
        {groupAssessmentsByType('QUIZ').length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <FileCheck className="w-6 h-6 mr-2 text-blue-600" />
              Quizzes ({groupAssessmentsByType('QUIZ').length}/4)
            </h3>
            
            <div className="space-y-4">
              {groupAssessmentsByType('QUIZ').map((assessment) => (
                <div
                  key={assessment.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">
                      Quiz {assessment.number ?? assessment.title ?? assessment.id}
                    </h4>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAssessmentEdit(assessment)}
                          className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded"
                          title="Edit quiz"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAssessment(assessment.id)}
                          className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                          title="Delete quiz"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <a
                      href={resolveFileUrl(assessment.question_paper)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-blue-700">Question Paper</span>
                      <Download className="w-4 h-4 text-blue-600" />
                    </a>
                    <a
                      href={resolveFileUrl(assessment.model_solution)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-green-700">Model Solution</span>
                      <Download className="w-4 h-4 text-green-600" />
                    </a>
                    <a
                      href={resolveFileUrl(assessment.sample_scripts)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-purple-700">Sample Scripts</span>
                      <Download className="w-4 h-4 text-purple-600" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isCoordinatorViewer && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Feedback: Quizzes</h3>
            <textarea
              value={getFb('QUIZZES')}
              onChange={(e) => setFb('QUIZZES', e.target.value)}
              placeholder="Remarks about quizzes (visible to faculty)"
              className="w-full border border-gray-300 rounded-md p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 text-right">
              <button onClick={() => saveFb('QUIZZES')} className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700">Save Quizzes Feedback</button>
            </div>
          </div>
        )}

        {/* Midterm Section */}
        {groupAssessmentsByType('MIDTERM').length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <FileCheck className="w-6 h-6 mr-2 text-blue-600" />
              Midterm Examination
            </h3>
            
            {groupAssessmentsByType('MIDTERM').map((assessment) => (
              <div key={assessment.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-800">
                    Midterm Exam {assessment.number ?? assessment.title ?? assessment.id}
                  </h4>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAssessmentEdit(assessment)}
                        className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded"
                        title="Edit midterm"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAssessment(assessment.id)}
                        className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                        title="Delete midterm"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <a
                    href={resolveFileUrl(assessment.question_paper)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center justify-between p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-blue-700">Question Paper</span>
                    <Download className="w-5 h-5 text-blue-600" />
                  </a>
                  <a
                    href={resolveFileUrl(assessment.model_solution)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center justify-between p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-green-700">Model Solution</span>
                    <Download className="w-5 h-5 text-green-600" />
                  </a>
                  <a
                    href={resolveFileUrl(assessment.sample_scripts)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center justify-between p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-purple-700">Sample Scripts</span>
                    <Download className="w-5 h-5 text-purple-600" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {isCoordinatorViewer && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Feedback: Midterm</h3>
            <textarea
              value={getFb('MIDTERM')}
              onChange={(e) => setFb('MIDTERM', e.target.value)}
              placeholder="Remarks about midterm (visible to faculty)"
              className="w-full border border-gray-300 rounded-md p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 text-right">
              <button onClick={() => saveFb('MIDTERM')} className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700">Save Midterm Feedback</button>
            </div>
          </div>
        )}

        {/* Final Section */}
        {groupAssessmentsByType('FINAL').length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <FileCheck className="w-6 h-6 mr-2 text-blue-600" />
              Final Examination
            </h3>
            
            {groupAssessmentsByType('FINAL').map((assessment) => (
              <div key={assessment.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-800">
                    Final Exam {assessment.number ?? assessment.title ?? assessment.id}
                  </h4>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAssessmentEdit(assessment)}
                        className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded"
                        title="Edit final exam"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAssessment(assessment.id)}
                        className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                        title="Delete final exam"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <a
                    href={resolveFileUrl(assessment.question_paper)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center justify-between p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-blue-700">Question Paper</span>
                    <Download className="w-5 h-5 text-blue-600" />
                  </a>
                  <a
                    href={resolveFileUrl(assessment.model_solution)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center justify-between p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-green-700">Model Solution</span>
                    <Download className="w-5 h-5 text-green-600" />
                  </a>
                  <a
                    href={resolveFileUrl(assessment.sample_scripts)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center justify-between p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-purple-700">Sample Scripts</span>
                    <Download className="w-5 h-5 text-purple-600" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {isCoordinatorViewer && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-amber-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Feedback: Final Exam</h3>
            <textarea
              value={getFb('FINAL')}
              onChange={(e) => setFb('FINAL', e.target.value)}
              placeholder="Remarks about final exam (visible to faculty)"
              className="w-full border border-gray-300 rounded-md p-2 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-2 text-right">
              <button onClick={() => saveFb('FINAL')} className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700">Save Final Feedback</button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!componentToEdit}
        onClose={closeComponentModal}
        title={`Edit ${componentToEdit ? componentLabels[componentToEdit.component_type] || 'Component' : 'Component'}`}
        maxWidth="lg"
      >
        <form onSubmit={handleComponentUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={componentForm.title}
              onChange={(e) => setComponentForm((prev) => ({ ...prev, title: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={componentForm.description}
              onChange={(e) => setComponentForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Replace File (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setComponentFile(e.target.files?.[0] || null)}
              className="mt-1 w-full"
            />
            <p className="mt-1 text-xs text-gray-500">Leave empty to keep the current file.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeComponentModal}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!assessmentToEdit}
        onClose={closeAssessmentModal}
        title={`Edit ${assessmentToEdit ? assessmentLabels[assessmentToEdit.assessment_type] || 'Assessment' : 'Assessment'}`}
        maxWidth="xl"
      >
        <form onSubmit={handleAssessmentUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={assessmentForm.title}
                onChange={(e) => setAssessmentForm((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Number</label>
              <input
                type="number"
                min={1}
                value={assessmentForm.number}
                onChange={(e) => setAssessmentForm((prev) => ({ ...prev, number: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Marks</label>
              <input
                type="number"
                step="0.01"
                value={assessmentForm.max_marks}
                onChange={(e) => setAssessmentForm((prev) => ({ ...prev, max_marks: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Weightage (%)</label>
              <input
                type="number"
                step="0.01"
                value={assessmentForm.weightage}
                onChange={(e) => setAssessmentForm((prev) => ({ ...prev, weightage: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={assessmentForm.description}
              onChange={(e) => setAssessmentForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Question Paper (PDF)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setAssessmentFiles((prev) => ({ ...prev, question: e.target.files?.[0] || null }))}
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Model Solution (PDF)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setAssessmentFiles((prev) => ({ ...prev, solution: e.target.files?.[0] || null }))}
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sample Scripts (PDF)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setAssessmentFiles((prev) => ({ ...prev, sample: e.target.files?.[0] || null }))}
                className="mt-1 w-full"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">Leave file inputs empty to keep existing documents.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeAssessmentModal}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!logToEdit}
        onClose={closeLogModal}
        title={logToEdit ? `Edit Lecture ${logToEdit.lecture_number}` : 'Edit Lecture'}
        maxWidth="xl"
      >
        <form onSubmit={handleLogUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Lecture Number</label>
              <div className="mt-1 w-full rounded-md border border-gray-200 p-2 bg-gray-50 text-gray-900">
                {logForm.lecture_number || (logToEdit ? String(logToEdit.lecture_number) : '')}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={logForm.date}
                onChange={(e) => setLogForm((prev) => ({ ...prev, date: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
              <div className="mt-1 w-full rounded-md border border-gray-200 p-2 bg-gray-50 text-gray-900">
                {logForm.duration || (logToEdit ? String(logToEdit.duration) : '')}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Topics Covered</label>
            <textarea
              value={logForm.topics_covered}
              onChange={(e) => setLogForm((prev) => ({ ...prev, topics_covered: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Evaluation Instrument</label>
            <input
              type="text"
              value={logForm.evaluation_instrument}
              onChange={(e) => setLogForm((prev) => ({ ...prev, evaluation_instrument: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Attendance Sheet (PDF/XLS/XLSX/CSV)</label>
            <input
              type="file"
              accept="application/pdf,.csv,.xls,.xlsx"
              onChange={(e) => setLogAttendanceFile(e.target.files?.[0] || null)}
              className="mt-1 w-full"
            />
            <p className="mt-1 text-xs text-gray-500">Uploading a new file will replace the existing attendance record.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeLogModal}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
      </div>
    </DashboardLayout>
  );
};

export default FolderDetailsView;
