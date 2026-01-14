import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { HeroBanner } from '../components/common/HeroBanner';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI, courseAllocationsAPI } from '../services/api';
import type { AxiosError } from 'axios';
import { Link } from 'react-router-dom';

interface FolderItem {
  id: number;
  course_details?: { code?: string; title?: string };
  faculty_name?: string;
  term_name?: string;
  department_name?: string;
  program_name?: string | null;
  status: string;
  submitted_at?: string | null;
  assigned_auditors?: Array<{ id: number; name: string; cnic: string }> | null;
}

const CoordinatorReview: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [actionNotes, setActionNotes] = useState<Record<number, string>>({});
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [returningId, setReturningId] = useState<number | null>(null);
  const [coordinatorAssignments, setCoordinatorAssignments] = useState<Array<{ course: number; term?: number | null }>>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Note: Backend now filters by CourseCoordinatorAssignment only, not by coordinator_reviewed_by
      // So we don't need to fetch assignments here - backend handles it
      
      // Don't filter by status - include SUBMITTED, APPROVED_COORDINATOR, and REJECTED_COORDINATOR folders
      // Backend will return folders coordinator can review or edit (where they are the reviewer)
      const params: Record<string, string | number> = { assigned_to_me: 1 };
      // Don't filter by program - coordinator assignments are course-based, not program-based
      const res = await courseFoldersAPI.getAll(params);
      const data = res.data as unknown;
      const hasResults = (x: unknown): x is { results: unknown } => typeof x === 'object' && x !== null && 'results' in x;
      let items: FolderItem[] = [];
      if (Array.isArray(data)) {
        items = data as FolderItem[];
      } else if (hasResults(data) && Array.isArray(data.results)) {
        items = data.results as FolderItem[];
      }
      
      // Filter folders to only show those where user is currently assigned as coordinator
      // AND exclude folders assigned for audit AND exclude folders with final HOD approval
      const coordinatorFolders = items.filter((folder) => {
        // Exclude folders with final HOD approval - these should only appear on dashboard, not in review
        if (folder.status === 'APPROVED_BY_HOD' || folder.status === 'REJECTED_BY_HOD') {
          return false;
        }
        // Exclude folders that are under audit
        if (folder.status === 'UNDER_AUDIT' || folder.status === 'AUDIT_COMPLETED') {
          return false;
        }
        // Exclude folders that have audit assignments (even if status hasn't changed yet)
        if (folder.assigned_auditors && folder.assigned_auditors.length > 0) {
          return false;
        }
        
        return true;
      });
      
      setFolders(coordinatorFolders);
    } catch (e) {
      const err = e as AxiosError<{ error?: string }>;
      setError(err.response?.data?.error || 'Failed to load submitted folders');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.program]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: number) => {
    try {
      setApprovingId(id);
      await courseFoldersAPI.coordinatorReview(id, { action: 'approve', notes: actionNotes[id] || '' });
      // Refresh to show updated status
      await load();
    } catch (e) {
      const err = e as AxiosError<{ error?: string }>;
      setError(err.response?.data?.error || 'Failed to approve folder');
    } finally {
      setApprovingId(null);
    }
  };

  const requestChanges = async (id: number) => {
    try {
      // Notes are optional now, but still show a warning if empty for rejections
      if (!actionNotes[id] || actionNotes[id].trim().length < 1) {
        const confirmed = window.confirm('You are about to return this folder without notes. Continue?');
        if (!confirmed) return;
      }
      setReturningId(id);
      await courseFoldersAPI.coordinatorReview(id, { action: 'reject', notes: actionNotes[id] || '' });
      // Refresh to show updated status
      await load();
    } catch (e) {
      const err = e as AxiosError<{ error?: string }>;
      setError(err.response?.data?.error || 'Failed to return folder');
    } finally {
      setReturningId(null);
    }
  };

  const layoutUserName = user?.full_name || 'Coordinator';
  const layoutUserAvatar = user?.profile_picture || undefined;
  
  // Determine user role for layout - allow HOD/Convener to use coordinator review
  const layoutRole = user?.role === 'HOD' ? 'hod' : user?.role === 'CONVENER' ? 'convener' : 'coordinator';

  return (
    <DashboardLayout userRole={layoutRole} userName={layoutUserName} userAvatar={layoutUserAvatar}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <HeroBanner
          title="Review Submitted Folders"
          subtitle="Approve complete folders or return with notes for changes."
          rounded
        />

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Awaiting Your Review</h2>
            <Button variant="secondary" onClick={load}>Refresh</Button>
          </div>

          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">{error}</div>}

          {loading ? (
            <div className="py-10 text-center text-gray-600">Loading…</div>
          ) : folders.length === 0 ? (
            <div className="py-10 text-center text-gray-600">No submitted folders found.</div>
          ) : (
            <div className="space-y-4">
              {folders.map((f) => (
                <div key={f.id} className="border rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="text-gray-900 font-medium">
                        {f.course_details?.code ? `${f.course_details.code} — ` : ''}{f.course_details?.title || 'Course'}
                      </div>
                      <div className="text-gray-600 text-sm">
                        Faculty: {f.faculty_name || 'Unknown'}
                      </div>
                      <div className="text-gray-500 text-xs">
                        Term: {f.term_name || 'N/A'} • Submitted: {f.submitted_at ? new Date(f.submitted_at).toLocaleString() : 'N/A'}
                      </div>
                      <div className="text-gray-500 text-xs">
                        Dept: {f.department_name || 'N/A'}{f.program_name ? ` • Program: ${f.program_name}` : ''}
                      </div>
                      {f.status && f.status !== 'SUBMITTED' && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            f.status === 'APPROVED_COORDINATOR' 
                              ? 'bg-green-100 text-green-800' 
                              : f.status === 'REJECTED_COORDINATOR'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {f.status === 'APPROVED_COORDINATOR' ? '✓ Approved' : f.status === 'REJECTED_COORDINATOR' ? '↩ Returned' : f.status}
                          </span>
                          <span className="text-gray-500 text-xs ml-2">(You can edit your decision)</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Use review-mode routes (read-only) so CONVENER/HOD acting as coordinator can access without hitting COORDINATOR-only /coordinator/folders/:id */}
                      <Link
                        to={`/coordinator/folder/${f.id}/title-page?review=1`}
                        className="inline-flex items-center rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 text-sm"
                      >
                        View Folder
                      </Link>
                      <Button 
                        variant="primary" 
                        onClick={() => approve(f.id)} 
                        disabled={approvingId === f.id || returningId === f.id}
                      >
                        {approvingId === f.id ? 'Approving…' : f.status === 'APPROVED_COORDINATOR' ? 'Re-approve' : 'Approve'}
                      </Button>
                      <Button 
                        variant="secondary" 
                        onClick={() => requestChanges(f.id)} 
                        disabled={returningId === f.id || approvingId === f.id}
                      >
                        {returningId === f.id ? 'Returning…' : f.status === 'REJECTED_COORDINATOR' ? 'Re-return' : 'Return with Notes'}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Input
                      label="Notes to faculty (for returns)"
                      placeholder="Brief reason or changes required"
                      value={actionNotes[f.id] || ''}
                      onChange={(e) => setActionNotes((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CoordinatorReview;