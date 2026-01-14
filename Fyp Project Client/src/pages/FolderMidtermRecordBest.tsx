import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import { useReviewMode } from '../hooks/useReviewMode';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';

interface FileRecord {
  fileName: string;
  uploadDate: string;
  fileSize: number;
  fileData?: string; // base64 encoded file data
}

const FolderMidtermRecordBest: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const idParam = params.id ?? params.folderId;
  const id = Number(idParam);
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState<FileRecord | null>(null);
  const [data, setData] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>([
    'SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED',
    'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED'
  ]);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    loadRecords();
  }, [id]);

  const loadRecords = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await courseFoldersAPI.getBasic(id);
      const outlineContent = response.data.outline_content || {};
      setData(response.data);
      const s = (response.data?.status || '').toUpperCase();
      const editableStatuses = new Set<string>(['DRAFT', 'REJECTED_COORDINATOR', 'REJECTED_BY_CONVENER', 'REJECTED_BY_HOD']);
      setReadOnly(submittedStatuses.has(s) || isAuditMemberReview || (isConvenerReview && !editableStatuses.has(s)) || (isHodReview && !editableStatuses.has(s)));
      const midtermRecords = outlineContent.midtermRecords || {};

      setUploadedFile(midtermRecords.best || null);
    } catch (err) {
      console.error('Error loading record:', err);
      setError('Failed to load record');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (readOnly) return;
    if (file && file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !id) return;

    try {
      setSaving(true);
      setError(null);

      // Convert file to base64
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert file to base64'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      if (!fileData) {
        throw new Error('File data is empty');
      }

      const response = await courseFoldersAPI.getBasic(id);
      const outlineContent = response.data.outline_content || {};
      const midtermRecords = outlineContent.midtermRecords || {};

      const fileRecord: FileRecord = {
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString(),
        fileSize: selectedFile.size,
        fileData: fileData // Store base64 data
      };

      midtermRecords.best = fileRecord;

      // Use section update to minimize payload and potential conflicts
      await courseFoldersAPI.saveOutline(id, {
        outline_content: midtermRecords,
        section: 'midtermRecords'
      });

      // Update local state
      outlineContent.midtermRecords = midtermRecords;
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
    if (readOnly) return;
    if (!id) return;

    try {
      setSaving(true);
      setError(null);

      const response = await courseFoldersAPI.getBasic(id);
      const outlineContent = response.data.outline_content || {};
      const midtermRecords = outlineContent.midtermRecords || {};

      delete midtermRecords.best;
      outlineContent.midtermRecords = midtermRecords;

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
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
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

  const idForNav = isNaN(id) ? (data?.id ?? id) : id;

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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Best Student Record</h1>
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
                      className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:bg-gray-400 font-medium transition-colors"
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
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      className="hidden"
                      disabled={readOnly}
                    />
                    <div className="px-8 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 text-sm font-medium transition-colors">
                      Browse Files
                    </div>
                  </label>
                  {selectedFile && (
                    <button
                      onClick={handleUpload}
                      disabled={saving || readOnly}
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
              onClick={() => navigate(`${basePath}/folder/${idForNav}/midterm/model-solution${isReviewContext ? '?review=1' : ''}`)}
              className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 font-medium transition-colors"
            >
              Previous: Model Solution
            </button>
            <button
              onClick={() => navigate(`${basePath}/folder/${idForNav}/midterm/records/average${isReviewContext ? '?review=1' : ''}`)}
              className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors"
            >
              Next: Average Record
            </button>
          </div>

          {isCoordinatorReview && submittedStatuses.has((data?.status || '').toUpperCase()) && isReviewContext && (
            <div className="mt-6">
              <CoordinatorFeedbackBox folderId={id} section="MIDTERM_RECORDS_BEST" />
            </div>
          )}

          {isAuditMemberReview && submittedStatuses.has((data?.status || '').toUpperCase()) && (
            <div className="mt-6">
              <AuditMemberFeedbackBox folderId={id} section="MIDTERM_RECORDS_BEST" />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FolderMidtermRecordBest;
