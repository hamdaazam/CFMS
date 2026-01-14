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
  fileData?: string; // base64 encoded file data
}

const FolderAssignmentRecordBest: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string; assignmentId?: string }>();
  const idParam = params.id ?? params.folderId;
  const assignmentId = params.assignmentId;
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
  const [assignmentName, setAssignmentName] = useState<string>('Assignment');

  useEffect(() => {
    loadRecords();
  }, [id, assignmentId, isCoordinatorReview]);

  const loadRecords = async () => {
    if (!id || !assignmentId) return;

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
      
      // Load assignment name from assignments array
      const assignments = outlineContent.assignments || [];
      const currentAssignment = assignments.find((a: any) => a.id === assignmentId);
      if (currentAssignment) {
        setAssignmentName(currentAssignment.name);
      }
      
      const assignmentRecords = outlineContent.assignmentRecords || {};
      const records = assignmentRecords[assignmentId] || {};

      setUploadedFile(records.best || null);
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
    if (!selectedFile || !id || !assignmentId) return;

    try {
      setSaving(true);
      setError(null);

      // Convert file to base64
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const response = await courseFoldersAPI.getBasic(id);
      const outlineContent = response.data.outline_content || {};
      const assignmentRecords = outlineContent.assignmentRecords || {};
      const records = assignmentRecords[assignmentId] || {};

      const fileRecord: FileRecord = {
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString(),
        fileSize: selectedFile.size,
        fileData: fileData // Store base64 data
      };

      records.best = fileRecord;
      assignmentRecords[assignmentId] = records;
      outlineContent.assignmentRecords = assignmentRecords;

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
    if (!id || !assignmentId) return;

    try {
      setSaving(true);
      setError(null);

      const response = await courseFoldersAPI.getBasic(id);
      const outlineContent = response.data.outline_content || {};
      const assignmentRecords = outlineContent.assignmentRecords || {};
      const records = assignmentRecords[assignmentId] || {};

      delete records.best;
      assignmentRecords[assignmentId] = records;
      outlineContent.assignmentRecords = assignmentRecords;

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
    // Check if we have a fileData (base64) stored
    if (uploadedFile.fileData) {
      // Convert base64 to blob and download
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
    const loadingRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';
    return (
      <DashboardLayout userRole={loadingRole}>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';
  return (
    <DashboardLayout userRole={userRole}>
      <div className="min-h-screen bg-[#F4F7FE] p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{assignmentName} - Best Student Record</h1>
            <p className="text-gray-600">Upload PDF record for best performing student</p>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-12 transition-all ${uploadedFile
              ? 'border-green-400 bg-green-50'
              : isDragging
                ? 'border-green-500 bg-green-100'
                : 'border-gray-300 bg-white'
              }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {uploadedFile ? (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-10 h-10 text-green-600" />
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
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 font-medium transition-colors"
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
                <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2 text-center">
                  {isDragging ? 'Drop your file here' : 'Upload Best Student Record'}
                </h3>
                <p className="text-sm text-gray-600 mb-6 text-center">
                  Drag and drop your PDF file here or click to browse
                </p>

                {selectedFile && (
                  <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-medium text-green-800 text-center">
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
                      <div className="px-8 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 text-sm font-medium transition-colors">
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
          <div className="mt-8 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
            <div className="flex gap-4">
              <button
                onClick={() => navigate(`${basePath}/folder/${id}/assignments/${assignmentId}/records${isReviewContext ? '?review=1' : ''}`)}
                className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 font-medium transition-colors"
              >
                Back to Record Overview
              </button>
            </div>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => navigate(`${basePath}/folder/${id}/assignments/${assignmentId}/records/average${isReviewContext ? '?review=1' : ''}`)}
                className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors"
              >
                Next: Average Record
              </button>
            </div>
          </div>
        </div>
      </div>
      {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && <CoordinatorFeedbackBox folderId={id!} section={`ASSIGNMENT_${assignmentId}_BEST`} />}

      {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && <AuditMemberFeedbackBox folderId={id!} section={`${assignmentName} - Best Record`} />}
    </DashboardLayout>
  );
};

export default FolderAssignmentRecordBest;
