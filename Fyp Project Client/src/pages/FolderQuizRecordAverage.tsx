import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { useReviewMode } from '../hooks/useReviewMode';
import { canEditFolder } from '../utils/folderPermissions';
import { Upload, Trash2, FileText, Download } from 'lucide-react';

interface FileRecord {
  fileName: string;
  uploadDate: string;
  fileSize: number;
  fileData?: string;
}

const FolderQuizRecordAverage: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string; quizId?: string }>();
  const idParam = params.id ?? params.folderId;
  const quizId = params.quizId;
  const id = Number(idParam);
  const navigate = useNavigate();
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [uploadedFile, setUploadedFile] = useState<FileRecord | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [quizName, setQuizName] = useState<string>('Quiz');

  useEffect(() => {
    loadRecords();
  }, [id, quizId, isCoordinatorReview]);

  const loadRecords = async () => {
    if (!id || !quizId) return;

    try {
      setLoading(true);
      const response = await courseFoldersAPI.getBasic(id);
      const s = (response.data?.status || '').toUpperCase();
      setStatus(s);
      const firstActivityCompleted = response.data?.first_activity_completed || false;
      const canEditForFinalSubmission = response.data?.can_edit_for_final_submission || false;
      // Use utility function to determine if folder can be edited
      const canEdit = canEditFolder(s, firstActivityCompleted, canEditForFinalSubmission, isAuditMemberReview, isConvenerReview, isHodReview);
      setReadOnly(!canEdit);
      const outlineContent = response.data.outline_content || {};
      
      // Load quiz name from quizzes array
      const quizzes = outlineContent.quizzes || [];
      const currentQuiz = quizzes.find((q: any) => q.id === quizId);
      if (currentQuiz) {
        setQuizName(currentQuiz.name);
      }
      
      const quizRecords = outlineContent.quizRecords || {};
      const records = quizRecords[quizId] || {};

      setUploadedFile(records.average || null);
    } catch (err) {
      console.error('Error loading records:', err);
      setError('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (file && file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !id || !quizId) return;

    try {
      setSaving(true);
      setError(null);

      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const response = await courseFoldersAPI.getBasic(id);
      const outlineContent = response.data.outline_content || {};
      const quizRecords = outlineContent.quizRecords || {};
      const records = quizRecords[quizId] || {};

      const fileRecord: FileRecord = {
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString(),
        fileSize: selectedFile.size,
        fileData: fileData
      };

      records.average = fileRecord;
      quizRecords[quizId] = records;
      outlineContent.quizRecords = quizRecords;

      await courseFoldersAPI.saveOutline(id, { outline_content: outlineContent });

      setUploadedFile(fileRecord);
      setSelectedFile(null);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !quizId) return;

    try {
      setSaving(true);
      setError(null);

      const response = await courseFoldersAPI.getBasic(id);
      const outlineContent = response.data.outline_content || {};
      const quizRecords = outlineContent.quizRecords || {};
      const records = quizRecords[quizId] || {};

      delete records.average;
      quizRecords[quizId] = records;
      outlineContent.quizRecords = quizRecords;

      await courseFoldersAPI.saveOutline(id, { outline_content: outlineContent });

      setUploadedFile(null);
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Failed to delete file');
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (readOnly) return;
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    if (!uploadedFile) return;
    if (uploadedFile.fileData) {
      const byteCharacters = atob(uploadedFile.fileData.split(',')[1] || uploadedFile.fileData);
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F4F7FE] p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{quizName} - Average Student Record</h1>
            <p className="text-gray-600">Upload PDF record for average performing student</p>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-12 transition-all ${uploadedFile
              ? 'border-blue-400 bg-blue-50'
              : isDragging
                ? 'border-blue-500 bg-blue-100'
                : 'border-gray-300 bg-white'
              }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {uploadedFile ? (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">File Uploaded Successfully</h3>
                <p className="text-sm font-medium text-gray-700 mb-1">{uploadedFile.fileName}</p>
                <p className="text-xs text-gray-500 mb-6">
                  Uploaded on {new Date(uploadedFile.uploadDate).toLocaleDateString()} •
                  {(uploadedFile.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-medium transition-colors"
                  >
                    <Download size={18} />
                    Download File
                  </button>
                  {!readOnly && (
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:bg-gray-400 font-medium transition-colors"
                    >
                      <Trash2 size={18} />
                      Delete File
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2 text-center">
                  {isDragging ? 'Drop your file here' : 'Upload Average Student Record'}
                </h3>
                <p className="text-sm text-gray-600 mb-6 text-center">
                  Drag and drop your PDF file here or click to browse
                </p>

                {selectedFile && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-800 text-center">
                      Selected: {selectedFile.name}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-4">
                  {!readOnly && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <div className="px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 text-sm font-medium transition-colors">
                        Browse Files
                      </div>
                    </label>
                  )}
                  {selectedFile && !readOnly && (
                    <button
                      onClick={handleUpload}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-8 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:bg-gray-400 text-sm font-medium transition-colors"
                    >
                      <Upload size={18} />
                      {saving ? 'Uploading...' : 'Upload File'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex justify-between items-center">
            <button
              onClick={() => navigate(`${basePath}/folder/${id}/quizzes/${quizId}/records/best${isReviewContext ? '?review=1' : ''}`)}
              className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 font-medium transition-colors"
            >
              Previous: Best Record
            </button>
            <button
              onClick={() => navigate(`${basePath}/folder/${id}/quizzes/${quizId}/records/worst${isReviewContext ? '?review=1' : ''}`)}
              className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors"
            >
              Next: Worst Record
            </button>
          </div>
        </div>
      </div>
      {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && <CoordinatorFeedbackBox folderId={id!} section={`QUIZ_${quizId}_AVERAGE`} />}

      {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && <AuditMemberFeedbackBox folderId={id!} section={`${quizName} - Average Record`} />}
    </DashboardLayout>
  );
};

export default FolderQuizRecordAverage;
