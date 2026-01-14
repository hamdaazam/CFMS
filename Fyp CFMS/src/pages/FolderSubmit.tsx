import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { FileCheck, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useReviewMode } from '../hooks/useReviewMode';

const FolderSubmit: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const idParam = params.id ?? params.folderId;
  const navigate = useNavigate();
  const [courseData, setCourseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [completenessIssues, setCompletenessIssues] = useState<string[]>([]);
  const { basePath, isCoordinatorReview, isConvenerReview, isAuditMemberReview, isHodReview } = useReviewMode();

  useEffect(() => {
    fetchCourseData();
  }, [idParam]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const response = await courseFoldersAPI.getBasic(Number(idParam));
      setCourseData(response.data);
    } catch (error) {
      console.error('Error fetching course data:', error);
      setError('Failed to load folder data');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialSubmit = async () => {
    await executeSubmit(false);
  };

  const executeSubmit = async (force: boolean = false) => {
    setSubmitting(true);
    setError(null);
    try {
      // Validation is mandatory - no skip option
      await courseFoldersAPI.submit(Number(idParam));

      alert('Folder submitted successfully! It has been sent to the coordinator for review.');
      window.dispatchEvent(new CustomEvent('foldersUpdated'));
      setTimeout(() => {
        navigate(`${basePath}/dashboard`);
      }, 1000);
    } catch (error: any) {
      console.error('Error submitting folder:', error);
      console.log('Full error response:', error.response);

      setSubmitting(false);

      if (error.response && error.response.data) {
        const data = error.response.data;
        console.log('Error data:', data);

        // Try to extract specific missing items or validation errors
        let missingItems: string[] = [];

        // Check if backend returned a structured missing_items array
        if (data.missing_items && Array.isArray(data.missing_items)) {
          missingItems = data.missing_items;
        }
        // Check if it's a validation error object with field-specific errors
        else if (typeof data === 'object' && !Array.isArray(data)) {
          // Extract all error messages from the object
          Object.entries(data).forEach(([key, value]) => {
            if (key === 'non_field_errors' || key === 'detail' || key === 'error' || key === 'details') {
              if (Array.isArray(value)) {
                missingItems.push(...value.map(String));
              } else {
                missingItems.push(String(value));
              }
            } else {
              const valStr = Array.isArray(value) ? value.join(', ') : String(value);
              missingItems.push(`${key.replace(/_/g, ' ')}: ${valStr}`);
            }
          });
        }
        // If it's just a string message
        else if (typeof data === 'string') {
          missingItems.push(data);
        }
        // If it's an array
        else if (Array.isArray(data)) {
          missingItems = data.map(item => typeof item === 'string' ? item : JSON.stringify(item));
        }

        // If we extracted any specific errors, handle them.
        if (missingItems.length > 0) {
          // If this looks like a hard-block (no course coordinator) show a clear error
          const isCoordinatorError = missingItems.some((it) => /coordinator/i.test(it));
          if (isCoordinatorError) {
            // Prefer server-provided details when available
            const msg = data.details || data.error || missingItems.join('\n');
            setError(String(msg));
            return;
          }

          // Filter out the "Missing Course Outline document" error (we surface others via modal)
          const filteredIssues = missingItems.filter(item => !item.includes('Missing Course Outline document'));

          // Only show modal if there are still issues after filtering
          if (filteredIssues.length > 0) {
            setCompletenessIssues(filteredIssues);
            setShowWarningModal(true);
            return;
          }
        }
      }

      // Fallback: show generic error
      let errorMessage = 'Failed to submit folder. Please try again.';
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') errorMessage = data;
        else if (data.detail) errorMessage = data.detail;
        else if (data.message) errorMessage = data.message;
        else if (data.error) errorMessage = data.error;
      }

      setError(errorMessage);
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

  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isConvenerReview ? 'convener' : isAuditMemberReview ? 'audit' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Submit Course Folder</h1>
              <p className="text-gray-600 mt-1">
                Review and submit your course folder for coordinator approval
              </p>
            </div>
            <FileCheck className="w-12 h-12 text-indigo-600" />
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

        {/* Checklist */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pre-Submission Checklist</h2>
          <div className="space-y-3">
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Course Outline Completed</p>
                <p className="text-sm text-gray-600">Description, objectives, and learning outcomes are filled</p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Course Log Entries Added</p>
                <p className="text-sm text-gray-600">Weekly topics and activities are documented</p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Assessments Documented</p>
                <p className="text-sm text-gray-600">Assignments, quizzes, midterm, and final exam details added</p>
              </div>
            </div>

            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Supporting Documents Uploaded</p>
                <p className="text-sm text-gray-600">Project report and course result files uploaded (if applicable)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">Important Notice</h3>
              <p className="text-sm text-amber-800">
                Once you submit this folder, you will no longer be able to make any edits.
                Please ensure all information is complete and accurate before submitting.
                The folder will be forwarded to the course coordinator for review.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Submission Error</h3>
                <p className="text-sm text-red-800 whitespace-pre-line">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <button
            onClick={handleInitialSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileCheck className="w-5 h-5 mr-2" />
                Submit Folder to Coordinator
              </>
            )}
          </button>
          <p className="text-sm text-gray-600 mt-3 text-center">
            By submitting, you confirm that all information is complete and accurate
          </p>
        </div>
      </div>

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4 text-amber-600">
              <AlertCircle className="w-8 h-8 mr-3" />
              <h3 className="text-xl font-bold">Folder Incomplete</h3>
            </div>

            <p className="text-gray-700 mb-4">
              The following items appear to be missing or incomplete:
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-6 max-h-60 overflow-y-auto">
              <ul className="list-disc list-inside text-sm text-amber-900 space-y-1">
                {completenessIssues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>

            <p className="text-gray-600 text-sm mb-6">
              Please fix these issues before submitting. All required items must be completed.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                Go Back & Fix Issues
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default FolderSubmit;
