import { useState } from 'react';
import { courseFoldersAPI } from '../../services/api';

interface CoordinatorReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number;
  folderName: string;
  onSuccess: () => void;
}

export const CoordinatorReviewModal = ({
  isOpen,
  onClose,
  folderId,
  folderName,
  onSuccess,
}: CoordinatorReviewModalProps) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !notes.trim()) {
      setError('Remarks are required when rejecting a folder');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await courseFoldersAPI.coordinatorReview(folderId, { action, notes });
      alert(`Folder ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Review Course Folder</h2>
        
        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            <strong>Folder:</strong> {folderName}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Remarks / Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Enter your remarks here..."
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleAction('approve')}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : '✓ Approve'}
          </button>
          
          <button
            onClick={() => handleAction('reject')}
            disabled={isSubmitting}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : '✗ Reject'}
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
