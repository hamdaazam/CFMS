import { useState } from 'react';
import { courseFoldersAPI } from '../../services/api';

interface HODDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number;
  folderName: string;
  onSuccess: () => void;
}

export const HODDecisionModal = ({
  isOpen,
  onClose,
  folderId,
  folderName,
  onSuccess,
}: HODDecisionModalProps) => {
  const [notes, setNotes] = useState('');
  const [finalFeedback, setFinalFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDecision = async (decision: 'approve' | 'reject') => {
    // Notes are now optional for both approve and reject
    setIsSubmitting(true);
    setError('');

    try {
      await courseFoldersAPI.hodFinalDecision(folderId, { decision, notes, final_feedback: finalFeedback });
      alert(
        decision === 'approve'
          ? 'Folder approved successfully (Final)!'
          : 'Folder rejected successfully!'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">HOD Final Decision</h2>
        
        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            <strong>Folder:</strong> {folderName}
          </p>
          <p className="text-sm text-gray-600">
            Make your final decision on this course folder
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Decision Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Enter your decision notes (optional)..."
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Final Feedback (Optional)
          </label>
          <textarea
            value={finalFeedback}
            onChange={(e) => setFinalFeedback(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Enter your final feedback for the faculty member..."
          />
          <p className="text-xs text-gray-500 mt-1">
            This feedback will be visible to the faculty member.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleDecision('approve')}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {isSubmitting ? 'Processing...' : '✓ APPROVE (Final)'}
          </button>
          
          <button
            onClick={() => handleDecision('reject')}
            disabled={isSubmitting}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
          >
            {isSubmitting ? 'Processing...' : '✗ REJECT'}
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
