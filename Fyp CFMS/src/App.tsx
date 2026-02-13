import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { RoleBasedRedirect } from './components/common/RoleBasedRedirect';

// Lazy load components for better performance
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
// Lazy load all page components for code splitting
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminProfile = lazy(() => import('./pages/AdminProfile').then(m => ({ default: m.AdminProfile })));
const AdminApprovedFolders = lazy(() => import('./pages/AdminApprovedFolders').then(m => ({ default: m.AdminApprovedFolders })));
const CreateTerm = lazy(() => import('./pages/CreateTerm').then(m => ({ default: m.CreateTerm })));
const ViewPreviousTerm = lazy(() => import('./pages/ViewPreviousTerm').then(m => ({ default: m.ViewPreviousTerm })));
const ViewCreatedTerms = lazy(() => import('./pages/ViewCreatedTerms').then(m => ({ default: m.ViewCreatedTerms })));
const EditTerm = lazy(() => import('./pages/EditTerm').then(m => ({ default: m.EditTerm })));
const ViewTermDetails = lazy(() => import('./pages/ViewTermDetails').then(m => ({ default: m.ViewTermDetails })));
const FacultyManagement = lazy(() => import('./pages/FacultyManagement').then(m => ({ default: m.FacultyManagement })));
const ManageFaculty = lazy(() => import('./pages/ManageFaculty').then(m => ({ default: m.ManageFaculty })));
const EditFaculty = lazy(() => import('./pages/EditFaculty').then(m => ({ default: m.EditFaculty })));
const CourseAllocation = lazy(() => import('./pages/CourseAllocation').then(m => ({ default: m.CourseAllocation })));
const AdminPendingRoleRequests = lazy(() => import('./pages/AdminPendingRoleRequests').then(m => ({ default: m.AdminPendingRoleRequests })));
const ViewCourses = lazy(() => import('./pages/ViewCourses').then(m => ({ default: m.ViewCourses })));
const EditCourse = lazy(() => import('./pages/EditCourse').then(m => ({ default: m.EditCourse })));
const ViewAllocations = lazy(() => import('./pages/ViewAllocations').then(m => ({ default: m.ViewAllocations })));
const Program = lazy(() => import('./pages/Program').then(m => ({ default: m.Program })));
const ViewPrograms = lazy(() => import('./pages/ViewPrograms').then(m => ({ default: m.ViewPrograms })));
const EditProgram = lazy(() => import('./pages/EditProgram').then(m => ({ default: m.EditProgram })));
const Department = lazy(() => import('./pages/Department').then(m => ({ default: m.Department })));
const ViewDepartments = lazy(() => import('./pages/ViewDepartments').then(m => ({ default: m.ViewDepartments })));
const ViewDepartmentDescription = lazy(() => import('./pages/ViewDepartmentDescription').then(m => ({ default: m.ViewDepartmentDescription })));
const FacultyProfile = lazy(() => import('./pages/FacultyProfile').then(m => ({ default: m.FacultyProfile })));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard').then(m => ({ default: m.FacultyDashboard })));
const CoordinatorProfile = lazy(() => import('./pages/CoordinatorProfile').then(m => ({ default: m.CoordinatorProfile })));
const CoordinatorDashboard = lazy(() => import('./pages/CoordinatorDashboard').then(m => ({ default: m.CoordinatorDashboard })));
const CoordinatorReview = lazy(() => import('./pages/CoordinatorReview'));
const AuditTeamProfile = lazy(() => import('./pages/AuditTeamProfile').then(m => ({ default: m.AuditTeamProfile })));
const AuditTeamDashboard = lazy(() => import('./pages/AuditTeamDashboard').then(m => ({ default: m.AuditTeamDashboard })));
const AuditTeamAssignedFolders = lazy(() => import('./pages/AuditTeamAssignedFolders').then(m => ({ default: m.AuditTeamAssignedFolders })));
const AuditMemberReports = lazy(() => import('./pages/AuditMemberReports'));
const ConvenerDashboard = lazy(() => import('./pages/ConvenerDashboard').then(m => ({ default: m.ConvenerDashboard })));
const ConvenerAuditAssignment = lazy(() => import('./pages/ConvenerAuditAssignment'));
const ConvenerReviewAudits = lazy(() => import('./pages/ConvenerReviewAudits'));
const ConvenerProfile = lazy(() => import('./pages/ConvenerProfile'));
const ConvenerAuditTeam = lazy(() => import('./pages/ConvenerAuditTeam'));
const ConvenerManageAuditMembers = lazy(() => import('./pages/ConvenerManageAuditMembers'));
const AuditReviewForm = lazy(() => import('./pages/AuditReviewForm').then(m => ({ default: m.AuditReviewForm })));
const HODDashboard = lazy(() => import('./pages/HODDashboard').then(m => ({ default: m.HODDashboard })));
const HODProfile = lazy(() => import('./pages/HODProfile'));
const HODCompletedFolders = lazy(() => import('./pages/HODCompletedFolders').then(m => ({ default: m.HODCompletedFolders })));
const HODPendingFolders = lazy(() => import('./pages/HODPendingFolders').then(m => ({ default: m.HODPendingFolders })));
const HODSubmittedFolders = lazy(() => import('./pages/HODSubmittedFolders').then(m => ({ default: m.HODSubmittedFolders })));
const HODReviewFolders = lazy(() => import('./pages/HODReviewFolders').then(m => ({ default: m.HODReviewFolders })));
const HODReviewedFolders = lazy(() => import('./pages/HODReviewedFolders').then(m => ({ default: m.HODReviewedFolders })));
const HODNotifications = lazy(() => import('./pages/HODNotifications').then(m => ({ default: m.HODNotifications })));
const HODApprovals = lazy(() => import('./pages/HODApprovals'));
const HODRoleRequests = lazy(() => import('./pages/HODRoleRequests'));
const HODFolderDecision = lazy(() => import('./pages/HODFolderDecision').then(m => ({ default: m.HODFolderDecision })));
const Unauthorized = lazy(() => import('./pages/Unauthorized').then(m => ({ default: m.Unauthorized })));
const CoordinatorNotifications = lazy(() => import('./pages/CoordinatorNotifications').then(m => ({ default: m.CoordinatorNotifications })));
const ConvenerNotifications = lazy(() => import('./pages/ConvenerNotifications').then(m => ({ default: m.ConvenerNotifications })));
const AuditMemberNotifications = lazy(() => import('./pages/AuditMemberNotifications').then(m => ({ default: m.AuditMemberNotifications })));
const AdminNotifications = lazy(() => import('./pages/AdminNotifications').then(m => ({ default: m.AdminNotifications })));
const FacultyCourses = lazy(() => import('./pages/FacultyCourses').then(m => ({ default: m.FacultyCourses })));
const FacultyCompletedFolder = lazy(() => import('./pages/FacultyCompletedFolder').then(m => ({ default: m.FacultyCompletedFolder })));
const FacultyPendingFolder = lazy(() => import('./pages/FacultyPendingFolder').then(m => ({ default: m.FacultyPendingFolder })));
const FacultySubmittedFolder = lazy(() => import('./pages/FacultySubmittedFolder').then(m => ({ default: m.FacultySubmittedFolder })));
const FacultyNotifications = lazy(() => import('./pages/FacultyNotifications').then(m => ({ default: m.FacultyNotifications })));
const CreateCourseFolder = lazy(() => import('./pages/CreateCourseFolder'));
const MyFolders = lazy(() => import('./pages/MyFolders'));
const FolderCreationWizard = lazy(() => import('./pages/FolderCreationWizard'));
const FolderDetailsView = lazy(() => import('./pages/FolderDetailsView'));
const FolderCoordinatorFeedback = lazy(() => import('./pages/FolderCoordinatorFeedback'));
const AuditReportViewer = lazy(() => import('./pages/AuditReportViewer'));
const FolderSectionPage = lazy(() => import('./pages/FolderSectionPage'));
const FolderTitlePage = lazy(() => import('./pages/FolderTitlePage'));
const FolderCourseOutline = lazy(() => import('./pages/FolderCourseOutline'));
const FolderCourseLog = lazy(() => import('./pages/FolderCourseLog'));
const FolderAttendance = lazy(() => import('./pages/FolderAttendance'));
const FolderLectureNotes = lazy(() => import('./pages/FolderLectureNotes'));
const FolderAssignments = lazy(() => import('./pages/FolderAssignments'));
const FolderAssignmentQuestionPaper = lazy(() => import('./pages/FolderAssignmentQuestionPaper'));
const FolderAssignmentModelSolution = lazy(() => import('./pages/FolderAssignmentModelSolution'));
const FolderAssignmentRecordBest = lazy(() => import('./pages/FolderAssignmentRecordBest'));
const FolderAssignmentRecordAverage = lazy(() => import('./pages/FolderAssignmentRecordAverage'));
const FolderAssignmentRecordWorst = lazy(() => import('./pages/FolderAssignmentRecordWorst'));
const FolderAssignmentRecordsOverview = lazy(() => import('./pages/FolderAssignmentRecordsOverview'));
const FolderQuizzes = lazy(() => import('./pages/FolderQuizzes'));
const FolderQuizQuestionPaper = lazy(() => import('./pages/FolderQuizQuestionPaper'));
const FolderQuizModelSolution = lazy(() => import('./pages/FolderQuizModelSolution'));
const FolderQuizRecordBest = lazy(() => import('./pages/FolderQuizRecordBest'));
const FolderQuizRecordAverage = lazy(() => import('./pages/FolderQuizRecordAverage'));
const FolderQuizRecordWorst = lazy(() => import('./pages/FolderQuizRecordWorst'));
const FolderQuizRecordsOverview = lazy(() => import('./pages/FolderQuizRecordsOverview'));
const FolderMidtermQuestionPaper = lazy(() => import('./pages/FolderMidtermQuestionPaper'));
const FolderMidtermModelSolution = lazy(() => import('./pages/FolderMidtermModelSolution'));
const FolderMidtermRecordBest = lazy(() => import('./pages/FolderMidtermRecordBest'));
const FolderMidtermRecordAverage = lazy(() => import('./pages/FolderMidtermRecordAverage'));
const FolderMidtermRecordWorst = lazy(() => import('./pages/FolderMidtermRecordWorst'));
const FolderFinalQuestionPaper = lazy(() => import('./pages/FolderFinalQuestionPaper'));
const FolderFinalModelSolution = lazy(() => import('./pages/FolderFinalModelSolution'));
const FolderFinalRecordBest = lazy(() => import('./pages/FolderFinalRecordBest'));
const FolderFinalRecordAverage = lazy(() => import('./pages/FolderFinalRecordAverage'));
const FolderFinalRecordWorst = lazy(() => import('./pages/FolderFinalRecordWorst'));
const FolderProjectReport = lazy(() => import('./pages/FolderProjectReport'));
const FolderCourseResult = lazy(() => import('./pages/FolderCourseResult'));
const FolderCloAssessment = lazy(() => import('./pages/FolderCloAssessment'));
const CoordinatorFolderDecision = lazy(() => import('./pages/CoordinatorFolderDecision'));
const FolderSubmit = lazy(() => import('./pages/FolderSubmit'));
const FolderReport = lazy(() => import('./pages/FolderReport'));
const FolderReviewReport = lazy(() => import('./pages/FolderReviewReport'));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
          {/* Root route - redirects based on user role */}
          <Route path="/" element={<RoleBasedRedirect />} />

          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/profile" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminProfile />
            </ProtectedRoute>
          } />

          {/* Legacy Dashboard Route (for backward compatibility) - redirects based on role */}
          <Route path="/dashboard" element={<RoleBasedRedirect />} />
          <Route path="/profile" element={<RoleBasedRedirect />} />

          {/* Term Management Routes - Admin Only */}
          <Route path="/terms" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CreateTerm />
            </ProtectedRoute>
          } />
          <Route path="/terms/create" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CreateTerm />
            </ProtectedRoute>
          } />
          <Route path="/terms/previous" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ViewPreviousTerm />
            </ProtectedRoute>
          } />
          <Route path="/terms/view" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ViewCreatedTerms />
            </ProtectedRoute>
          } />
          <Route path="/terms/:id" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ViewTermDetails />
            </ProtectedRoute>
          } />
          <Route path="/terms/edit" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <EditTerm />
            </ProtectedRoute>
          } />
          <Route path="/terms/edit/:id" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <EditTerm />
            </ProtectedRoute>
          } />

          {/* Course and Faculty Management - Admin Only */}
          <Route path="/course-allocation" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CourseAllocation />
            </ProtectedRoute>
          } />
          <Route path="/courses/allocate" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CourseAllocation />
            </ProtectedRoute>
          } />
          <Route path="/courses/view" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ViewCourses />
            </ProtectedRoute>
          } />
          <Route path="/courses/allocations" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ViewAllocations />
            </ProtectedRoute>
          } />
          <Route path="/admin/approved-folders" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminApprovedFolders />
            </ProtectedRoute>
          } />
          <Route path="/courses/edit/:id" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <EditCourse />
            </ProtectedRoute>
          } />
          <Route path="/faculty-management" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <FacultyManagement />
            </ProtectedRoute>
          } />
          <Route path="/faculty-management/manage" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ManageFaculty />
            </ProtectedRoute>
          } />
          <Route path="/faculty-management/pending" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminPendingRoleRequests />
            </ProtectedRoute>
          } />
          <Route path="/faculty-management/edit/:id" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <EditFaculty />
            </ProtectedRoute>
          } />

          {/* Department Management - Admin Only */}
          <Route path="/department" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Department />
            </ProtectedRoute>
          } />
          <Route path="/department/view" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ViewDepartments />
            </ProtectedRoute>
          } />
          <Route path="/department/description/:id" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ViewDepartmentDescription />
            </ProtectedRoute>
          } />

          {/* Program Management - Admin Only */}
          <Route path="/program" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Program />
            </ProtectedRoute>
          } />
          <Route path="/program/view" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ViewPrograms />
            </ProtectedRoute>
          } />
          <Route path="/program/edit/:id" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <EditProgram />
            </ProtectedRoute>
          } />

          {/* Supervisor Routes */}
          <Route path="/supervisor/profile" element={
            <ProtectedRoute allowedRoles={['SUPERVISOR']}>
              <FacultyProfile />
            </ProtectedRoute>
          } />
          <Route path="/supervisor/dashboard" element={
            <ProtectedRoute allowedRoles={['SUPERVISOR']}>
              <FacultyDashboard />
            </ProtectedRoute>
          } />

          {/* Faculty Routes (General Faculty Members) */}
          <Route path="/faculty/profile" element={
            <ProtectedRoute allowedRoles={['FACULTY', 'AUDIT_MEMBER']}>
              <FacultyProfile />
            </ProtectedRoute>
          } />
          <Route path="/faculty/dashboard" element={
            <ProtectedRoute allowedRoles={['FACULTY', 'AUDIT_MEMBER']}>
              <FacultyDashboard />
            </ProtectedRoute>
          } />
          <Route path="/faculty/courses" element={
            <ProtectedRoute allowedRoles={['FACULTY', 'AUDIT_MEMBER']}>
              <FacultyCourses />
            </ProtectedRoute>
          } />
          <Route path="/faculty/create-folder" element={
            <ProtectedRoute allowedRoles={['FACULTY', 'AUDIT_MEMBER']}>
              <CreateCourseFolder />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folders" element={
            <ProtectedRoute allowedRoles={['FACULTY', 'AUDIT_MEMBER']}>
              <MyFolders />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folders/create/:allocationId" element={
            <ProtectedRoute allowedRoles={['FACULTY', 'AUDIT_MEMBER']}>
              <FolderCreationWizard />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folders/:folderId/edit" element={
            <ProtectedRoute allowedRoles={['FACULTY', 'AUDIT_MEMBER']}>
              <FolderCreationWizard />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folders/:folderId" element={
            <ProtectedRoute allowedRoles={['FACULTY', 'AUDIT_MEMBER']}>
              <FolderDetailsView />
            </ProtectedRoute>
          } />
          <Route path="/faculty/completed-folder" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FacultyCompletedFolder />
            </ProtectedRoute>
          } />
          <Route path="/faculty/pending-folder" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FacultyPendingFolder />
            </ProtectedRoute>
          } />
          <Route path="/faculty/accepted-folder" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FacultySubmittedFolder />
            </ProtectedRoute>
          } />
          {/* Specific folder section routes */}
          <Route path="/faculty/folder/:folderId/feedback" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderCoordinatorFeedback />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/title-page" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderTitlePage />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/course-outline" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderCourseOutline />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/course-log" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderCourseLog />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/attendance" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderAttendance />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/lecture-notes" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderLectureNotes />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/assignments/task" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderAssignments />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/assignments/:assignmentId/question-paper" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderAssignmentQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/assignments/:assignmentId/model-solution" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderAssignmentModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/assignments/:assignmentId/records/best" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderAssignmentRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/assignments/:assignmentId/records/average" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderAssignmentRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/assignments/:assignmentId/records/worst" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderAssignmentRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/assignments/:assignmentId/records" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderAssignmentRecordsOverview />
            </ProtectedRoute>
          } />

          {/* Quiz Routes */}
          <Route path="/faculty/folder/:folderId/quizzes" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderQuizzes />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/quizzes/:quizId/question-paper" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderQuizQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/quizzes/:quizId/model-solution" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderQuizModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/quizzes/:quizId/records/best" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderQuizRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/quizzes/:quizId/records/average" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderQuizRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/quizzes/:quizId/records/worst" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderQuizRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/quizzes/:quizId/records" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderQuizRecordsOverview />
            </ProtectedRoute>
          } />

          {/* Midterm Routes */}
          <Route path="/faculty/folder/:folderId/midterm/question-paper" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderMidtermQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/midterm/model-solution" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderMidtermModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/midterm/records/best" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderMidtermRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/midterm/records/average" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderMidtermRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/midterm/records/worst" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderMidtermRecordWorst />
            </ProtectedRoute>
          } />

          {/* Final Routes */}
          <Route path="/faculty/folder/:folderId/final/question-paper" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderFinalQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/final/model-solution" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderFinalModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/final/records/best" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderFinalRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/final/records/average" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderFinalRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/final/records/worst" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderFinalRecordWorst />
            </ProtectedRoute>
          } />

          {/* Project Report & Course Result */}
          <Route path="/faculty/folder/:id/project-report" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderProjectReport />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/course-result" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderCourseResult />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/folder-review-report" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderReviewReport />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/clo-assessment" element={
            <ProtectedRoute allowedRoles={["FACULTY"]}>
              <FolderCloAssessment />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/submit" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderSubmit />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:id/report" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderReport />
            </ProtectedRoute>
          } />

          {/* Generic folder section pages (placeholders until detailed pages are implemented) */}
          <Route path="/faculty/folder/:folderId/:section" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderSectionPage />
            </ProtectedRoute>
          } />
          <Route path="/faculty/folder/:folderId/:section/:subsection" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FolderSectionPage />
            </ProtectedRoute>
          } />
          <Route path="/faculty/notifications" element={
            <ProtectedRoute allowedRoles={['FACULTY']}>
              <FacultyNotifications />
            </ProtectedRoute>
          } />
          <Route path="/evaluator/notifications" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <FacultyNotifications />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/notifications" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <AuditMemberNotifications />
            </ProtectedRoute>
          } />
          <Route path="/convener/notifications" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <ConvenerNotifications />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/notifications" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <CoordinatorNotifications />
            </ProtectedRoute>
          } />
          <Route path="/admin/notifications" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminNotifications />
            </ProtectedRoute>
          } />
          <Route path="/hod/notifications" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODNotifications />
            </ProtectedRoute>
          } />

          {/* Unauthorized Route */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Course Coordinator Routes */}
          <Route path="/coordinator/profile" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <CoordinatorProfile />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/dashboard" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <CoordinatorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/courses" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <FacultyCourses />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/create-folder" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <CreateCourseFolder />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folders" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <MyFolders />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folders/create/:allocationId" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <FolderCreationWizard />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folders/:folderId/edit" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <FolderCreationWizard />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/review" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <CoordinatorReview />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folders/:folderId" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <FolderDetailsView />
            </ProtectedRoute>
          } />
          {/* Coordinator-specific folder section routes (read-only views with feedback inputs) */}
          {/* Allow HOD and CONVENER to access these routes when they are coordinators */}
          <Route path="/coordinator/folder/:folderId/title-page" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderTitlePage />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/course-outline" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderCourseOutline />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/course-log" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderCourseLog />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/attendance" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderAttendance />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/lecture-notes" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderLectureNotes />
            </ProtectedRoute>
          } />
          {/* Assignments */}
          <Route path="/coordinator/folder/:folderId/assignments/task" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderAssignments />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/assignments/:assignmentId/question-paper" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderAssignmentQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/assignments/:assignmentId/model-solution" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderAssignmentModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/assignments/:assignmentId/records/best" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderAssignmentRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/assignments/:assignmentId/records/average" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderAssignmentRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/assignments/:assignmentId/records/worst" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderAssignmentRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/assignments/:assignmentId/records" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderAssignmentRecordsOverview />
            </ProtectedRoute>
          } />
          {/* Quizzes */}
          <Route path="/coordinator/folder/:folderId/quizzes" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderQuizzes />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/quizzes/:quizId/question-paper" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderQuizQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/quizzes/:quizId/model-solution" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderQuizModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/quizzes/:quizId/records/best" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderQuizRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/quizzes/:quizId/records/average" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderQuizRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/quizzes/:quizId/records/worst" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderQuizRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/quizzes/:quizId/records" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderQuizRecordsOverview />
            </ProtectedRoute>
          } />
          {/* Midterm */}
          <Route path="/coordinator/folder/:folderId/midterm/question-paper" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderMidtermQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/midterm/model-solution" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderMidtermModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/midterm/records/best" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderMidtermRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/midterm/records/average" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderMidtermRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/midterm/records/worst" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderMidtermRecordWorst />
            </ProtectedRoute>
          } />
          {/* Final */}
          <Route path="/coordinator/folder/:folderId/final/question-paper" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderFinalQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:folderId/final/model-solution" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderFinalModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/final/records/best" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderFinalRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/final/records/average" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderFinalRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/final/records/worst" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderFinalRecordWorst />
            </ProtectedRoute>
          } />
          {/* Project Report & Course Result */}
          <Route path="/coordinator/folder/:id/project-report" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderProjectReport />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/course-result" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderCourseResult />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/folder-review-report" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderReviewReport />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/clo-assessment" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderCloAssessment />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/submit" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderSubmit />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/report" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <FolderReport />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/decision" element={
            <ProtectedRoute allowedRoles={['COORDINATOR', 'HOD', 'CONVENER']}>
              <CoordinatorFolderDecision />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/folder/:id/feedback" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <FolderCoordinatorFeedback />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/pending-folder" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <FacultyPendingFolder />
            </ProtectedRoute>
          } />
          <Route path="/coordinator/accepted-folder" element={
            <ProtectedRoute allowedRoles={['COORDINATOR']}>
              <FacultySubmittedFolder />
            </ProtectedRoute>
          } />

          {/* Auditor Routes (Evaluator + Audit Team + Audit Member) */}
          <Route path="/evaluator/profile" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <AuditTeamProfile />
            </ProtectedRoute>
          } />
          <Route path="/evaluator/dashboard" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <AuditTeamDashboard />
            </ProtectedRoute>
          } />
          <Route path="/evaluator/assigned-folders" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <AuditTeamAssignedFolders />
            </ProtectedRoute>
          } />
          <Route path="/evaluator/folders/:folderId/review" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <AuditReviewForm />
            </ProtectedRoute>
          } />

          {/* Distinct Audit Member Routes */}
          <Route path="/audit-member/profile" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <AuditTeamProfile />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/dashboard" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <AuditTeamDashboard />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/assigned-folders" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <AuditTeamAssignedFolders />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/reports" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <AuditMemberReports />
            </ProtectedRoute>
          } />

          {/* Audit Member Folder View Routes (read-only) */}
          <Route path="/audit-member/folder/:folderId/title-page" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderTitlePage />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/course-outline" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderCourseOutline />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/course-log" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderCourseLog />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/attendance" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderAttendance />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/lecture-notes" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderLectureNotes />
            </ProtectedRoute>
          } />
          {/* Assignments */}
          <Route path="/audit-member/folder/:folderId/assignments/task" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderAssignments />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/assignments/:assignmentId/question-paper" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderAssignmentQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/assignments/:assignmentId/model-solution" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderAssignmentModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/assignments/:assignmentId/records/best" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderAssignmentRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/assignments/:assignmentId/records/average" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderAssignmentRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/assignments/:assignmentId/records/worst" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderAssignmentRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/assignments/:assignmentId/records" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderAssignmentRecordsOverview />
            </ProtectedRoute>
          } />
          {/* Quizzes */}
          <Route path="/audit-member/folder/:folderId/quizzes" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderQuizzes />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/quizzes/:quizId/question-paper" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderQuizQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/quizzes/:quizId/model-solution" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderQuizModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/quizzes/:quizId/records/best" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderQuizRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/quizzes/:quizId/records/average" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderQuizRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/quizzes/:quizId/records/worst" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderQuizRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/quizzes/:quizId/records" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderQuizRecordsOverview />
            </ProtectedRoute>
          } />
          {/* Midterm */}
          <Route path="/audit-member/folder/:folderId/midterm/question-paper" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderMidtermQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/midterm/model-solution" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderMidtermModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/midterm/records/best" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderMidtermRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/midterm/records/average" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderMidtermRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/midterm/records/worst" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderMidtermRecordWorst />
            </ProtectedRoute>
          } />
          {/* Final */}
          <Route path="/audit-member/folder/:folderId/final/question-paper" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderFinalQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:folderId/final/model-solution" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderFinalModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/final/records/best" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderFinalRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/final/records/average" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderFinalRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/final/records/worst" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderFinalRecordWorst />
            </ProtectedRoute>
          } />
          {/* Audit member - readonly access to project/course/clo uploads */}
          <Route path="/audit-member/folder/:id/report" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderReport />
            </ProtectedRoute>
          } />

          <Route path="/audit-member/folder/:id/project-report" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderProjectReport />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/course-result" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderCourseResult />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/folder-review-report" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderReviewReport />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/clo-assessment" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderCloAssessment />
            </ProtectedRoute>
          } />
          {/* Evaluator / Audit Team read-only access to project/course/clo uploads */}
          <Route path="/evaluator/folder/:id/project-report" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <FolderProjectReport />
            </ProtectedRoute>
          } />
          <Route path="/evaluator/folder/:id/course-result" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <FolderCourseResult />
            </ProtectedRoute>
          } />
          <Route path="/evaluator/folder/:id/folder-review-report" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <FolderReviewReport />
            </ProtectedRoute>
          } />
          <Route path="/evaluator/folder/:id/clo-assessment" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <FolderCloAssessment />
            </ProtectedRoute>
          } />
          {/* Project Report & Course Result */}
          <Route path="/audit-member/folder/:id/project-report" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderProjectReport />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/course-result" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderCourseResult />
            </ProtectedRoute>
          } />
          <Route path="/audit-member/folder/:id/submit" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <FolderSubmit />
            </ProtectedRoute>
          } />

          {/* Course Feedback (Rating) Route */}
          <Route path="/audit-member/folders/:folderId/review" element={
            <ProtectedRoute allowedRoles={['AUDIT_MEMBER']}>
              <AuditReviewForm />
            </ProtectedRoute>
          } />

          {/* Legacy Audit Routes (backward compatibility) */}
          <Route path="/audit/profile" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <AuditTeamProfile />
            </ProtectedRoute>
          } />
          <Route path="/audit/dashboard" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <AuditTeamDashboard />
            </ProtectedRoute>
          } />
          <Route path="/audit/assigned-folders" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <AuditTeamAssignedFolders />
            </ProtectedRoute>
          } />
          <Route path="/audit/folders/:folderId/review" element={
            <ProtectedRoute allowedRoles={['EVALUATOR', 'AUDIT_TEAM', 'AUDIT_MEMBER']}>
              <AuditReviewForm />
            </ProtectedRoute>
          } />

          {/* Convener Routes */}
          <Route path="/convener/dashboard" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <ConvenerDashboard />
            </ProtectedRoute>
          } />
          {/* New convener routes */}
          <Route path="/convener/audit-members" element={
            <ProtectedRoute allowedRoles={['CONVENER', 'ADMIN']}>
              <ConvenerAuditTeam />
            </ProtectedRoute>
          } />
          <Route path="/convener/audit-members/manage" element={
            <ProtectedRoute allowedRoles={['CONVENER', 'ADMIN']}>
              <ConvenerManageAuditMembers />
            </ProtectedRoute>
          } />
          <Route path="/convener/profile" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <ConvenerProfile />
            </ProtectedRoute>
          } />
          <Route path="/convener/assign-courses" element={
            <ProtectedRoute allowedRoles={['CONVENER', 'ADMIN']}>
              <ConvenerAuditAssignment />
            </ProtectedRoute>
          } />

          {/* Convener Teaching - Folder List Pages */}
          <Route path="/convener/pending-folder" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FacultyPendingFolder />
            </ProtectedRoute>
          } />
          <Route path="/convener/completed-folder" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FacultyCompletedFolder />
            </ProtectedRoute>
          } />
          <Route path="/convener/submitted-folder" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FacultySubmittedFolder />
            </ProtectedRoute>
          } />
          <Route path="/convener/accepted-folder" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FacultySubmittedFolder />
            </ProtectedRoute>
          } />
          <Route path="/convener/create-folder" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <CreateCourseFolder />
            </ProtectedRoute>
          } />
          <Route path="/convener/folders" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <MyFolders />
            </ProtectedRoute>
          } />
          <Route path="/convener/folders/create/:allocationId" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderCreationWizard />
            </ProtectedRoute>
          } />
          <Route path="/convener/folders/:folderId/edit" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderCreationWizard />
            </ProtectedRoute>
          } />


          {/* Backwards-compat redirects */}
          <Route path="/convener/audit-team" element={<Navigate to="/convener/audit-members" replace />} />
          <Route path="/convener/audit-team/manage" element={<Navigate to="/convener/audit-members/manage" replace />} />
          <Route path="/convener/audit-assignment" element={<Navigate to="/convener/assign-courses" replace />} />
          <Route path="/convener/review-audits" element={
            <ProtectedRoute allowedRoles={['CONVENER', 'ADMIN']}>
              <ConvenerReviewAudits />
            </ProtectedRoute>
          } />
          <Route path="/convener/folders/:folderId/reports" element={
            <ProtectedRoute allowedRoles={['CONVENER', 'ADMIN']}>
              <AuditReportViewer />
            </ProtectedRoute>
          } />

          {/* Convener Teaching Folders Routes (when convener teaches courses) */}
          <Route path="/convener/folder/:id/title-page" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderTitlePage />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/course-outline" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderCourseOutline />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/course-log" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderCourseLog />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/attendance" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderAttendance />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/lecture-notes" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderLectureNotes />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/assignments/task" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderAssignments />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/assignments/:assignmentId/question-paper" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderAssignmentQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/assignments/:assignmentId/model-solution" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderAssignmentModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/assignments/:assignmentId/records" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderAssignmentRecordsOverview />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/assignments/:assignmentId/records/best" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderAssignmentRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/assignments/:assignmentId/records/average" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderAssignmentRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/assignments/:assignmentId/records/worst" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderAssignmentRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/quizzes" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderQuizzes />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/quizzes/:quizId/question-paper" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderQuizQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/quizzes/:quizId/model-solution" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderQuizModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/quizzes/:quizId/records" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderQuizRecordsOverview />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/quizzes/:quizId/records/best" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderQuizRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/quizzes/:quizId/records/average" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderQuizRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/quizzes/:quizId/records/worst" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderQuizRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/midterm/question-paper" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderMidtermQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/midterm/model-solution" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderMidtermModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/midterm/records/best" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderMidtermRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/midterm/records/average" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderMidtermRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/midterm/records/worst" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderMidtermRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/final/question-paper" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderFinalQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/final/model-solution" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderFinalModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/final/records/best" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderFinalRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/final/records/average" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderFinalRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/final/records/worst" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderFinalRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/project-report" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderProjectReport />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/course-result" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderCourseResult />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/folder-review-report" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderReviewReport />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/clo-assessment" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderCloAssessment />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/report" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderReport />
            </ProtectedRoute>
          } />
          {/* Submit route already exists at line 1236 */}
          <Route path="/convener/folder/:id/submit" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderSubmit />
            </ProtectedRoute>
          } />
          <Route path="/convener/folder/:id/feedback" element={
            <ProtectedRoute allowedRoles={['CONVENER']}>
              <FolderCoordinatorFeedback />
            </ProtectedRoute>
          } />

          {/* HOD Routes */}
          <Route path="/hod/dashboard" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODDashboard />
            </ProtectedRoute>
          } />
          <Route path="/hod/profile" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODProfile />
            </ProtectedRoute>
          } />
          <Route path="/hod/courses/completed" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODCompletedFolders />
            </ProtectedRoute>
          } />
          <Route path="/hod/courses/pending" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODPendingFolders />
            </ProtectedRoute>
          } />
          <Route path="/hod/courses/submitted" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODSubmittedFolders />
            </ProtectedRoute>
          } />
          <Route path="/hod/accepted-folder" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FacultySubmittedFolder />
            </ProtectedRoute>
          } />
          <Route path="/hod/review-folders" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODReviewFolders />
            </ProtectedRoute>
          } />
          <Route path="/hod/reviewed-folders" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODReviewedFolders />
            </ProtectedRoute>
          } />
          <Route path="/hod/approvals" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODApprovals />
            </ProtectedRoute>
          } />
          <Route path="/hod/role-requests" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODRoleRequests />
            </ProtectedRoute>
          } />
          <Route path="/hod/notifications" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODNotifications />
            </ProtectedRoute>
          } />
          <Route path="/hod/folders/:folderId/reports" element={
            <ProtectedRoute allowedRoles={['HOD', 'ADMIN']}>
              <AuditReportViewer />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/decision" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <HODFolderDecision />
            </ProtectedRoute>
          } />
          {/* HOD Folder Review Routes (read-only) */}
          <Route path="/hod/folder/:folderId/title-page" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderTitlePage />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/course-outline" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderCourseOutline />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/course-log" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderCourseLog />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/attendance" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderAttendance />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/lecture-notes" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderLectureNotes />
            </ProtectedRoute>
          } />
          {/* Assignments */}
          <Route path="/hod/folder/:folderId/assignments/task" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderAssignments />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/assignments/:assignmentId/question-paper" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderAssignmentQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/assignments/:assignmentId/model-solution" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderAssignmentModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/assignments/:assignmentId/records/best" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderAssignmentRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/assignments/:assignmentId/records/average" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderAssignmentRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/assignments/:assignmentId/records/worst" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderAssignmentRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/assignments/:assignmentId/records" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderAssignmentRecordsOverview />
            </ProtectedRoute>
          } />

          {/* Quizzes */}
          <Route path="/hod/folder/:folderId/quizzes" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderQuizzes />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/quizzes/:quizId/question-paper" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderQuizQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/quizzes/:quizId/model-solution" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderQuizModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/quizzes/:quizId/records/best" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderQuizRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/quizzes/:quizId/records/average" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderQuizRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/quizzes/:quizId/records/worst" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderQuizRecordWorst />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/quizzes/:quizId/records" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderQuizRecordsOverview />
            </ProtectedRoute>
          } />

          {/* Midterm */}
          <Route path="/hod/folder/:folderId/midterm/question-paper" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderMidtermQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/midterm/model-solution" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderMidtermModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/midterm/records/best" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderMidtermRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/midterm/records/average" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderMidtermRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/midterm/records/worst" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderMidtermRecordWorst />
            </ProtectedRoute>
          } />

          {/* Final */}
          <Route path="/hod/folder/:folderId/final/question-paper" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderFinalQuestionPaper />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/final/model-solution" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderFinalModelSolution />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/final/records/best" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderFinalRecordBest />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/final/records/average" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderFinalRecordAverage />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/final/records/worst" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderFinalRecordWorst />
            </ProtectedRoute>
          } />

          {/* Project report & Course result */}
          <Route path="/hod/folder/:folderId/project-report" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderProjectReport />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/course-result" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderCourseResult />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/folder-review-report" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderReviewReport />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:id/clo-assessment" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderCloAssessment />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:id/report" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderReport />
            </ProtectedRoute>
          } />
          <Route path="/hod/folder/:folderId/submit" element={
            <ProtectedRoute allowedRoles={['HOD']}>
              <FolderSubmit />
            </ProtectedRoute>
          } />

          {/* Student Routes */}
          <Route path="/student/dashboard" element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <div>Student Dashboard - Coming Soon</div>
            </ProtectedRoute>
          } />
          <Route path="/student/profile" element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <div>Student Profile - Coming Soon</div>
            </ProtectedRoute>
          } />

          <Route path="/logout" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
