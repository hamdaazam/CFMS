import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReviewMode } from '../hooks/useReviewMode';
import { canEditFolder } from '../utils/folderPermissions';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

interface FileRecord {
  fileName: string;
  uploadDate: string;
  fileSize: number;
  fileExists?: boolean; // Track if file actually exists on server
  fileUrl?: string; // Direct URL to the file
}

const FolderCloAssessment: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const idParam = params.id ?? params.folderId;
  const id = Number(idParam);
  const navigate = useNavigate();
  const { basePath, isCoordinatorReview, isAuditMemberReview, isHodReview, isConvenerReview } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [readOnly, setReadOnly] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<FileRecord | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);

  useEffect(() => {
    loadRecord();
  }, [id]);

  const loadRecord = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await courseFoldersAPI.getBasic(id);
      const outlineContent = response.data.outline_content || {};
      const s = (response.data?.status || '').toUpperCase();
      setStatus(s);
      const firstActivityCompleted = response.data?.first_activity_completed || false;
      const canEditForFinalSubmission = response.data?.can_edit_for_final_submission || false;
      // Use utility function to determine if folder can be edited
      const canEdit = canEditFolder(s, firstActivityCompleted, canEditForFinalSubmission, isAuditMemberReview, isConvenerReview, isHodReview);
      setReadOnly(!canEdit);
      
      // Check if metadata exists
      const cloAssessmentMeta = outlineContent.cloAssessment;
      
      // Check if actual file field exists (this is the real file, not just metadata)
      const hasActualFile = !!response.data.clo_assessment_file;
      const fileUrl = response.data.clo_assessment_file; // Store the file URL for direct download
      
      if (cloAssessmentMeta) {
        // If metadata exists but file doesn't, mark it as missing
        if (!hasActualFile) {
          setUploadedFile({
            ...cloAssessmentMeta,
            fileExists: false
          });
          // Only show error if user can edit (not in review mode)
          if (!readOnly && !isReviewContext) {
            setError('File metadata found but file is missing on server. Please re-upload the file.');
          } else {
            // For reviewers, just note that file is missing but don't show as error
            setError(null);
          }
        } else {
          // Both metadata and file exist
          setUploadedFile({
            ...cloAssessmentMeta,
            fileExists: true,
            fileUrl: fileUrl // Store the file URL for direct download
          });
        }
      } else {
        setUploadedFile(null);
      }
    } catch (err) {
      console.error('Error loading CLO assessment:', err);
      setError('Failed to load CLO assessment');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (readOnly) return;
    if (file) {
      // Check file extension and MIME type
      const isPdfExtension = file.name.toLowerCase().endsWith('.pdf');
      const isPdfMimeType = file.type === 'application/pdf' || file.type === '';
      
      if (!isPdfExtension) {
        setError('Please select a PDF file (file must have .pdf extension)');
        return;
      }
      
      // Check file size (20MB max as per backend)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (file.size > maxSize) {
        setError(`File size must not exceed 20MB. Your file is ${formatFileSize(file.size)}`);
        return;
      }
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (readOnly) return;
    if (!selectedFile || !id) return;
    try {
      setSaving(true);
      setError(null);

      // Validate file before upload
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are allowed');
        return;
      }

      const maxSize = 20 * 1024 * 1024; // 20MB
      if (selectedFile.size > maxSize) {
        setError(`File size must not exceed 20MB. Your file is ${formatFileSize(selectedFile.size)}`);
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Upload file to backend
      await courseFoldersAPI.uploadCloAssessment(id, formData);

      // Reload folder data to get updated file info
      await loadRecord();

      setSelectedFile(null);
      setError(null); // Clear any previous errors on success
    } catch (err: any) {
      console.error('Error uploading CLO assessment:', err);
      
      // Extract detailed error message
      let errorMessage = 'Failed to upload file';
      
      if (err.response) {
        // Check for different error response formats
        if (err.response.data) {
          if (typeof err.response.data === 'string') {
            errorMessage = err.response.data;
          } else if (err.response.data.error) {
            errorMessage = err.response.data.error;
          } else if (err.response.data.message) {
            errorMessage = err.response.data.message;
          } else if (err.response.data.detail) {
            errorMessage = err.response.data.detail;
          } else if (Array.isArray(err.response.data) && err.response.data.length > 0) {
            errorMessage = err.response.data[0];
          } else {
            errorMessage = `Upload failed: ${err.response.status} ${err.response.statusText}`;
          }
        } else {
          errorMessage = `Upload failed: ${err.response.status} ${err.response.statusText}`;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (readOnly) return;
    if (!id) return;
    try {
      setSaving(true);
      setError(null);

      // Call the delete API endpoint
      await courseFoldersAPI.deleteCloAssessment(id);

      // Reload to sync state
      await loadRecord();
    } catch (err: any) {
      console.error('Error deleting file:', err);
      setError(err.response?.data?.error || 'Failed to delete file');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!uploadedFile) return;

    // Check if file actually exists before attempting download
    if (uploadedFile.fileExists === false) {
      if (!isReviewContext) {
        setError('File is missing on server. Please re-upload the file.');
      }
      return;
    }

    // Try direct URL download first if available (faster and more reliable)
    if (uploadedFile.fileUrl) {
      try {
        console.log('Attempting direct URL download:', uploadedFile.fileUrl);
        // Make URL absolute if it's relative
        let fileUrl = uploadedFile.fileUrl;
        if (fileUrl && !fileUrl.startsWith('http')) {
          // If it's a relative URL, make it absolute
          const baseUrl = 'http://127.0.0.1:8000';
          fileUrl = fileUrl.startsWith('/') ? `${baseUrl}${fileUrl}` : `${baseUrl}/${fileUrl}`;
        }
        console.log('Using absolute URL:', fileUrl);
        
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = uploadedFile.fileName || 'clo_assessment.pdf';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 100);
        console.log('Direct URL download triggered');
        return;
      } catch (err) {
        console.warn('Direct URL download failed, trying blob method:', err);
        // Fall through to blob method
      }
    }

    try {
      setError(null);
      console.log('Starting blob download for CLO Assessment, folder ID:', id);
      const response = await courseFoldersAPI.downloadCloAssessment(id);
      console.log('Download response received:', response.status, 'Content-Type:', response.headers['content-type']);

      // When using responseType: 'blob', response.data is already a Blob
      if (!(response.data instanceof Blob)) {
        console.error('Response data is not a Blob:', typeof response.data);
        setError('Invalid file format received from server');
        return;
      }

      if (response.data.size === 0) {
        console.error('Blob is empty');
        setError('File is empty or not found');
        return;
      }

      console.log('Creating blob URL, size:', response.data.size, 'type:', response.data.type);
      
      // Create blob URL - use response.data directly since it's already a Blob
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      console.log('Blob URL created:', url);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = uploadedFile.fileName || 'clo_assessment.pdf';
      link.style.display = 'none'; // Hide the link
      document.body.appendChild(link);
      
      console.log('Triggering download for:', link.download);
      
      // Trigger download immediately
      link.click();
      console.log('Download click triggered');
      
      // Clean up after download
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
        console.log('Download cleanup completed');
      }, 1000);
    } catch (err: any) {
      console.error('Error downloading file:', err);
      
      // Try to extract error message from response
      if (err.response) {
        // Check response status
        if (err.response.status === 404) {
          setError('File not found on server. The file may have been deleted or never uploaded.');
          return;
        }

        // Try to extract error message from response data
        if (err.response.data) {
          try {
            // If error response is a blob (because of responseType: 'blob'), convert it to text
            if (err.response.data instanceof Blob) {
              const text = await err.response.data.text();
              try {
                const errorData = JSON.parse(text);
                setError(errorData.error || errorData.message || 'Failed to download file');
              } catch {
                setError(`Failed to download file (HTTP ${err.response.status})`);
              }
            } else if (typeof err.response.data === 'object' && err.response.data !== null) {
              setError(err.response.data.error || err.response.data.message || 'Failed to download file');
            } else {
              setError(`Failed to download file (HTTP ${err.response.status})`);
            }
          } catch (parseErr) {
            setError(`Failed to download file (HTTP ${err.response.status})`);
          }
        } else {
          setError(`Failed to download file (HTTP ${err.response.status})`);
        }
      } else {
        setError(err.message || 'Failed to download file. Please check your connection.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  const idForNav = isNaN(id) ? id : id;
  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <FolderContentsNav basePath={basePath} folderId={idForNav} />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 md:px-6 pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">CLO Assessment</h1>
          <p className="text-gray-600 mt-1">Upload the CLO assessment evidence document</p>
        </div>

        {error && !isReviewContext && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>
        )}
        {uploadedFile && uploadedFile.fileExists === false && isReviewContext && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
            <p className="font-medium">⚠️ File Not Available for Review</p>
            <p className="text-sm mt-1">The file metadata indicates a file was uploaded, but the actual file is missing from the server. This appears to be a data inconsistency issue. The faculty member will need to re-upload the file.</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload CLO Assessment</h2>

          {!uploadedFile ? (
            <div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}`}>
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Drag and drop your PDF file here, or click to browse</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload-clo"
                  disabled={readOnly}
                />
                <label
                  htmlFor="file-upload-clo"
                  className={`inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Choose File
                </label>
                <p className="text-sm text-gray-500 mt-2">PDF files only, max 20MB</p>
              </div>

              {selectedFile && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedFile(null)} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                    <button onClick={handleUpload} disabled={saving} className="px-4 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Uploading...' : 'Upload'}</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`p-4 border rounded-md ${uploadedFile.fileExists === false ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start">
                  <FileText className={`w-5 h-5 mr-3 mt-0.5 ${uploadedFile.fileExists === false ? 'text-yellow-600' : 'text-green-600'}`} />
                  <div>
                    <p className="font-medium text-gray-800">{uploadedFile.fileName}</p>
                    <p className="text-sm text-gray-600 mt-1">Uploaded on {formatDate(uploadedFile.uploadDate)}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(uploadedFile.fileSize)}</p>
                    {uploadedFile.fileExists === false && (
                      <p className="text-xs text-yellow-700 mt-1 font-medium">⚠️ File missing on server - please re-upload</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(uploadedFile.fileExists === true || uploadedFile.fileExists === undefined) && (
                    <button
                      onClick={handleDownload}
                      className="text-indigo-600 hover:text-indigo-700 p-2 cursor-pointer"
                      title="Download file"
                      type="button"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700 disabled:opacity-50"
                      title="Delete file"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <button onClick={() => navigate(`${basePath}/folder/${id}/folder-review-report${isReviewContext ? '?review=1' : ''}`)} className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 font-medium transition-colors">Previous: Course Review Report</button>

          {isCoordinatorReview ? (
            // Coordinator - if they are viewing a folder in coordinator REVIEW mode (query ?review=1)
            // the next page should be the folder decision screen. If they are a coordinator but
            // not in review mode (editor/pending flows) offer the Submit Folder navigation when allowed.
            isReviewContext ? (
              <button onClick={() => navigate(`${basePath}/folder/${id}/decision${isReviewContext ? '?review=1' : ''}`)} className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors">Next: Folder Decision</button>
            ) : (
              // coordinator edit/pending flow: show submit button when editable
              ((!readOnly) || (isConvenerReview && status && !new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']).has(status))) && (
                <button onClick={() => navigate(`${basePath}/folder/${id}/submit${isReviewContext ? '?review=1' : ''}`)} className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors">Next: Submit Folder</button>
              )
            )
          ) : isHodReview ? (
            // HOD: Show Submit Folder for pending folders (editable), Decision for review folders (submitted)
            status && new Set<string>(['SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD']).has(status) ? (
              <button onClick={() => navigate(`${basePath}/folder/${id}/decision`)} className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors">Next: Folder Decision</button>
            ) : (
              !readOnly && (
                <button onClick={() => navigate(`${basePath}/folder/${id}/submit`)} className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors">Next: Submit Folder</button>
              )
            )
          ) : isAuditMemberReview ? (
            // Audit-member flow: next should go to Course Feedback review form (route uses folders/:folderId/review)
            <button onClick={() => navigate(`${basePath}/folders/${id}/review`)} className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors">Next: Course Feedback</button>
          ) : (
            // For non-coordinator / non-audit-member pages: show the submit button if the current user can edit (not readOnly)
            // OR if this is a convener page showing a pending folder (convener should be able to move to submit)
            ((!readOnly) || (isConvenerReview && status && !new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']).has(status))) && (
              <button onClick={() => navigate(`${basePath}/folder/${id}/submit${isReviewContext ? '?review=1' : ''}`)} className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors">Next: Submit Folder</button>
            )
          )}
        </div>

        {isReviewContext && status && new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']).has(status) && (
          <div className="mt-6">
            <CoordinatorFeedbackBox folderId={id} section="CLO_ASSESSMENT" />
          </div>
        )}

        {isAuditMemberReview && status && submittedStatuses.has(status) && (
          <AuditMemberFeedbackBox folderId={id} section="CLO_ASSESSMENT" />
        )}

      </div>
    </DashboardLayout>
  );
};

export default FolderCloAssessment;
