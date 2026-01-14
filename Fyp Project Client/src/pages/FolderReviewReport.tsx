import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import { useReviewMode } from '../hooks/useReviewMode';
import { canEditFolder } from '../utils/folderPermissions';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { FolderContentsNav } from '../components/common/FolderContentsNav';

interface FileRecord {
    fileName: string;
    uploadDate: string;
    fileSize: number;
}

const FolderReviewReport: React.FC = () => {
    const params = useParams<{ id?: string; folderId?: string }>();
    const idParam = params.id ?? params.folderId;
    const id = Number(idParam);
    const navigate = useNavigate();
    const { basePath, isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview } = useReviewMode();
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

    useEffect(() => {
        loadRecord();
    }, [id]);

    const loadRecord = async () => {
        if (!id) return;

        try {
            setLoading(true);
            const response = await courseFoldersAPI.getBasic(id);
            const outlineContent = response.data.outline_content || {};
            const s = (response.data?.status || '').toUpperCase();
            setStatus(s);
            const firstActivityCompleted = response.data?.first_activity_completed || false;
            const canEditForFinalSubmission = response.data?.can_edit_for_final_submission || false;
            // Use utility function to determine if folder can be edited
            const canEdit = canEditFolder(s, firstActivityCompleted, canEditForFinalSubmission, isAuditMemberReview, isConvenerReview, isHodReview);
            setReadOnly(!canEdit);

            setUploadedFile(outlineContent.folderReviewReport || null);
        } catch (err) {
            console.error('Error loading folder review report:', err);
            setError('Failed to load folder review report');
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
        if (readOnly) return;
        if (!selectedFile || !id) return;

        try {
            setSaving(true);
            setError(null);

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('file', selectedFile);

            // Upload file to backend
            await courseFoldersAPI.uploadFolderReviewReport(id, formData);

            // Reload folder data to get updated file info
            await loadRecord();

            setSelectedFile(null);
        } catch (err: any) {
            console.error('Error uploading file:', err);
            setError(err.response?.data?.error || 'Failed to upload file');
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
            await courseFoldersAPI.deleteFolderReviewReport(id);

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

        try {
            const response = await courseFoldersAPI.downloadFolderReviewReport(id);

            // Create a blob URL and trigger download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', uploadedFile.fileName || 'folder_review_report.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading file:', err);
            setError('Failed to download file');
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
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Course Review Report</h1>
                    <p className="text-gray-600 mt-1">Upload the course review report document</p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
                        {error}
                    </div>
                )}

                {/* Upload Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload Course Review Report</h2>

                    {!uploadedFile ? (
                        <div>
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 mb-2">
                                    Drag and drop your PDF file here, or click to browse
                                </p>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                                    className="hidden"
                                    id="file-upload"
                                    disabled={readOnly}
                                />
                                <label htmlFor="file-upload" className={`inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>Choose File

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
                                        <button
                                            onClick={() => setSelectedFile(null)}
                                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleUpload}
                                            disabled={saving}
                                            className="px-4 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {saving ? 'Uploading...' : 'Upload'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start">
                                    <FileText className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-gray-800">{uploadedFile.fileName}</p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Uploaded on {formatDate(uploadedFile.uploadDate)}
                                        </p>
                                        <p className="text-xs text-gray-500">{formatFileSize(uploadedFile.fileSize)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {readOnly && (
                                        <button
                                            onClick={handleDownload}
                                            className="text-indigo-600 hover:text-indigo-700 p-2"
                                            title="Download file"
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

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Instructions</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Upload the course review report document</li>
                        <li>Only PDF format is accepted</li>
                        <li>Maximum file size is 20MB</li>
                        <li>You can replace the file by uploading a new one</li>
                    </ul>
                </div>

                {/* Navigation */}
                <div className="mt-8 flex justify-between items-center">
                    <button
                        onClick={() => navigate(`${basePath}/folder/${id}/course-result${isReviewContext ? '?review=1' : ''}`)}
                        className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 font-medium transition-colors"
                    >
                        Previous: Course Result
                    </button>

                    <button
                        onClick={() => navigate(`${basePath}/folder/${id}/clo-assessment${isReviewContext ? '?review=1' : ''}`)}
                        className="px-6 py-3 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 font-medium transition-colors disabled:opacity-50"
                    >
                        Next: CLO Assessment
                    </button>
                </div>
                {isReviewContext && status && new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']).has(status) && (
                    <div className="mt-6">
                        <CoordinatorFeedbackBox folderId={id} section="FOLDER_REVIEW_REPORT" />
                    </div>
                )}

                {isAuditMemberReview && status && new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']).has(status) && (
                    <div className="mt-6">
                        <AuditMemberFeedbackBox folderId={id} section="FOLDER_REVIEW_REPORT" />
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default FolderReviewReport;
