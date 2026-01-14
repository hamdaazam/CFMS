import React, { useEffect, useState } from 'react';
import { courseFoldersAPI } from '../../services/api';

interface Props {
  folderId: number;
  section: string; // e.g., 'COURSE_OUTLINE', 'COURSE_LOG', etc.
}

const CoordinatorFeedbackBox: React.FC<Props> = ({ folderId, section }) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    courseFoldersAPI
      .getBasic(folderId)
      .then((res) => {
        if (!mounted) return;
        const existing = res.data?.coordinator_feedback || {};
        setNotes(existing?.[section] || '');
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [folderId, section]);

  const handleSave = async () => {
    if (!notes.trim()) {
      // Allow empty to clear? For now, require some text
      // If clearing is needed later, relax this guard.
    }
    setSaving(true);
    try {
      await courseFoldersAPI.saveCoordinatorFeedback(folderId, { section, notes });
      // Reload feedback to ensure we have the latest from server
      const res = await courseFoldersAPI.getBasic(folderId);
      const existing = res.data?.coordinator_feedback || {};
      setNotes(existing?.[section] || '');
      alert('Feedback saved.');
      // Notify others (e.g., sidebar) if needed
      window.dispatchEvent(new CustomEvent('coordinatorFeedbackSaved', { detail: { folderId, section } }));
    } catch (e: any) {
      console.error('Failed to save feedback', e);
      const errorMessage = e?.response?.data?.error || e?.response?.data?.detail || e?.message || 'Failed to save feedback';
      alert(`Failed to save feedback: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 border rounded-md border-amber-300 bg-amber-50">
      <div className="px-4 py-2 border-b border-amber-200 bg-amber-100 text-amber-900 font-medium text-sm">
        Coordinator Feedback for this section
      </div>
      <div className="p-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
          placeholder="Write clear, actionable feedback that the faculty member can act upon."
          className="w-full min-h-[110px] border border-amber-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving…' : 'Save Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorFeedbackBox;
