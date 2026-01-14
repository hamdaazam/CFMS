import { useState, useEffect } from 'react';
import { courseFoldersAPI } from '../../services/api';

interface ConvenerReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number;
  folderName: string;
  onSuccess: () => void;
}

export const ConvenerReviewModal = ({
  isOpen,
  onClose,
  folderId,
  folderName,
  onSuccess,
}: ConvenerReviewModalProps) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load folder data when modal opens to get current status and notes
  useEffect(() => {
    if (isOpen && folderId) {
      setLoading(true);
      courseFoldersAPI.getById(folderId)
        .then((res) => {
          const folder = res.data;
          setCurrentStatus(folder.status || '');
          // Pre-fill notes with existing convener notes if available
          if (folder.convener_notes) {
            setNotes(folder.convener_notes);
          }
        })
        .catch((err) => {
          console.error('Error loading folder:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // Reset when modal closes
      setNotes('');
      setCurrentStatus('');
      setError('');
    }
  }, [isOpen, folderId]);

  if (!isOpen) return null;

  const handleAction = async (action: 'forward_to_hod' | 'reject') => {
    if (action === 'reject' && !notes.trim()) {
      setError('Remarks are required when rejecting a folder');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await courseFoldersAPI.convenerReview(folderId, { action, notes });
      const isChangingDecision = currentStatus === 'SUBMITTED_TO_HOD' || currentStatus === 'REJECTED_BY_CONVENER';
      const actionText = action === 'forward_to_hod' ? 'forwarded to HOD' : 'rejected';
      alert(
        isChangingDecision
          ? `Decision changed successfully! Folder has been ${actionText}.`
          : `Folder ${actionText} successfully!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusDisplay = () => {
    if (currentStatus === 'SUBMITTED_TO_HOD') {
      return <span className="text-green-700 font-semibold">Currently: Forwarded to HOD</span>;
    } else if (currentStatus === 'REJECTED_BY_CONVENER') {
      return <span className="text-red-700 font-semibold">Currently: Rejected</span>;
    } else if (currentStatus === 'AUDIT_COMPLETED') {
      return <span className="text-blue-700 font-semibold">Currently: Awaiting Review</span>;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">
          {currentStatus === 'SUBMITTED_TO_HOD' || currentStatus === 'REJECTED_BY_CONVENER' 
            ? 'Change Decision' 
            : 'Review Audit Report'}
        </h2>
        
        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            <strong>Folder:</strong> {folderName}
          </p>
          {getStatusDisplay() && (
            <p className="text-sm mb-2">
              {getStatusDisplay()}
            </p>
          )}
          <p className="text-sm text-gray-600">
            {currentStatus === 'SUBMITTED_TO_HOD' || currentStatus === 'REJECTED_BY_CONVENER'
              ? 'You can change your decision below. This will update the folder status accordingly.'
              : 'Review the audit reports and decide whether to forward to HOD or reject'}
          </p>
        </div>

        {loading && (
          <div className="mb-4 text-center text-gray-600">
            Loading folder details...
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes / Remarks
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Enter your notes here..."
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleAction('forward_to_hod')}
            disabled={isSubmitting || loading}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : '→ Forward to HOD'}
          </button>
          
          <button
            onClick={() => handleAction('reject')}
            disabled={isSubmitting || loading}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : '✗ Reject'}
          </button>
          
          <button
            onClick={onClose}
            disabled={isSubmitting || loading}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
