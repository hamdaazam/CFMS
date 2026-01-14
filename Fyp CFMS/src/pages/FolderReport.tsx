import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { FileText, Download, Loader } from 'lucide-react';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { useReviewMode } from '../hooks/useReviewMode';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

const FolderReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [courseData, setCourseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchCourseData();
  }, [id]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const response = await courseFoldersAPI.getBasic(Number(id));
      setCourseData(response.data);
      setStatus((response.data?.status || '').toUpperCase());
    } catch (error) {
      console.error('Error fetching course data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDFReport = async () => {
    setGenerating(true);

    try {
      // Call the backend API to generate the complete merged PDF
      const response = await courseFoldersAPI.generateFolderReport(Number(id));

      if (response.data?.url) {
        // Download the PDF
        window.open(response.data.url, '_blank');

        alert(`Complete folder report generated successfully!\n\nSections included: ${response.data.total_sections}\n\n${response.data.message}`);
      } else {
        alert('PDF generated but download URL not available. Please refresh and check your folder.');
      }

      setGenerating(false);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      const errorMessage = error?.response?.data?.error || 'Error generating PDF report. Please try again.';
      alert(errorMessage);
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout userRole="faculty">
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  const idForNav = Number(id);

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <FolderContentsNav basePath={basePath} folderId={idForNav} />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 md:px-6 pb-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Complete Course Folder Report</h1>
              <p className="text-gray-600 mt-1">
                Generate a comprehensive PDF report with all course content and uploaded files
              </p>
            </div>
            <FileText className="w-12 h-12 text-indigo-600" />
          </div>

          {courseData && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Course Code</p>
                <p className="font-semibold text-gray-900">{courseData.course_code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Course Title</p>
                <p className="font-semibold text-gray-900">{courseData.course_title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Department</p>
                <p className="font-semibold text-gray-900">{courseData.department_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Program</p>
                <p className="font-semibold text-gray-900">{courseData.program_name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Report Contents Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What's Included</h2>
          <p className="text-sm text-gray-600 mb-4">
            This comprehensive report includes both generated content and all uploaded PDF documents:
          </p>
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-green-600 rounded-full mt-2 mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">Generated Pages</p>
                <p className="text-sm text-gray-600">Title page, course outline, course log tables, assessment summary</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">Attendance Records</p>
                <p className="text-sm text-gray-600">All uploaded attendance sheets from course logs</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">Assignment Materials</p>
                <p className="text-sm text-gray-600">Question papers, model solutions, and sample scripts for all assignments</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-pink-600 rounded-full mt-2 mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">Quiz Materials</p>
                <p className="text-sm text-gray-600">Question papers, model solutions, and sample scripts for all quizzes</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">Midterm & Final Exam Materials</p>
                <p className="text-sm text-gray-600">Question papers, model solutions, and sample scripts</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 mr-3"></div>
              <div>
                <p className="font-medium text-gray-900">Other Documents</p>
                <p className="text-sm text-gray-600">Course outline PDFs, reference books, and other uploaded components</p>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <button
            onClick={generatePDFReport}
            disabled={generating}
            className="w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader className="w-5 h-5 mr-2 animate-spin" />
                Generating Complete Folder Report...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Generate & Download Complete Folder Report
              </>
            )}
          </button>
          <p className="text-sm text-gray-600 mt-3 text-center">
            This will merge all uploaded PDFs with generated content into one comprehensive report
          </p>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => navigate(`${basePath}/folder/${id}/final/records/worst${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 font-medium transition-colors"
          >
            Previous: Final Worst Record
          </button>

          <button
            onClick={() => navigate(`${basePath}/folder/${id}/project-report${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors"
          >
            Next: Project Report
          </button>
        </div>

        {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && (
          <CoordinatorFeedbackBox folderId={Number(id)} section="COURSE_REVIEW_REPORT" />
        )}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && (
          <AuditMemberFeedbackBox folderId={Number(id)} section="COURSE_REVIEW_REPORT" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FolderReport;
