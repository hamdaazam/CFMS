import React, { useEffect, useState } from 'react';
import { courseFoldersAPI } from '../../services/api';

interface Props {
    folderId: number;
    section: string; // e.g., 'COURSE_OUTLINE', 'COURSE_LOG', etc.
}

const AuditMemberFeedbackBox: React.FC<Props> = ({ folderId, section }) => {
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
                const existing = res.data?.audit_member_feedback || {};
                setNotes(existing?.[section] || '');
            })
            .catch(() => { })
            .finally(() => mounted && setLoading(false));
        return () => {
            mounted = false;
        };
    }, [folderId, section]);

    // Listen for feedback saved events from other instances to refresh
    useEffect(() => {
        const handleFeedbackSaved = (e: CustomEvent) => {
            const { folderId: savedFolderId, section: savedSection } = e.detail || {};
            // Refresh if it's the same folder and section
            if (savedFolderId === folderId && savedSection === section) {
                courseFoldersAPI
                    .getBasic(folderId)
                    .then((res) => {
                        const existing = res.data?.audit_member_feedback || {};
                        setNotes(existing?.[section] || '');
                    })
                    .catch(() => { });
            }
        };

        window.addEventListener('auditMemberFeedbackSaved', handleFeedbackSaved as EventListener);
        return () => {
            window.removeEventListener('auditMemberFeedbackSaved', handleFeedbackSaved as EventListener);
        };
    }, [folderId, section]);

    const handleSave = async () => {
        if (!notes.trim()) {
            // Allow empty to clear feedback
            // You can uncomment the line below if you want to prevent saving empty feedback
            // return;
        }
        setSaving(true);
        try {
            await courseFoldersAPI.saveAuditMemberFeedback(folderId, { section, notes: notes.trim() });
            // Reload feedback from server to ensure we have the latest data
            const res = await courseFoldersAPI.getBasic(folderId);
            const existing = res.data?.audit_member_feedback || {};
            setNotes(existing?.[section] || '');
            alert('Feedback saved.');
            // Notify others (e.g., sidebar) if needed
            window.dispatchEvent(new CustomEvent('auditMemberFeedbackSaved', { detail: { folderId, section } }));
        } catch (e: any) {
            console.error('Failed to save feedback', e);
            const errorMessage = e?.response?.data?.error || e?.message || 'Failed to save feedback';
            alert(`Failed to save feedback: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-6 border rounded-md border-blue-300 bg-blue-50">
            <div className="px-4 py-2 border-b border-blue-200 bg-blue-100 text-blue-900 font-medium text-sm">
                Audit Member Feedback for: <span className="font-bold">{section.includes('-') ? section : section.replace(/_/g, ' ').toUpperCase()}</span>
            </div>
            <div className="p-4">
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={loading}
                    placeholder="Write clear, actionable feedback that addresses quality, completeness, and compliance."
                    className="w-full min-h-[110px] border border-blue-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                />
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {saving ? 'Saving…' : 'Save Feedback'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuditMemberFeedbackBox;
