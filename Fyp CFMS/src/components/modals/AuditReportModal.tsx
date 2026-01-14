import { useState } from 'react';
import { courseFoldersAPI } from '../../services/api';

interface AuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number;
  folderName: string;
  onSuccess: () => void;
}

export const AuditReportModal = ({
  isOpen,
  onClose,
  folderId,
  folderName,
  onSuccess,
}: AuditReportModalProps) => {
  const [remarks, setRemarks] = useState('');
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }
      setFeedbackFile(file);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!remarks.trim()) {
      setError('Remarks are required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('remarks', remarks);
      if (feedbackFile) {
        formData.append('feedback_file', feedbackFile);
      }

      await courseFoldersAPI.submitAuditReport(folderId, formData);
      alert('Audit report submitted successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit audit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Submit Audit Report</h2>
        
        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            <strong>Folder:</strong> {folderName}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Audit Remarks <span className="text-red-500">*</span>
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            rows={5}
            placeholder="Enter your audit findings and remarks..."
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Feedback File (Optional PDF)
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
          {feedbackFile && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {feedbackFile.name}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
          
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
