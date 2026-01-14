import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { Upload, Trash2, Download } from 'lucide-react';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { useReviewMode } from '../hooks/useReviewMode';
import { canEditFolder } from '../utils/folderPermissions';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

interface FolderDetail {
  id: number;
  section: string;
  status?: string;
  course_title?: string;
  course_code?: string;
  instructor_name?: string;
  semester?: string;
  outline_content?: OutlineContent;
}

interface LectureNoteFile {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

interface OutlineContent {
  lectureNotesFile?: LectureNoteFile;
}

const FolderLectureNotes: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;
  const navigate = useNavigate();
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>([
    'SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED'
  ]);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [data, setData] = useState<FolderDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<LectureNoteFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

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
        // Load saved lecture notes file from backend if exists
        if (res.data.outline_content?.lectureNotesFile) {
          setUploadedFile(res.data.outline_content.lectureNotesFile);
        }
      })
      .catch(() => {
        if (mounted) {
          setData(null);
        }
      });
    return () => { mounted = false; };
  }, [id, isCoordinatorReview]);

  const courseTitle = data?.course_title || '—';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!readOnly) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (readOnly) return;

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      setSelectedFile(files[0]);
    } else {
      alert('Please upload a PDF file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;

    const files = e.target.files;
    if (files && files.length > 0) {
      if (files[0].type === 'application/pdf') {
        setSelectedFile(files[0]);
      } else {
        alert('Please upload a PDF file');
      }
    }
  };

  const handleUpload = async () => {
    if (readOnly || !selectedFile) {
      if (!selectedFile) alert('Please select a file first');
      return;
    }

    setSaving(true);
    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const fileData: LectureNoteFile = {
        id: Date.now().toString(),
        fileName: selectedFile.name,
        fileUrl: base64Data, // Store base64 data
        uploadedAt: new Date().toISOString()
      };

      const existingContent = data?.outline_content || {};
      const outlineContent = {
        ...existingContent,
        lectureNotesFile: fileData,
      };

      await courseFoldersAPI.saveOutline(id, { outline_content: outlineContent });
      
      // Reload data from server to ensure it's persisted
      const freshData = await courseFoldersAPI.getBasic(id);
      if (freshData?.data) {
        setData(freshData.data);
        if (freshData.data.outline_content?.lectureNotesFile) {
          setUploadedFile(freshData.data.outline_content.lectureNotesFile);
        } else {
          setUploadedFile(fileData); // Fallback to local data if server doesn't return it yet
        }
      } else {
        setUploadedFile(fileData);
      }
      
      setSelectedFile(null);
      alert('Lecture notes uploaded successfully!');
    } catch (error) {
      console.error('Error uploading lecture notes:', error);
      alert('Failed to upload lecture notes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (readOnly) return;

    if (!confirm('Are you sure you want to delete these lecture notes?')) {
      return;
    }

    setSaving(true);
    try {
      const existingContent = data?.outline_content || {};
      const outlineContent = {
        ...existingContent,
        lectureNotesFile: null,
      };

      await courseFoldersAPI.saveOutline(id, { outline_content: outlineContent });
      
      // Reload data from server to ensure it's persisted
      const freshData = await courseFoldersAPI.getBasic(id);
      if (freshData?.data) {
        setData(freshData.data);
        setUploadedFile(null);
      } else {
        setUploadedFile(null);
      }
      
      setSelectedFile(null);
      alert('Lecture notes deleted successfully!');
    } catch (error) {
      console.error('Error deleting lecture notes:', error);
      alert('Failed to delete lecture notes');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!uploadedFile) return;
    if (uploadedFile.fileUrl && uploadedFile.fileUrl.startsWith('data:')) {
      // It's base64 data
      const byteCharacters = atob(uploadedFile.fileUrl.split(',')[1] || uploadedFile.fileUrl);
      const byteArrays = [];
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays.push(byteCharacters.charCodeAt(i));
      }
      const blob = new Blob([new Uint8Array(byteArrays)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = uploadedFile.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      alert('File data not available. Please re-upload the file.');
    }
  };

  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <FolderContentsNav basePath={basePath} folderId={idForNav} />
        </div>
        {/* Course chip */}
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium mb-4">
          {courseTitle}
        </div>

        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-6">Upload Lecture Notes</h2>

        <div className="max-w-2xl">
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 mb-4 transition-colors ${isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : uploadedFile
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 bg-gray-50'
              }`}
          >
            <div className="text-center">
              {uploadedFile ? (
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">File Uploaded</p>
                  <p className="text-xs text-gray-600">{uploadedFile.fileName}</p>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-base font-medium text-gray-700 mb-1">
                    Drag & Drop your lecture notes PDF here
                  </p>
                  <p className="text-sm text-gray-500 mb-3">Supported formats: PDF</p>
                </div>
              )}

              {selectedFile && !uploadedFile && (
                <p className="text-sm text-indigo-600 mb-3">
                  Selected: {selectedFile.name}
                </p>
              )}

              <div className="flex items-center justify-center gap-3">
                <label className={readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    disabled={readOnly}
                    className="hidden"
                  />
                  <div className="px-6 py-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors text-sm font-medium">
                    Browse
                  </div>
                </label>

                {(selectedFile || uploadedFile) && (
                  <button
                    onClick={selectedFile ? handleUpload : () => { }}
                    disabled={saving || (!selectedFile && !!uploadedFile) || readOnly}
                    className={`px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${selectedFile && !readOnly
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    <Upload className="w-4 h-4 inline mr-1" />
                    {saving ? 'Uploading...' : readOnly ? 'Read-only' : 'Upload'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Download and Delete Buttons */}
          {uploadedFile && (
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Download size={18} />
                Download
              </button>
              {!readOnly && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/attendance${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-coral text-white hover:bg-coral/90 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/assignments/task${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-indigo-900 text-white hover:bg-indigo-800 transition-colors"
          >
            Next
          </button>
        </div>

        {isCoordinatorReview && submittedStatuses.has((status || '').toUpperCase()) && isReviewContext && (
          <CoordinatorFeedbackBox folderId={id} section="LECTURE_NOTES" />
        )}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && (
          <AuditMemberFeedbackBox folderId={id} section="LECTURE_NOTES" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FolderLectureNotes;
