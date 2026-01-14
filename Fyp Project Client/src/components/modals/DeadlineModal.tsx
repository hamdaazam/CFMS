import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { folderDeadlinesAPI, termsAPI } from '../../services/api';

interface Deadline {
  id?: number;
  deadline_type: 'FIRST_SUBMISSION' | 'FINAL_SUBMISSION';
  term: number;
  department?: number;
  deadline_date: string;
  notes?: string;
  term_name?: string;
  department_name?: string;
  is_passed?: boolean;
  is_active?: boolean;
}

interface Term {
  id: number;
  session_term: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface DeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deadline?: Deadline | null;
  departmentId?: number;
}

export const DeadlineModal: React.FC<DeadlineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  deadline,
  departmentId,
}) => {
  const [deadlineType, setDeadlineType] = useState<'FIRST_SUBMISSION' | 'FINAL_SUBMISSION'>('FIRST_SUBMISSION');
  const [termId, setTermId] = useState<number | ''>('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTerms();
      if (deadline) {
        // Editing existing deadline
        setDeadlineType(deadline.deadline_type);
        setTermId(deadline.term);
        const dateTime = new Date(deadline.deadline_date);
        setDeadlineDate(dateTime.toISOString().split('T')[0]);
        setDeadlineTime(dateTime.toTimeString().slice(0, 5)); // HH:MM format
        setNotes(deadline.notes || '');
      } else {
        // Creating new deadline
        setDeadlineType('FIRST_SUBMISSION');
        setTermId('');
        setDeadlineDate('');
        setDeadlineTime('');
        setNotes('');
      }
      setError(null);
    }
  }, [isOpen, deadline]);

  const loadTerms = async () => {
    try {
      setLoading(true);
      const response = await termsAPI.getAll();
      const termsList = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      setTerms(termsList);
    } catch (err: any) {
      console.error('Failed to load terms:', err);
      setError('Failed to load terms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    if (!termId) {
      setError('Please select a term');
      setSaving(false);
      return;
    }

    if (!deadlineDate || !deadlineTime) {
      setError('Please provide both date and time');
      setSaving(false);
      return;
    }

    try {
      // Combine date and time into ISO datetime string
      const dateTimeString = `${deadlineDate}T${deadlineTime}:00`;
      const deadlineDateTime = new Date(dateTimeString).toISOString();

      const data: any = {
        deadline_type: deadlineType,
        term: termId,
        deadline_date: deadlineDateTime,
        notes: notes.trim() || undefined,
      };

      if (departmentId) {
        data.department = departmentId;
      }

      if (deadline?.id) {
        // Update existing deadline
        await folderDeadlinesAPI.update(deadline.id, data);
      } else {
        // Create new deadline
        await folderDeadlinesAPI.create(data);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save deadline:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to save deadline. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {deadline?.id ? 'Edit Deadline' : 'Set Submission Deadline'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={saving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Deadline Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline Type <span className="text-red-500">*</span>
              </label>
              <select
                value={deadlineType}
                onChange={(e) => setDeadlineType(e.target.value as 'FIRST_SUBMISSION' | 'FINAL_SUBMISSION')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={saving || !!deadline?.id}
              >
                <option value="FIRST_SUBMISSION">First Submission (After Midterm)</option>
                <option value="FINAL_SUBMISSION">Final Submission (After Final Term)</option>
              </select>
            </div>

            {/* Term */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Term <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                  Loading terms...
                </div>
              ) : (
                <select
                  value={termId}
                  onChange={(e) => setTermId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={saving}
                >
                  <option value="">Select a term</option>
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.session_term} {term.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={saving}
                min={new Date().toISOString().split('T')[0]} // Prevent past dates
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={saving}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Additional notes about the deadline..."
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? 'Saving...' : deadline?.id ? 'Update Deadline' : 'Set Deadline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

