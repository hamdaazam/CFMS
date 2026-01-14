import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI, folderComponentsAPI, assessmentsAPI, courseLogsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FileUp, Plus, Trash2, Send, ChevronRight, CheckCircle, Circle, AlertCircle } from 'lucide-react';

interface CourseAllocation {
  allocation_id: number;
  course_code: string;
  course_title: string;
  section: string;
  term: string;
  term_id: number | null;
  department: string;
  department_id: number | null;
  program: string;
  program_id: number | null;
  course_id: number | null;
}

interface CourseLogEntry {
  id?: number;
  lecture_number: number;
  date: string;
  duration: number;
  topics_covered: string;
  evaluation_instrument: string;
  attendance_sheet?: string | null;
}

interface Assessment {
  id: number;
  assessment_type: 'ASSIGNMENT' | 'QUIZ' | 'MIDTERM' | 'FINAL';
  number: number;
  title?: string;
  description?: string;
  question_paper?: string | null;
  model_solution?: string | null;
  sample_scripts?: string | null;
  max_marks?: number;
  weightage?: number;
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

const ensureNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type WizardStep =
  | 'info'
  | 'outline'
  | 'logs'
  | 'attendance'
  | 'references'
  | 'assignments'
  | 'quizzes'
  | 'midterm'
  | 'final'
  | 'review';

export const FolderCreationWizard: React.FC = () => {
  const { allocationId, folderId: folderIdParam } = useParams<{ allocationId?: string; folderId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isEditMode = !!folderIdParam;
  const [allocation, setAllocation] = useState<CourseAllocation | null>(location.state?.allocation || null);
  const [currentStep, setCurrentStep] = useState<WizardStep>('info');
  const [folderId, setFolderId] = useState<number | null>(folderIdParam ? Number(folderIdParam) : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resumeStepInitialized, setResumeStepInitialized] = useState(false);

  // Optional: single-PDF upload (full folder)
  const [folderPdfFile, setFolderPdfFile] = useState<File | null>(null);
  const [folderPdfUploading, setFolderPdfUploading] = useState(false);
  const [folderPdfValidation, setFolderPdfValidation] = useState<any | null>(null);

  // Component uploads state
  const [outlineFile, setOutlineFile] = useState<File | null>(null);
  const [referencesFile, setReferencesFile] = useState<File | null>(null);
  const [attendanceUploads, setAttendanceUploads] = useState<Record<number, File | null>>({});
  const [attendanceUploadingId, setAttendanceUploadingId] = useState<number | null>(null);
  const [hasAttendanceComponent, setHasAttendanceComponent] = useState(false);

  // Course logs state
  const [courseLogs, setCourseLogs] = useState<CourseLogEntry[]>([
    { lecture_number: 1, date: '', duration: 50, topics_covered: '', evaluation_instrument: '', attendance_sheet: null },
  ]);

  // Assessment state (Assignments, Quizzes, Midterm, Final)
  const [assignmentFiles, setAssignmentFiles] = useState<{
    [key: number]: { question: File | null; solution: File | null; sample: File | null };
  }>({
    1: { question: null, solution: null, sample: null },
    2: { question: null, solution: null, sample: null },
    3: { question: null, solution: null, sample: null },
    4: { question: null, solution: null, sample: null },
  });

  const [quizFiles, setQuizFiles] = useState<{
    [key: number]: { question: File | null; solution: File | null; sample: File | null };
  }>({
    1: { question: null, solution: null, sample: null },
    2: { question: null, solution: null, sample: null },
    3: { question: null, solution: null, sample: null },
    4: { question: null, solution: null, sample: null },
  });

  const [midtermFiles, setMidtermFiles] = useState<{
    question: File | null;
    solution: File | null;
    sample: File | null;
  }>({ question: null, solution: null, sample: null });

  const [finalFiles, setFinalFiles] = useState<{
    question: File | null;
    solution: File | null;
    sample: File | null;
  }>({ question: null, solution: null, sample: null });

  const [existingAssessments, setExistingAssessments] = useState<Record<'ASSIGNMENT' | 'QUIZ' | 'MIDTERM' | 'FINAL', Assessment[]>>({
    ASSIGNMENT: [],
    QUIZ: [],
    MIDTERM: [],
    FINAL: [],
  });

  useEffect(() => {
    if (isEditMode && folderIdParam) {
      // Edit mode: Load existing folder data
      loadFolderData(Number(folderIdParam));
    } else if (!allocation && !isEditMode && !allocationId) {
      // Create mode but no allocation context available
      navigate('/faculty/create-folder');
    }
  }, [folderIdParam, allocation, navigate, isEditMode, allocationId]);

  useEffect(() => {
    const checkExistingFolderForAllocation = async () => {
      const allocationIdNumber = ensureNumber(allocationId);
      if (isEditMode || !allocationIdNumber || folderId) {
        return;
      }

      try {
        const response = await courseFoldersAPI.getAll({ course_allocation: allocationIdNumber });
        const folders = Array.isArray(response.data)
          ? response.data
          : (response.data.results || []);

        const matchingFolder = folders.find((folder: any) => {
          const folderAllocationId =
            ensureNumber(folder.course_allocation) ??
            ensureNumber(folder.course_allocation_id) ??
            ensureNumber(folder.course_allocation_detail?.id) ??
            ensureNumber(folder.course_allocation_details?.id);

          return folderAllocationId === allocationIdNumber;
        });

        if (matchingFolder) {
          await loadFolderData(matchingFolder.id);
        }
      } catch (err) {
        console.error('Error checking existing folder for allocation:', err);
      }
    };

    checkExistingFolderForAllocation();
  }, [allocationId, isEditMode, folderId]);

  const isCoordinator = user?.role === 'COORDINATOR';
  const layoutProps = {
    userRole: (isCoordinator ? 'coordinator' : 'faculty') as 'coordinator' | 'faculty',
    userName: user?.full_name || (isCoordinator ? 'Coordinator' : 'Faculty'),
    userAvatar: user?.profile_picture || undefined,
  };

  const refreshAssessments = async (id: number) => {
    try {
      const response = await assessmentsAPI.getAll({ folder: id });
      const assessmentData: Assessment[] = Array.isArray(response.data)
        ? response.data
        : (response.data.results || []);

      const grouped: Record<'ASSIGNMENT' | 'QUIZ' | 'MIDTERM' | 'FINAL', Assessment[]> = {
        ASSIGNMENT: [],
        QUIZ: [],
        MIDTERM: [],
        FINAL: [],
      };

      assessmentData.forEach((assessment: Assessment) => {
        if (grouped[assessment.assessment_type]) {
          grouped[assessment.assessment_type] = [
            ...grouped[assessment.assessment_type],
            assessment,
          ].sort((a, b) => (a.number || 0) - (b.number || 0));
        }
      });

      setExistingAssessments(grouped);
    } catch (err) {
      console.error('Error loading assessments:', err);
      setExistingAssessments({ ASSIGNMENT: [], QUIZ: [], MIDTERM: [], FINAL: [] });
    }
  };

  const loadFolderData = async (id: number) => {
    try {
      setLoading(true);
      setFolderId(id);
      
      // Single detailed fetch (includes components, assessments, logs)
      const response = await courseFoldersAPI.getById(id);
      const folderData = response.data;

      setAllocation((prev) => {
        if (prev) {
          return prev;
        }

        const allocationDetail = folderData?.course_allocation_detail || folderData?.course_allocation_details || {};
        const courseInfo = folderData?.course_details || allocationDetail?.course_details || {};
        const termInfo = folderData?.term_details || allocationDetail?.term_details || {};
        const departmentInfo = folderData?.department_details || allocationDetail?.department_details || {};
        const programInfo = folderData?.program_details || allocationDetail?.program_details || null;

        return {
          allocation_id:
            ensureNumber(folderData?.course_allocation) ??
            ensureNumber(folderData?.course_allocation_id) ??
            ensureNumber(allocationDetail?.id) ??
            0,
          course_code: courseInfo?.code || 'N/A',
          course_title: courseInfo?.title || 'N/A',
          section: folderData?.section || allocationDetail?.section || 'N/A',
          term: termInfo?.session_term || 'Current Term',
          term_id:
            ensureNumber(folderData?.term) ??
            ensureNumber(allocationDetail?.term) ??
            ensureNumber(termInfo?.id) ??
            null,
          department: departmentInfo?.name || 'N/A',
          department_id:
            ensureNumber(folderData?.department) ??
            ensureNumber(allocationDetail?.department) ??
            ensureNumber(departmentInfo?.id) ??
            null,
          program: programInfo?.title || 'N/A',
          program_id:
            ensureNumber(folderData?.program) ??
            ensureNumber(allocationDetail?.program) ??
            ensureNumber(programInfo?.id) ??
            null,
          course_id:
            ensureNumber(folderData?.course) ??
            ensureNumber(allocationDetail?.course) ??
            ensureNumber(courseInfo?.id) ??
            null,
        };
      });
      
      // Use embedded components (avoid extra request)
      const components = Array.isArray(folderData?.components) ? folderData.components : [];

      console.log('Loaded components:', components);

      // Mark steps as completed based on existing components
  const outlineExists = components.some((c: any) => c.component_type === 'COURSE_OUTLINE');
  const referencesExists = components.some((c: any) => c.component_type === 'REFERENCE_BOOKS');
  const attendanceExists = components.some((c: any) => c.component_type === 'ATTENDANCE');

  console.log('Component exists:', { outlineExists, referencesExists, attendanceExists });

      if (outlineExists) setOutlineFile(new File([], 'uploaded'));
      if (referencesExists) setReferencesFile(new File([], 'uploaded'));
  setHasAttendanceComponent(attendanceExists);

      // Use embedded logs
      const logs = Array.isArray(folderData?.log_entries) ? folderData.log_entries : [];

      if (logs.length > 0) {
        const normalizedLogs = logs.map((log: any, index: number) => ({
          id: log.id,
          lecture_number: log.lecture_number ?? index + 1,
          date: log.date ?? '',
          duration: log.duration ?? 50,
          topics_covered: log.topics_covered ?? '',
          evaluation_instrument: log.evaluation_instrument ?? '',
          attendance_sheet: log.attendance_sheet || null,
        }));
        setCourseLogs(normalizedLogs);
      }
      setAttendanceUploads({});

      // Use embedded assessments to seed UI quickly
      const assessmentData: Assessment[] = Array.isArray(folderData?.assessments) ? folderData.assessments : [];
      const grouped: Record<'ASSIGNMENT' | 'QUIZ' | 'MIDTERM' | 'FINAL', Assessment[]> = {
        ASSIGNMENT: [],
        QUIZ: [],
        MIDTERM: [],
        FINAL: [],
      };
      assessmentData.forEach((a: Assessment) => {
        const t = a.assessment_type;
        if (grouped[t]) {
          grouped[t] = [...grouped[t], a].sort((x, y) => (x.number || 0) - (y.number || 0));
        }
      });
      setExistingAssessments(grouped);
      setResumeStepInitialized(false);
      
      setError(null);
    } catch (err: any) {
      console.error('Error loading folder data:', err);
      setError('Failed to load folder data');
    } finally {
      setLoading(false);
    }
  };

  const savedLogs = courseLogs.filter(
    (log): log is CourseLogEntry & { id: number } => typeof log.id === 'number'
  );
  const logsComplete = savedLogs.length > 0;
  const attendanceComplete = hasAttendanceComponent || (logsComplete && savedLogs.every((log) => !!log.attendance_sheet));

  const assessmentHasAllFiles = (assessment: Assessment) =>
    Boolean(assessment.question_paper && assessment.model_solution);

  const mapByNumber = (assessments: Assessment[]) =>
    assessments.reduce<Record<number, Assessment>>((acc, item) => {
      if (typeof item.number === 'number') {
        acc[item.number] = item;
      }
      return acc;
    }, {});

  const assignmentMap = mapByNumber(existingAssessments.ASSIGNMENT);
  const quizMap = mapByNumber(existingAssessments.QUIZ);

  const assignmentsComplete = [1, 2, 3, 4].every((num) => {
    const assessment = assignmentMap[num];
    return assessment ? assessmentHasAllFiles(assessment) : false;
  });

  const quizzesComplete = [1, 2, 3, 4].every((num) => {
    const assessment = quizMap[num];
    return assessment ? assessmentHasAllFiles(assessment) : false;
  });

  const midtermComplete = existingAssessments.MIDTERM.some(assessmentHasAllFiles);

  const finalComplete = existingAssessments.FINAL.some(assessmentHasAllFiles);

  const reviewReady = Boolean(
    folderId &&
      outlineFile &&
      referencesFile &&
      logsComplete &&
      attendanceComplete &&
      assignmentsComplete &&
      quizzesComplete &&
      midtermComplete &&
      finalComplete
  );

  const steps: { key: WizardStep; label: string; completed: boolean }[] = [
    { key: 'info', label: 'Title Page', completed: !!folderId },
    { key: 'outline', label: 'Course Outline', completed: !!outlineFile },
    { key: 'logs', label: 'Course Logs', completed: logsComplete },
    { key: 'attendance', label: 'Attendance', completed: attendanceComplete },
    { key: 'references', label: 'Reference Books', completed: !!referencesFile },
    { key: 'assignments', label: 'Assignments (4)', completed: assignmentsComplete },
    { key: 'quizzes', label: 'Quizzes (4)', completed: quizzesComplete },
    { key: 'midterm', label: 'Midterm Exam', completed: midtermComplete },
    { key: 'final', label: 'Final Exam', completed: finalComplete },
    { key: 'review', label: 'Review & Submit', completed: reviewReady },
  ];

  useEffect(() => {
    if (!folderId || resumeStepInitialized) {
      return;
    }

    const firstIncomplete = steps.find((step) => !step.completed);
    if (firstIncomplete) {
      setCurrentStep(firstIncomplete.key);
    } else {
      setCurrentStep('review');
    }

    setResumeStepInitialized(true);
  }, [folderId, steps, resumeStepInitialized]);

  const createFolder = async () => {
    if (!allocation) return;

    try {
      setLoading(true);
      setError(null);

      // Create folder - faculty will be auto-set by backend from authenticated user
      const currentYear = new Date().getFullYear();
      const response = await courseFoldersAPI.create({
        course: allocation.course_id ?? 0,
        course_allocation: allocation.allocation_id,
        faculty: user?.id ?? 0, // Use authenticated user's ID
        term: allocation.term_id ?? 0,
        department: allocation.department_id ?? 0,
        program: allocation.program_id || undefined,
        academic_year: `${currentYear}-${currentYear + 1}`, // e.g., "2024-2025"
      });

      setFolderId(response.data.id);
      setResumeStepInitialized(false);
      setSuccessMessage('Folder created successfully!');
      
      // Move to next step after short delay
      setTimeout(() => {
        setSuccessMessage(null);
        setCurrentStep('outline');
      }, 1500);
    } catch (err: any) {
      console.error('Error creating folder:', err);
      const errorMsg = err.response?.data?.error || 
                       err.response?.data?.detail || 
                       err.response?.data?.faculty?.[0] ||
                       err.response?.data?.non_field_errors?.[0] ||
                       'Failed to create folder. Please ensure you have a faculty profile.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const uploadComponent = async (componentType: string, file: File, description: string) => {
    if (!folderId) {
      setError('Please create folder first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if component already exists
      const existingComponents = await folderComponentsAPI.getAll({ folder: folderId });
      const components = Array.isArray(existingComponents.data) 
        ? existingComponents.data 
        : (existingComponents.data.results || []);
      
      const alreadyExists = components.some((c: any) => c.component_type === componentType);
      
      if (alreadyExists) {
        const confirmReplace = window.confirm(
          `A ${description} has already been uploaded. Do you want to replace it?`
        );
        if (!confirmReplace) {
          setLoading(false);
          return;
        }
        
        // Delete existing component
        const existingComponent = components.find((c: any) => c.component_type === componentType);
        if (existingComponent) {
          await folderComponentsAPI.delete(existingComponent.id);
        }
      }

      const formData = new FormData();
      formData.append('folder', folderId.toString());
      formData.append('component_type', componentType);
      formData.append('title', file.name);
      formData.append('file', file);
      formData.append('description', description);
      formData.append('order', '1');

      await folderComponentsAPI.create(formData);
      setSuccessMessage(`${description} uploaded successfully!`);
      
      // Mark step as completed based on component type
      if (componentType === 'COURSE_OUTLINE') {
        setOutlineFile(file);
        // Auto-navigate to next step after short delay
        setTimeout(() => {
          setSuccessMessage(null);
          setCurrentStep('logs');
        }, 1500);
      }
      if (componentType === 'REFERENCE_BOOKS') {
        setReferencesFile(file);
        setTimeout(() => {
          setSuccessMessage(null);
          setCurrentStep('assignments');
        }, 1500);
      }
    } catch (err: any) {
      console.error('Error uploading component:', err);
      setError(err.response?.data?.error || err.response?.data?.file?.[0] || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const saveCourseLog = async (log: CourseLogEntry, index: number) => {
    if (!folderId) {
      setError('Please create folder first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (log.id) {
        const response = await courseLogsAPI.partialUpdate(log.id, {
          lecture_number: log.lecture_number,
          date: log.date,
          duration: log.duration,
          topics_covered: log.topics_covered,
          evaluation_instrument: log.evaluation_instrument,
        });

        setCourseLogs((prev) =>
          prev.map((entry, idx) =>
            idx === index
              ? {
                  ...entry,
                  ...response.data,
                }
              : entry
          )
        );
      } else {
        const response = await courseLogsAPI.create({
          folder: folderId,
          lecture_number: log.lecture_number,
          date: log.date,
          duration: log.duration,
          topics_covered: log.topics_covered,
          evaluation_instrument: log.evaluation_instrument,
        });

        const savedLog = response.data;
        setCourseLogs((prev) =>
          prev.map((entry, idx) =>
            idx === index
              ? {
                  ...entry,
                  ...savedLog,
                }
              : entry
          )
        );
      }

      setSuccessMessage('Course log saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error saving course log:', err);
      setError(err.response?.data?.error || 'Failed to save course log');
    } finally {
      setLoading(false);
    }
  };

  const uploadAssessment = async (
    type: string,
    number: number,
    questionFile: File | null,
    solutionFile: File | null,
    sampleFile: File | null
  ) => {
    if (!folderId) {
      setError('Please create folder first');
      return;
    }

    if (!questionFile || !solutionFile || !sampleFile) {
      setError('All three files are required for assessment');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const titleMap: Record<string, string> = {
        ASSIGNMENT: 'Assignment',
        QUIZ: 'Quiz',
        MIDTERM: 'Midterm',
        FINAL: 'Final Exam',
      };

      const formData = new FormData();
      formData.append('folder', folderId.toString());
      formData.append('assessment_type', type);
      formData.append('number', number.toString());
      formData.append('title', `${titleMap[type] || type} ${number}`.trim());
      formData.append('question_paper', questionFile);
      formData.append('model_solution', solutionFile);
      formData.append('sample_scripts', sampleFile);

      await assessmentsAPI.create(formData);
      setSuccessMessage(`${type} ${number} uploaded successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);

      await refreshAssessments(folderId);

      if (type === 'ASSIGNMENT') {
        setAssignmentFiles((prev) => ({
          ...prev,
          [number]: { question: null, solution: null, sample: null },
        }));
      }

      if (type === 'QUIZ') {
        setQuizFiles((prev) => ({
          ...prev,
          [number]: { question: null, solution: null, sample: null },
        }));
      }

      if (type === 'MIDTERM') {
        setMidtermFiles({ question: null, solution: null, sample: null });
      }

      if (type === 'FINAL') {
        setFinalFiles({ question: null, solution: null, sample: null });
      }
    } catch (err: any) {
      console.error('Error uploading assessment:', err);
      setError(err.response?.data?.error || 'Failed to upload assessment');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLog = () => {
    const newLogNumber = courseLogs.length + 1;
    setCourseLogs([
      ...courseLogs,
      {
        lecture_number: newLogNumber,
        date: '',
        duration: 50,
        topics_covered: '',
        evaluation_instrument: '',
        attendance_sheet: null,
      },
    ]);
  };

  const handleRemoveLog = (index: number) => {
    if (courseLogs.length > 1) {
      const logToRemove = courseLogs[index];
      setCourseLogs(courseLogs.filter((_, i) => i !== index));

      if (logToRemove?.id) {
        setAttendanceUploads((prev) => {
          const updated = { ...prev };
          delete updated[logToRemove.id as number];
          return updated;
        });
      }
    }
  };

  const handleLogChange = (index: number, field: keyof CourseLogEntry, value: any) => {
    const updated = [...courseLogs];
    updated[index] = { ...updated[index], [field]: value };
    setCourseLogs(updated);
  };

  const handleAttendanceFileChange = (logId: number, file: File | null) => {
    setAttendanceUploads((prev) => ({
      ...prev,
      [logId]: file,
    }));
  };

  const uploadAttendanceForLog = async (log: CourseLogEntry) => {
    if (!log.id) {
      setError('Save the course log before uploading attendance.');
      return;
    }

    const logId = log.id;
    const file = attendanceUploads[logId];
    if (!file) {
      setError('Please select an attendance file to upload.');
      return;
    }

    try {
      setAttendanceUploadingId(logId);
      setError(null);

      const formData = new FormData();
      formData.append('attendance_sheet', file);

  const response = await courseLogsAPI.uploadAttendance(logId, formData);

      setCourseLogs((prev) =>
        prev.map((entry) =>
          entry.id === logId
            ? {
                ...entry,
                attendance_sheet: response.data.attendance_sheet,
              }
            : entry
        )
      );

      setSuccessMessage(`Attendance for Lecture ${log.lecture_number} uploaded successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);

      setAttendanceUploads((prev) => ({
        ...prev,
        [logId]: null,
      }));
    } catch (err: any) {
      console.error('Error uploading attendance:', err);
      const errorMsg = err.response?.data?.error || 'Failed to upload attendance file';
      setError(errorMsg);
    } finally {
      setAttendanceUploadingId(null);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'info':
        return (
          <div className="space-y-6">
            {isEditMode ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Edit Mode</h3>
                <p className="text-slate-700 mb-4">
                  You are editing an existing course folder. Navigate through the steps to update components.
                </p>
                <p className="text-slate-600 text-sm">Folder ID: {folderId}</p>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-r from-slate-700 to-slate-600 rounded-lg p-6 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-2">{allocation?.course_code}</h3>
                      <p className="text-slate-200 mb-4">{allocation?.course_title}</p>
                    </div>
                    <img src="/cust-logo.png" alt="CUST" className="w-20 h-20 opacity-90 ml-4 flex-shrink-0" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-300">Section:</span>
                      <span className="ml-2 font-medium">{allocation?.section}</span>
                    </div>
                    <div>
                      <span className="text-slate-300">Term:</span>
                      <span className="ml-2 font-medium">{allocation?.term}</span>
                    </div>
                    <div>
                      <span className="text-slate-300">Department:</span>
                      <span className="ml-2 font-medium">{allocation?.department}</span>
                    </div>
                    <div>
                      <span className="text-slate-300">Program:</span>
                      <span className="ml-2 font-medium">{allocation?.program}</span>
                    </div>
                  </div>
                </div>

                {!folderId ? (
                  <button
                    onClick={createFolder}
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 disabled:bg-gray-400"
                  >
                    {loading ? 'Creating...' : 'Create Course Folder'}
                  </button>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-medium">✓ Folder created successfully!</p>
                    <p className="text-green-600 text-sm mt-1">Folder ID: {folderId}</p>
                  </div>
                )}

                {/* Optional single-PDF upload shown early (right after folder is created) */}
                {folderId && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="font-semibold text-gray-800">Upload Folder (PDF) — Optional</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Upload a single PDF of your complete folder. The system checks required sections (Theory/Lab).
                    </p>

                    <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => setFolderPdfFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                      />
                      <button
                        type="button"
                        disabled={!folderPdfFile || folderPdfUploading}
                        onClick={async () => {
                          if (!folderId || !folderPdfFile) return;
                          try {
                            setFolderPdfUploading(true);
                            setError(null);
                            setSuccessMessage(null);
                            const form = new FormData();
                            form.append('file', folderPdfFile);
                            const res = await courseFoldersAPI.uploadFolderPdf(folderId, form);
                            setFolderPdfValidation(res.data?.validation || null);
                            setSuccessMessage('Folder PDF uploaded and validated.');
                          } catch (err: any) {
                            setFolderPdfValidation(null);
                            setError(err.response?.data?.error || 'Failed to upload folder PDF');
                          } finally {
                            setFolderPdfUploading(false);
                          }
                        }}
                        className="bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-lg disabled:bg-gray-400 whitespace-nowrap"
                      >
                        {folderPdfUploading ? 'Uploading…' : 'Upload & Validate'}
                      </button>
                    </div>

                    {folderPdfValidation && (
                      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                        <div className="flex flex-wrap gap-3 items-center">
                          <span className="font-medium text-slate-800">
                            Course Type: {folderPdfValidation.course_type || 'THEORY'}
                          </span>
                          <span className={folderPdfValidation.missing?.length ? 'text-red-700' : 'text-green-700'}>
                            Missing: {Array.isArray(folderPdfValidation.missing) ? folderPdfValidation.missing.length : 0}
                          </span>
                          <span className={folderPdfValidation.order_ok ? 'text-green-700' : 'text-amber-700'}>
                            Order: {folderPdfValidation.order_ok ? 'OK' : 'Issues'}
                          </span>
                          <span className={folderPdfValidation.text_extracted ? 'text-green-700' : 'text-red-700'}>
                            Text: {folderPdfValidation.text_extracted ? 'Detected' : 'Not detected (scanned PDF?)'}
                          </span>
                        </div>

                        {Array.isArray(folderPdfValidation.missing) && folderPdfValidation.missing.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium text-red-800">Missing required sections:</p>
                            <ul className="list-disc pl-5 text-red-800">
                              {folderPdfValidation.missing.map((m: string) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'outline':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Course Outline</h3>
              <p className="text-gray-600 mb-4">Upload the official course outline document (PDF, max 20MB)</p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <FileUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setOutlineFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="outline-upload"
                />
                <label
                  htmlFor="outline-upload"
                  className="cursor-pointer text-slate-600 hover:text-slate-700 font-medium"
                >
                  Click to upload
                </label>
                <p className="text-gray-500 text-sm mt-2">or drag and drop</p>
                {outlineFile && (
                  <p className="text-green-600 mt-4 font-medium">Selected: {outlineFile.name}</p>
                )}
              </div>

              {outlineFile && !loading && (
                <button
                  onClick={() => uploadComponent('COURSE_OUTLINE', outlineFile, 'Course Outline')}
                  className="mt-4 bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-6 rounded-lg"
                >
                  Upload Course Outline
                </button>
              )}
            </div>
          </div>
        );

      case 'logs':
        return (
          <div className="space-y-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Course Log Entries</h3>
            </div>

            <div className="space-y-4">
              {courseLogs.map((log, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-700">Lecture {log.lecture_number}</h4>
                    {courseLogs.length > 1 && (
                      <button
                        onClick={() => handleRemoveLog(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={log.date}
                        onChange={(e) => handleLogChange(index, 'date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                      <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                        {log.duration}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Topics Covered</label>
                      <textarea
                        value={log.topics_covered}
                        onChange={(e) => handleLogChange(index, 'topics_covered', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Instrument</label>
                      <input
                        type="text"
                        value={log.evaluation_instrument}
                        onChange={(e) => handleLogChange(index, 'evaluation_instrument', e.target.value)}
                        placeholder="e.g., Quiz, Assignment, Lab"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {log.date && log.topics_covered && (
                    <button
                      onClick={() => saveCourseLog(log, index)}
                      disabled={loading}
                      className="mt-3 bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-4 rounded text-sm"
                    >
                      {loading ? 'Saving...' : 'Save Log'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-0.5 flex justify-center pb-0">
              <button
                onClick={handleAddLog}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-white text-slate-800 hover:bg-slate-50 shadow-sm transition text-sm w-full md:w-auto"
              >
                <Plus className="w-3.5 h-3.5 mr-2" />
                <span className="leading-none">Add Lecture</span>
              </button>
            </div>
          </div>
        );

      case 'attendance':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-800">Upload Attendance Records</h3>
              <p className="text-gray-600">
                Attach the attendance sheet for each lecture. Save the course log first, then upload a PDF or spreadsheet
                (max 20MB) for that lecture.
              </p>
            </div>

            {hasAttendanceComponent && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4">
                A consolidated attendance file is already uploaded for this folder. You can keep it, or upload
                lecture-wise attendance sheets below to replace it.
              </div>
            )}

            {savedLogs.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4">
                Save at least one course log entry before uploading attendance files.
              </div>
            ) : (
              <div className="space-y-4">
                {savedLogs.map((log) => {
                  const logId = log.id as number;
                  const selectedFile = attendanceUploads[logId] || null;
                  return (
                    <div
                      key={logId}
                      className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Lecture {log.lecture_number}
                          </p>
                          <p className="text-sm text-gray-600">
                            {log.date ? new Date(log.date).toLocaleDateString() : 'Date not set'}
                          </p>
                          {log.attendance_sheet ? (
                            <a
                              href={resolveFileUrl(log.attendance_sheet)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 inline-flex items-center gap-1"
                            >
                              View current attendance
                            </a>
                          ) : (
                            <span className="text-sm text-gray-500 mt-2 inline-block">
                              No attendance uploaded yet
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
                          <div>
                            <input
                              type="file"
                              accept=".pdf,.xlsx,.xls,.csv"
                              onChange={(e) => handleAttendanceFileChange(logId, e.target.files?.[0] || null)}
                              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                            />
                            {selectedFile && (
                              <p className="text-xs text-green-600 mt-1">✓ {selectedFile.name}</p>
                            )}
                          </div>
                          <button
                            onClick={() => uploadAttendanceForLog(log)}
                            disabled={!selectedFile || attendanceUploadingId === logId}
                            className="bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded disabled:bg-gray-300 disabled:text-gray-600"
                          >
                            {attendanceUploadingId === logId
                              ? 'Uploading...'
                              : log.attendance_sheet
                              ? 'Replace Attendance'
                              : 'Upload Attendance'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'references':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Reference Books List</h3>
              <p className="text-gray-600 mb-4">Upload the list of recommended reference books (PDF, max 20MB)</p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <FileUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setReferencesFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="references-upload"
                />
                <label
                  htmlFor="references-upload"
                  className="cursor-pointer text-slate-600 hover:text-slate-700 font-medium"
                >
                  Click to upload
                </label>
                <p className="text-gray-500 text-sm mt-2">or drag and drop</p>
                {referencesFile && (
                  <p className="text-green-600 mt-4 font-medium">Selected: {referencesFile.name}</p>
                )}
              </div>

              {referencesFile && !loading && (
                <button
                  onClick={() => uploadComponent('REFERENCE_BOOKS', referencesFile, 'Reference Books')}
                  className="mt-4 bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-6 rounded-lg"
                >
                  Upload Reference Books
                </button>
              )}
            </div>
          </div>
        );

      case 'assignments':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Assignments (4 Required)</h3>
            <p className="text-gray-600 mb-4">
              Upload 3 files for each assignment: Question Paper, Model Solution, and Sample Student Scripts
            </p>

            {existingAssessments.ASSIGNMENT.length > 0 && (
              <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
                <p className="text-sm font-semibold text-green-700 mb-3">Uploaded assignments</p>
                <div className="space-y-3">
                  {existingAssessments.ASSIGNMENT.map((assessment) => (
                    <div
                      key={assessment.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-green-100 rounded-md p-3"
                    >
                      <div className="font-medium text-gray-800">Assignment {assessment.number}</div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {assessment.question_paper && (
                          <a
                            href={resolveFileUrl(assessment.question_paper)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Question Paper
                          </a>
                        )}
                        {assessment.model_solution && (
                          <a
                            href={resolveFileUrl(assessment.model_solution)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Model Solution
                          </a>
                        )}
                        {assessment.sample_scripts && (
                          <a
                            href={resolveFileUrl(assessment.sample_scripts)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Sample Scripts
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4">Assignment {num}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Question Paper */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Paper *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const files = { ...assignmentFiles };
                        files[num].question = e.target.files?.[0] || null;
                        setAssignmentFiles(files);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                    />
                    {assignmentFiles[num].question && (
                      <p className="text-xs text-green-600 mt-1">✓ {assignmentFiles[num].question.name}</p>
                    )}
                  </div>

                  {/* Model Solution */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Model Solution *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const files = { ...assignmentFiles };
                        files[num].solution = e.target.files?.[0] || null;
                        setAssignmentFiles(files);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                    />
                    {assignmentFiles[num].solution && (
                      <p className="text-xs text-green-600 mt-1">✓ {assignmentFiles[num].solution.name}</p>
                    )}
                  </div>

                  {/* Sample Scripts */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sample Scripts *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const files = { ...assignmentFiles };
                        files[num].sample = e.target.files?.[0] || null;
                        setAssignmentFiles(files);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                    />
                    {assignmentFiles[num].sample && (
                      <p className="text-xs text-green-600 mt-1">✓ {assignmentFiles[num].sample.name}</p>
                    )}
                  </div>
                </div>

                {assignmentFiles[num].question && assignmentFiles[num].solution && assignmentFiles[num].sample && (
                  <button
                    onClick={() =>
                      uploadAssessment(
                        'ASSIGNMENT',
                        num,
                        assignmentFiles[num].question,
                        assignmentFiles[num].solution,
                        assignmentFiles[num].sample
                      )
                    }
                    disabled={loading}
                    className="mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:bg-gray-400"
                  >
                    {loading ? 'Uploading...' : `Upload Assignment ${num}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        );

      case 'quizzes':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Quizzes (4 Required)</h3>
            <p className="text-gray-600 mb-4">
              Upload 3 files for each quiz: Question Paper, Model Solution, and Sample Student Scripts
            </p>

            {existingAssessments.QUIZ.length > 0 && (
              <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
                <p className="text-sm font-semibold text-green-700 mb-3">Uploaded quizzes</p>
                <div className="space-y-3">
                  {existingAssessments.QUIZ.map((assessment) => (
                    <div
                      key={assessment.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-green-100 rounded-md p-3"
                    >
                      <div className="font-medium text-gray-800">Quiz {assessment.number}</div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {assessment.question_paper && (
                          <a
                            href={resolveFileUrl(assessment.question_paper)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Question Paper
                          </a>
                        )}
                        {assessment.model_solution && (
                          <a
                            href={resolveFileUrl(assessment.model_solution)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Model Solution
                          </a>
                        )}
                        {assessment.sample_scripts && (
                          <a
                            href={resolveFileUrl(assessment.sample_scripts)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Sample Scripts
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4">Quiz {num}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Question Paper */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Paper *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const files = { ...quizFiles };
                        files[num].question = e.target.files?.[0] || null;
                        setQuizFiles(files);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                    />
                    {quizFiles[num].question && (
                      <p className="text-xs text-green-600 mt-1">✓ {quizFiles[num].question.name}</p>
                    )}
                  </div>

                  {/* Model Solution */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Model Solution *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const files = { ...quizFiles };
                        files[num].solution = e.target.files?.[0] || null;
                        setQuizFiles(files);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                    />
                    {quizFiles[num].solution && (
                      <p className="text-xs text-green-600 mt-1">✓ {quizFiles[num].solution.name}</p>
                    )}
                  </div>

                  {/* Sample Scripts */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sample Scripts *
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const files = { ...quizFiles };
                        files[num].sample = e.target.files?.[0] || null;
                        setQuizFiles(files);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                    />
                    {quizFiles[num].sample && (
                      <p className="text-xs text-green-600 mt-1">✓ {quizFiles[num].sample.name}</p>
                    )}
                  </div>
                </div>

                {quizFiles[num].question && quizFiles[num].solution && quizFiles[num].sample && (
                  <button
                    onClick={() =>
                      uploadAssessment('QUIZ', num, quizFiles[num].question, quizFiles[num].solution, quizFiles[num].sample)
                    }
                    disabled={loading}
                    className="mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:bg-gray-400"
                  >
                    {loading ? 'Uploading...' : `Upload Quiz ${num}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        );

      case 'midterm':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Midterm Exam</h3>
            <p className="text-gray-600 mb-4">
              Upload 3 files for midterm exam: Question Paper, Model Solution, and Sample Student Scripts
            </p>

            {existingAssessments.MIDTERM.length > 0 && (
              <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
                <p className="text-sm font-semibold text-green-700 mb-3">Uploaded midterm files</p>
                <div className="space-y-3">
                  {existingAssessments.MIDTERM.map((assessment) => (
                    <div
                      key={assessment.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-green-100 rounded-md p-3"
                    >
                      <div className="font-medium text-gray-800">Midterm {assessment.number || ''}</div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {assessment.question_paper && (
                          <a
                            href={resolveFileUrl(assessment.question_paper)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Question Paper
                          </a>
                        )}
                        {assessment.model_solution && (
                          <a
                            href={resolveFileUrl(assessment.model_solution)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Model Solution
                          </a>
                        )}
                        {assessment.sample_scripts && (
                          <a
                            href={resolveFileUrl(assessment.sample_scripts)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Sample Scripts
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-4">Midterm Examination</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Question Paper */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Paper *
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setMidtermFiles({ ...midtermFiles, question: e.target.files?.[0] || null })
                    }
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                  />
                  {midtermFiles.question && (
                    <p className="text-xs text-green-600 mt-1">✓ {midtermFiles.question.name}</p>
                  )}
                </div>

                {/* Model Solution */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model Solution *
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setMidtermFiles({ ...midtermFiles, solution: e.target.files?.[0] || null })
                    }
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                  />
                  {midtermFiles.solution && (
                    <p className="text-xs text-green-600 mt-1">✓ {midtermFiles.solution.name}</p>
                  )}
                </div>

                {/* Sample Scripts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sample Scripts *
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setMidtermFiles({ ...midtermFiles, sample: e.target.files?.[0] || null })
                    }
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                  />
                  {midtermFiles.sample && (
                    <p className="text-xs text-green-600 mt-1">✓ {midtermFiles.sample.name}</p>
                  )}
                </div>
              </div>

              {midtermFiles.question && midtermFiles.solution && midtermFiles.sample && (
                <button
                  onClick={() =>
                    uploadAssessment('MIDTERM', 1, midtermFiles.question, midtermFiles.solution, midtermFiles.sample)
                  }
                  disabled={loading}
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:bg-gray-400"
                >
                  {loading ? 'Uploading...' : 'Upload Midterm Exam'}
                </button>
              )}
            </div>
          </div>
        );

      case 'final':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Final Exam</h3>
            <p className="text-gray-600 mb-4">
              Upload 3 files for final exam: Question Paper, Model Solution, and Sample Student Scripts
            </p>

            {existingAssessments.FINAL.length > 0 && (
              <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
                <p className="text-sm font-semibold text-green-700 mb-3">Uploaded final exam files</p>
                <div className="space-y-3">
                  {existingAssessments.FINAL.map((assessment) => (
                    <div
                      key={assessment.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-green-100 rounded-md p-3"
                    >
                      <div className="font-medium text-gray-800">Final {assessment.number || ''}</div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {assessment.question_paper && (
                          <a
                            href={resolveFileUrl(assessment.question_paper)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Question Paper
                          </a>
                        )}
                        {assessment.model_solution && (
                          <a
                            href={resolveFileUrl(assessment.model_solution)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Model Solution
                          </a>
                        )}
                        {assessment.sample_scripts && (
                          <a
                            href={resolveFileUrl(assessment.sample_scripts)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 hover:text-slate-900 underline"
                          >
                            Sample Scripts
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-4">Final Examination</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Question Paper */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Paper *
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setFinalFiles({ ...finalFiles, question: e.target.files?.[0] || null })
                    }
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                  />
                  {finalFiles.question && (
                    <p className="text-xs text-green-600 mt-1">✓ {finalFiles.question.name}</p>
                  )}
                </div>

                {/* Model Solution */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model Solution *
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setFinalFiles({ ...finalFiles, solution: e.target.files?.[0] || null })
                    }
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                  />
                  {finalFiles.solution && (
                    <p className="text-xs text-green-600 mt-1">✓ {finalFiles.solution.name}</p>
                  )}
                </div>

                {/* Sample Scripts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sample Scripts *
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) =>
                      setFinalFiles({ ...finalFiles, sample: e.target.files?.[0] || null })
                    }
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                  />
                  {finalFiles.sample && (
                    <p className="text-xs text-green-600 mt-1">✓ {finalFiles.sample.name}</p>
                  )}
                </div>
              </div>

              {finalFiles.question && finalFiles.solution && finalFiles.sample && (
                <button
                  onClick={() =>
                    uploadAssessment('FINAL', 1, finalFiles.question, finalFiles.solution, finalFiles.sample)
                  }
                  disabled={loading}
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:bg-gray-400"
                >
                  {loading ? 'Uploading...' : 'Upload Final Exam'}
                </button>
              )}
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Review & Submit Folder</h3>
            <p className="text-gray-600 mb-6">
              Review all uploaded components and submit the folder for coordinator review.
            </p>

            {/* Optional: Upload single PDF for full folder + checklist validation */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-800">Upload Folder (PDF) — Optional</p>
                  <p className="text-sm text-gray-600 mt-1">
                    If you already have a complete folder as a single PDF, upload it here. The system will check required sections (Theory/Lab).
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setFolderPdfFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                />
                <button
                  type="button"
                  disabled={!folderId || !folderPdfFile || folderPdfUploading}
                  onClick={async () => {
                    if (!folderId || !folderPdfFile) return;
                    try {
                      setFolderPdfUploading(true);
                      setError(null);
                      setSuccessMessage(null);
                      const form = new FormData();
                      form.append('file', folderPdfFile);
                      const res = await courseFoldersAPI.uploadFolderPdf(folderId, form);
                      setFolderPdfValidation(res.data?.validation || null);
                      setSuccessMessage('Folder PDF uploaded and validated.');
                    } catch (err: any) {
                      setFolderPdfValidation(null);
                      setError(err.response?.data?.error || 'Failed to upload folder PDF');
                    } finally {
                      setFolderPdfUploading(false);
                    }
                  }}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-lg disabled:bg-gray-400 whitespace-nowrap"
                >
                  {folderPdfUploading ? 'Uploading…' : 'Upload & Validate'}
                </button>
              </div>

              {folderPdfValidation && (
                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="font-medium text-slate-800">
                      Course Type: {folderPdfValidation.course_type || 'THEORY'}
                    </span>
                    <span className={folderPdfValidation.missing?.length ? 'text-red-700' : 'text-green-700'}>
                      Missing: {Array.isArray(folderPdfValidation.missing) ? folderPdfValidation.missing.length : 0}
                    </span>
                    <span className={folderPdfValidation.order_ok ? 'text-green-700' : 'text-amber-700'}>
                      Order: {folderPdfValidation.order_ok ? 'OK' : 'Issues'}
                    </span>
                    <span className={folderPdfValidation.text_extracted ? 'text-green-700' : 'text-red-700'}>
                      Text: {folderPdfValidation.text_extracted ? 'Detected' : 'Not detected (scanned PDF?)'}
                    </span>
                  </div>

                  {Array.isArray(folderPdfValidation.missing) && folderPdfValidation.missing.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-red-800">Missing required sections:</p>
                      <ul className="list-disc pl-5 text-red-800">
                        {folderPdfValidation.missing.map((m: string) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(folderPdfValidation.order_issues) && folderPdfValidation.order_issues.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-amber-800">Order issues (found out of sequence):</p>
                      <ul className="list-disc pl-5 text-amber-800">
                        {folderPdfValidation.order_issues.map((m: string) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-yellow-800 font-medium">Before submitting</p>
                  <p className="text-yellow-700 text-sm mt-1">
                    Make sure all required components are uploaded. Incomplete folders cannot be submitted.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!folderId) return;
                try {
                  setLoading(true);
                  await courseFoldersAPI.submit(folderId);
                  setSuccessMessage('Folder submitted successfully!');
                  const base = isCoordinator ? '/coordinator' : '/faculty';
                  setTimeout(() => navigate(`${base}/folders`), 2000);
                } catch (err: any) {
                  setError(err.response?.data?.error || err.response?.data?.details || 'Failed to submit folder');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || !folderId}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:bg-gray-400"
            >
              <Send className="w-5 h-5 mr-2" />
              {loading ? 'Submitting...' : 'Submit Folder for Review'}
            </button>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">This section is under development</p>
          </div>
        );
    }
  };

  if (!allocation && !isEditMode) {
    return null;
  }

  return (
    <DashboardLayout
      {...layoutProps}
      title={isEditMode ? "Edit Course Folder" : "Create Course Folder"}
    >
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white rounded-lg shadow-sm p-4 h-fit sticky top-4">
          <h3 className="font-semibold text-gray-800 mb-4">Wizard Steps</h3>
          <nav className="space-y-2">
            {steps.map((step) => (
              <button
                key={step.key}
                onClick={() => setCurrentStep(step.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentStep === step.key
                    ? 'bg-slate-50 text-slate-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center">
                  {step.completed ? (
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 mr-2" />
                  )}
                  {step.label}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-lg shadow-sm p-6">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {renderStepContent()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FolderCreationWizard;
